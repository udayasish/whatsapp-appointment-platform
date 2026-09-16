# IVR Sandbox & Local Testing Guide — Exotel Integration

This guide provides end-to-end instructions for testing the IVR appointment booking flow using:
1. **Bruno API Collection (Offline / Local Webhook Simulation)** — Fast, automated, zero telecom balance needed.
2. **Exotel Trial / Sandbox Account (Live Telephony Simulation)** — Using an Exotel trial virtual number (or personal verified number) with ngrok tunneling.

---

## 1. Architecture: How the Sandbox Works

During sandbox testing, the exact same state machine and database logic run as in production:

```
                  ┌────────────────────────────────────────┐
                  │          Method A: Bruno Runner        │
                  │   (Simulates Exotel Webhook POSTs)     │
                  └──────────────────┬─────────────────────┘
                                     │
┌────────────────────────────────┐   │
│   Method B: Exotel Sandbox     │   │
│   (Real Phone Call via ngrok)  ├───┴───► [Express Backend: /api/ivr/*]
└────────────────────────────────┘                 │
                                                   ├── Redis: ivr:session:{CallSid} (TTL 600s)
                                                   ├── PostgreSQL: Locks slot & books appointment
                                                   ├── Exotel SMS (Mocked/Live trial)
                                                   └── BullMQ: Reminder queues
```

---

## 2. Prerequisites & Local Environment Setup

### Step 2.1: Verify Local Services
Make sure your PostgreSQL and Redis instances are running:
```bash
# Verify Docker or local services
docker compose up -d  # (if using docker-compose for PG and Redis)
```

### Step 2.2: Seed Database with Test Clinic, Doctors & Slots
Ensure your database has active doctors and slots available for booking:
```bash
# Seed initial admin & clinic data
npm run db:seed

# Reset and generate fresh slots for the next 10-14 days
npm run slots:reset
```

### Step 2.3: Set Tenant's `ivr_phone_number` in the Database
The IVR router resolves clinic context by checking `tenants.ivr_phone_number == To`.
Ensure your test tenant has an IVR phone number configured.

Run this SQL query against your local database:
```sql
UPDATE tenants 
SET ivr_phone_number = '09513886363' 
WHERE status = 'active';
```
*(You can also use any test number matching the `ivrPhoneNumber` variable in your Bruno environment).*

### Step 2.4: Start the Local Development Server
```bash
npm run dev
```
Server should be running at `http://localhost:3000`.

---

## 3. Method A: Testing via Bruno Collection (Recommended First Step)

The project includes an official **13-request Bruno test suite** located in `bruno-collection/IVR/`.

### Step 3.1: Open Bruno & Select Environment
1. Open the [Bruno](https://www.usebruno.com/) API client.
2. Open the collection folder: `bruno-collection`.
3. Select the **Local** environment (configured in `bruno-collection/environments/Local.bru`):
   - `baseUrl`: `http://localhost:3000`
   - `callSid`: `test-call-1001` (change this to test fresh sessions)
   - `patientPhone`: `919999999999`
   - `ivrPhoneNumber`: `09513886363`

---

### Step 3.2: Step-by-Step Happy Path Execution

Execute the requests in sequence:

#### 1. Check IVR Health
- **Request:** `Get IVR Health` (`GET /api/ivr/health`)
- **Expected Response:** `HTTP 200 OK`
  ```json
  {
    "status": "ok",
    "provider": "exotel",
    "phase": 4
  }
  ```

#### 2. Simulate Incoming Call
- **Request:** `Simulate Incoming Call` (`POST /api/ivr/incoming`)
- **Payload:** `CallSid=test-call-1001`, `From=919999999999`, `To=09513886363`
- **Expected Response:** `HTTP 200 OK` with `Content-Type: text/xml`
  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <Response>
    <Gather action="http://localhost:3000/api/ivr/step" method="POST" numDigits="1" timeout="10">
      <Say>Namaste! Welcome to Apex Health Clinic. Press 1 to book an appointment. Press 0 to exit.</Say>
    </Gather>
    <Say>We did not receive your input. Please call back. Goodbye.</Say>
    <Hangup/>
  </Response>
  ```
- **Backend Action:** Redis key `ivr:session:test-call-1001` is created with state `welcome` and cached active doctors.

#### 3. Step 1: Select "Book Appointment" (Press 1)
- **Request:** `Step 1 - Select Book Appointment` (`POST /api/ivr/step`, `Digits=1`)
- **Expected Response:** ExoML listing active doctors:
  ```xml
  <Gather action="http://localhost:3000/api/ivr/step" method="POST" numDigits="1" timeout="10">
    <Say>Please select a doctor. Press 1 for Dr. Sharma, Cardiologist. Press 2 for Dr. Patel, General Physician. Press star to exit.</Say>
  </Gather>
  ```

#### 4. Step 2: Select Doctor (Press 1)
- **Request:** `Step 2 - Select Doctor` (`POST /api/ivr/step`, `Digits=1`)
- **Expected Response:** ExoML listing available dates:
  ```xml
  <Gather action="http://localhost:3000/api/ivr/step" method="POST" numDigits="1" timeout="10">
    <Say>Please select a date. Press 1 for Wednesday, 16 September. Press 2 for Thursday, 17 September. Press star to go back.</Say>
  </Gather>
  ```

#### 5. Step 3: Select Date (Press 1)
- **Request:** `Step 3 - Select Date` (`POST /api/ivr/step`, `Digits=1`)
- **Expected Response:** ExoML listing available time slots:
  ```xml
  <Gather action="http://localhost:3000/api/ivr/step" method="POST" numDigits="1" timeout="10">
    <Say>Please select a time. Press 1 for 10:00 AM. Press 2 for 10:30 AM. Press star to go back.</Say>
  </Gather>
  ```

#### 6. Step 4: Select Slot (Press 1)
- **Request:** `Step 4 - Select Slot` (`POST /api/ivr/step`, `Digits=1`)
- **Expected Response:** Confirmation summary prompt:
  ```xml
  <Gather action="http://localhost:3000/api/ivr/step" method="POST" numDigits="1" timeout="10">
    <Say>You selected Dr. Sharma on Wednesday, 16 September at 10:00 AM. Press 1 to confirm. Press 2 to start over.</Say>
  </Gather>
  ```

#### 7. Step 5: Confirm Booking (Press 1)
- **Request:** `Step 5 - Confirm Booking` (`POST /api/ivr/step`, `Digits=1`)
- **Expected Response:**
  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <Response>
    <Say>Your appointment is confirmed. Your token number is 1. Thank you for calling. Goodbye.</Say>
    <Hangup/>
  </Response>
  ```
- **Backend Verification:**
  - `appointments` table has a new row with `status='confirmed'` and `complaint='Booked via IVR'`.
  - Redis session key `ivr:session:test-call-1001` is automatically deleted.
  - BullMQ reminder job is scheduled for the patient.

---

### Step 3.3: Edge Cases & Hardening Testing in Bruno

Test the Phase 4 edge cases using the provided Bruno requests:

| Scenario | Request in Bruno | Input Parameters | Expected Behavior |
| :--- | :--- | :--- | :--- |
| **Go Back Menu** | `Test Go Back (Star Key)` | `Digits=*` | Steps back to the previous menu (e.g. from slot to date, or date to doctor). |
| **Invalid Input** | `Test Invalid Keypress` | `Digits=9` | Server responds: *"Sorry, that was not a valid option. Please try again."* Increments `invalidCount`. On 3rd invalid attempt, hangs up with *"Too many invalid attempts"*. |
| **Blank / Timeout Input** | `Test Timeout or Empty Input` | `Digits=` (empty) | Server responds: *"We did not receive your input. Please try again."* without crashing. |
| **Expired Session** | `Test Session Expired` | `CallSid=EXPIRED_OR_RANDOM` | Server responds: *"Your session has expired. Please call back. Goodbye."* and hangs up cleanly. |
| **Caller Hangup** | `Simulate Hangup` | `POST /api/ivr/hangup` | Deletes Redis session; returns HTTP 200. |

---

## 4. Method B: Testing with Real Phone Call via Exotel Sandbox + ngrok

If you want to actually dial an Indian phone number from your phone and hear the IVR speech:

### Step 4.1: Expose Your Local Server via ngrok
Install and start [ngrok](https://ngrok.com/):
```bash
ngrok http 3000
```
Note your HTTPS forwarding URL (e.g., `https://a1b2-c3d4.ngrok-free.app`).

### Step 4.2: Update Local Environment Variables (`.env`)
Set `APP_BASE_URL` to your ngrok URL:
```bash
APP_BASE_URL=https://a1b2-c3d4.ngrok-free.app
```
Restart your dev server: `npm run dev`.

### Step 4.3: Exotel Sandbox Account Setup
1. Sign up for an Exotel trial account at [my.exotel.com](https://my.exotel.com).
2. **Whitelist Your Mobile Number:**
   - In Trial mode, Exotel **only permits calls to/from verified numbers**.
   - Go to **Settings** > **Verified Numbers** (or Caller IDs).
   - Add your mobile number and verify via OTP.
3. **Note Your Assigned Trial Virtual Number:**
   - Go to **Phone Numbers** in Exotel dashboard.
   - You will see your sandbox trial number (e.g. `09513886363` or `0804719XXXX`).

### Step 4.4: Configure the ExoML App in Exotel
1. In the Exotel dashboard, click **App Bazaar** > **Create App**.
2. Name it: `Sandbox IVR Testing`.
3. In the flow configuration, choose **Connect to URL** / **ExoML Passthru**:
   - **Call Start / Incoming URL:**
     `POST https://a1b2-c3d4.ngrok-free.app/api/ivr/incoming`
   - **DTMF Action / Step URL:**
     `POST https://a1b2-c3d4.ngrok-free.app/api/ivr/step`
   - **Hangup / Call Completion URL:**
     `POST https://a1b2-c3d4.ngrok-free.app/api/ivr/hangup`
   - **Fallback URL:**
     `GET https://a1b2-c3d4.ngrok-free.app/api/ivr/fallback`
4. Attach this app to your Exotel sandbox number.

### Step 4.5: Update Tenant in Local Database
Match the trial number in your database:
```sql
UPDATE tenants 
SET ivr_phone_number = 'YOUR_EXOTEL_SANDBOX_NUMBER' 
WHERE status = 'active';
```

### Step 4.6: Place the Live Call
1. From your **verified mobile phone**, dial the Exotel sandbox number.
2. Listen to the welcome prompt and test keypresses:
   - Press `1` -> Doctor Selection
   - Press `1` -> Date Selection
   - Press `*` -> Returns to Doctor Selection
   - Press `1` -> Select Date
   - Press `1` -> Select Slot
   - Press `1` -> Confirm
3. You will hear: *"Your appointment is confirmed. Your token number is X..."*
4. Check your terminal: You will see structured logs for each step with `CallSid`, `From`, `To`, and duration.

---

## 5. Automated Concurrency & Slot Contention Test

To test that Redis sessions and PostgreSQL advisory locks protect slots when multiple calls collide:

Run the load test:
```bash
npm run ivr:load-test
```

### Sample Expected Output:
```
======================================================
 Starting IVR Concurrency Load Test (5 concurrent callers)
 Base URL: http://localhost:3000
 Target IVR Number: 09513886363
======================================================

Caller #1 | Time: 185ms | Status: [SUCCESS]                  | Appointment booked successfully
Caller #2 | Time: 198ms | Status: [SLOT_CONTENTION_HANDLED]  | Race condition caught gracefully (alternative slot offered)
Caller #3 | Time: 204ms | Status: [SLOT_CONTENTION_HANDLED]  | Race condition caught gracefully (alternative slot offered)
Caller #4 | Time: 211ms | Status: [SLOT_CONTENTION_HANDLED]  | Race condition caught gracefully (alternative slot offered)
Caller #5 | Time: 220ms | Status: [SLOT_CONTENTION_HANDLED]  | Race condition caught gracefully (alternative slot offered)

------------------------------------------------------
Total calls:             5
Successful bookings:     1
Contention handled:      4
Failures/Errors:         0
------------------------------------------------------
[PASS] Concurrency and slot race condition tests passed!
```

---

## 6. How to Verify Appointments in Database & Dashboard

### In PostgreSQL:
```sql
SELECT id, token_number, appointment_date, appointment_time, complaint, status, created_at 
FROM appointments 
WHERE complaint = 'Booked via IVR' 
ORDER BY created_at DESC 
LIMIT 5;
```

### In Admin Dashboard:
1. Open `http://localhost:3000/admin` (or your frontend admin port).
2. Login with receptionist or doctor credentials (see `src/scripts/seed-admin-users.ts`).
3. View the appointments list:
   - Source/Complaint displays: **"Booked via IVR"**
   - Status: **Confirmed**
   - Patient Phone: The caller's number

### In Redis (BullMQ queues):
Verify that the reminder job was queued:
```bash
redis-cli
127.0.0.1:6379> KEYS bull:appointment-reminders:*
127.0.0.1:6379> ZRANGE bull:appointment-reminders:delayed 0 -1 WITHSCORES
```

---

## 7. Sandbox Testing Troubleshooting Checklist

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| **"Sorry, clinic not found or inactive"** | Dialed `To` number doesn't match `tenants.ivr_phone_number`. | Run `SELECT ivr_phone_number FROM tenants;` and update it to match the exact string sent in `To`. |
| **"Sorry, no doctors are available right now"** | No active doctors in the tenant clinic. | Run `npm run db:seed` or verify `doctors.status = 'active'`. |
| **"Sorry, no appointment dates are available"** | Doctor has no slots generated for the coming days. | Run `npm run slots:reset` to populate 10-14 days of slots. |
| **Call drops with fast busy signal on real phone** | Number dialing isn't whitelisted in Exotel trial account. | Go to Exotel Console > Settings > Verified Numbers, add and verify your phone. |
| **ngrok webhook 502 / 504 Gateway Timeout** | Local Node.js server crashed or stopped. | Check terminal running `npm run dev`. Check `npm run typecheck`. |
| **Exotel reports "Invalid XML"** | Response wasn't XML or had unescaped characters. | Verify responses with `curl -i -X POST http://localhost:3000/api/ivr/incoming`. Must return `Content-Type: text/xml`. |
