import test from "node:test";
import assert from "node:assert/strict";
import { signState } from "@/lib/oauth-state";
import { validateOAuthState } from "@/lib/oauth-flow";
import { extractAccountMetadata } from "@/lib/connected-account";

test("connect -> callback happy path (mocked)", () => {
  const secret = "super-secret-key";
  const userId = "user-123";
  const stateId = "state-abc";
  const nonce = "nonce-xyz";
  const state = signState(stateId, nonce, secret);

  const oauthState = {
    id: stateId,
    nonce,
    user_id: userId,
    provider: "google",
    created_at: new Date().toISOString(),
  };

  const validation = validateOAuthState({
    stateParam: state,
    secret,
    oauthState,
    userId,
    provider: "google",
    now: Date.now(),
  });

  assert.ok(validation.ok);

  const connection = {
    credentials: {
      raw: {
        email: "demo@example.com",
        name: "Demo User",
        scope: "gmail.readonly calendar",
      },
    },
  };

  const metadata = extractAccountMetadata(connection);
  assert.equal(metadata.email, "demo@example.com");
  assert.equal(metadata.name, "Demo User");
  assert.deepEqual(metadata.scopes, ["gmail.readonly", "calendar"]);
});
