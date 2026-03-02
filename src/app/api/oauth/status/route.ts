import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestId, logError, logWarn } from "@/lib/logging";
import { nango, requireGoogleIntegrationId } from "@/lib/nango";
import { extractAccountMetadata, type NangoConnection } from "@/lib/connected-account";

export async function GET(req: Request) {
  const requestId = getRequestId();
  const { searchParams } = new URL(req.url);
  const provider = searchParams.get("provider") || "google";

  const { supabase, user } = await requireUser();
  if (!user) {
    logWarn("oauth.status.unauthorized", { requestId });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limiter = rateLimit(`oauth-status:${user.id}`, 20, 60_000);
  if (!limiter.allowed) {
    logWarn("oauth.status.rate_limited", { requestId, userId: user.id });
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const initial = await supabase
    .from("connected_accounts")
    .select("id, account_email, status, created_at")
    .eq("user_id", user.id)
    .eq("provider", provider)
    .order("created_at", { ascending: false });
  let data = initial.data;
  const error = initial.error;

  if (error) {
    logError("oauth.status.failed", { requestId, userId: user.id, error });
    return NextResponse.json(
      { error: "Failed to fetch connections" },
      { status: 500 },
    );
  }

  // Fallback sync path: if callback persistence was missed, recover from Nango.
  if ((data?.length ?? 0) === 0 && provider === "google") {
    const integrationId = requireGoogleIntegrationId();
    if (integrationId) {
      try {
        const nangoConnections = await nango.listConnections({
          userId: user.id,
          integrationId,
        });

        for (const connection of nangoConnections.connections ?? []) {
          const connectionId = connection.connection_id;
          if (!connectionId) continue;

          let accountEmail: string | null = null;
          let accountDisplayName: string | null = null;
          let scopes: string[] | null = null;

          try {
            const full = await nango.getConnection(integrationId, connectionId);
            const metadata = extractAccountMetadata(full as NangoConnection);
            accountEmail = metadata.email;
            accountDisplayName = metadata.name;
            scopes = metadata.scopes;
          } catch {
            // Keep sync robust; metadata enrichment is best-effort.
          }

          await supabase
            .from("connected_accounts")
            .upsert(
              {
                user_id: user.id,
                provider: "google",
                nango_connection_id: connectionId,
                account_email: accountEmail,
                account_display_name: accountDisplayName,
                scopes,
                status: "connected",
              },
              { onConflict: "user_id,provider,nango_connection_id" },
            );
        }

        const refreshed = await supabase
          .from("connected_accounts")
          .select("id, account_email, status, created_at")
          .eq("user_id", user.id)
          .eq("provider", provider)
          .order("created_at", { ascending: false });
        data = refreshed.data ?? [];
      } catch (syncError) {
        logWarn("oauth.status.nango_sync_failed", {
          requestId,
          userId: user.id,
          error: syncError,
        });
      }
    }
  }

  return NextResponse.json({
    connected: (data?.length ?? 0) > 0,
    connections: data ?? [],
  });
}
