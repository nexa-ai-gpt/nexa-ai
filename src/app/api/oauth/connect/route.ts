import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { nango, requireGoogleIntegrationId, requireOAuthStateSecret } from "@/lib/nango";
import { requireUser } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestId, logError, logInfo, logWarn } from "@/lib/logging";
import { signState } from "@/lib/oauth-state";

export async function POST(req: Request) {
  const requestId = getRequestId();
  try {
    const { provider, redirectTo } = await req.json();
    if (provider !== "google") {
      return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
    }

    const { supabase, user } = await requireUser();
    if (!user) {
      logWarn("oauth.connect.unauthorized", { requestId });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limiter = rateLimit(`oauth-connect:${user.id}`, 5, 60_000);
    if (!limiter.allowed) {
      logWarn("oauth.connect.rate_limited", { requestId, userId: user.id });
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const integrationId = requireGoogleIntegrationId();
    if (!integrationId) {
      logError("oauth.connect.missing_integration", { requestId, userId: user.id });
      return NextResponse.json(
        { error: "Missing GMAIL_INTEGRATION_ID" },
        { status: 500 },
      );
    }

    const nonce = crypto.randomBytes(16).toString("hex");
    const connectionId = `supabase:${user.id}:google:${crypto
      .randomBytes(4)
      .toString("hex")}`;

    const safeRedirect =
      typeof redirectTo === "string" && redirectTo.startsWith("/")
        ? redirectTo
        : null;

    const { data: stateRow, error } = await supabase
      .from("oauth_states")
      .insert({
        user_id: user.id,
        provider: "google",
        nonce,
        connection_id: connectionId,
        redirect_to: safeRedirect,
      })
      .select("id")
      .single();

    if (error || !stateRow) {
      logError("oauth.connect.state_create_failed", { requestId, userId: user.id, error });
      return NextResponse.json(
        { error: "Failed to create oauth state" },
        { status: 500 },
      );
    }

    const state = signState(stateRow.id, nonce, requireOAuthStateSecret());

    const connect = await nango.createConnectSession({
      allowed_integrations: [integrationId],
      end_user: {
        id: user.id,
        email: user.email ?? undefined,
      },
    });

    const connectLink = new URL(connect.data.connect_link);
    connectLink.searchParams.set("state", state);
    connectLink.searchParams.set("provider", "google");
    connectLink.searchParams.set("connection_id", connectionId);

    logInfo("oauth.connect.created", {
      requestId,
      userId: user.id,
      provider: "google",
      stateId: stateRow.id,
    });

    return NextResponse.json({ connectLink: connectLink.toString() });
  } catch (error) {
    logError("oauth.connect.unhandled_error", { requestId, error });
    const message =
      error instanceof Error
        ? error.message
        : "Failed to start OAuth. Check env vars and Nango integration settings.";
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
