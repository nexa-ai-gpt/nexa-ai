"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const CONNECTORS = [
  {
    id: "gmail",
    label: "Gmail",
    description: "Generate and send emails",
    logo: "/gmail-logo.png",
  },
  {
    id: "calendar",
    label: "Google Calendar",
    description: "Create exam/events with date and time",
    logo: "/google-calendar-logo.png",
  },
];

function parseJsonSafe(text: string) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export default function AIPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
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
      onResponse: () => setChatError(null),
      onError: (error) => {
        setChatError(error.message || "Request failed.");
      },
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
      setUserId(data.session?.user.id ?? null);
      setUserEmail(data.session?.user.email ?? null);
    }

    void loadSession();
    const { data: subscription } = supabase.auth.onAuthStateChange((_, session) => {
      setUserId(session?.user.id ?? null);
      setUserEmail(session?.user.email ?? null);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkStatus() {
      if (!userId) return;
      const res = await fetch("/api/oauth/status?provider=google");
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

    void checkStatus();
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
      body: JSON.stringify({ provider: "google", redirectTo: "/ai" }),
    });

    const text = await res.text();
    const data = parseJsonSafe(text);
    if (res.ok && data.connectLink) {
      window.location.href = data.connectLink;
      return;
    }

    setConnectError(data.error || "Unable to start OAuth connection.");
  }

  const isConnected = connections.some((item) => item.status === "connected");
  const canSend = Boolean(userId && isConnected);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black text-white">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12">
        <header className="flex flex-col gap-3">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">AI Actions</p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Send emails and add exam events
          </h1>
          <p className="max-w-2xl text-sm text-zinc-400">
            Ask in plain English. The assistant will generate the email and send it, or create
            exam events in Google Calendar.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-[320px_1fr]">
          <div className="flex flex-col gap-6 rounded-2xl border border-white/10 bg-zinc-900/60 p-6">
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-400">
              <span>Session</span>
              <span className="text-zinc-300">{userId ? "Ready" : "Sign in required"}</span>
            </div>

            {!userId && (
              <button
                type="button"
                onClick={async () => {
                  const supabase = createSupabaseBrowserClient();
                  await supabase.auth.signInWithOAuth({
                    provider: "google",
                    options: { redirectTo: `${window.location.origin}/ai` },
                  });
                }}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-200"
              >
                Sign in with Google
              </button>
            )}

            {userId && (
              <div className="text-xs text-zinc-500">
                Signed in as {userEmail ?? "user"}
                {primaryConnection?.account_email ? ` • ${primaryConnection.account_email}` : ""}
              </div>
            )}

            {connectError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {connectError}
              </div>
            )}
            {chatError && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                {chatError}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <p className="text-xs font-medium uppercase text-zinc-500">Integrations</p>
              <div className="flex flex-col gap-2">
                {CONNECTORS.map((connector) => (
                  <div
                    key={connector.id}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <Image
                        src={connector.logo}
                        alt={`${connector.label} logo`}
                        width={20}
                        height={20}
                        className="h-5 w-5"
                      />
                      <div>
                        <p className="text-sm font-semibold text-white">{connector.label}</p>
                        <p className="text-xs text-zinc-500">{connector.description}</p>
                      </div>
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
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-400">
              <span>Status</span>
              <span
                className={
                  connectionStatus === "connected" ? "text-emerald-400" : "text-amber-300"
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
                    "Generate a polite email to dean@example.edu asking for exam hall ticket correction and send it now.",
                })
              }
              disabled={!canSend}
              className="rounded-full border border-white/20 px-4 py-2 text-sm text-white hover:border-white/40"
            >
              Try email action
            </button>

            <button
              type="button"
              onClick={() =>
                append({
                  role: "user",
                  content:
                    "Add exam to calendar: Physics Midterm on 2026-03-10 from 10:00 to 13:00 Asia/Kolkata.",
                })
              }
              disabled={!canSend}
              className="rounded-full border border-white/20 px-4 py-2 text-sm text-white hover:border-white/40"
            >
              Try exam event action
            </button>

            <div className="text-xs text-zinc-500">
              Examples: &quot;Generate email and send to admissions@college.edu about fee receipt&quot;,
              &quot;Add exam tomorrow 2 PM to 4 PM in my calendar&quot;.
            </div>
          </div>

          <div className="flex h-[650px] flex-col rounded-2xl border border-white/10 bg-black/40">
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
              {messages.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 text-sm text-zinc-400">
                  Start with: &quot;Generate and send email to...&quot; or &quot;Add exam to calendar...&quot;
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
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

            <form onSubmit={handleSubmit} className="border-t border-white/10 p-4">
              <div className="flex items-center gap-3 rounded-full border border-white/15 bg-zinc-900 px-4 py-2">
                <input
                  className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
                  value={input}
                  onChange={handleInputChange}
                  placeholder="Generate and send email, or add exam to calendar..."
                  disabled={!canSend}
                />
                <button
                  type="submit"
                  disabled={isLoading || !canSend}
                  className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-zinc-900 disabled:opacity-50"
                >
                  {isLoading ? "Working..." : "Send"}
                </button>
              </div>
              {!isConnected && (
                <p className="mt-2 text-xs text-amber-300">
                  Connect Google first to enable chat actions.
                </p>
              )}
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
