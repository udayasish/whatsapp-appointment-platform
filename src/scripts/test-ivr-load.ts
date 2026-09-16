/**
 * IVR Concurrency & Load Test Script
 *
 * Simulates multiple concurrent callers calling the IVR system simultaneously:
 * 1. POST /api/ivr/incoming (Call initialization)
 * 2. POST /api/ivr/step with Digits=1 (Select Book Appointment)
 * 3. POST /api/ivr/step with Digits=1 (Select First Doctor)
 * 4. POST /api/ivr/step with Digits=1 (Select First Date)
 * 5. POST /api/ivr/step with Digits=1 (Select First Slot)
 * 6. POST /api/ivr/step with Digits=1 (Confirm Booking - Advisory lock contention test)
 *
 * Usage:
 *   npx tsx src/scripts/test-ivr-load.ts
 */

import axios from "axios";
import { env } from "../lib/index.js";

const BASE_URL = env.APP_BASE_URL || "http://localhost:3000";
const IVR_PHONE = env.IVR_PHONE_NUMBER || "08047192000";
const CONCURRENT_CALLS = 5;

interface CallResult {
  callId: number;
  callSid: string;
  phone: string;
  durationMs: number;
  outcome: string;
  status: "success" | "slot_contention_handled" | "failed";
}

async function simulateCaller(callerIndex: number): Promise<CallResult> {
  const startTime = Date.now();
  const callSid = `LOAD_TEST_${Date.now()}_${callerIndex}`;
  const phone = `+9198765${String(callerIndex).padStart(5, "0")}`;

  const client = axios.create({
    baseURL: BASE_URL,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    timeout: 10000,
  });

  try {
    // 1. Incoming Call
    const incomingRes = await client.post(
      "/api/ivr/incoming",
      new URLSearchParams({
        CallSid: callSid,
        From: phone,
        To: IVR_PHONE,
      }).toString()
    );

    if (incomingRes.status !== 200 || !incomingRes.data.includes("<Gather")) {
      return {
        callId: callerIndex,
        callSid,
        phone,
        durationMs: Date.now() - startTime,
        outcome: `Incoming call failed: ${incomingRes.data.slice(0, 100)}`,
        status: "failed",
      };
    }

    // 2. Welcome -> Press 1 (Book Appointment)
    await client.post(
      "/api/ivr/step",
      new URLSearchParams({
        CallSid: callSid,
        From: phone,
        To: IVR_PHONE,
        Digits: "1",
      }).toString()
    );

    // 3. Select Doctor -> Press 1
    await client.post(
      "/api/ivr/step",
      new URLSearchParams({
        CallSid: callSid,
        From: phone,
        To: IVR_PHONE,
        Digits: "1",
      }).toString()
    );

    // 4. Select Date -> Press 1
    await client.post(
      "/api/ivr/step",
      new URLSearchParams({
        CallSid: callSid,
        From: phone,
        To: IVR_PHONE,
        Digits: "1",
      }).toString()
    );

    // 5. Select Slot -> Press 1
    await client.post(
      "/api/ivr/step",
      new URLSearchParams({
        CallSid: callSid,
        From: phone,
        To: IVR_PHONE,
        Digits: "1",
      }).toString()
    );

    // 6. Confirm Booking -> Press 1
    const confirmRes = await client.post(
      "/api/ivr/step",
      new URLSearchParams({
        CallSid: callSid,
        From: phone,
        To: IVR_PHONE,
        Digits: "1",
      }).toString()
    );

    const body = String(confirmRes.data);

    if (body.includes("Your appointment is confirmed")) {
      return {
        callId: callerIndex,
        callSid,
        phone,
        durationMs: Date.now() - startTime,
        outcome: "Appointment booked successfully",
        status: "success",
      };
    } else if (body.includes("slot was just booked") || body.includes("Please select another")) {
      return {
        callId: callerIndex,
        callSid,
        phone,
        durationMs: Date.now() - startTime,
        outcome: "Race condition caught gracefully (alternative slot offered)",
        status: "slot_contention_handled",
      };
    } else {
      return {
        callId: callerIndex,
        callSid,
        phone,
        durationMs: Date.now() - startTime,
        outcome: `Unexpected response: ${body.slice(0, 120)}`,
        status: "failed",
      };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      callId: callerIndex,
      callSid,
      phone,
      durationMs: Date.now() - startTime,
      outcome: `Error: ${message}`,
      status: "failed",
    };
  }
}

async function runLoadTest(): Promise<void> {
  console.log(`\n======================================================`);
  console.log(` Starting IVR Concurrency Load Test (${CONCURRENT_CALLS} concurrent callers)`);
  console.log(` Base URL: ${BASE_URL}`);
  console.log(` Target IVR Number: ${IVR_PHONE}`);
  console.log(`======================================================\n`);

  const promises: Promise<CallResult>[] = [];
  for (let i = 1; i <= CONCURRENT_CALLS; i++) {
    promises.push(simulateCaller(i));
  }

  const results = await Promise.all(promises);

  console.log(`\n--- Test Results Summary ---`);
  let successCount = 0;
  let contentionCount = 0;
  let failedCount = 0;

  for (const r of results) {
    console.log(
      `Caller #${r.callId} | Time: ${r.durationMs}ms | Status: [${r.status.toUpperCase()}] | ${r.outcome}`
    );
    if (r.status === "success") successCount++;
    else if (r.status === "slot_contention_handled") contentionCount++;
    else failedCount++;
  }

  console.log(`\n------------------------------------------------------`);
  console.log(`Total calls:             ${CONCURRENT_CALLS}`);
  console.log(`Successful bookings:     ${successCount}`);
  console.log(`Contention handled:      ${contentionCount}`);
  console.log(`Failures/Errors:         ${failedCount}`);
  console.log(`------------------------------------------------------\n`);

  if (failedCount === 0) {
    console.log(`[PASS] Concurrency and slot race condition tests passed!`);
  } else {
    console.log(`[WARN] Some calls failed. Check server logs for details.`);
  }
}

runLoadTest().catch((err) => {
  console.error("Load test execution error:", err);
  process.exit(1);
});
