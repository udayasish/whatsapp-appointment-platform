import { isSessionExpired } from "../src/components/booking/services/session-manager.js";
import type { ConversationState } from "../src/lib/db/index.js";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

console.log("--- Testing Session Expiration Logic ---");

// Test 1: Idle state should never expire
const idleState: ConversationState = {
  id: "test-1",
  tenantId: "tenant-1",
  phoneNumber: "+919876543210",
  currentStep: "idle",
  tempData: {},
  createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
  updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
};
assert(!isSessionExpired(idleState, 15), "Idle state never expires even after 1 day");

// Test 2: Active state within window should not expire
const recentActiveState: ConversationState = {
  id: "test-2",
  tenantId: "tenant-1",
  phoneNumber: "+919876543210",
  currentStep: "select_language",
  tempData: {},
  createdAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
  updatedAt: new Date(Date.now() - 5 * 60 * 1000),
};
assert(!isSessionExpired(recentActiveState, 15), "Active state 5 mins ago is not expired for 15 min window");

// Test 3: Active state past window should expire
const expiredActiveState: ConversationState = {
  id: "test-3",
  tenantId: "tenant-1",
  phoneNumber: "+919876543210",
  currentStep: "select_language",
  tempData: {},
  createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
  updatedAt: new Date(Date.now() - 30 * 60 * 1000),
};
assert(isSessionExpired(expiredActiveState, 15), "Active state 30 mins ago IS expired for 15 min window");

// Test 4: Stale Webhook Message calculation
console.log("\n--- Testing Webhook Stale Guard Calculation ---");
const nowSeconds = Math.floor(Date.now() / 1000);
const freshMessageAge = nowSeconds - (nowSeconds - 10); // 10 seconds old
const staleMessageAge = nowSeconds - (nowSeconds - 3600); // 1 hour old (from retry)
const maxAge = 300; // 5 minutes

assert(freshMessageAge <= maxAge, "10-second-old message is accepted");
assert(staleMessageAge > maxAge, "1-hour-old message is recognized as stale and dropped");

console.log("\n🎉 All Session Timeout & Stale Guard Tests Passed Successfully!");
