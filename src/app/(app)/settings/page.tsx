'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function doExport() {
    setError(null);
    setNotice(null);
  }

  async function doImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error('File is not valid JSON');
      }
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Import failed');
      setNotice(`Imported ${data.imported} memories.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function doDeleteAll() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/delete-all', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE_ALL' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Delete failed');
      setNotice(`Deleted ${data.deleted} memories.`);
      setConfirmDelete(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  const card = 'rounded-2xl border border-[#1f2937] bg-[#111827] p-5';
  const btn = 'rounded-lg border border-[#374151] px-4 py-2 text-sm font-medium hover:bg-[#1f2937]';

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-1 text-sm text-[#9ca3af]">Your data, your control. Export, import, or erase.</p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
      )}
      {notice && (
        <div className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {notice}
        </div>
      )}

      <section className={`${card} mt-6`}>
        <h2 className="font-semibold">Export</h2>
        <p className="mt-1 text-sm text-[#9ca3af]">
          Download all memories as <code className="text-[#60a5fa]">universal-memory.json</code>. This file can be
          re-imported to restore everything.
        </p>
        <a
          href="/api/export"
          onClick={doExport}
          className="mt-4 inline-block rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d4ed8]"
        >
          Export all memories
        </a>
      </section>

      <section className={`${card} mt-6`}>
        <h2 className="font-semibold">Import</h2>
        <p className="mt-1 text-sm text-[#9ca3af]">Restore from a previous export file.</p>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className={`${btn} mt-4 disabled:opacity-50`}
        >
          Choose file…
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void doImport(e)} />
      </section>

      <section className="mt-6 rounded-2xl border border-red-500/30 bg-[#1a0d0d] p-5">
        <h2 className="font-semibold text-red-300">Danger zone</h2>
        <p className="mt-1 text-sm text-[#9ca3af]">
          Permanently delete <b className="text-[#e5e9f0]">all</b> memories and versions. This cannot be undone. It is
          recommended to export first.
        </p>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="mt-4 rounded-lg border border-red-500/50 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-500/10"
          >
            Delete all memories
          </button>
        ) : (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/40 px-3 py-2">
            <span className="text-sm text-red-300">Really delete everything?</span>
            <button
              onClick={() => void doDeleteAll()}
              disabled={busy}
              className="rounded bg-red-500/20 px-3 py-1 text-sm font-medium text-red-300 disabled:opacity-50"
            >
              Yes, delete everything
            </button>
            <button onClick={() => setConfirmDelete(false)} className="text-sm text-[#9ca3af]">
              Cancel
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
