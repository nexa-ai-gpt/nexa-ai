import test from "node:test";
import assert from "node:assert/strict";
import { signState, verifyState } from "@/lib/oauth-state";

test("signState + verifyState roundtrip", () => {
  const secret = "super-secret-key";
  const state = signState("id123", "nonce456", secret);
  const parsed = verifyState(state, secret);
  assert.ok(parsed);
  assert.equal(parsed?.id, "id123");
  assert.equal(parsed?.nonce, "nonce456");
});

test("verifyState rejects tampered signatures", () => {
  const secret = "super-secret-key";
  const state = signState("id123", "nonce456", secret);
  const tampered = state.replace("nonce456", "nonce789");
  const parsed = verifyState(tampered, secret);
  assert.equal(parsed, null);
});
