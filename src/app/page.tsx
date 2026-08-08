import Link from 'next/link';

const PROVIDER_MATRIX = [
  { name: 'Claude (claude.ai)', status: 'Supported', note: 'Remote MCP connector via OAuth (Free/Pro/Max/Team/Enterprise)' },
  { name: 'ChatGPT (chatgpt.com)', status: 'Partial', note: 'Developer Mode + remote MCP; write on Business/Enterprise/Edu (beta)' },
  { name: 'Gemini (gemini.google.com)', status: 'Not currently supported', note: 'Personal web has no self-serve MCP; use Gemini API/CLI/Enterprise' },
] as const;

export default async function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-[#0a0f1c] text-[#e5e9f0]">
      <nav className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2563eb] text-sm">UM</span>
          <span>Universal Memory Vault</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/dashboard" className="rounded-lg px-3 py-1.5 text-[#9ca3af] hover:text-white">
            Dashboard
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg bg-[#2563eb] px-4 py-1.5 font-medium text-white hover:bg-[#1d4ed8]"
          >
            Open vault
          </Link>
        </div>
      </nav>

      <section className="mx-auto flex w-full max-w-5xl flex-col items-center px-6 pt-16 pb-20 text-center">
        <span className="rounded-full border border-[#1f2937] bg-[#0f172a] px-3 py-1 text-xs text-[#60a5fa]">
          One memory layer. Any AI.
        </span>
        <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          Long-term memory for your AI —<br />
          owned by you.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[#9ca3af]">
          A provider-agnostic personal memory vault. Claude, ChatGPT and other AI platforms
          read and write one shared memory store through the Model Context Protocol — while
          <b className="text-[#e5e9f0]"> you</b> own the data, control access, and audit every change.
        </p>
        <div className="mt-8 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-xl bg-[#2563eb] px-6 py-3 font-semibold text-white hover:bg-[#1d4ed8]"
          >
            Open your vault
          </Link>
          <a
            href="#providers"
            className="rounded-xl border border-[#374151] px-6 py-3 font-medium text-[#e5e9f0] hover:bg-[#1f2937]"
          >
            Provider support
          </a>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-5xl gap-4 px-6 pb-16 sm:grid-cols-3">
        {[
          { t: 'Universal memory schema', d: 'Facts, preferences, goals, habits, relationships and projects — a neutral schema with no vendor lock-in.' },
          { t: 'Version history + audit', d: 'Every create, update and delete is versioned and logged. You always know who changed what and why.' },
          { t: 'MCP-native', d: 'Exposes memory_search, create, update, delete as MCP tools with OAuth. No browser scraping, ever.' },
        ].map((f) => (
          <div key={f.t} className="rounded-2xl border border-[#1f2937] bg-[#111827] p-6">
            <h3 className="font-semibold">{f.t}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#9ca3af]">{f.d}</p>
          </div>
        ))}
      </section>

      <section id="providers" className="mx-auto w-full max-w-5xl px-6 pb-20">
        <h2 className="text-2xl font-semibold">AI platform compatibility</h2>
        <p className="mt-2 text-sm text-[#9ca3af]">
          Honest, documentation-based capability matrix. Anything unsupported is marked as such —
          this project never fakes compatibility.
        </p>
        <div className="mt-6 overflow-hidden rounded-2xl border border-[#1f2937]">
          {PROVIDER_MATRIX.map((p) => (
            <div
              key={p.name}
              className="flex flex-col gap-1 border-b border-[#1f2937] bg-[#111827] p-5 last:border-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="font-medium">{p.name}</div>
              <div className="text-sm text-[#9ca3af] sm:text-right">{p.note}</div>
              <span
                className={`self-start rounded-full px-2.5 py-0.5 text-xs font-medium sm:self-auto ${
                  p.status === 'Supported'
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : p.status === 'Partial'
                      ? 'bg-amber-500/15 text-amber-300'
                      : 'bg-red-500/15 text-red-300'
                }`}
              >
                {p.status}
              </span>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-[#1f2937] py-8 text-center text-sm text-[#6b7280]">
        Universal AI Memory Vault — you own your memories.
      </footer>
    </main>
  );
}
