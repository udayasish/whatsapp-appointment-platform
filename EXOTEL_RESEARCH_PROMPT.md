# Comprehensive Technical Investigation: Dynamic IVR Integration with Exotel Trial Accounts

## 1. Project Context & What We Have Built
We are building a production-grade, multi-tenant automated voice appointment booking IVR system on top of a medical clinic SaaS platform.

### Tech Stack:
- **Runtime:** Node.js (v24), TypeScript (ESM)
- **Framework:** Express.js 5
- **Database:** PostgreSQL (Neon Cloud) with Drizzle ORM
- **Concurrency Protection:** PostgreSQL Session-Level Advisory Locks on `(doctorId, slotTime)`
- **Cache & Session Management:** Redis (BullMQ connection pool)
- **Tunnel for Local Webhook Testing:** Ngrok (`https://...ngrok-free.dev`)

### Backend IVR State Machine:
We built a stateful IVR flow that tracks calls in Redis keyed by `ivr:session:{CallSid}` with a 600-second TTL:
1. **`welcome`**: Greets caller with clinic name, prompts `Press 1 to book, 0 to exit`.
2. **`select_doctor`**: Dynamically queries active doctors from PostgreSQL for that clinic, reads doctor names and specialties (`Press 1 for Dr. A, 2 for Dr. B...`).
3. **`select_date`**: Queries available calendar days for the selected doctor (`Press 1 for Today, 2 for Tomorrow...`).
4. **`select_slot`**: Queries open appointment slots (`Press 1 for 10:00 AM, 2 for 11:30 AM...`).
5. **`confirm`**: Reads back the doctor, date, and time, prompts `Press 1 to confirm`.
   - Upon pressing `1`, executes a PostgreSQL transaction with an advisory lock, creates or resolves the patient, inserts the appointment record, generates a token number, enqueues BullMQ WhatsApp reminders, and sends an SMS.

---

## 2. Implementations Built on the Backend

We built **two** parallel protocols to interface with Exotel:

### Implementation A: Pure Voice XML (ExoML)
- **Endpoints:**
  - `ALL /api/ivr/incoming`: Resolves tenant by dialed Exophone number (`To`), initializes session, and returns:
    ```xml
    <?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Gather action="https://...ngrok-free.dev/api/ivr/step" method="POST" numDigits="1" timeout="10">
        <Say>Namaste! Welcome to Demo Clinic. Press 1 to book an appointment. Press 0 to exit.</Say>
      </Gather>
      <Say>We did not receive your input. Goodbye.</Say>
      <Hangup/>
    </Response>
    ```
  - `ALL /api/ivr/step`: Receives `Digits`, updates Redis session state, and returns the next dynamic `<Gather><Say>...</Say></Gather>`.

### Implementation B: Exotel Flow Builder Dynamic Gather JSON
- **Endpoint:** `ALL /api/ivr/prompt`
- Specifically written to comply with Exotel's Gather Applet *"Configure parameters dynamically by providing a URL"* specification:
  ```json
  {
    "gather_prompt": {
      "text": "Please select a doctor. Press 1 for Doctor Bora. Press star to exit."
    },
    "max_input_digits": 1,
    "input_timeout": 10
  }
  ```
  Returns `Content-Type: application/json` with HTTP `200 OK`.

---

## 3. Exotel Sandbox / Trial Account Constraints Encountered

1. **Virtual Number Binding:**
   - We are using an Exotel Trial Account (Account SID: `dococt1`, Trial Number: `09513886363`, Account PIN: `7002-0595-44`).
   - The trial number is permanently bound to a default visual flow called `dococt1 Landing Flow` (App ID: `1341744`).
   - When attempting to reassign the trial number to a new custom ExoML App in the Exotel Dashboard (*ExoPhones -> Assign to Flow*), Exotel returns:
     `{"error": true, "message": "Invalid Exophone/Phonenumber"}`
   - Therefore, all experimentation must happen inside the visual **Flow Builder** canvas of `dococt1 Landing Flow`.

2. **Caller ID Verification:**
   - Trial accounts require every test mobile number to be pre-verified via OTP under *Settings > Verified Numbers*.

---

## 4. The Exact Technical Problem We Are Investigating

Inside the visual **Flow Builder** canvas of the trial flow:

### Test Scenario 1: Static Gather Applet (Flow Builder Local)
- When a Gather applet is set to **"Configure using flow builder here"** with text typed directly in the UI (`Namaste! Welcome to Demo Clinic...`):
  - **Result:** The caller dials in, enters PIN, and **hears the TTS audio clearly and loudly**.
  - When caller presses `1`, the attached **Passthru** applet correctly sends `GET /api/ivr/step?digits="1"` to our backend.

### Test Scenario 2: Dynamic Gather Applet (Configure parameters dynamically by providing a URL)
- When any Gather applet in the flow is switched to **"Configure parameters dynamically by providing a URL"**:
  - **URL Configured:** `https://...ngrok-free.dev/api/ivr/prompt`
  - **What Happens On Call:**
    1. Caller reaches that Gather applet.
    2. Exotel fires a `GET` request to our `/api/ivr/prompt` endpoint.
    3. Our server receives the request, parses `CallSid`, `From`, `To`, and responds within milliseconds with:
       ```http
       HTTP/1.1 200 OK
       Content-Type: application/json

       {
         "gather_prompt": {
           "text": "Please select a doctor. Press 1 for Doctor Bora."
         },
         "max_input_digits": 1,
         "input_timeout": 10
       }
       ```
    4. **The Bug / Issue:** The caller hears **complete silence**. No text-to-speech is rendered or played. The call remains silent for exactly the configured `input_timeout` duration (10 seconds), and then terminates.
    5. **Exotel Call Log output:**
       `"At the Gather prompt, the user didn't enter any input."`

---

## 5. Specific Questions for Research & Resolution

1. **Does Exotel's Dynamic Gather Applet support raw Text-to-Speech (`"text": "..."`) on trial/standard accounts?**
   - Does Exotel require an audio file URL (`"audio_url": "https://.../prompt.mp3"`) instead of `"text"` when parameters are provided dynamically?
   - Does Exotel's TTS engine (Festival / Amazon Polly) require specific payload parameters (e.g., language code, voice profile, or encoding) when driven dynamically via JSON?
2. **Why does Exotel Flow Builder's Passthru Applet ignore returned ExoML?**
   - Is the Passthru applet strictly a binary HTTP router (`200 OK` vs `302 Found`), or is there a way to make it execute the returned ExoML `<Response><Say>...</Say><Gather>...</Gather></Response>` mid-flow?
3. **How can a trial virtual number run pure ExoML?**
   - Given that the UI blocks reassigning the trial number (`"Invalid Exophone/Phonenumber"`), is there an applet inside Flow Builder (e.g., Transfer, Connect, or Voicebot) that can delegate complete call control to an external ExoML endpoint?
4. **What is the exact valid JSON schema for Exotel Gather Dynamic URL?**
   - Are fields like `max_input_digits`, `finish_on_key`, `input_timeout`, and `repeat_menu` validated against strict integer/string types, and could a missing or unexpected field cause Exotel to suppress audio playback while still waiting for DTMF input?
