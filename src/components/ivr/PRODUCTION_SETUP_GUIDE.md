# IVR Production Setup Guide — Exotel Integration

This document provides a step-by-step operational runbook to transition the IVR (Interactive Voice Response) appointment booking system from local development to production on **Exotel**.

---

## Architecture Summary

```
[Patient Calls] 
       │
       ▼
[Telecom Network (Airtel / Jio / Vi)]
       │
       ▼
[Exotel Virtual Number (Exophone)]
       │
       ▼  HTTP POST (application/x-www-form-urlencoded)
[Your Production Backend (/api/ivr/*)]
       │
       ├── Redis: Call session state (10-minute TTL)
       ├── PostgreSQL: Advisory-lock booking transaction
       ├── Exotel SMS API: Booking confirmation SMS
       ├── BullMQ: Queued WhatsApp 24h & 2h appointment reminders
       └── Admin Dashboard: Live view of all appointments
```

---

## Phase 5 Checklist Overview

- [ ] **Step 1:** Complete Exotel KYC & Commercial Account Activation
- [ ] **Step 2:** Purchase & Activate a Production Exophone (Indian Virtual Number)
- [ ] **Step 3:** Create & Configure the ExoML App in Exotel Dashboard
- [ ] **Step 4:** Link the Exophone to Your Clinic Tenant in PostgreSQL
- [ ] **Step 5:** Configure Production Environment Variables (`.env`)
- [ ] **Step 6:** Configure Reverse Proxy (Nginx / Caddy / Cloudflare) & IP Allowlist
- [ ] **Step 7:** Run Concurrency & Race-Condition Load Test
- [ ] **Step 8:** Perform End-to-End Live Call Test with an Indian Phone Number
- [ ] **Step 9:** Verify Admin Dashboard, SMS, and WhatsApp Reminders

---

## Step 1: Complete Exotel KYC & Commercial Account Activation

In India, telecom regulations (Department of Telecommunications - DoT and TRAI) mandate strict KYC verification before virtual numbers can receive public calls.

1. **Sign Up / Log In:** Go to [https://my.exotel.com](https://my.exotel.com).
2. **Navigate to KYC:** In the Exotel dashboard, go to **Settings** > **Company Profile / KYC**.
3. **Submit Required Business Documents:**
   - **Entity Proof:** Certificate of Incorporation / GST Registration Certificate / Clinical Establishment License.
   - **PAN Card:** Business PAN (or proprietor PAN if proprietorship).
   - **Authorized Signatory ID & Address Proof:** Aadhaar / Passport / Voter ID of the clinic director/owner.
   - **Letter of Authorization (LoA):** On clinic letterhead authorizing the account manager.
4. **Account Activation:** Exotel takes 24–48 business hours to verify. Once verified, your account status changes from **Trial / Sandbox** to **Active / Commercial**.

---

## Step 2: Purchase & Activate a Production Exophone

1. Go to **Exotel Dashboard** > **Phone Numbers** > **Buy Numbers**.
2. Select your preferred number type:
   - **Landline Number (Recommended):** Provides local city presence (e.g. Bangalore `080`, Mumbai `022`, Delhi `011`).
   - **Mobile Number:** 10-digit virtual number (`+91XXXXXXXXXX`).
3. Complete the purchase using your account balance.
4. Note down your assigned number (e.g., `08047192000` or `+918047192000`).

---

## Step 3: Create & Configure the ExoML App in Exotel

Exotel routes calls using an **ExoML App** (an application that reads XML instructions from your server).

1. In the Exotel dashboard, go to **App Bazaar** > **Create New App** (or **Custom Apps** > **ExoML**).
2. Name your app: `Clinic IVR Booking`.
3. In the visual flow builder or URL settings, point to your production server endpoints:

| Event / Webhook | HTTP Method | Target Production URL |
| :--- | :--- | :--- |
| **Incoming Call URL** | `POST` | `https://api.yourclinicdomain.com/api/ivr/incoming` |
| **DTMF Gather / Passthru URL** | `POST` | `https://api.yourclinicdomain.com/api/ivr/step` |
| **Hangup / Call End URL** | `POST` | `https://api.yourclinicdomain.com/api/ivr/hangup` |
| **Fallback / Failure URL** | `GET` | `https://api.yourclinicdomain.com/api/ivr/fallback` |

4. **Attach Number:** Go to **Phone Numbers** > Select your purchased Exophone > Click **Attach App** > Select `Clinic IVR Booking`.
5. **Call Recording:** Disable call recording unless explicitly needed for clinical audit compliance.

---

## Step 4: Link the Exophone to Your Clinic Tenant in PostgreSQL

When an incoming call arrives, the backend identifies which clinic is being called by matching the `To` field against `tenants.ivr_phone_number`.

### Option A: Using Raw SQL (PostgreSQL CLI or Adminer/DBeaver)
```sql
-- 1. Identify your clinic tenant ID
SELECT id, name, ivr_phone_number FROM tenants;

-- 2. Update the clinic with the purchased Exotel virtual number
-- Format: exactly as Exotel sends in the "To" parameter (standard 10-digit or STD format without plus, or with +91)
UPDATE tenants 
SET ivr_phone_number = '08047192000' 
WHERE id = 'YOUR_TENANT_UUID_HERE';

-- 3. Verify the record
SELECT id, name, ivr_phone_number, status FROM tenants WHERE ivr_phone_number = '08047192000';
```

### Option B: Using Drizzle Studio
Run:
```bash
npm run studio
```
Open the local Drizzle Studio browser interface, navigate to the `tenants` table, locate your clinic row, and set `ivr_phone_number` to your Exophone.

---

## Step 5: Configure Production Environment Variables (`.env`)

Update your production `.env` file on your server (e.g., Docker container, AWS ECS, or VM):

```bash
# --- Production Base URL ---
# Must be public HTTPS without trailing slash
APP_BASE_URL=https://api.yourclinicdomain.com

# --- Exotel Credentials ---
# Found on: Exotel Dashboard > API Credentials
EXOTEL_ACCOUNT_SID=your_exotel_subdomain_or_sid
EXOTEL_API_KEY=your_api_key_32_chars
EXOTEL_API_TOKEN=your_api_token_64_chars
IVR_PHONE_NUMBER=08047192000

# --- IP Allowlist (Optional but Recommended) ---
# Comma-separated list of Exotel IPs allowed to call /api/ivr/*
# Leave empty in development. In production, set to Exotel webhook source IPs:
EXOTEL_IP_ALLOWLIST=52.74.1.209,52.74.8.106,52.77.106.140,54.254.148.60
```

---

## Step 6: Configure Reverse Proxy & Web Server

Exotel expects responses within **5 seconds** (maximum timeout: 10s). Ensure your reverse proxy does not buffer chunks or modify headers.

### Nginx Example Configuration

```nginx
server {
    server_name api.yourclinicdomain.com;

    location /api/ivr/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # Forward actual client IP so Exotel IP allowlist middleware can inspect it
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Host $host;

        # Disable buffering for fast response streaming
        proxy_buffering off;
        proxy_connect_timeout 5s;
        proxy_read_timeout 10s;
    }
}
```

---

## Step 7: Concurrency & Race-Condition Load Test

Before receiving real patient calls, verify that your Redis session storage, PostgreSQL connection pool, and advisory locks handle simultaneous calls without deadlocks.

Run the built-in load test script:
```bash
npm run ivr:load-test
```

### What this script verifies:
1. Simulates **5 concurrent callers** connecting at the exact same millisecond.
2. All 5 callers simultaneously attempt to book slot #1 for doctor #1.
3. **Verification:**
   - Exactly **1 caller** successfully books the slot.
   - The other **4 callers** encounter the race-condition handler, receive an informative ExoML response, and are automatically offered fresh available slots.
   - **0 deadlocks**, **0 uncaught exceptions**, and **0 database corruption**.

---

## Step 8: End-to-End Live Call Verification

Dial your Exophone from an Indian mobile phone (e.g., Airtel, Jio, or Vodafone Idea):

1. **Welcome Message:**
   - You should hear: *"Namaste! Welcome to [Clinic Name]. Press 1 to book an appointment. Press 0 to exit."*
   - Press `1`.
2. **Doctor Selection:**
   - You should hear: *"Please select a doctor. Press 1 for Dr. [Name], [Specialization]..."*
   - Press `1`.
3. **Date Selection:**
   - You should hear: *"Please select a date. Press 1 for [Day, Date]..."*
   - Press `1`.
4. **Slot Selection:**
   - You should hear: *"Please select a time. Press 1 for [Time]..."*
   - Press `1`.
5. **Confirmation:**
   - You should hear: *"You selected Dr. [Name] on [Date] at [Time]. Press 1 to confirm. Press 2 to start over."*
   - Press `1`.
6. **Completion:**
   - You should hear: *"Your appointment is confirmed. Your token number is [X]. Thank you for calling. Goodbye."*
   - Call hangs up automatically.

---

## Step 9: Post-Call Verification Checklist

After completing the live call:

### 1. SMS Confirmation
- Check the caller's mobile phone for the confirmation SMS:
  > *"Your appointment with Dr. [Name] is confirmed for [Date] at [Time]. Token Number: [X]. Please arrive 10 minutes prior."*
- *Note:* In India, SMS headers and templates must be registered on the DLT platform (Jio/Airtel/Smartping) under TRAI guidelines.

### 2. Admin Dashboard
- Open the Admin Dashboard: `https://yourclinicdomain.com/admin`
- Navigate to **Appointments**.
- Confirm that the new appointment appears with:
  - Patient Phone Number: Caller's mobile number
  - Doctor: Selected doctor
  - Date & Time: Selected slot
  - Status: `confirmed`
  - Notes: `Booked via IVR`

### 3. BullMQ Scheduled Reminders
- Check Redis to verify that the 24-hour and 2-hour reminder jobs are queued:
  ```bash
  # Check Redis appointment reminder queue count
  redis-cli zcard bull:appointment-reminders:delayed
  ```

---

## Troubleshooting & FAQ

### Issue 1: Exotel plays "Application Error" or generic error tone
- **Root Cause:** Your server returned HTTP 500, non-XML content, or took > 10 seconds to respond.
- **Fix:** Check backend logs (`winston`). Verify that `APP_BASE_URL` in `.env` is accessible externally via HTTPS. Test `GET https://api.yourclinicdomain.com/api/ivr/health`.

### Issue 2: Call hangs up immediately after dialing
- **Root Cause:** `tenants.ivr_phone_number` does not match the `To` field sent by Exotel.
- **Fix:** Check the logs for `"IVR call for unknown or inactive tenant"`. Compare the logged `To` parameter (e.g. `08047192000` vs `+918047192000`) and update `tenants.ivr_phone_number` to match exactly.

### Issue 3: SMS is not delivered
- **Root Cause:** Missing DLT template registration or invalid `EXOTEL_API_KEY` / `EXOTEL_API_TOKEN`.
- **Fix:** Inspect server logs for `"Failed to send IVR booking confirmation SMS"`. Verify your Exotel SMS API credentials and ensure your DLT Entity ID and Template ID are approved in Exotel.

---

## Operations & Monitoring Maintenance

- **Health Endpoint:** Set up an external uptime monitor (e.g., UptimeRobot, BetterStack, or Datadog) pointing to:
  `GET https://api.yourclinicdomain.com/api/ivr/health` (expects HTTP 200 `{ "status": "ok", "provider": "exotel", "phase": 4 }`).
- **Session Expiry:** IVR call sessions are automatically purged from Redis after 10 minutes (TTL 600s). No manual database cleanup is needed.
