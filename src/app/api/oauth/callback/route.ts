import { NextResponse } from "next/server";
import { nango, requireGoogleIntegrationId, requireOAuthStateSecret } from "@/lib/nango";
import { requireUser } from "@/lib/supabase/server";
import { getRequestId, logError, logInfo, logWarn } from "@/lib/logging";
import { validateOAuthState } from "@/lib/oauth-flow";
import { verifyState } from "@/lib/oauth-state";
import { extractAccountMetadata } from "@/lib/connected-account";

export async function GET(req: Request) {
  const requestId = getRequestId();
  const { user, supabase } = await requireUser();
  if (!user) {
    logWarn("oauth.callback.unauthorized", { requestId });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const stateParam = searchParams.get("state");
  if (!stateParam) {
    logWarn("oauth.callback.missing_state", { requestId, userId: user.id });
    return NextResponse.json({ error: "Missing state" }, { status: 400 });
  }
  const parsed = verifyState(stateParam, requireOAuthStateSecret());
  if (!parsed) {
    logWarn("oauth.callback.invalid_state", { requestId, userId: user.id });
    return NextResponse.json({ error: "Invalid state" }, { status: 400 });
  }

  const { data: oauthState } = await supabase
    .from("oauth_states")
    .select("*")
    .eq("id", parsed.id)
    .maybeSingle();
  const validation = validateOAuthState({
    stateParam,
    secret: requireOAuthStateSecret(),
    oauthState,
    userId: user.id,
    provider: "google",
  });
  if (!validation.ok) {
    logWarn(`oauth.callback.${validation.error}`, { requestId, userId: user.id });
    return NextResponse.json({ error: "Invalid state" }, { status: 400 });
  }
  const state = validation.state;

  const connectionId =
    searchParams.get("connection_id") || searchParams.get("connectionId");
  const providerConfigKey =
    searchParams.get("provider_config_key") ||
    searchParams.get("integration_id") ||
    requireGoogleIntegrationId();

  if (!connectionId || !providerConfigKey) {
    logWarn("oauth.callback.missing_connection", { requestId, userId: user.id });
    return NextResponse.json(
      { error: "Missing connection details" },
      { status: 400 },
    );
  }
  if (oauthState?.connection_id && oauthState.connection_id !== connectionId) {
    logWarn("oauth.callback.connection_mismatch", {
      requestId,
      userId: user.id,
    });
    return NextResponse.json({ error: "Connection mismatch" }, { status: 400 });
  }

  const connection = await nango.getConnection(providerConfigKey, connectionId);

  const metadata = extractAccountMetadata(connection as any);

  const { error: upsertError } = await supabase
    .from("connected_accounts")
    .upsert(
      {
        user_id: user.id,
        provider: "google",
        nango_connection_id: connectionId,
        account_email: metadata.email,
        account_display_name: metadata.name,
        scopes: metadata.scopes,
        status: "connected",
      },
      {
        onConflict: "user_id,provider,nango_connection_id",
      },
    );

  await supabase.from("oauth_states").delete().eq("id", state.id);

  if (upsertError) {
    logError("oauth.callback.upsert_failed", { requestId, userId: user.id, error: upsertError });
    return NextResponse.json(
      { error: "Failed to store connection" },
      { status: 500 },
    );
  }

  logInfo("oauth.callback.success", {
    requestId,
    userId: user.id,
    provider: "google",
    connectionId,
  });

  const redirectTo =
    oauthState.redirect_to && oauthState.redirect_to.startsWith("/")
      ? oauthState.redirect_to
      : "/oauth/callback";
  return NextResponse.redirect(new URL(redirectTo, req.url));
}
