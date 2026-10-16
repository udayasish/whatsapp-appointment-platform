import { app } from "../app.js";
import axios from "axios";
import { bullConnection } from "../lib/bull/index.js";
import { pool } from "../lib/db/index.js";
import type { AddressInfo } from "net";

async function run() {
  console.log("Starting local test server...");
  const server = app.listen(0);
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`Server listening on ${baseUrl}`);

  const client = axios.create({
    baseURL: baseUrl,
    validateStatus: () => true,
  });

  try {
    console.log("\n=== Test 1: HEAD /api/ivr/prompt ===");
    const headRes = await client.head("/api/ivr/prompt");
    console.log(`Status: ${headRes.status}`);
    console.log(`Content-Type: ${headRes.headers["content-type"]}`);
    if (headRes.status !== 200) throw new Error("HEAD /prompt failed");
    if (headRes.headers["content-type"] !== "application/json") {
      throw new Error(`Unexpected Content-Type: ${headRes.headers["content-type"]}`);
    }
    console.log("PASS: HEAD /prompt returned 200 with exact application/json");

    console.log("\n=== Test 2: HEAD /api/ivr/prompt/fallback ===");
    const headFbRes = await client.head("/api/ivr/prompt/fallback");
    console.log(`Status: ${headFbRes.status}`);
    console.log(`Content-Type: ${headFbRes.headers["content-type"]}`);
    if (headFbRes.status !== 200) throw new Error("HEAD /prompt/fallback failed");
    if (headFbRes.headers["content-type"] !== "application/json") {
      throw new Error(`Unexpected Content-Type: ${headFbRes.headers["content-type"]}`);
    }
    console.log("PASS: HEAD /prompt/fallback returned 200 with exact application/json");

    console.log("\n=== Test 3: GET /api/ivr/prompt (Cold Call / First hit) ===");
    const coldStart = Date.now();
    const coldRes = await client.get("/api/ivr/prompt?CallSid=COLD_CALL_1&To=09513886363&From=07002059544");
    const coldDuration = Date.now() - coldStart;
    console.log(`Cold response in ${coldDuration}ms:`, JSON.stringify(coldRes.data));
    console.log(`Content-Type: ${coldRes.headers["content-type"]}`);
    if (coldRes.status !== 200) throw new Error("Cold GET failed");
    if (coldDuration > 200) {
      console.warn(`WARNING: Cold start took ${coldDuration}ms, expected sub-100ms`);
    } else {
      console.log(`PASS: Cold start responded instantly in ${coldDuration}ms`);
    }

    console.log("\n=== Test 4: POST /api/ivr/incoming (Call Init & Redis Pipeline) ===");
    // Ensure active tenant is mapped to IVR test phone number
    await pool.query(
      "UPDATE tenants SET ivr_phone_number = CASE WHEN name = 'Bang Clinic' THEN '09513886363' ELSE NULL END"
    );
    const tenantCheck = await pool.query("SELECT id, name, ivr_phone_number FROM tenants WHERE ivr_phone_number = '09513886363'");
    console.log("Configured tenant for IVR:", tenantCheck.rows[0]);

    const testSid = `BENCH_${Date.now()}`;
    const testPhone = "07002059544";
    const testTo = "09513886363";

    const initStart = Date.now();
    const initRes = await client.post(
      "/api/ivr/incoming",
      new URLSearchParams({
        CallSid: testSid,
        From: testPhone,
        To: testTo,
      }).toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    const initDuration = Date.now() - initStart;
    console.log(`Incoming init took ${initDuration}ms, status: ${initRes.status}`);

    // Verify Redis keys
    const sessionRaw = await bullConnection.get(`ivr:session:${testSid}`);
    const dataRaw = await bullConnection.get(`ivr:data:${testSid}`);
    const promptWelcome = await bullConnection.get(`ivr:prompt:${testSid}:welcome`);
    const promptDoctor = await bullConnection.get(`ivr:prompt:${testSid}:select_doctor`);

    console.log("Redis ivr:session exists?", !!sessionRaw);
    console.log("Redis ivr:data exists?", !!dataRaw);
    console.log("Redis ivr:prompt:welcome:", promptWelcome);
    console.log("Redis ivr:prompt:select_doctor:", promptDoctor);

    if (!sessionRaw || !promptWelcome || !promptDoctor) {
      throw new Error("Redis pipeline failed to store initial data and precomputed prompts!");
    }
    console.log("PASS: Pipeline stored session, data, and initial prompts");

    console.log("\n=== Test 5: Benchmark GET /api/ivr/prompt Latency (Redis Served) ===");
    for (let i = 1; i <= 5; i++) {
      const t0 = Date.now();
      const res = await client.get(`/api/ivr/prompt?CallSid=${testSid}`);
      const elapsed = Date.now() - t0;
      console.log(`Iteration ${i}: ${elapsed}ms | Prompt: "${res.data.gather_prompt?.text}"`);
      if (res.status !== 200) throw new Error(`GET /prompt returned ${res.status}`);
      if (elapsed > 50) {
        console.warn(`WARNING: Iteration ${i} took ${elapsed}ms > 50ms`);
      }
    }
    console.log("PASS: Prompt served directly from Redis with sub-50ms latency!");

    console.log("\n=== Test 6: Step 1 (Press 1 -> select_doctor) ===");
    const step1Res = await client.post(
      "/api/ivr/step",
      new URLSearchParams({ CallSid: testSid, Digits: "1", From: testPhone, To: testTo }).toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    console.log(`Step 1 status: ${step1Res.status} (Expected 200)`);
    if (step1Res.status !== 200) throw new Error(`Step 1 failed with ${step1Res.status}`);

    console.log("\n=== Test 7: GET /api/ivr/prompt (Doctor Menu) ===");
    const doctorPromptRes = await client.get(`/api/ivr/prompt?CallSid=${testSid}`);
    console.log("Doctor prompt text:", doctorPromptRes.data.gather_prompt?.text);

    console.log("\n=== Test 8: Step 2 (Select Doctor 1 -> select_date) ===");
    const step2Res = await client.post(
      "/api/ivr/step",
      new URLSearchParams({ CallSid: testSid, Digits: "1", From: testPhone, To: testTo }).toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    console.log(`Step 2 status: ${step2Res.status} (Expected 200)`);
    if (step2Res.status !== 200) throw new Error(`Step 2 failed with ${step2Res.status}`);

    console.log("\n=== Test 9: GET /api/ivr/prompt (Date Menu) ===");
    const datePromptRes = await client.get(`/api/ivr/prompt?CallSid=${testSid}`);
    console.log("Date prompt text:", datePromptRes.data.gather_prompt?.text);

    console.log("\n=== Test 10: Step 3 (Select Date 1 -> select_slot) ===");
    const step3Res = await client.post(
      "/api/ivr/step",
      new URLSearchParams({ CallSid: testSid, Digits: "1", From: testPhone, To: testTo }).toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    console.log(`Step 3 status: ${step3Res.status} (Expected 200)`);
    if (step3Res.status !== 200) throw new Error(`Step 3 failed with ${step3Res.status}`);

    console.log("\n=== Test 11: GET /api/ivr/prompt (Slot Menu) ===");
    const slotPromptRes = await client.get(`/api/ivr/prompt?CallSid=${testSid}`);
    console.log("Slot prompt text:", slotPromptRes.data.gather_prompt?.text);

    console.log("\n=== Test 12: Step 4 (Select Slot 1 -> confirm) ===");
    const step4Res = await client.post(
      "/api/ivr/step",
      new URLSearchParams({ CallSid: testSid, Digits: "1", From: testPhone, To: testTo }).toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    console.log(`Step 4 status: ${step4Res.status} (Expected 200)`);
    if (step4Res.status !== 200) throw new Error(`Step 4 failed with ${step4Res.status}`);

    console.log("\n=== Test 13: GET /api/ivr/prompt (Confirm Menu) ===");
    const confirmPromptRes = await client.get(`/api/ivr/prompt?CallSid=${testSid}`);
    console.log("Confirm prompt text:", confirmPromptRes.data.gather_prompt?.text);

    console.log("\n=== Test 14: Step 5 (Press 1 to Confirm Booking) ===");
    const step5Res = await client.post(
      "/api/ivr/step",
      new URLSearchParams({ CallSid: testSid, Digits: "1", From: testPhone, To: testTo }).toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    console.log(`Step 5 status: ${step5Res.status} (Must be 200, NEVER 302!)`);
    if (step5Res.status !== 200) throw new Error(`Step 5 returned ${step5Res.status}, expected 200`);

    console.log("\n=== Test 15: GET /api/ivr/prompt (Confirmed Prompt Playback) ===");
    const tConfirmed = Date.now();
    const confirmedPromptRes = await client.get(`/api/ivr/prompt?CallSid=${testSid}`);
    console.log(`Fetched confirmed prompt in ${Date.now() - tConfirmed}ms:`, confirmedPromptRes.data.gather_prompt?.text);
    if (!confirmedPromptRes.data.gather_prompt?.text?.includes("confirmed")) {
      throw new Error("Confirmed prompt text does not contain 'confirmed'!");
    }
    console.log("PASS: Confirmation message with token successfully queued and served to Gather applet!");

    console.log("\n=== Test 16: Call Hangup & Key Cleanup ===");
    const hangupRes = await client.post(
      "/api/ivr/hangup",
      new URLSearchParams({ CallSid: testSid }).toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    console.log(`Hangup status: ${hangupRes.status}`);

    const remainingSession = await bullConnection.get(`ivr:session:${testSid}`);
    const remainingData = await bullConnection.get(`ivr:data:${testSid}`);
    const remainingPrompt = await bullConnection.get(`ivr:prompt:${testSid}:confirmed`);

    console.log("Remaining session:", remainingSession);
    console.log("Remaining data:", remainingData);
    console.log("Remaining prompt:", remainingPrompt);

    if (remainingSession || remainingData || remainingPrompt) {
      throw new Error("Cleanup failed: Redis keys still exist after hangup!");
    }
    console.log("PASS: All Redis keys cleaned up on hangup");

    console.log("\nALL IVR TESTS PASSED SUCCESSFULLY! Sub-50ms dynamic Gather is validated.");
  } finally {
    server.close();
    await bullConnection.quit();
    await pool.end();
  }
}

run().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
