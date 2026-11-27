export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 text-center">
      <h1 className="text-3xl font-extrabold">You are offline</h1>
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
        IP Intelligence needs an internet connection for live IP lookups. Reconnect and try again.
      </p>
      <a
        href="/"
        className="mt-6 rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-bold text-slate-950"
      >
        Try again
      </a>
    </main>
  );
}
