# IVR System — Progress Tracker

## System Overview
IVR appointment booking using Exotel telephony provider.
Patients call clinic number → IVR flow → appointment booked in same DB 
as WhatsApp bookings → appears in admin dashboard automatically.

## Provider: Exotel
- ExoML XML: <Say>, <GetDigits>, <Hangup>
- Webhook body: application/x-www-form-urlencoded
- Call ID field: CallSid
- Caller field: From
- Dialed number field: To
- No HMAC signature — uses IP allowlist instead
- Exotel dashboard: create ExoML App → assign to number → set webhook URLs

## Architecture
- All IVR code: src/components/ivr/
- Routes: src/components/ivr/routes/ivr.routes.ts
- Controllers: src/components/ivr/controllers/ivr.controller.ts
- Services: src/components/ivr/services/
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
Status: IN PROGRESS
Started: 2026-09-15
Completed: —

Tasks:
- [ ] Create src/components/ivr/services/sms.service.ts
- [ ] Implement Exotel SMS API call (axios POST)
- [ ] Integrate SMS into confirm step after successful booking
- [ ] Integrate scheduleReminder() after booking
- [ ] Integrate scheduleBookingAlert() after booking
- [ ] Test SMS delivery to patient phone
- [ ] Verify BullMQ reminder job is queued

### Phase 4: Edge Cases + Hardening
Status: NOT STARTED
Started: —
Completed: —

Tasks:
- [ ] Invalid keypress handling (count, max 3, hangup)
- [ ] No doctors available → graceful hangup
- [ ] No dates available → go back to doctor selection
- [ ] No slots on selected date → go back to date selection
- [ ] Race condition on slot (createAppointmentFromBooking returns null)
- [ ] Session expired mid-call → graceful restart message
- [ ] All errors caught → always return valid XML, never 500 HTML
- [ ] Input sanitization via Zod schemas on all webhook bodies
- [ ] Log all IVR events with callId, tenantId, step for debugging
- [ ] Test all edge cases manually

### Phase 5: Production Readiness
Status: NOT STARTED
Started: —
Completed: —

Tasks:
- [ ] Exotel IP allowlist validation in middleware
- [ ] Verify Exotel KYC completed
- [ ] Purchase production Exophone from Exotel
- [ ] Update tenants table: set ivr_phone_number for clinic
- [ ] Configure production Exotel dashboard with webhook URLs
- [ ] Load test: simulate 5 concurrent calls
- [ ] Confirm admin dashboard shows IVR bookings
- [ ] Confirm WhatsApp reminders fire for IVR bookings
- [ ] Final end-to-end test with real Indian phone number
