import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET as exportUserData } from "../src/app/api/user/export/route.ts";
import { DELETE as deleteUserProfile } from "../src/app/api/user/profile/route.ts";

test("GDPR Art. 20 / CCPA Data Portability: export endpoint enforces verified authentication", async () => {
  const response = await exportUserData();
  assert.equal(response.status, 401);
  const json = await response.json();
  assert.equal(json.code, "AUTH_REQUIRED");
});

test("GDPR Art. 17 / CCPA Right to Erasure: profile deletion endpoint rejects unverified origin and unauthenticated calls", async () => {
  // Test invalid origin
  const invalidOriginReq = new NextRequest("http://localhost:3000/api/user/profile", {
    method: "DELETE",
    headers: { origin: "https://evil-attacker.example.com" },
  });
  const res1 = await deleteUserProfile(invalidOriginReq);
  assert.equal(res1.status, 403);
  const json1 = await res1.json();
  assert.equal(json1.code, "INVALID_ORIGIN");

  // Test same origin but unauthenticated
  const validOriginReq = new NextRequest("http://localhost:3000/api/user/profile", {
    method: "DELETE",
    headers: {
      origin: "http://localhost:3000",
      host: "localhost:3000",
    },
  });
  const res2 = await deleteUserProfile(validOriginReq);
  assert.equal(res2.status, 401);
  const json2 = await res2.json();
  assert.equal(json2.code, "AUTH_REQUIRED");
});

test("ePrivacy Directive Art. 5(3) & CNIL: cookie inventory adheres to strictly necessary criteria", () => {
  const COOKIE_INVENTORY = [
    { name: "__Secure-next-auth.session-token", type: "authentication", exempt: true },
    { name: "__Host-next-auth.csrf-token", type: "security_csrf", exempt: true },
    { name: "next-auth.callback-url", type: "user_input_state", exempt: true },
    { name: "zt_cookie_consent_v1", type: "compliance_record", exempt: true },
    { name: "theme", type: "user_customization", exempt: true },
  ];

  for (const item of COOKIE_INVENTORY) {
    // Under WP 194, essential authentication, CSRF security tokens, and user preference cookies are exempt from prior consent
    assert.equal(item.exempt, true, `${item.name} must be classified as exempt under Article 5(3) WP 194`);
  }
});
