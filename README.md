This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## OAuth + Supabase Setup

Required env vars:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `NANGO_SECRET_KEY`
- `GMAIL_INTEGRATION_ID` (Google/Gmail integration key from Nango)
- `WEBHOOK_GMAIL` (optional, for Nango webhook URL reference)
- `CALLBACK_GMAIL` (optional, provider callback reference)
- `OAUTH_STATE_SECRET` (HMAC secret, 32+ chars)
- `OPENAI_API_KEY`
- `MISTRAL_API_KEY` (for Library RAG — embeddings and generation)

Supabase SQL migrations (apply in order):
- `supabase/migrations/20260302000100_oauth_connectors.sql`
- `supabase/migrations/20260302000200_notes_library.sql` (requires pgvector enabled in Supabase)

OAuth flow:
1. User signs in with Supabase Auth (Google).
2. App calls `POST /api/oauth/connect` (server verifies session).
3. Nango Connect opens and finishes.
4. Nango redirects to `/api/oauth/callback` which validates state + persists `connected_accounts`.

Chat:
- `POST /api/chat` requires Supabase session and uses the most recent `connected_accounts` row for Google.

## Features

| Route | Description |
|---|---|
| `/` | Landing page — sign in or go to dashboard |
| `/dashboard` | AI chat with Gmail, Calendar, Docs via Nango |
| `/notes` | Notion-like notes list |
| `/notes/[id]` | BlockNote rich-text editor with auto-save |
| `/library` | Upload documents + RAG chat powered by Mistral |

## Notes
- Notes are stored as BlockNote JSON in Supabase (`notes` table)
- Auto-saved 1.5s after last keystroke

## Library RAG
1. Paste document text → chunks are embedded with `mistral-embed` → stored in `library_chunks` (pgvector)
2. Ask a question → query is embedded → top-5 similar chunks retrieved via cosine similarity
3. Mistral `mistral-small-latest` generates a grounded answer
