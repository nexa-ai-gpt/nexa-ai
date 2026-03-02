import crypto from "node:crypto";

export function signState(id: string, nonce: string, secret: string) {
  const payload = `${id}.${nonce}`;
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

export function verifyState(state: string, secret: string) {
  const parts = state.split(".");
  if (parts.length !== 3) return null;
  const [id, nonce, signature] = parts;
  const payload = `${id}.${nonce}`;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }
  return { id, nonce };
}
