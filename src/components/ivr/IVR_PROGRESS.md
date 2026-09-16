# IVR System — Progress Tracker

## System Overview
IVR appointment booking using Exotel telephony provider.
Patients call clinic number → IVR flow → appointment booked in same DB 
as WhatsApp bookings → appears in admin dashboard automatically.

## Provider: Exotel
- ExoML XML: <Say>, <Gather>, <Hangup>
- Webhook body: application/x-www-form-urlencoded
- Call ID field: CallSid
- Caller field: From
- Dialed number field: To
- No HMAC signature — uses IP allowlist instead
- Exotel dashboard: create ExoML App → assign to number → set webhook URLs

## Architecture
- All IVR code: src/components/ivr/
- Routes: src/components/ivr/routes/ivr.routes.ts
- Controllers: src/components/ivr/controllers/ivr.controller.ts (thin HTTP layer: request validation, response dispatching, 0 DB queries)
- Services: src/components/ivr/services/
  - ivr-flow.service.ts: IVR state machine orchestration and navigation
  - booking.service.ts: Appointment confirmation, DB transactions, alerts, and reminders
  - prompts.service.ts: ExoML TTS prompt builders and date/time formatters
  - session.service.ts: Redis session storage
  - resolve-tenant.service.ts: Tenant phone resolution
  - sms.service.ts: Exotel SMS notification service
  - xml.service.ts: ExoML XML builders
- Schemas: src/components/ivr/schemas/ivr.schema.ts
- Session storage: Redis (existing bullConnection), key: ivr:session:{CallSid}, TTL: 600s
- DB: Same PostgreSQL as WhatsApp system

## Reused Services (DO NOT modify these)
- createAppointmentFromBooking → src/components/appointments/services/create-appointment.ts
- listActiveDoctors → src/components/doctors/services/list-active-doctors.ts
- listAvailableDates → src/components/slots/services/list-available-dates.ts
- listAvailableSlots → src/components/slots/services/list-available-slots.ts
- getOrCreatePatient → src/components/booking/services/get-or-create-patient.ts
- scheduleReminder → src/components/appointments/queue/schedule-reminder.ts
- scheduleBookingAlert → src/components/notifications/queue/schedule-booking-alert.ts
- bullConnection → src/lib/bull/index.ts (Redis client for IVR sessions)

## Webhook URLs to configure in Exotel dashboard
- Incoming call: POST https://{APP_BASE_URL}/api/ivr/incoming
- DTMF step:     POST https://{APP_BASE_URL}/api/ivr/step
- Hangup:        POST https://{APP_BASE_URL}/api/ivr/hangup
- Fallback:      GET  https://{APP_BASE_URL}/api/ivr/fallback

## Phases

### Phase 1: Foundation + DB Migration + App Wiring
Status: COMPLETED
Started: 2026-09-15
Completed: 2026-09-15

Tasks:
- [x] Create IVR_PROGRESS.md
- [x] Create folder structure (routes/, controllers/, services/, schemas/)
- [x] Create DB migration for ivr_phone_number column on tenants
- [x] Update tenants Drizzle model
- [x] Add env vars to src/lib/env.ts
- [x] Add urlencoded middleware + mount ivrRouter in src/app.ts
- [x] Create src/components/ivr/schemas/ivr.schema.ts (Zod schemas)
- [x] Create src/components/ivr/services/xml.service.ts (ExoML builders)
- [x] Create src/components/ivr/services/session.service.ts (Redis session)
- [x] Create src/components/ivr/services/resolve-tenant.service.ts
- [x] Create src/components/ivr/controllers/ivr.controller.ts (stub handlers)
- [x] Create src/components/ivr/routes/ivr.routes.ts
- [x] Create src/components/ivr/index.ts
- [x] Verify server starts without errors
- [x] Test GET /api/ivr/health returns 200

### Phase 2: Core IVR Flow (Welcome → Doctor → Date → Slot → Confirm)
Status: COMPLETED
Started: 2026-09-15
Completed: 2026-09-15

Tasks:
- [x] Implement handleIncomingCall (welcome menu)
- [x] Implement handleStep for welcome step
- [x] Implement handleStep for select_doctor step
- [x] Implement handleStep for select_date step
- [x] Implement handleStep for select_slot step
- [x] Implement handleStep for confirm step with createAppointmentFromBooking
- [x] Implement handleHangup (session cleanup)
- [x] Implement handleFallback (static XML)
- [x] Test full call flow end-to-end with Exotel sandbox number
- [x] Verify appointment appears in admin dashboard after booking

### Phase 3: SMS Confirmation + Reminders
Status: COMPLETED
Started: 2026-09-15
Completed: 2026-09-15

Tasks:
- [x] Create src/components/ivr/services/sms.service.ts
- [x] Implement Exotel SMS API call (axios POST)
- [x] Integrate SMS into confirm step after successful booking
- [x] Integrate scheduleReminder() after booking
- [x] Integrate scheduleBookingAlert() after booking
- [x] Test SMS delivery to patient phone
- [x] Verify BullMQ reminder job is queued

### Phase 4: Edge Cases + Hardening
Status: COMPLETED
Started: 2026-09-15
Completed: 2026-09-15

Tasks:
- [x] Invalid keypress handling (count, max 3, hangup)
- [x] Blank / timeout digit input handling with distinct prompt
- [x] No doctors available → graceful hangup
- [x] No dates available → go back to doctor selection with prompt
- [x] No slots on selected date → go back to date selection
- [x] Race condition on slot (fresh slot list prompt or fallback to date menu)
- [x] Session expired mid-call → graceful restart message
- [x] All errors caught → always return valid XML, never 500 HTML
- [x] XML escaping of dynamic values and action URLs in ExoML builder
- [x] Input sanitization via Zod schemas on all webhook bodies (From/To made optional on DTMF steps)
- [x] Log all IVR events with callSid, tenantId, step for debugging
- [x] Added Bruno test files for empty input and expired session

### Phase 5: Production Readiness
Status: READY FOR OPERATIONAL DEPLOYMENT
Started: 2026-09-15
Completed: 2026-09-15 (Code & tooling complete; operational steps documented in PRODUCTION_SETUP_GUIDE.md)

Tasks:
- [x] Exotel IP allowlist validation middleware (src/components/ivr/middlewares/ip-allowlist.middleware.ts)
- [x] EXOTEL_IP_ALLOWLIST environment configuration in src/lib/env.ts & .env.example
- [x] Concurrency load test script (src/scripts/test-ivr-load.ts, npm run ivr:load-test)
- [x] Comprehensive step-by-step production runbook (src/components/ivr/PRODUCTION_SETUP_GUIDE.md)
- [x] Detailed sandbox & local testing guide (src/components/ivr/SANDBOX_TESTING_GUIDE.md)
- [ ] Complete Exotel KYC verification (operational task)
- [ ] Purchase production Exophone from Exotel (operational task)
- [ ] Update tenants table: set ivr_phone_number for clinic in production DB
- [ ] Configure production Exotel dashboard with webhook URLs
- [ ] Execute `npm run ivr:load-test` against staging/production
- [ ] Perform live call from real Indian mobile SIM
- [ ] Confirm appointment appears in Admin Dashboard & WhatsApp reminders fire

