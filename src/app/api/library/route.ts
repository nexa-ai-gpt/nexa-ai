import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { Mistral } from "@mistralai/mistralai";
import { getMistralApiKey } from "@/lib/mistral";

function chunkText(text: string, size = 500, overlap = 50): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    chunks.push(text.slice(start, end).trim());
    if (end === text.length) break;
    start += size - overlap;
  }
  return chunks.filter((c) => c.length > 0);
}

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("library_documents")
    .select("id, title, file_type, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ documents: data });
}

export async function POST(req: NextRequest) {
  const { supabase, user } = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { title, content } = body as { title?: string; content?: string };

  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json(
      { error: "title and content are required" },
      { status: 400 },
    );
  }

  // Insert document
  const { data: doc, error: docError } = await supabase
    .from("library_documents")
    .insert({ user_id: user.id, title: title.trim(), content: content.trim() })
    .select()
    .single();

  if (docError || !doc) {
    return NextResponse.json({ error: docError?.message ?? "Insert failed" }, { status: 500 });
  }

  // Generate embeddings if Mistral key is configured
  const apiKey = getMistralApiKey();
  if (apiKey) {
    try {
      const mistral = new Mistral({ apiKey });
      const chunks = chunkText(content.trim());

      if (chunks.length > 0) {
        const embedRes = await mistral.embeddings.create({
          model: "mistral-embed",
          inputs: chunks,
        });

        const chunkRows = chunks.map((chunkContent, i) => ({
          document_id: doc.id,
          user_id: user.id,
          content: chunkContent,
          embedding: embedRes.data[i]?.embedding ?? null,
          chunk_index: i,
        }));

        await supabase.from("library_chunks").insert(chunkRows);
      }
    } catch {
      // Embeddings failed — document is still saved, RAG just won't work
    }
  }

  return NextResponse.json({ document: doc }, { status: 201 });
}
