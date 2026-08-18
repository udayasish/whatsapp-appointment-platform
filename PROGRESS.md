---
# Project Progress

## Phase 1 — Database Setup
Status: DONE
Date: 2026-08-03

### What was built
- Project scaffold mirroring the `D:\gbp-connect-be` reference conventions: Express 5 +
  TypeScript (strict, NodeNext, ESM) + Drizzle ORM (node-postgres) + BullMQ/ioredis +
  Zod-validated env + Winston logger + centralized `AppError` hierarchy + `asyncHandler`.
- All 9 required Postgres enums: `user_role`, `day_of_week`, `appointment_status`,
  `message_direction`, `conversation_step`, `report_status`, `slot_status`,
  `tenant_status`, `blocked_date_reason` — plus a TS union type exported per enum
  (`UserRole`, `DayOfWeek`, etc.) for reuse in application code.
- All 9 required tables as Drizzle models with relations and `$inferSelect` types:
  `tenants`, `users`, `doctors`, `slots`, `blocked_dates`, `appointments`, `reports`,
  `messages`, `conversation_state`.
- Indexes: `tenant_id` on every tenant-scoped table, `phone_number` on `users` /
  `conversation_state` / `messages` (as `from_number`), `appointment_date` and `status`
  on `appointments`, `status` on `slots` and `reports`, `slot_date` on `slots`. Plus
  uniqueness constraints: `tenants.whatsapp_phone_number_id` /
  `whatsapp_display_number`, `(tenant_id, phone_number)` on `users`, `(doctor_id,
  slot_date, start_time)` on `slots`, `(doctor_id, blocked_date)` on `blocked_dates`,
  `(doctor_id, appointment_date, token_number)` on `appointments`, `wa_message_id` on
  `messages`, `(tenant_id, phone_number)` on `conversation_state`.
- Initial migration generated and applied (`0000_colossal_patriot.sql`).
- Shared `generateSlots` service (`components/slots/services/generate-slots.ts`):
  expands a weekly template (weekdays + start/end time + slot duration) into concrete
  per-date slot rows over a configurable horizon (`BOOKING_HORIZON_DAYS`, default 14).
  Duplicate `(doctor, date, start_time)` rows are skipped via `onConflictDoNothing`,
  so it is safe to re-run. Built now so both the seed script and the future Phase 5
  `SLOT` staff command reuse the exact same logic (no duplicated date-math).
- Seed script (`src/lib/db/seed.ts`, `npm run db:seed`): one tenant ("Sunrise Clinic"),
  one doctor user + doctor profile ("Dr. Asha Verma", General Physician, 15-min slots),
  one receptionist user, and 120 generated slots (Mon–Fri, 09:00–12:00, 15-min
  increments, over the 14-day horizon). Idempotent — re-running creates 0 duplicates.
- Local dev infra: `compose.yml` (Postgres 16 + Redis 7 with healthchecks), `.env` /
  `.env.example`.

### Files created or modified
- `package.json`, `tsconfig.json`, `drizzle.config.ts`, `compose.yml`, `.env.example`,
  `.env`, `.gitignore`
- `src/lib/env.ts`, `src/lib/logger.ts`, `src/lib/errors.ts`, `src/lib/async-handler.ts`,
  `src/lib/index.ts`
- `src/lib/db/db.ts`, `src/lib/db/index.ts`, `src/lib/db/seed.ts`
- `src/lib/db/models/common.ts`, `enums.ts`, `tenants.ts`, `users.ts`, `doctors.ts`,
  `slots.ts`, `blocked-dates.ts`, `appointments.ts`, `reports.ts`, `messages.ts`,
  `conversation-state.ts`, `index.ts`
- `src/lib/db/migrations/0000_colossal_patriot.sql` (+ `meta/`)
- `src/lib/bull/index.ts` (queue/worker scaffolding, wired up fully in Phase 4)
- `src/middlewares/index.ts` (404 + central error handler)
- `src/components/slots/services/generate-slots.ts`, `index.ts`
- `src/app.ts`, `src/index.ts` (minimal Express skeleton + `/health`; webhook routes
  added in Phase 2)

### Decisions made
- **Identity model**: `users` is scoped `(tenant_id, phone_number)` unique, not a
  global-phone identity — the same phone number can be a patient at one clinic and
  staff at another, and each tenant has its own WhatsApp number so there's no
  cross-tenant ambiguity to resolve (unlike the reference project's multi-org users).
- **`doctors` splits off `users`** (1:1 via `user_id`) rather than folding scheduling
  attributes (specialization, consult duration, active flag) into `users`, since
  patients/receptionists never need those columns.
- **`slots` are concrete rows, not recurring templates** — one row per
  (doctor, date, start_time). The staff `SLOT` command and the seed script both
  generate concrete rows via the shared `generateSlots` service. This trades some
  storage for much simpler booking/query logic (no "expand recurrence on read" step).
- **`messages.tenant_id` is nullable** — inbound messages are logged even when tenant
  resolution fails (unknown `phone_number_id`), so nothing is silently dropped; the
  webhook handler built in Phase 2 must handle a null tenant gracefully.
- **`conversation_state` is patient-only** (booking-bot ladder). Staff commands
  (Phase 5) are stateless single-line commands and don't need conversation tracking.
- **No admin API / admin-auth middleware** — unlike the reference project, this
  product has zero web dashboard; every actor (patient, doctor, receptionist) only
  ever talks to the system over WhatsApp, so there's no `X-Admin-Key`-gated surface.
  Seeding/admin tasks happen via scripts (`npm run db:seed`), not HTTP endpoints.
- **Stack/tooling mirrors `D:\gbp-connect-be`** exactly: Express 5, Drizzle ORM
  (node-postgres driver), Postgres 16, BullMQ + ioredis, Zod v4, Winston, TypeScript
  strict/NodeNext/ESM, `tsx` for dev. `AppError` hierarchy, `asyncHandler`, and the
  `errorHandler` (ZodError → 400, pg unique-violation 23505 → 409 safety net) copied
  verbatim since they're framework-agnostic to the product domain.
- Gotcha: Docker Desktop was installed but not yet running when `docker compose up`
  was first attempted — had to wait for the engine to come up before retrying (same
  gotcha the reference project's PROGRESS.md notes).

---

## Phase 2 — WhatsApp Webhook Setup
Status: DONE
Date: 2026-08-03

### What was built
- `GET /webhook` verification handler: validates `hub.mode` + `hub.verify_token`
  against `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, echoes `hub.challenge` on match, else 403.
- `POST /webhook` receiver, protected by `X-Hub-Signature-256` verification
  (`verify-signature.ts`, HMAC-SHA256 over the raw request body vs `WHATSAPP_APP_SECRET`,
  timing-safe compare). The raw bytes are captured via `express.json({ verify })` in
  `app.ts` since re-stringifying the parsed body could produce a different signature.
  Responds 200 to Meta immediately (before processing) since Meta retries the whole
  payload on any non-2xx/slow response; processing errors are caught and logged, never
  thrown after the ack.
- Payload parsing (`parse-inbound.ts`): a lenient Zod schema for Meta's webhook shape,
  normalizing `entry[].changes[].value.{messages,statuses}` into flat
  `ParsedInboundMessage[]` / `ParsedStatusUpdate[]` lists. Extracts `phone_number_id`
  (which WhatsApp number was messaged), sender phone, `wa_message_id`, message type,
  text body (from `text` or `button` types), and media id (from `image`/`document`).
  Unparseable payloads yield empty arrays rather than throwing.
- Tenant resolver (`resolve-tenant.ts`): looks up the tenant by
  `whatsapp_phone_number_id` from the payload metadata — never from the URL, since
  Meta sends every tenant's webhooks to the one configured endpoint.
- Role resolver (`resolve-role.ts`): looks up `(tenant_id, phone_number)` in `users`
  and returns `{role, user}` or `{role: "unknown", user: null}`.
- Message logging (`log-message.ts`): every inbound/outbound message is written to
  `messages`, including a null-tenant path for payloads whose `phone_number_id`
  doesn't match any tenant (nothing is silently dropped). `onConflictDoNothing()`
  makes logging safe against Meta's at-least-once webhook redelivery.
- Status-update handling (`apply-status-update.ts`): applies delivery receipts
  (sent/delivered/read/failed) from `statuses[]` to the matching `wa_message_id` row.
- WhatsApp send utility (`send-message.ts`): `sendWhatsAppMessage()` posts to the
  Graph API (`https://graph.facebook.com/{WHATSAPP_API_VERSION}/{phone_number_id}/messages`)
  and logs the outbound message (including the `wa_message_id` Meta returns) through
  the same `logMessage` used for inbound — one audit trail, one send path used by
  every future component (booking bot, staff handler, reminder/report/notification
  queues). `sendTextMessage()` is a thin convenience wrapper for the common case.
- Message routing seam (`message-router.ts`): `routeInboundMessage()` sends
  doctor/receptionist messages to a staff handler and everyone else (patients, and
  unknown numbers — treated as prospective patients) to a patient handler. Both
  handlers are populated via `registerPatientMessageHandler` /
  `registerStaffMessageHandler`, self-registered by Phase 3 and Phase 5 at module
  load (mirrors the reference project's event-bus self-registration pattern) — Phase
  2 has zero knowledge of the booking bot or staff parser.
- Orchestration (`handle-inbound-message.ts`): ties resolve-tenant → resolve-role →
  log-message → route-message together for each parsed inbound message.
- Verified live against the running dev server: `/health` 200; GET `/webhook` returns
  the challenge on a correct verify token and 403 on a wrong one; POST `/webhook` with
  a correctly HMAC-signed seeded-tenant payload returns 200 and the message appears in
  `messages` with the resolved `tenant_id`, correct `wa_message_id`, and body; POST
  with a wrong signature returns 401 and is not logged.

### Files created or modified
- `src/app.ts` (raw-body capture via `express.json({ verify })`, mounts `whatsappRouter`)
- `src/components/whatsapp/schema.ts`, `controller.ts`, `routes.ts`, `verify-signature.ts`
- `src/components/whatsapp/services/resolve-tenant.ts`, `resolve-role.ts`,
  `log-message.ts`, `parse-inbound.ts`, `apply-status-update.ts`, `message-router.ts`,
  `handle-inbound-message.ts`, `send-message.ts`, `index.ts`

### Decisions made
- **No admin/dashboard auth on the webhook routes** — the only "auth" for
  `POST /webhook` is the Meta signature check; `GET /webhook` is Meta's own
  verify-token handshake. Both are mounted at the app root (no `/v1` prefix), matching
  where Meta actually calls.
- **Ack-then-process pattern**: `receiveWebhookHandler` calls `res.sendStatus(200)`
  before doing any DB/routing work, and swallows all downstream errors internally
  (logged, never re-thrown) — sending a response and then throwing would attempt to
  set headers twice. This trades "Meta sees a 200 even if our processing later fails"
  for avoiding endless Meta redelivery storms on transient errors; DB writes are
  idempotent (`onConflictDoNothing`) so redeliveries that DO happen (network blip
  before the ack) are harmless.
- **Unknown senders route to the patient bot, not a dead end** — anyone messaging a
  tenant's number who isn't already a `doctor`/`receptionist`/known `patient` is
  treated as a prospective patient; Phase 3's booking bot is responsible for
  onboarding them (creating their `users` row) on first contact.
- **Router is a pluggable seam, not a Phase 3/5 dependency** — `message-router.ts`
  exports `registerPatientMessageHandler` / `registerStaffMessageHandler` with no
  imports from `components/booking` or `components/staff`. Those components will
  self-register via a side-effect import in `src/index.ts` when built (reference
  project convention), keeping Phase 2 fully functional (logs + warns) even before
  Phase 3/5 exist.
- **Send utility takes a raw `payload` object**, not just `{body}` — Meta's message
  types (text, interactive buttons/lists, template, document) all POST different JSON
  shapes to the same endpoint. `sendWhatsAppMessage` handles any of them uniformly;
  `sendTextMessage` is the convenience wrapper for the common case. This avoids
  hardcoding "text-only" into the one function every later phase depends on.
- Placeholder dev credentials generated for `WHATSAPP_WEBHOOK_VERIFY_TOKEN` /
  `WHATSAPP_APP_SECRET` / `WHATSAPP_ACCESS_TOKEN` in `.env` (no real Meta app exists
  yet) — replace with real values from the Meta App Dashboard before going live;
  `WHATSAPP_ACCESS_TOKEN` in particular must be a real token for `send-message.ts` to
  actually reach the Graph API.

---

## Phase 3 — Patient Booking Bot
Status: DONE
Date: 2026-08-03

### What was built
- Full booking ladder implemented exactly as specified: `IDLE → SELECT_LANGUAGE →
  SELECT_ACTION → SELECT_DOCTOR → SELECT_DATE → SELECT_SLOT → ENTER_NAME → ENTER_AGE
  → ENTER_COMPLAINT → CONFIRM_BOOKING → COMPLETED`. Each step is its own file under
  `src/components/booking/steps/`, dispatched by `handle-booking-message.ts`.
  `conversation_state` is read/written on every message via
  `services/conversation-state.ts` (`getOrCreateConversationState`,
  `updateConversationState`, `resetConversationState`).
- Bilingual (English/Hindi) throughout: `messages.ts` holds an i18n string table
  keyed by step; `SELECT_LANGUAGE` stores the choice in `tempData.lang` and every
  subsequent prompt/validation/confirmation message is rendered in that language.
- Input validation with re-ask-without-changing-state on every step: invalid input
  returns `{nextStep: <same step>, tempData: <unchanged>, reply: invalidGeneric + the
  exact last prompt shown}` — the last numbered-list prompt (`tempData.lastPrompt`) is
  cached at generation time so a re-ask is always byte-identical, never regenerated
  (guards against the underlying list changing between prompt and reply, e.g. a slot
  being taken).
- Global cancel handling: `/^cancel$/i` at any step except `idle` moves to
  `CANCELLED` then immediately resets to `IDLE` (`resetConversationState`), sending a
  localized cancellation message.
- `SELECT_ACTION` offers "Book an appointment" (enters the ladder) or "View my
  upcoming appointments" (lists booked appointments via
  `appointments/services/list-upcoming-for-patient.ts`, then resets straight to idle
  — a side path, not part of the ladder).
- `SELECT_DOCTOR`/`SELECT_DATE`/`SELECT_SLOT` list live data
  (`doctors/services/list-active-doctors.ts`,
  `slots/services/list-available-dates.ts`/`list-available-slots.ts`) and cache the
  shown ids alongside the prompt text in `tempData` so numeric replies map back to
  the correct row. If a chosen date's slots are gone by the time it's picked (race),
  `SELECT_DATE` regenerates and re-shows the date list rather than dead-ending.
- `COMPLETED` creates the appointment via
  `appointments/services/create-appointment.ts` (`createAppointmentFromBooking`):
  wrapped in a DB transaction with a Postgres advisory lock scoped to
  `doctorId:date` plus a `SELECT ... FOR UPDATE` on the slot row — assigns
  `tokenNumber = max(existing tokens for that doctor+date) + 1`, marks the slot
  `booked`, inserts the appointment, then resets conversation_state to idle and
  sends a localized confirmation (token, doctor, date, time). Returns null (handled
  as "slot just taken, please restart") if the slot lost the race.
- Unknown senders are auto-registered as patients on first contact
  (`booking/services/get-or-create-patient.ts`) — no separate signup step.
- Self-registers with the Phase 2 router seam: `components/booking/index.ts` calls
  `registerPatientMessageHandler(handleBookingMessage)` as a side effect, imported
  from `src/index.ts`.
- Verified live end-to-end against the running dev server (Postgres + Redis via
  compose, a local mock Graph API standing in for Meta): full flow from "Hi" through
  every step to a confirmed booking (token #1, correct doctor/date/time, slot marked
  `booked`, `conversation_state` reset to idle); invalid input at `SELECT_LANGUAGE`
  correctly re-asks without advancing; `cancel` mid-flow correctly resets to idle;
  the Hindi path renders every prompt in Hindi end-to-end; "view my upcoming
  appointments" correctly lists the booked appointment and resets to idle.

### Files created or modified
- `src/common/format.ts` (date/time display formatting)
- `src/components/doctors/services/list-active-doctors.ts`, `find-doctor-by-name.ts`
  (latter unused until Phase 5's BLOCK/SLOT commands), `index.ts`
- `src/components/slots/services/list-available-dates.ts`, `list-available-slots.ts`
  (added to the existing `index.ts` barrel from Phase 1)
- `src/components/appointments/services/create-appointment.ts`,
  `list-upcoming-for-patient.ts`, `index.ts`
- `src/components/booking/services/conversation-state.ts`, `get-or-create-patient.ts`,
  `index.ts`
- `src/components/booking/types.ts`, `messages.ts`
- `src/components/booking/steps/shared.ts`, `idle.ts`, `select-language.ts`,
  `select-action.ts`, `select-doctor.ts`, `select-date.ts`, `select-slot.ts`,
  `enter-name.ts`, `enter-age.ts`, `enter-complaint.ts`, `confirm-booking.ts`,
  `index.ts`
- `src/components/booking/handle-booking-message.ts`, `index.ts`
- `src/index.ts` (side-effect import of `components/booking/index.js`)
- `src/lib/retry.ts`, `src/lib/mutex.ts` (new — see Decisions)
- `src/lib/index.ts` (barrel additions: `withRetry`, `withKeyLock`)
- `src/lib/db/db.ts` (pool hardening — see Decisions)
- `src/lib/env.ts`, `.env.example` (added `WHATSAPP_GRAPH_API_BASE_URL` override,
  used only for local mock-server testing)
- `src/components/whatsapp/controller.ts` (wrapped message/status processing in
  `withRetry` with per-attempt logging)
- `src/components/whatsapp/services/handle-inbound-message.ts` (wrapped in
  `withKeyLock`)
- `.env` (switched `DATABASE_URL`/`REDIS_URL` host from `localhost` to `127.0.0.1`)

### Decisions made
- **Static-prompt steps reconstruct their prompt from `tempData`; only the three
  numbered-list steps (doctor/date/slot) cache `lastPrompt` verbatim.** This keeps
  invalid-input re-asks cheap for most steps while guaranteeing the dynamic lists
  stay stable and correctly indexed across a retry.
- **Token assignment concurrency**: two patients confirming the same doctor+date at
  the same instant must never collide. Chose a Postgres advisory transaction lock
  (`pg_advisory_xact_lock(hashtext('doctorId:date'))`) plus `FOR UPDATE` on the slot
  row over an application-level in-memory lock, since it's correct across multiple
  server instances (the in-memory `withKeyLock` mutex added later is explicitly
  single-process and NOT used for this — see below).
- **Unknown senders → patient bot, with auto-registration.** Consistent with the
  Phase 2 decision that unknown numbers are prospective patients; the booking bot is
  where the `users` row actually gets created (needed as `appointments.patient_id`).
- **Two infrastructure bugs found and fixed during live testing** (both would have
  caused silently-dropped or corrupted webhook processing in production, not just
  local dev):
  1. **Root cause, `localhost` DNS resolution**: `DATABASE_URL`/`REDIS_URL` used
     `localhost`, which Node resolves to `::1` (IPv6) before falling back to IPv4 on
     this Windows/WSL2 + Docker Desktop setup. Docker Desktop's IPv6 port-forward for
     Postgres was flaky, causing ~26-30s stalls before every fresh connection
     (observed as `ECONNRESET` after a long hang) — this looked exactly like random
     dropped messages under load-tested locally. Fixed by using `127.0.0.1` explicitly
     in both URLs. **Recommendation for production deployment**: use explicit IPv4
     addresses or verify IPv6 connectivity to the DB/Redis hosts before relying on
     hostname resolution.
  2. **Defense in depth added regardless of the above fix** (a real DB/network blip
     is always possible in production, not just this dev quirk):
     - `src/lib/db/db.ts`: `keepAlive: true` (survive idle NAT/proxy timeouts),
       `connectionTimeoutMillis: 5000` (fail fast instead of hanging), and a
       `pool.on("error", ...)` handler (node-postgres crashes the process on an
       unhandled pool error event otherwise).
     - `src/lib/retry.ts` (`withRetry`): retries transient failures once (300ms
       backoff) around webhook message/status processing in
       `components/whatsapp/controller.ts`, with per-attempt warn-level logging for
       observability. Upholds the Phase 2 "nothing is silently dropped" guarantee.
     - `src/lib/mutex.ts` (`withKeyLock`): discovered a genuine correctness bug while
       testing the retry — if one message's processing is slow (e.g. hits the retry
       path) while a later message for the *same sender* processes quickly, they can
       race and corrupt `conversation_state` (read-modify-write out of order). Meta
       does not guarantee in-order webhook delivery, so this isn't purely a local
       testing artifact. Fixed by serializing `handleInboundMessage` per
       `(phone_number_id, from)` — an in-process async mutex keyed on data available
       *before* any DB call, so a slow tenant lookup for one message still blocks a
       later message for the same sender behind it. Different senders/tenants remain
       fully concurrent. Verified in isolation (order preserved under an artificial
       500ms delay; different keys run concurrently, not serialized against each
       other) since the live network stall wasn't reliably reproducible on demand.
     - Note: `withKeyLock` is in-process only (a `Map` in memory) — correct for a
       single server instance. If this service is ever horizontally scaled, per-sender
       serialization would need to move to a Postgres advisory lock (same pattern
       already used for token assignment) or a Redis-based lock instead.

---

## Phase 4 — BullMQ Queues
Status: DONE
Date: 2026-08-03

### What was built
- Three BullMQ queues (`src/lib/bull/queues.ts`, built on the Phase-1
  `createQueue`/`bullConnection` infra): `reminder_queue`, `report_queue`,
  `notification_queue` — each with a typed job-data interface.
- **`reminder_queue`**: `components/appointments/queue/schedule-reminder.ts`
  (`scheduleReminder(appointment, tenantTimezone)`) computes the appointment's exact
  UTC instant from its `(appointment_date, appointment_time)` wall-clock values in
  the tenant's IANA timezone (new zero-dependency helper, `common/timezone.ts` —
  `zonedTimeToUtc`, using the standard double-`Intl.DateTimeFormat` offset trick,
  correct across DST), subtracts 24h, and adds a delayed `send-reminder` job. If
  that moment has already passed (booking made within 24h of the appointment), the
  reminder is skipped rather than firing late/immediately — logged at info level.
  `components/appointments/queue/reminder-worker.ts` sends the WhatsApp reminder and
  sets `reminder_sent = true`; a no-op guard skips sending if the appointment was
  since cancelled/completed or already reminded.
- **`report_queue`**: `components/reports/queue/enqueue-report-delivery.ts`
  (`enqueueReportDelivery(reportId)`, ready for Phase 5's REPORT command to call)
  adds a `deliver-report` job. `components/reports/queue/report-worker.ts` re-sends
  the uploaded PDF by its WhatsApp media id (`report.file_url`) as a `document`
  message to the patient, then sets `status = 'sent'`. Retries are handled by the
  queue's existing `defaultJobOptions` (3 attempts, exponential backoff — already
  built in Phase 1's `lib/bull/index.ts`); a `worker.on("failed", ...)` listener
  mirrors `job.attemptsMade` onto `reports.retry_count` and sets `status = 'failed'`
  once the final attempt is exhausted.
- **`notification_queue`**: one queue, two job types, one worker
  (`components/notifications/queue/notification-worker.ts`):
  - `booking-alert` (real-time): `schedule-booking-alert.ts` enqueues immediately
    after `confirm-booking.ts` creates an appointment; the worker sends the doctor a
    "New booking: Token #N — name at time" message.
  - `morning-summary` (daily 8 AM, per tenant's own timezone): registered via BullMQ
    `upsertJobScheduler` with `{pattern: "0 8 * * *", tz: tenant.timezone}` — BullMQ/
    cron-parser handle the timezone conversion natively (no manual date math needed
    here, unlike the reminder). `sync-morning-summary-schedulers.ts`
    (`syncMorningSummarySchedulers()`) re-registers one scheduler per active tenant
    at boot (idempotent — safe to re-run every restart, mirrors the reference
    project's `syncSchedulers()` pattern). The worker iterates every active doctor
    for that tenant and sends each one their own list of today's booked
    appointments (or "no appointments today").
- `confirm-booking.ts` now fires both `scheduleReminder` and `scheduleBookingAlert`
  right after a successful `createAppointmentFromBooking`.
- `src/index.ts`: side-effect imports instantiate all three workers; boot calls
  `syncMorningSummarySchedulers()`; graceful shutdown now calls `closeWorkers()`
  (Phase-1 infra, unused until now) before closing the DB pool.
- Verified live end-to-end (Postgres + Redis via compose, mock Graph API standing in
  for Meta): booked an appointment for later today → reminder correctly skipped
  (24h-before window already past) + booking alert delivered to the doctor
  instantly; booked a future appointment (Aug 5, 09:00 IST) → reminder job found in
  Redis with `delay` computing to exactly `2026-08-04T03:30:00Z` (09:00 IST on
  Aug 4 — verified against a manual UTC calculation) + booking alert delivered;
  `notification_queue` repeatable scheduler present in Redis, next-run timestamp
  verified to be `2026-08-04T02:30:00Z` (08:00 IST, correctly rolled to tomorrow
  since today's 8 AM had already passed); report delivery success path (mock
  succeeds → `status = 'sent'`) and failure path (mock stopped → 3 failed attempts →
  `status = 'failed'`, `retry_count = 3`, permanent-failure logged) both verified.

### Files created or modified
- `src/common/timezone.ts` (new — `zonedTimeToUtc`)
- `src/lib/bull/queues.ts` (new — the three `Queue` instances + job data types)
- `src/components/appointments/queue/schedule-reminder.ts`, `reminder-worker.ts`,
  `index.ts`
- `src/components/reports/queue/enqueue-report-delivery.ts`, `report-worker.ts`,
  `index.ts`
- `src/components/notifications/queue/schedule-booking-alert.ts`,
  `sync-morning-summary-schedulers.ts`, `notification-worker.ts`, `index.ts` (new
  component)
- `src/components/booking/steps/confirm-booking.ts` (fires reminder + booking alert)
- `src/index.ts` (worker side-effect imports, scheduler sync at boot,
  `closeWorkers()` on shutdown)

### Decisions made
- **No new date-library dependency for reminder timing.** `zonedTimeToUtc` uses only
  the built-in `Intl.DateTimeFormat` (format the UTC guess in the target zone,
  diff against the guess to get that date's actual offset, correct for it) —
  correct across DST because the offset is computed per-instant, not fixed. Verified
  against Asia/Kolkata (UTC+5:30, no DST) and America/New_York in both summer (EDT)
  and winter (EST). Reserved for the reminder's one-off delay computation; the daily
  cron instead uses BullMQ's own `tz` repeat option, which is the more natural fit
  for a recurring schedule.
- **Reminder skipped (not sent late/immediately) if the 24h-before moment has
  already passed.** A same-day or next-day booking made close to the appointment
  shouldn't get a reminder at a nonsensical time; the patient already just booked
  and confirmed the details.
- **`report_queue` reuses the existing `defaultJobOptions` (3 attempts, exponential
  backoff) rather than a bespoke retry loop** — satisfies "failed after 3 retries"
  directly from BullMQ's own retry mechanics; the `worker.on("failed")` listener
  only needs to translate `job.attemptsMade` into the DB row.
- **`notification_queue` carries two job names on one queue/worker** rather than two
  separate queues, since they share identical delivery semantics (send one WhatsApp
  message, no retries-with-DB-side-effects like the other two queues) — kept it to
  one BullMQ primitive instead of multiplying infra for a distinction without a
  difference.
- **New `components/notifications/` component** (not folded into `appointments` or
  `doctors`) for the two doctor-facing notification job types, since neither
  "appointments" nor "doctors" domain code needs to own message-composition/queue
  logic — mirrors the reference project's principle of a thin, single-purpose
  component per concern.

---

## Phase 5 — Staff Command Handler
Status: DONE
Date: 2026-08-03

### What was built
- New `components/staff/` component, self-registered as the router's staff handler
  (`registerStaffMessageHandler`) via `components/staff/index.ts`, side-effect
  imported from `src/index.ts` — mirrors the booking bot's registration pattern.
  `handle-staff-message.ts` is the single entry point: a document-type message is
  routed straight to the REPORT flow; otherwise the first whitespace-delimited word
  is the command (case-insensitive), the rest is passed as `args` to one command
  handler per file under `commands/`. Unknown commands get the full command list
  back so staff always know how to recover.
- **TODAY** (`commands/today.ts`): lists today's appointments. A doctor sees only
  their own queue; a receptionist sees every doctor's queue for the tenant —
  enforced by `resolve-doctor-scope.ts` (`resolveDoctorScope`), a shared helper used
  by TODAY/DONE/NOSHOW/CANCEL so a doctor can never act on another doctor's queue.
- **DONE `<token>`** / **NOSHOW `<token>`** (`commands/done.ts`, `commands/noshow.ts`):
  look up today's booked appointment by token via the new
  `findTodaysAppointmentByToken` service and set status to `completed`/`noshow`.
  Since token numbers are only unique *per doctor per day*, a token matching more
  than one doctor's queue today (only possible for a receptionist, since a doctor's
  lookup is already scoped) returns a clarifying "matches multiple doctors" message
  instead of silently acting on the wrong appointment.
- **CANCEL `<token>` `<reason>`** (`commands/cancel.ts`): same token lookup, then
  `cancelAppointment` (new service) sets `status = 'cancelled'` + `cancel_reason`
  *and* frees the slot back to `available` in one transaction, then sends the
  patient a WhatsApp cancellation notice with the reason.
- **BLOCK `<doctor name>` `<date YYYY-MM-DD>`** (`commands/block.ts`): parsed by
  taking the last whitespace token as the date and everything before it as the
  (possibly multi-word) doctor name, matched via Phase-3's `findDoctorsByName`
  (0 matches → not-found, 2+ → ambiguous, listing candidates). Inserts into
  `blocked_dates` (`onConflictDoNothing` — reports "already blocked" on a repeat),
  sets every slot on that doctor+date to `blocked`, and cancels+notifies every
  affected *booked* appointment on that date (reason: "`<doctor>` unavailable on
  this date").
- **SLOT `<doctor name>` `<days>` `<start HH:MM>` `<end HH:MM>` `<duration>`**
  (`commands/slot.ts`): parses the last 4 tokens as `days`/`start`/`end`/`duration`
  (everything before is the doctor name, same trailing-token strategy as BLOCK),
  validates time format/ordering and a positive integer duration, parses `days` via
  the new `common/day-of-week.ts` (`MON,WED,FRI` → `DayOfWeek[]`), and calls the
  *same* `generateSlots` service built in Phase 1 for the seed script — no
  duplicated slot-generation logic between seeding and this command, as planned.
- **REPORT** (`commands/report.ts`): not a standalone text command — triggered when
  the inbound message is a `document` whose caption matches `REPORT <phone>`
  (case-insensitive). Resolves the patient by `(tenant_id, phone)`, inserts a
  `reports` row (`file_url` = the WhatsApp media id, `uploaded_by` = the sender),
  and calls Phase 4's `enqueueReportDelivery`. A document without a matching
  caption, or a plain "REPORT ..." text message with no attachment, gets an
  explanatory usage message instead of silently doing nothing.
- Every command returns a plain string reply, sent back via the same
  `sendTextMessage` utility everything else uses — success and error paths both
  produce a clear WhatsApp message to the sender.
- Verified live end-to-end (Postgres + Redis via compose, mock Graph API): TODAY
  (both receptionist clinic-wide and doctor self-scoped views), DONE, NOSHOW, and
  CANCEL (including the patient receiving the cancellation WhatsApp message) each
  confirmed against real booked appointments; BLOCK confirmed to insert
  `blocked_dates`, flip 12 slots to `blocked`, cancel the one affected booked
  appointment, and notify that patient; SLOT confirmed to create exactly 12 new
  slots (2 matching Saturdays in the horizon × 6 slots/day) via fuzzy doctor-name
  match ("Asha" → "Dr. Asha Verma"); REPORT confirmed end-to-end — receptionist
  gets "queued" confirmation, `reports` row created and reaches `status = 'sent'`,
  patient receives the outbound document message. Error paths verified: unknown
  command, token not found, missing CANCEL reason, unknown doctor name, invalid
  SLOT days — each returns a specific, actionable message.

### Files created or modified
- `src/common/day-of-week.ts` (new — `parseWeekdays`)
- `src/components/doctors/services/get-doctor-by-user-id.ts` (+ `index.ts` update)
- `src/components/appointments/services/find-todays-appointment-by-token.ts`,
  `list-todays-appointments.ts`, `mark-appointment-status.ts` (+ `index.ts` update)
- `src/components/staff/resolve-doctor-scope.ts`, `handle-staff-message.ts`,
  `index.ts`
- `src/components/staff/commands/today.ts`, `done.ts`, `noshow.ts`, `cancel.ts`,
  `block.ts`, `slot.ts`, `report.ts`, `index.ts`
- `src/components/whatsapp/services/parse-inbound.ts` (bug fix — see Decisions)
- `src/lib/db/seed.ts` (bug fix — see Decisions)
- `src/index.ts` (side-effect import of `components/staff/index.js`)

### Decisions made
- **Bug found and fixed: document/image captions were never extracted.**
  `parse-inbound.ts`'s `extractBody` only handled `text` and `button` message
  types — a `document` message's `caption` (where the REPORT command's
  `"REPORT <phone>"` text actually lives) was silently dropped, which would have
  made the REPORT command permanently unreachable. Added `caption` to the
  document/image Zod schemas and to `extractBody`.
- **Bug found and fixed: seeded doctor/receptionist phone numbers had a leading
  `+`, which never matches Meta's webhook `from` field** (Meta sends plain digits —
  country code + number, no `+`). Since role resolution is an exact string match on
  `(tenant_id, phone_number)`, the seeded staff could never have been recognized as
  staff by a real (or simulated) webhook — every message from them would have
  resolved as `role: "unknown"` and been routed to the *patient* bot instead of the
  staff parser. Fixed in `seed.ts` (and by updating the already-seeded rows) with a
  code comment recording the convention. **Anyone integrating with the real Meta
  API must store phone numbers without a leading `+` for this same reason.**
- **Token-number ambiguity is surfaced, never guessed.** The spec's `DONE
  [token]`/`NOSHOW [token]`/`CANCEL [token] [reason]` don't take a doctor argument,
  but token numbers reset to 1 per doctor per day — so with 2+ doctors both having
  a "token #3" today, a bare `DONE 3` from a receptionist is genuinely ambiguous.
  Rather than silently picking one (wrong-patient risk in a medical context), the
  bot lists the conflicting doctor names and asks the doctor themselves to send the
  command (which resolves unambiguously via their own doctor-scoped lookup).
- **BLOCK cancels *and* notifies, rather than just recording the block.** The spec
  says "add to blocked_dates, notify affected patients" — read literally as also
  requiring existing bookings on that date to be resolved, not left dangling as
  `booked` appointments against now-blocked slots.
- **CANCEL frees the underlying slot back to `available`** (not left `booked`)
  since a cancelled appointment should be immediately rebookable — same reasoning
  applied to BLOCK setting affected slots to `blocked` rather than leaving stale
  `booked` slots with no live appointment behind them.
- **BLOCK/SLOT parse the doctor name by taking fixed-format tokens off the *end* of
  the string** (date for BLOCK; days/start/end/duration for SLOT), since the doctor
  name itself may contain spaces and has no other reliable delimiter in a
  plain-text WhatsApp command.

---
