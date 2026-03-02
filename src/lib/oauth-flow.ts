import { verifyState } from "@/lib/oauth-state";

export const STATE_TTL_MS = 10 * 60 * 1000;

export function validateOAuthState(params: {
  stateParam: string;
  secret: string;
  oauthState: {
    id: string;
    nonce: string;
    user_id: string;
    provider: string;
    created_at: string;
  } | null;
  userId: string;
  provider: string;
  now?: number;
}) {
  const { stateParam, secret, oauthState, userId, provider } = params;
  const now = params.now ?? Date.now();
  const state = verifyState(stateParam, secret);
  if (!state) {
    return { ok: false, error: "invalid_state" as const };
  }
  if (!oauthState || oauthState.id !== state.id || oauthState.nonce !== state.nonce) {
    return { ok: false, error: "state_not_found" as const };
  }
  if (oauthState.user_id !== userId || oauthState.provider !== provider) {
    return { ok: false, error: "state_mismatch" as const };
  }
  const createdAt = new Date(oauthState.created_at).getTime();
  if (now - createdAt > STATE_TTL_MS) {
    return { ok: false, error: "state_expired" as const };
  }
  return { ok: true, state };
}
