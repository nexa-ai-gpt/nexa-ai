"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { AppNav } from "@/components/AppNav";

interface NoteRow {
  id: string;
  title: string;
  content: unknown;
  updated_at: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getExcerpt(content: unknown): string {
  if (!Array.isArray(content)) return "";
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const b = block as Record<string, unknown>;
    if (Array.isArray(b.content)) {
      for (const inline of b.content) {
        if (inline && typeof inline === "object") {
          const i = inline as Record<string, unknown>;
          if (typeof i.text === "string" && i.text.trim()) {
            return i.text.trim().slice(0, 120);
          }
        }
      }
    }
  }
  return "";
}

export default function NotesPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const loadNotes = useCallback(async () => {
    const res = await fetch("/api/notes");
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const data = await res.json();
    setNotes(data.notes ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/");
        return;
      }
      setUserEmail(data.session.user.email ?? null);
      void loadNotes();
    });
  }, [loadNotes, router]);

  async function createNote() {
    setCreating(true);
    try {
      const res = await fetch("/api/notes", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        router.push(`/notes/${data.note.id}`);
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <AppNav userEmail={userEmail} />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Notes</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Rich block-based notes, auto-saved.
            </p>
          </div>
          <button
            type="button"
            onClick={createNote}
            disabled={creating}
            className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 disabled:opacity-60"
          >
            {creating ? "Creating..." : "+ New note"}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-zinc-900/40 py-24 text-center">
            <span className="text-4xl">??</span>
            <p className="text-sm text-zinc-400">
              No notes yet. Create your first one.
            </p>
            <button
              type="button"
              onClick={createNote}
              disabled={creating}
              className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 disabled:opacity-60"
            >
              {creating ? "Creating..." : "Create note"}
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {notes.map((note) => (
              <button
                key={note.id}
                type="button"
                onClick={() => router.push(`/notes/${note.id}`)}
                className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-zinc-900/60 p-5 text-left transition-colors hover:border-white/20 hover:bg-zinc-900"
              >
                <h2 className="truncate text-sm font-semibold text-white">
                  {note.title || "Untitled"}
                </h2>
                {getExcerpt(note.content) && (
                  <p className="line-clamp-2 text-xs leading-5 text-zinc-400">
                    {getExcerpt(note.content)}
                  </p>
                )}
                <span className="mt-auto text-xs text-zinc-600">
                  {formatDate(note.updated_at)}
                </span>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
