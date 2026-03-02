import { Nango } from "@nangohq/node";

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const nango = new Nango({
  secretKey: requireEnv("NANGO_SECRET_KEY"),
});

export function requireGoogleIntegrationId() {
  return (
    process.env.GMAIL_INTEGRATION_ID ||
    process.env.NANGO_GOOGLE_INTEGRATION_ID ||
    process.env.NANGO_INTEGRATION_ID ||
    ""
  );
}

export function getGmailWebhookUrl() {
  return process.env.WEBHOOK_GMAIL || "";
}

export function getGmailProviderCallback() {
  return process.env.CALLBACK_GMAIL || "";
}

export function requireOAuthStateSecret() {
  return requireEnv("OAUTH_STATE_SECRET");
}
