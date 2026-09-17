# Prompt for Claude: Deep Research on Twilio IVR Architecture & Migration Blueprint

> **Instructions for Claude**: Copy and paste the entire prompt below into Claude. It provides full context of our current architecture, what works, why Exotel created friction, what code can be 100% reused, and the exact research questions needed to design our Twilio IVR pipeline.

---

```markdown
# Comprehensive Technical Request: Twilio IVR Integration & Migration Architecture

## 1. Project Background & Tech Stack

We are developing an automated, multi-tenant healthcare appointment booking platform. Callers dial an IVR phone number assigned to a clinic/tenant, interact via DTMF keypad inputs across a multi-step booking flow, and receive a confirmed appointment with an SMS/WhatsApp confirmation.

### Current Backend Stack:
- **Runtime**: Node.js v24 (ESM), TypeScript (`"moduleResolution": "NodeNext"`)
- **Web Framework**: Express.js 5
- **Database**: PostgreSQL (hosted on Neon Cloud, AWS us-east-2), managed via Drizzle ORM
- **Cache & State Store**: Redis (hosted locally / Upstash, managed via ioredis / BullMQ connection)
- **Architecture**: Domain-driven, thin controllers, centralized services, advisory locking for concurrency

---

## 2. Why We Are Leaving Exotel (The Problems Encountered)

We initially integrated with Exotel, but encountered severe developer friction and architectural limitations:

1. **Fragmented Applet / Paradigm Mismatch**:
   - Exotel forces a visual "Flow Builder" canvas where applets have incompatible API contracts:
     - The **Passthru Applet** ignores returned XML/ExoML and only routes calls based on HTTP status codes (`200 OK` vs `302 Found`).
     - The **Gather Applet** in dynamic mode rejects standard XML and expects a custom JSON response (`{"gather_prompt": {"text": "..."}}`).
   - This creates a broken hybrid where our backend has to juggle both XML and custom JSON for the same call session.

2. **Strict Gateway Timeouts & Telecom Silence**:
   - Exotel's dynamic Gather applet has a strict hard timeout (~5 seconds) and sensitive HTTP parser requirements (e.g. failing or falling back if `Content-Type` includes `; charset=utf-8` or takes >3.5s due to cross-region database queries).
   - In Exotel's trial environment, callers must dial a shared virtual number and enter an account PIN before connecting to flows, and Exotel's audio pipeline frequently produces silence when transitioning between dynamic endpoints.

---

## 3. Our Existing IVR Logic & What Can Be Reused

Our business logic, state machine, and data persistence layers are already fully built and verified:

### What Is 100% Reusable (Zero Logic Changes):
1. **Clinic/Tenant Resolution** (`src/components/ivr/services/resolve-tenant.service.ts`):
   - Maps the dialed number (`To`) to a tenant in PostgreSQL:
     ```ts
     resolveTenantByIvrPhone(dialedNumber: string): Promise<Tenant | null>
     ```
2. **Appointment Booking Engine with Concurrency Protection** (`src/components/ivr/services/booking.service.ts`):
   - Atomically books slots using PostgreSQL transactional advisory locks (`pg_try_advisory_xact_lock`), handles race conditions, generates appointment tokens, and dispatches confirmation notifications.
3. **Session Management** (`src/components/ivr/services/session.service.ts`):
   - Redis-backed state machine tracked by `CallSid` with 10-minute TTL:
     ```ts
     interface IvrSession {
       step: "welcome" | "select_doctor" | "select_date" | "select_slot" | "confirm";
       tenantId: string;
       clinicName?: string;
       callerPhone: string;
       doctors?: Doctor[];
       selectedDoctorId?: string;
       selectedDoctorName?: string;
       dates?: string[];
       selectedDate?: string;
       slots?: Slot[];
       selectedSlotId?: string;
       selectedSlotTime?: string;
       invalidCount?: number;
     }
     ```
4. **Prompt Text Generators** (`src/components/ivr/services/prompts.service.ts`):
   - Generates natural, human-friendly prompt texts for Welcome, Doctor selection, Date selection, Slot selection, Confirmation, and Invalid input reprompts.
5. **Data Queries**:
   - `listActiveDoctors(tenantId)`, `listAvailableDates(doctorId)`, `listAvailableSlots(doctorId, date)`.

### What Needs to Be Replaced / Adapted for Twilio:
1. **XML Generation** (`src/components/ivr/services/xml.service.ts`):
   - Replace Exotel's `<Response><Gather action="" method="POST"><Say>...</Say></Gather></Response>` (ExoML) with official Twilio Voice TwiML (`VoiceResponse` from the `twilio` SDK or lightweight template strings).
2. **Webhooks & Endpoints**:
   - Eliminate the weird JSON prompt vs XML step dichotomy! Twilio natively uses pure TwiML XML for **every single turn** of the conversation.
3. **Security Middleware**:
   - Replace custom IP allowlisting with Twilio's official HMAC signature verification (`twilio.webhook()` or `validateRequest`).

---

## 4. The IVR Flow We Want to Build with Twilio

We want a clean, standard, 100% TwiML-driven stateless/Redis-backed IVR flow:

```
Caller Dials Twilio Number
           │
           ▼
[POST /api/ivr/twilio/incoming]
  - Resolve Tenant from `To` number
  - Initialize session in Redis (CallSid)
  - Return TwiML:
    <Response>
      <Gather numDigits="1" action="/api/ivr/twilio/step" method="POST" timeout="10">
        <Say language="en-IN" voice="Polly.Aditi">Namaste! Welcome to Demo Clinic. Press 1 to book an appointment. Press 0 to exit.</Say>
      </Gather>
      <Redirect>/api/ivr/twilio/timeout</Redirect>
    </Response>
           │
           ▼ (Caller presses "1")
[POST /api/ivr/twilio/step]
  - Read Digits and CallSid from Twilio request body
  - Advance State Machine:
    - Step 1: "welcome" -> Select Doctor (Lists active doctors, prompts "Press 1 for Dr. Bora...")
    - Step 2: "select_doctor" -> Select Date (Prompts "Press 1 for Today, Press 2 for Tomorrow...")
    - Step 3: "select_date" -> Select Time Slot (Prompts "Press 1 for 10:00 AM...")
    - Step 4: "select_slot" -> Confirm Booking (Prompts "You selected Dr. Bora on Friday at 10 AM. Press 1 to confirm...")
    - Step 5: "confirm" -> Execute booking in DB -> Speaks confirmation token -> <Hangup/>
```

---

## 5. What We Need You (Claude) to Research & Detail

Please perform a deep, rigorous research on Twilio IVR and provide a complete architectural guide covering the following areas:

### A. Twilio Voice Architecture & Webhook Protocol
1. How does Twilio handle multi-turn IVRs using `<Gather>` and `action` URLs?
2. What are the best practices for handling timeouts (when caller enters no digits) and invalid inputs (wrong digits) cleanly without dropping the call?
3. Should we pass state via query params in the `action` URL (e.g., `/step?step=select_doctor`) or keep it purely in Redis keyed by `CallSid`? What are the latency and edge-case trade-offs?
4. What HTTP status code and headers does Twilio expect (`Content-Type: text/xml`, `200 OK`)? Does Twilio have any quirks with trailing slashes, redirects, or character encoding?

### B. India Telephony & Phone Number Regulations with Twilio
1. **Critical for our use case in India**: Does Twilio provide Indian local numbers (+91) or Indian toll-free numbers (1800) for inbound calling?
2. What are the KYC / regulatory requirements (DoT / TRAI regulations, address verification, business registration) for procuring an Indian voice-capable number on Twilio?
3. If an Indian local number is difficult or slow to procure, what are the common architectures/workarounds? (e.g., Twilio SIP trunking, call forwarding from a local Indian SIM/operator to a Twilio number, or programmable voice with international DID)?
4. How do caller ID (`From`) and dialed number (`To`) get formatted (E.164 e.g. `+919876543210`) when an Indian mobile caller dials in?

### C. Text-To-Speech (TTS) & Accents (Indian English & Hindi)
1. Which TTS engines and voices are supported in Twilio `<Say>` for Indian accents?
   - Amazon Polly voices (e.g., `Polly.Aditi`, `Polly.Raveena`, `Polly.Kajal` neural)?
   - Google TTS voices?
2. How do we configure bilingual or code-mixed speech (e.g., *"Namaste! Welcome to Demo Clinic. Appointment book karne ke liye 1 dabayein"* or clear Indian English)?
3. Can we use SSML (`<prosody rate="..." pitch="...">`, `<break time="500ms"/>`, `<say-as interpret-as="digits">`) inside Twilio `<Say>` to make doctor names and dates sound completely natural?

### D. Security & Verification
1. How does `X-Twilio-Signature` work?
2. How should we configure Twilio webhook signature verification in Express.js (handling raw vs parsed bodies, ngrok vs production domains, reverse proxy SSL termination)?

### E. Concrete Implementation Blueprint
1. Provide the exact code for a `twilio-ivr.service.ts` or `twilio-xml.service.ts` using the official `twilio` npm package (`twilio.twiml.VoiceResponse`).
2. Provide the Express route handlers (`handleTwilioIncoming`, `handleTwilioStep`, `handleTwilioStatusCallback`).
3. Show how our existing `session.service.ts`, `prompts.service.ts`, and `booking.service.ts` integrate seamlessly into this controller with zero rewrite of business logic.
4. Provide a step-by-step checklist to set up a Twilio account, buy/configure a number, configure the webhook URL, and test locally with ngrok.
```
