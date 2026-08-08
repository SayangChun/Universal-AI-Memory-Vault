'use client';
import { useCallback, useEffect, useState } from 'react';
import { PROVIDER_LABELS, type Provider } from '@/lib/types';
import { formatDate } from '@/lib/utils';

interface Integration {
  id: string;
  provider: Provider;
  name: string;
  status: string;
  credential_type: string;
  meta: Record<string, unknown>;
  created_at: string;
  last_used_at: string | null;
}

interface AccessToken {
  id: string;
  name: string;
  token_prefix: string;
  integration_id: string | null;
  expires_at: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [tokens, setTokens] = useState<AccessToken[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newProvider, setNewProvider] = useState<Provider>('claude');
  const [newTokenName, setNewTokenName] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const [iRes, tRes] = await Promise.all([fetch('/api/integrations'), fetch('/api/access-tokens')]);
      if (!iRes.ok || !tRes.ok) throw new Error('加载集成失败');
      const iData = await iRes.json();
      const tData = await tRes.json();
      setIntegrations(iData.integrations ?? []);
      setTokens(tData.tokens ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载集成失败');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addIntegration(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const res = await fetch('/api/integrations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: newName, provider: newProvider }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message ?? '添加集成失败');
      return;
    }
    setNewName('');
    void load();
  }

  async function removeIntegration(id: string) {
    const res = await fetch(`/api/integrations/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      setError(data.message ?? '删除集成失败');
      return;
    }
    void load();
  }

  async function createToken(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!newTokenName.trim()) return;
    const res = await fetch('/api/access-tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: newTokenName.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message ?? '创建令牌失败');
      return;
    }
    setNotice(`令牌已创建：${data.secret}。请立即复制保存，密钥不会再次显示。`);
    setNewTokenName('');
    void load();
  }

  async function revokeToken(id: string) {
    const res = await fetch(`/api/access-tokens/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      setError(data.message ?? '撤销令牌失败');
      return;
    }
    void load();
  }

  const inputCls =
    'rounded-lg border border-[#1f2937] bg-[#0f172a] px-3 py-2 text-sm text-[#e5e9f0] outline-none focus:border-[#2563eb]';

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold">平台集成</h1>
      <p className="mt-1 text-sm text-[#9ca3af]">
        通过 MCP (OAuth) 连接 AI 平台，或创建个人访问令牌 (Access Token) 以供程序调用。
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
      )}
      {notice && (
        <div className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {notice}
        </div>
      )}

      <section className="mt-6 rounded-2xl border border-[#1f2937] bg-[#111827] p-5">
        <h2 className="font-semibold">已连接的 AI 平台</h2>
        {integrations.length === 0 ? (
          <p className="mt-3 text-sm text-[#6b7280]">暂无集成记录。</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {integrations.map((i) => (
              <li key={i.id} className="flex items-center justify-between rounded-xl border border-[#1f2937] p-3">
                <div>
                  <div className="text-sm font-medium">{i.name}</div>
                  <div className="text-xs text-[#6b7280]">
                    {PROVIDER_LABELS[i.provider] ?? i.provider} · {i.credential_type}
                    {i.last_used_at ? ` · 上次使用于 ${formatDate(i.last_used_at)}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => removeIntegration(i.id)}
                  className="rounded-lg border border-red-500/40 px-3 py-1 text-xs text-red-300 hover:bg-red-500/10"
                >
                  删除
                </button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={addIntegration} className="mt-4 flex flex-wrap items-end gap-2">
          <label className="flex-1 text-xs text-[#9ca3af]">
            名称
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="例如：Claude (claude.ai)" className={`${inputCls} mt-1 w-full`} />
          </label>
          <label className="text-xs text-[#9ca3af]">
            提供商
            <select
              value={newProvider}
              onChange={(e) => setNewProvider(e.target.value as Provider)}
              className={`${inputCls} mt-1`}
            >
              {(Object.keys(PROVIDER_LABELS) as Provider[]).map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d4ed8]">
            添加
          </button>
        </form>
      </section>

      <section className="mt-6 rounded-2xl border border-[#1f2937] bg-[#111827] p-5">
        <h2 className="font-semibold">个人访问令牌 (Access Tokens)</h2>
        <p className="mt-1 text-sm text-[#9ca3af]">
          适用于 CLI / stdio MCP 客户端及程序化调用。令牌的作用类似于 OAuth 会话。
        </p>
        {tokens.length === 0 ? (
          <p className="mt-3 text-sm text-[#6b7280]">暂无令牌。</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {tokens.map((t) => (
              <li key={t.id} className="flex items-center justify-between rounded-xl border border-[#1f2937] p-3">
                <div>
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="text-xs text-[#6b7280]">
                    <code className="text-[#60a5fa]">{t.token_prefix}…</code> · 创建于 {formatDate(t.created_at)}
                    {t.last_used_at ? ` · 上次使用于 ${formatDate(t.last_used_at)}` : ''}
                    {t.revoked_at ? ' · 已撤销' : ''}
                  </div>
                </div>
                {!t.revoked_at && (
                  <button
                    onClick={() => revokeToken(t.id)}
                    className="rounded-lg border border-red-500/40 px-3 py-1 text-xs text-red-300 hover:bg-red-500/10"
                  >
                    撤销
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={createToken} className="mt-4 flex items-end gap-2">
          <label className="flex-1 text-xs text-[#9ca3af]">
            令牌名称
            <input value={newTokenName} onChange={(e) => setNewTokenName(e.target.value)} placeholder="例如：my-script" className={`${inputCls} mt-1 w-full`} />
          </label>
          <button type="submit" className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d4ed8]">
            创建令牌
          </button>
        </form>
      </section>

      <section className="mt-6 rounded-2xl border border-[#1f2937] bg-[#111827] p-5">
        <h2 className="font-semibold">连接 Claude / ChatGPT / Gemini 说明</h2>
        <p className="mt-1 text-sm text-[#9ca3af]">详细配置指南请参考文档。概括如下：</p>
        <ul className="mt-3 flex flex-col gap-2 text-sm text-[#9ca3af]">
          <li>
            <b className="text-[#e5e9f0]">Claude</b> — 将 MCP 服务器 URL 添加为自定义远程连接器，OAuth 将自动运行。
          </li>
          <li>
            <b className="text-[#e5e9f0]">ChatGPT</b> — 启用开发者模式，然后添加远程 MCP 服务器 URL。完整写入权限需要 Business/Enterprise/Edu 订阅。
          </li>
          <li>
            <b className="text-[#e5e9f0]">Gemini (Web)</b> — 个人账号暂不支持自服务 MCP；请使用 Gemini API/CLI 或 Enterprise 版本。
          </li>
        </ul>
      </section>
    </div>
  );
}
