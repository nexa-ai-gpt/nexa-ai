-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── Notes ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT        NOT NULL DEFAULT 'Untitled',
  content    JSONB       NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notes_user_id_updated_idx ON notes (user_id, updated_at DESC);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notes"
  ON notes FOR ALL
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION set_notes_updated_at()
  RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;$$;

CREATE TRIGGER notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION set_notes_updated_at();

-- ─── Library Documents ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS library_documents (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT        NOT NULL,
  content    TEXT        NOT NULL,
  file_type  TEXT        NOT NULL DEFAULT 'text',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS library_documents_user_id_idx ON library_documents (user_id);

ALTER TABLE library_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own library documents"
  ON library_documents FOR ALL
  USING (auth.uid() = user_id);

-- ─── Library Chunks (for RAG) ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS library_chunks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID        NOT NULL REFERENCES library_documents(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     TEXT        NOT NULL,
  embedding   vector(1024),
  chunk_index INTEGER     NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS library_chunks_document_id_idx ON library_chunks (document_id);
CREATE INDEX IF NOT EXISTS library_chunks_user_id_idx     ON library_chunks (user_id);

ALTER TABLE library_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own library chunks"
  ON library_chunks FOR ALL
  USING (auth.uid() = user_id);

-- ─── Vector similarity search function ───────────────────────────────────────

CREATE OR REPLACE FUNCTION search_library_chunks(
  query_embedding vector(1024),
  match_user_id   uuid,
  match_count     int DEFAULT 5
)
RETURNS TABLE (
  id          uuid,
  document_id uuid,
  content     text,
  similarity  float
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    lc.id,
    lc.document_id,
    lc.content,
    1 - (lc.embedding <=> query_embedding) AS similarity
  FROM library_chunks lc
  WHERE lc.user_id = match_user_id
    AND lc.embedding IS NOT NULL
  ORDER BY lc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
