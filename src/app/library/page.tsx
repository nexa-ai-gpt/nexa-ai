"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { AppNav } from "@/components/AppNav";

interface LibDoc {
  id: string;
  title: string;
  file_type: string;
  created_at: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ document_id: string; excerpt: string; similarity: number }>;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function LibraryPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [documents, setDocuments] = useState<LibDoc[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  // Upload form
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadContent, setUploadContent] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // RAG chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [query, setQuery] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/");
        return;
      }
      setUserEmail(data.session.user.email ?? null);
      loadDocuments();
    });
  }, [router]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadDocuments() {
    const res = await fetch("/api/library");
    if (!res.ok) return;
    const data = await res.json();
    setDocuments(data.documents ?? []);
    setLoadingDocs(false);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadTitle.trim() || !uploadContent.trim()) return;
    setUploading(true);
    setUploadError(null);
    const res = await fetch("/api/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: uploadTitle, content: uploadContent }),
    });
    const data = await res.json();
    if (!res.ok) {
      setUploadError(data.error ?? "Upload failed");
    } else {
      setUploadTitle("");
      setUploadContent("");
      await loadDocuments();
    }
    setUploading(false);
  }

  async function deleteDocument(id: string) {
    if (!confirm("Delete this document?")) return;
    await fetch(`/api/library/${id}`, { method: "DELETE" });
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }

  async function handleChat(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || chatLoading) return;
    const userMsg: ChatMessage = { role: "user", content: query.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setQuery("");
    setChatLoading(true);

    const res = await fetch("/api/library/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: userMsg.content }),
    });
    const data = await res.json();
    const assistantMsg: ChatMessage = {
      role: "assistant",
      content: data.answer ?? data.error ?? "Something went wrong.",
      sources: data.sources,
    };
    setMessages((prev) => [...prev, assistantMsg]);
    setChatLoading(false);
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-white">
      <AppNav userEmail={userEmail} />

      <main className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-6 py-10">
        {/* Left: Documents */}
        <aside className="flex w-72 shrink-0 flex-col gap-5">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Library</h1>
            <p className="mt-1 text-xs text-zinc-400">
              Upload documents, then chat with them via RAG.
            </p>
          </div>

          {/* Upload form */}
          <form
            onSubmit={handleUpload}
            className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-zinc-900/60 p-4"
          >
            <p className="text-xs font-semibold uppercase text-zinc-500">
              Add document
            </p>
            <input
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="Title"
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-white/30"
            />
            <textarea
              value={uploadContent}
              onChange={(e) => setUploadContent(e.target.value)}
              placeholder="Paste document content here…"
              rows={6}
              className="resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-white/30"
            />
            {uploadError && (
              <p className="text-xs text-rose-400">{uploadError}</p>
            )}
            <button
              type="submit"
              disabled={uploading || !uploadTitle.trim() || !uploadContent.trim()}
              className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 disabled:opacity-50"
            >
              {uploading ? "Uploading & indexing…" : "Upload"}
            </button>
          </form>

          {/* Document list */}
          <div className="flex flex-col gap-2">
            {loadingDocs ? (
              <div className="flex justify-center py-6">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              </div>
            ) : documents.length === 0 ? (
              <p className="py-4 text-center text-xs text-zinc-600">
                No documents yet.
              </p>
            ) : (
              documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-zinc-900/40 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-white">
                      {doc.title}
                    </p>
                    <p className="text-xs text-zinc-600">
                      {formatDate(doc.created_at)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteDocument(doc.id)}
                    className="ml-2 shrink-0 text-xs text-zinc-600 hover:text-rose-400"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Right: RAG Chat */}
        <section className="flex flex-1 flex-col rounded-2xl border border-white/10 bg-black/40">
          <div className="border-b border-white/10 px-5 py-3">
            <h2 className="text-sm font-semibold text-white">
              Chat with your library
            </h2>
            <p className="text-xs text-zinc-500">
              Ask questions — answers are grounded in your documents.
            </p>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {messages.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5 text-sm text-zinc-400">
                Upload at least one document, then ask a question about it.
              </div>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                      msg.role === "user"
                        ? "bg-white text-zinc-900"
                        : "bg-zinc-900 text-zinc-200"
                    }`}
                  >
                    <p>{msg.content}</p>
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 flex flex-col gap-1 border-t border-white/10 pt-2">
                        <p className="text-xs font-semibold text-zinc-500">
                          Sources
                        </p>
                        {msg.sources.map((s, si) => (
                          <p key={si} className="text-xs text-zinc-500">
                            {s.excerpt}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-zinc-900 px-4 py-3 text-sm text-zinc-400">
                  Thinking…
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <form
            onSubmit={handleChat}
            className="border-t border-white/10 p-4"
          >
            <div className="flex items-center gap-3 rounded-full border border-white/15 bg-zinc-900 px-4 py-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask about your documents…"
                className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
                disabled={chatLoading}
              />
              <button
                type="submit"
                disabled={chatLoading || !query.trim()}
                className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-zinc-900 disabled:opacity-50"
              >
                {chatLoading ? "Thinking…" : "Ask"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
