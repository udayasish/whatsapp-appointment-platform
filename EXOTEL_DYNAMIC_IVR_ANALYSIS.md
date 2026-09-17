# Deep Technical Analysis: Why Exotel Hangs Up on Dynamic Gather URL Configuration

**Document Author**: Antigravity Technical Architecture  
**Target Platform**: Exotel Telephony Cloud & Node.js Express Backend  
**Issue Subject**: Call drop / hangup when using *"Configure parameters dynamically by providing a URL"* in Exotel App Builder.

---

## 1. Executive Summary: What Just Happened?

When you selected **"Configure parameters dynamically by providing a URL"** inside the Exotel **Gather** applet (as shown in your screenshot) and pointed it to:
```
https://hammy-luanne-patchily.ngrok-free.dev/api/ivr/incoming
```
The incoming call reached your backend server (as logged at `12:27:42` and `12:27:46`), initialized the clinic session, and then **immediately hung up**.

### The Root Cause: A Protocol & Schema Mismatch

1. **What your endpoint returned (`/api/ivr/incoming`)**:
   Your backend returned an **ExoML XML document**:
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <Response>
     <Gather action="https://hammy-luanne-patchily.ngrok-free.dev/api/ivr/step" method="POST" numDigits="1" timeout="10">
       <Say>Namaste! Welcome to Demo Clinic. Press 1 to book an appointment. Press 0 to exit.</Say>
     </Gather>
     <Say>We did not receive your input. Please call back. Goodbye.</Say>
     <Hangup/>
   </Response>
   ```

2. **What Exotel's Gather Applet Dynamic URL expects**:
   The Gather Applet in Exotel's Visual Flow Builder **does not accept ExoML XML documents** as dynamic configuration. Instead, it is an HTTP configuration hook expecting a **specific JSON object** with parameters such as:
   ```json
   {
     "gather_prompt": {
       "text": "Namaste! Welcome to Demo Clinic. Press 1 to book an appointment."
     },
     "max_input_digits": 1,
     "input_timeout": 10
   }
   ```

3. **Why the call hung up**:
   When Exotel fetched `/api/ivr/incoming` and received XML with `<Response><Gather>`, its JSON parser crashed or rejected the payload as an invalid response. In Exotel's visual flow builder, any applet evaluation failure immediately triggers the default fail-safe rule: **terminate call / Hangup**.

---

## 2. In-Depth Comparison: Two Incompatible Exotel Architectures

Exotel provides **two completely different paradigms** for building dynamic IVRs. Mixing them together causes immediate call drops.

| Feature | Paradigm A: Visual Flow Builder Applets (Gather + Passthru) | Paradigm B: Pure ExoML Direct Webhook (Recommended) |
| :--- | :--- | :--- |
| **How Calls Start** | Exotel executes visual blocks (Greeting -> Gather -> Passthru -> Branch). | Exotel immediately delegates the entire call lifecycle to your server URL via ExoML. |
| **Response Format** | Plain text / JSON parameters to configure fixed visual boxes. | Standard **ExoML XML** (`<Response>`, `<Gather>`, `<Say>`, `<Hangup>`). |
| **State Machine Location** | Divided awkwardly between Exotel drag-and-drop canvas & server. | **100% in your backend** (Express + Redis session state machine). |
| **Dynamic Multi-Level Menus** | **Very clumsy & rigid**: Requires a separate Passthru and Gather block for every menu tier (Doctor -> Date -> Slot -> Confirm). | **Effortless**: One single controller endpoint handles infinite levels dynamically from database slots. |
| **What broke in your test** | You pointed the Gather Applet dynamic configuration URL to an ExoML generator endpoint (`/api/ivr/incoming`). | Your `/api/ivr/incoming` code was written for Paradigm B, but invoked inside Paradigm A. |

---

## 3. Specific Restrictions of Exotel Trial / Sandbox Accounts

In addition to the protocol mismatch, your Exotel trial account imposes operational guardrails that impact testing:

### 3.1 Strict Caller ID Whitelisting
- **Trial Rule**: Exotel blocks any call originating from or dialing to a phone number that is **not explicitly verified** under your Exotel dashboard's *Verified Numbers / Caller IDs* section.
- **Symptom**: If an unverified personal SIM calls your virtual number, Exotel drops the call before executing any applet or hitting your ngrok webhook.

### 3.2 Single Virtual Number (Exophone) Binding
- In Trial accounts, you receive one shared or dedicated virtual pilot number (e.g. `09513886363`).
- If another flow is attached to this number in App Bazaar, or if incoming routing is misconfigured, incoming requests will not reach your server.

### 3.3 Strict Webhook Timeouts (3 to 5 Seconds)
- Exotel has a strict **3500ms – 5000ms HTTP timeout**.
- If ngrok is experiencing network latency, or if your database query to Neon PostgreSQL takes > 3.5 seconds to resolve doctors and slots, Exotel times out and drops the call with a hangup tone.
- In your log:
  ```
  [2026-09-17 12:27:42] IVR handleIncomingCall received
  [2026-09-17 12:27:46] IVR incoming call initialized  (Elapsed: 4 seconds!)
  ```
  Notice that **4 full seconds** elapsed between receiving the call and finishing initialization. On a trial account with network hops via ngrok, this is right at the boundary of Exotel's timeout!

### 3.4 Outbound SMS & Telephony Header Restrictions
- Trial accounts cannot send arbitrary dynamic SMS messages without DLT registration in India. SMS templates must adhere to trial sandbox formats.

---

## 4. Why You NEED Dynamic IVR and How to Configure It Correctly

A healthcare appointment booking system **cannot** use hardcoded static menus because:
1. Doctors have dynamic weekly schedules and leave days.
2. Available dates shift every day.
3. Available patient slots (e.g. 9:00 AM, 11:00 AM) change continuously as patients book via WhatsApp and the web dashboard.

### How to Achieve True Dynamic IVR with Exotel:

There are two clean solutions:

---

### Solution 1: Use Pure ExoML (The Standard Enterprise Architecture)

Instead of using Exotel's visual Drag-and-Drop flow builder (which has the Gather applet limitation), configure an **ExoML Custom App**:

1. In Exotel Dashboard, go to **App Bazaar** > **Create App**.
2. Instead of building a flow with Gather/Passthru blocks, select **Custom App / ExoML App** (or a single **Passthru** block that hands over control to your ExoML server).
3. Set your endpoints:
   - **Start / Incoming URL**: `https://hammy-luanne-patchily.ngrok-free.dev/api/ivr/incoming`
   - **Step / DTMF URL**: `https://hammy-luanne-patchily.ngrok-free.dev/api/ivr/step`
   - **Hangup URL**: `https://hammy-luanne-patchily.ngrok-free.dev/api/ivr/hangup`
4. Now, your backend's existing `buildGather()` XML:
   ```xml
   <Response>
     <Gather action="https://.../api/ivr/step" numDigits="1" timeout="10">
       <Say>Press 1 for Dr. Sharma, Press 2 for Dr. Bora...</Say>
     </Gather>
   </Response>
   ```
   is executed directly by Exotel's telephony engine. Exotel reads the options dynamically, collects digits, and POSTs them to `/api/ivr/step`. **No visual builder blocks needed.**

---

### Solution 2: If Using the Gather Visual Applet, Point It to `/api/ivr/prompt` (JSON)

If you want to keep using the Exotel Visual Flow Builder's **Gather** applet with *"Configure parameters dynamically by providing a URL"*:

1. **Do NOT use `/api/ivr/incoming`** in that field (because it returns XML).
2. Use the dedicated JSON endpoint:
   ```
   https://hammy-luanne-patchily.ngrok-free.dev/api/ivr/prompt
   ```
3. When Exotel queries `/api/ivr/prompt`, your server returns pure JSON:
   ```json
   {
     "gather_prompt": {
       "text": "Namaste! Welcome to Demo Clinic. Press 1 for Doctor Bora. Press 2 for Doctor Smith."
     },
     "max_input_digits": 1,
     "input_timeout": 10
   }
   ```
4. Exotel speaks this text, gathers the user's DTMF digit, and passes it to the next applet (your **Passthru** applet, which forwards the digit to `/api/ivr/step`).

---

## 5. Summary & Action Items

| Issue | Cause | Fix |
| :--- | :--- | :--- |
| **Call Hangup in Gather Applet** | Gather applet dynamic URL received XML (`<Response><Gather>`) instead of JSON (`{"gather_prompt":...}`). | Change Primary URL in Gather Applet to `/api/ivr/prompt`, OR switch app to pure ExoML. |
| **Near-Timeout Latency (4 seconds)** | Cold DB connection to Neon Cloud DB over ngrok. | Keep DB connection pool warm, or deploy backend to a cloud VM with low telecom latency. |
| **Trial Restrictions** | Non-whitelisted caller numbers, strict DLT SMS compliance. | Verify caller phone in Exotel console; ensure tenant `ivr_phone_number` matches trial number. |
