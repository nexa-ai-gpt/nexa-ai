import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { Mistral } from "@mistralai/mistralai";
import { getMistralApiKey } from "@/lib/mistral";

export async function POST(req: NextRequest) {
  const { supabase, user } = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { query } = body as { query?: string };

  if (!query?.trim()) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  const apiKey = getMistralApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "MISTRAL_API (or MISTRAL_API_KEY) is not configured" },
      { status: 503 },
    );
  }

  const mistral = new Mistral({ apiKey });

  let queryEmbedding: number[];
  try {
    const embedRes = await mistral.embeddings.create({
      model: "mistral-embed",
      inputs: [query.trim()],
    });
    queryEmbedding = embedRes.data[0].embedding ?? [];
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to embed query: " + String(e) },
      { status: 500 },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: chunks, error: searchError } = await (supabase.rpc as any)(
    "search_library_chunks",
    {
      query_embedding: queryEmbedding,
      match_user_id: user.id,
      match_count: 5,
    },
  );

  if (searchError) {
    return NextResponse.json({ error: searchError.message }, { status: 500 });
  }

  if (!chunks || chunks.length === 0) {
    return NextResponse.json({
      answer:
        "I couldn't find relevant content in your library. Please upload some documents first.",
      sources: [],
    });
  }

  const contextText = chunks
    .map((c: { content: string }, i: number) => `[${i + 1}] ${c.content}`)
    .join("\n\n");

  const systemPrompt =
    "You are a helpful assistant. Answer the user's question based ONLY on the provided document excerpts. " +
    "If the answer is not in the excerpts, say so clearly.\n\nDocument excerpts:\n" +
    contextText;

  const chatRes = await mistral.chat.complete({
    model: "mistral-small-latest",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: query.trim() },
    ],
  });

  const answer =
    chatRes.choices?.[0]?.message?.content ?? "No response generated.";

  return NextResponse.json({
    answer,
    sources: chunks.map(
      (c: { document_id: string; content: string; similarity: number }) => ({
        document_id: c.document_id,
        excerpt: c.content.slice(0, 120) + (c.content.length > 120 ? "..." : ""),
        similarity: Math.round(c.similarity * 100) / 100,
      }),
    ),
  });
}
