import { NextResponse } from "next/server";
import { nango, requireGoogleIntegrationId } from "@/lib/nango";
import { requireUser } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestId, logError, logInfo, logWarn } from "@/lib/logging";

export async function POST(req: Request) {
  const requestId = getRequestId();
  const { connectedAccountId } = await req.json();
  if (!connectedAccountId) {
    return NextResponse.json(
      { error: "connectedAccountId is required" },
      { status: 400 },
    );
  }

  const { supabase, user } = await requireUser();
  if (!user) {
    logWarn("oauth.disconnect.unauthorized", { requestId });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limiter = rateLimit(`oauth-disconnect:${user.id}`, 10, 60_000);
  if (!limiter.allowed) {
    logWarn("oauth.disconnect.rate_limited", { requestId, userId: user.id });
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { data: account, error } = await supabase
    .from("connected_accounts")
    .select("id, nango_connection_id")
    .eq("id", connectedAccountId)
    .eq("user_id", user.id)
    .single();

  if (error || !account) {
    logWarn("oauth.disconnect.not_found", { requestId, userId: user.id });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const integrationId = requireGoogleIntegrationId();
  if (integrationId) {
    try {
      await nango.deleteConnection(integrationId, account.nango_connection_id);
    } catch {
      // best effort revoke
      logWarn("oauth.disconnect.revoke_failed", {
        requestId,
        userId: user.id,
        connectionId: account.nango_connection_id,
      });
    }
  }

  const { error: updateError } = await supabase
    .from("connected_accounts")
    .update({ status: "revoked" })
    .eq("id", connectedAccountId);

  if (updateError) {
    logError("oauth.disconnect.update_failed", {
      requestId,
      userId: user.id,
      error: updateError,
    });
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  logInfo("oauth.disconnect.success", {
    requestId,
    userId: user.id,
    connectionId: account.nango_connection_id,
  });

  return NextResponse.json({ success: true });
}
