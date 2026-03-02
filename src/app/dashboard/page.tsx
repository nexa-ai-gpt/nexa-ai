"use client";

import { useEffect, useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { AppNav } from "@/components/AppNav";

const CONNECTORS = [
  { id: "gmail", label: "Gmail", description: "Email inbox and search" },
  { id: "calendar", label: "Google Calendar", description: "Events and reminders" },
  { id: "docs", label: "Google Docs", description: "Docs content and summaries" },
];

function parseJsonSafe(text: string) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export default function Dashboard() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    "unknown" | "connected" | "disconnected"
  >("unknown");
  const [connections, setConnections] = useState<
    Array<{ id: string; account_email: string | null; status: string; created_at: string }>
  >([]);

  const { messages, input, handleInputChange, handleSubmit, isLoading, append } =
    useChat({
      api: "/api/chat",
      streamProtocol: "text",
      body: {},
    });

  const primaryConnection = connections[0];
  const statusLabel = useMemo(() => {
    if (connectionStatus === "connected") return "Connected";
    if (connectionStatus === "disconnected") return "Not connected";
    return "Checking...";
  }, [connectionStatus]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;
    async function loadSession() {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        router.replace("/");
        return;
      }
      setUserId(data.session.user.id);
      setUserEmail(data.session.user.email ?? null);
    }
    loadSession();
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_, session) => {
        if (!session) {
          router.replace("/");
          return;
        }
        setUserId(session.user.id);
        setUserEmail(session.user.email ?? null);
      },
    );
    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    async function checkStatus() {
      if (!userId) return;
      const res = await fetch(`/api/oauth/status?provider=google`);
      const text = await res.text();
      const data = parseJsonSafe(text);
      if (!res.ok) {
        if (!cancelled) {
          setConnectionStatus("disconnected");
          setConnections([]);
        }
        return;
      }
      if (!cancelled) {
        setConnectionStatus(data.connected ? "connected" : "disconnected");
        setConnections(data.connections || []);
      }
    }
    checkStatus();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function connectProvider() {
    if (!userId) return;
    setConnectError(null);
    const res = await fetch("/api/oauth/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "google" }),
    });

    const text = await res.text();
    const data = parseJsonSafe(text);
    if (res.ok && data.connectLink) {
      window.location.href = data.connectLink;
      return;
    }
    setConnectError(data.error || "Unable to start OAuth connection.");
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-zinc-950 via-zinc-900 to-black text-white">
      <AppNav userEmail={userEmail} />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12">
        <header className="flex flex-col gap-3">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
            Manus AI Clone
          </p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Ask your workspace. Get actions done.
          </h1>
          <p className="max-w-2xl text-sm text-zinc-400">
            Connect Gmail and Calendar with Nango, then chat using natural
            language to search mail or create events.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-[320px_1fr]">
          <div className="flex flex-col gap-6 rounded-2xl border border-white/10 bg-zinc-900/60 p-6">
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-400">
              <span>Session</span>
              <span className="text-zinc-300">
                {userId ? "Ready" : "Sign in required"}
              </span>
            </div>

            {userId && (
              <div className="text-xs text-zinc-500">
                Signed in as {userEmail ?? "user"}
                {primaryConnection?.account_email
                  ? ` • ${primaryConnection.account_email}`
                  : ""}
              </div>
            )}

            {connectError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {connectError}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <p className="text-xs font-medium uppercase text-zinc-500">
                Connectors
              </p>
              <div className="flex flex-col gap-2">
                {CONNECTORS.map((connector) => {
                  const isConnected = connections.some(
                    (item) => item.status === "connected",
                  );
                  return (
                    <div
                      key={connector.id}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {connector.label}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {connector.description}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={connectProvider}
                        disabled={!userId || isConnected}
                        className={`text-xs font-semibold ${
                          isConnected ? "text-emerald-400" : "text-zinc-500"
                        }`}
                      >
                        {isConnected ? "Connected" : "Connect"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-400">
              <span>Status</span>
              <span
                className={
                  connectionStatus === "connected"
                    ? "text-emerald-400"
                    : "text-amber-300"
                }
              >
                {statusLabel}
              </span>
            </div>

            <button
              type="button"
              onClick={connectProvider}
              disabled={!userId}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-200"
            >
              Connect with Google
            </button>

            <button
              type="button"
              onClick={() =>
                append({
                  role: "user",
                  content:
                    "Show my next 5 meetings and the last 3 emails from today.",
                })
              }
              className="rounded-full border border-white/20 px-4 py-2 text-sm text-white hover:border-white/40"
            >
              Try a sample query
            </button>

            <div className="text-xs text-zinc-500">
              Prompts: &quot;Find unread emails from finance&quot;, &quot;Schedule a 30 min
              sync tomorrow at 2pm&quot;, &quot;Summarize doc 1a2b3c&quot;
            </div>
          </div>

          <div className="flex h-162.5 flex-col rounded-2xl border border-white/10 bg-black/40">
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
              {messages.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 text-sm text-zinc-400">
                  Ask anything about your Gmail or Calendar once connected.
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.role === "user"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                        message.role === "user"
                          ? "bg-white text-zinc-900"
                          : "bg-zinc-900 text-zinc-200"
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))
              )}
            </div>

            <form
              onSubmit={handleSubmit}
              className="border-t border-white/10 p-4"
            >
              <div className="flex items-center gap-3 rounded-full border border-white/15 bg-zinc-900 px-4 py-2">
                <input
                  className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
                  value={input}
                  onChange={handleInputChange}
                  placeholder="Ask about your inbox or calendar..."
                  disabled={!userId}
                />
                <button
                  type="submit"
                  disabled={isLoading || !userId}
                  className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-zinc-900 disabled:opacity-50"
                >
                  {isLoading ? "Thinking..." : "Send"}
                </button>
              </div>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
