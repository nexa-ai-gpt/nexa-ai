"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const FEATURES = [
  {
    icon: "??",
    title: "Notion-like Notes",
    description:
      "Rich block editor with headings, lists, code blocks, and auto-save powered by BlockNote.",
  },
  {
    icon: "??",
    title: "AI Library",
    description:
      "Store documents, index chunks, and chat with grounded answers using Mistral-powered RAG.",
  },
  {
    icon: "??",
    title: "Workspace AI",
    description:
      "Use natural language to query connected tools like Gmail and Calendar.",
  },
  {
    icon: "??",
    title: "Nango Integrations",
    description:
      "Connect external providers securely through OAuth with managed token refresh.",
  },
];

export default function LandingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace("/dashboard");
      } else {
        setLoading(false);
      }
    });
  }, [router]);

  async function signIn() {
    setSigningIn(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black text-white">
      <header className="flex items-center justify-between px-8 py-5">
        <span className="text-base font-bold tracking-tight">Manus AI</span>
        <button
          type="button"
          onClick={signIn}
          disabled={signingIn}
          className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 disabled:opacity-60"
        >
          {signingIn ? "Redirecting..." : "Sign in"}
        </button>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-32 pt-20 text-center">
        <p className="mb-4 text-xs uppercase tracking-[0.3em] text-zinc-500">
          Manus + Notion-style Workspace
        </p>
        <h1 className="mb-6 text-5xl font-semibold leading-tight tracking-tight md:text-6xl">
          Notes, Library, and AI chat
          <br />
          <span className="text-zinc-400">in one unified app.</span>
        </h1>
        <p className="mx-auto mb-10 max-w-2xl text-base text-zinc-400">
          Create rich notes, build a document library with retrieval, and use AI
          workflows with your connected tools.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            onClick={signIn}
            disabled={signingIn}
            className="rounded-full bg-white px-7 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 disabled:opacity-60"
          >
            {signingIn ? "Redirecting..." : "Get started"}
          </button>
          <Link
            href="/notes"
            className="rounded-full border border-white/20 px-7 py-3 text-sm font-medium text-white hover:border-white/40"
          >
            Open notes
          </Link>
          <Link
            href="/library"
            className="rounded-full border border-white/20 px-7 py-3 text-sm font-medium text-white hover:border-white/40"
          >
            Open library
          </Link>
        </div>

        <div className="mt-24 grid gap-5 text-left sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6"
            >
              <span className="mb-3 block text-2xl">{feature.icon}</span>
              <h3 className="mb-2 text-sm font-semibold text-white">
                {feature.title}
              </h3>
              <p className="text-xs leading-5 text-zinc-400">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-white/10 px-8 py-6 text-center text-xs text-zinc-600">
        Manus AI Clone · Built with Next.js, Supabase, Nango, and Mistral
      </footer>
    </div>
  );
}
