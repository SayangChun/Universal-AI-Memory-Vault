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
        throw new Error('文件不是有效的 JSON 格式');
      }
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? '导入失败');
      setNotice(`已成功导入 ${data.imported} 条记忆。`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败');
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
      if (!res.ok) throw new Error(data.message ?? '删除失败');
      setNotice(`已成功删除 ${data.deleted} 条记忆。`);
      setConfirmDelete(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setBusy(false);
    }
  }

  const card = 'rounded-2xl border border-[#1f2937] bg-[#111827] p-5';
  const btn = 'rounded-lg border border-[#374151] px-4 py-2 text-sm font-medium hover:bg-[#1f2937]';

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">系统设置</h1>
      <p className="mt-1 text-sm text-[#9ca3af]">数据自主，完全掌控。支持导出、导入或清空数据。</p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
      )}
      {notice && (
        <div className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {notice}
        </div>
      )}

      <section className={`${card} mt-6`}>
        <h2 className="font-semibold">导出数据</h2>
        <p className="mt-1 text-sm text-[#9ca3af]">
          将所有记忆下载为 <code className="text-[#60a5fa]">universal-memory.json</code> 文件。此文件可用于重新导入以恢复所有数据。
        </p>
        <a
          href="/api/export"
          onClick={doExport}
          className="mt-4 inline-block rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d4ed8]"
        >
          导出所有记忆
        </a>
      </section>

      <section className={`${card} mt-6`}>
        <h2 className="font-semibold">导入数据</h2>
        <p className="mt-1 text-sm text-[#9ca3af]">从先前的导出文件中恢复数据。</p>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className={`${btn} mt-4 disabled:opacity-50`}
        >
          选择文件…
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void doImport(e)} />
      </section>

      <section className="mt-6 rounded-2xl border border-red-500/30 bg-[#1a0d0d] p-5">
        <h2 className="font-semibold text-red-300">危险区域</h2>
        <p className="mt-1 text-sm text-[#9ca3af]">
          永久删除<b className="text-[#e5e9f0]">所有</b>记忆及其历史版本。此操作不可逆，建议在操作前先导出备份。
        </p>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="mt-4 rounded-lg border border-red-500/50 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-500/10"
          >
            清空所有记忆
          </button>
        ) : (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/40 px-3 py-2">
            <span className="text-sm text-red-300">确定要清空所有数据吗？</span>
            <button
              onClick={() => void doDeleteAll()}
              disabled={busy}
              className="rounded bg-red-500/20 px-3 py-1 text-sm font-medium text-red-300 disabled:opacity-50"
            >
              确认清空
            </button>
            <button onClick={() => setConfirmDelete(false)} className="text-sm text-[#9ca3af]">
              取消
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
