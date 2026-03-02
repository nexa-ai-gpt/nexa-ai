"use client";

import { useCallback, useEffect, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { AppNav } from "@/components/AppNav";
import type { PartialBlock } from "@blocknote/core";

const BlockNoteEditor = dynamic(() => import("@/components/BlockNoteEditor"), {
  ssr: false,
});

interface NoteData {
  id: string;
  title: string;
  content: PartialBlock[];
}

type SaveStatus = "saved" | "saving" | "unsaved" | "error";

export default function NotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [note, setNote] = useState<NoteData | null>(null);
  const [title, setTitle] = useState("Untitled");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestContent = useRef<PartialBlock[]>([]);
  const latestTitle = useRef("Untitled");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/");
        return;
      }
      setUserEmail(data.session.user.email ?? null);
    });
  }, [router]);

  useEffect(() => {
    async function fetchNote() {
      const res = await fetch(`/api/notes/${id}`);
      if (!res.ok) {
        router.replace("/notes");
        return;
      }
      const data = await res.json();
      setNote(data.note);
      setTitle(data.note.title ?? "Untitled");
      latestTitle.current = data.note.title ?? "Untitled";
      latestContent.current = data.note.content ?? [];
      setLoading(false);
    }

    void fetchNote();
  }, [id, router]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, []);

  const saveNow = useCallback(async () => {
    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/notes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: latestTitle.current,
          content: latestContent.current,
        }),
      });

      if (!res.ok) {
        setSaveStatus("error");
        return;
      }

      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  }, [id]);

  const scheduleSave = useCallback(() => {
    setSaveStatus("unsaved");
    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(() => {
      void saveNow();
    }, 1200);
  }, [saveNow]);

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setTitle(e.target.value);
    latestTitle.current = e.target.value;
    scheduleSave();
  }

  function handleEditorChange(blocks: PartialBlock[]) {
    latestContent.current = blocks;
    scheduleSave();
  }

  async function deleteNote() {
    if (!confirm("Delete this note?")) return;
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
    router.push("/notes");
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-white">
      <AppNav userEmail={userEmail} />

      <div className="flex items-center justify-between border-b border-white/10 px-6 py-3">
        <Link href="/notes" className="text-xs text-zinc-500 hover:text-white">
          ? Back to notes
        </Link>
        <div className="flex items-center gap-4">
          <span
            className={`text-xs ${
              saveStatus === "saved"
                ? "text-emerald-500"
                : saveStatus === "saving"
                  ? "text-zinc-400"
                  : saveStatus === "error"
                    ? "text-rose-400"
                    : "text-zinc-600"
            }`}
          >
            {saveStatus === "saved"
              ? "Saved"
              : saveStatus === "saving"
                ? "Saving..."
                : saveStatus === "error"
                  ? "Save failed"
                  : "Unsaved"}
          </span>
          <button
            type="button"
            onClick={deleteNote}
            className="text-xs text-zinc-600 hover:text-rose-400"
          >
            Delete
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        </div>
      ) : (
        <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
          <input
            value={title}
            onChange={handleTitleChange}
            placeholder="Untitled"
            className="mb-6 w-full bg-transparent text-3xl font-bold text-white outline-none placeholder:text-zinc-700"
          />
          {note && (
            <BlockNoteEditor
              initialContent={note.content}
              onChange={handleEditorChange}
            />
          )}
        </div>
      )}
    </div>
  );
}
