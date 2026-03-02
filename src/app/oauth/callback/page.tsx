export default function OAuthCallbackPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
      <div className="mx-auto w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-900 p-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Connection complete
        </h1>
        <p className="mt-3 text-sm text-zinc-400">
          You can close this tab and return to the app to start chatting.
        </p>
        <a
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-white px-5 py-2 text-sm font-semibold text-zinc-900"
        >
          Back to chat
        </a>
      </div>
    </div>
  );
}
