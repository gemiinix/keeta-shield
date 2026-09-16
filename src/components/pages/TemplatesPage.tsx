'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DocumentArrowUpIcon } from '@heroicons/react/24/outline';
import type { Template, Termo } from '@/lib/types';
import { PLACEHOLDER_TEMPLATE } from '@/components/editor/TemplateEditor';

type Tab = 'templates' | 'termos';

export default function TemplatesPage() {
  const [tab, setTab] = useState<Tab>('templates');

  return (
    <div className="mt-6">
      <div className="inline-flex rounded-xl border border-zinc-800 bg-zinc-900 p-1">
        {(
          [
            { key: 'templates', label: 'Templates de Resposta' },
            { key: 'termos', label: 'Termos e Condições (Keeta)' },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-lg px-5 py-2 text-sm font-semibold transition-all ${
              tab === key ? 'bg-keeta-teal text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">{tab === 'templates' ? <TemplatesTab /> : <TermosTab />}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Aba: Templates de resposta                                          */
/* ------------------------------------------------------------------ */

function TemplatesTab() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | null>(null);
  const [nome, setNome] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [padrao, setPadrao] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/templates');
      const data = (await res.json()) as { templates?: Template[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Falha ao carregar.');
      setTemplates(data.templates ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = useCallback(async () => {
    setError(null);
    setMsg(null);
    if (!nome.trim() || !conteudo.trim()) {
      setError('Preencha nome e conteúdo.');
      return;
    }
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing?.id, nome: nome.trim(), conteudo, padrao }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Falha ao salvar.');
      setMsg(editing ? 'Template atualizado ✅' : 'Template criado ✅');
      setEditing(null);
      setNome('');
      setConteudo('');
      setPadrao(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.');
    }
  }, [nome, conteudo, padrao, editing, load]);

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        const res = await fetch(`/api/templates?id=${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Falha ao remover.');
        load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao remover.');
      }
    },
    [load]
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Formulário */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <h3 className="text-sm font-bold text-zinc-100">
          {editing ? `Editando: ${editing.nome}` : 'Novo Template'}
        </h3>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome (ex.: Resposta Procon Padrão)"
          className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-keeta-teal"
        />
        <textarea
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          placeholder={PLACEHOLDER_TEMPLATE}
          rows={14}
          spellCheck={false}
          className="mt-3 w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-keeta-teal"
        />
        <label className="mt-3 flex items-center gap-2 text-xs text-zinc-400">
          <input type="checkbox" checked={padrao} onChange={(e) => setPadrao(e.target.checked)} className="accent-keeta-teal" />
          Usar como template padrão nas novas análises
        </label>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleSave}
            className="rounded-xl bg-keeta-yellow px-5 py-2 text-sm font-bold text-zinc-900 transition-colors hover:bg-keeta-yellow-dark"
          >
            {editing ? 'Salvar alterações' : 'Criar template'}
          </button>
          {editing && (
            <button
              onClick={() => {
                setEditing(null);
                setNome('');
                setConteudo('');
                setPadrao(false);
              }}
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-300"
            >
              cancelar edição
            </button>
          )}
          {!editing && (
            <button
              onClick={() => setConteudo(PLACEHOLDER_TEMPLATE)}
              className="text-xs font-semibold text-zinc-500 hover:text-keeta-teal"
            >
              usar padrão Procon
            </button>
          )}
        </div>
        {msg && <p className="mt-3 text-xs text-keeta-teal">{msg}</p>}
        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      </section>

      {/* Lista */}
      <section>
        {loading ? (
          <p className="text-sm text-zinc-500">Carregando…</p>
        ) : templates.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-700 p-6 text-center text-sm text-zinc-500">
            Nenhum template salvo. Crie o primeiro ao lado — ou clique em &quot;usar padrão Procon&quot;.
          </p>
        ) : (
          <ul className="space-y-3">
            {templates.map((t) => (
              <li key={t.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-zinc-200">{t.nome}</h4>
                    {t.padrao && (
                      <span className="rounded-full bg-keeta-teal/15 px-2 py-0.5 text-[10px] font-bold uppercase text-keeta-teal">
                        padrão
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setEditing(t);
                        setNome(t.nome);
                        setConteudo(t.conteudo);
                        setPadrao(t.padrao);
                      }}
                      className="text-xs font-semibold text-zinc-400 hover:text-zinc-200"
                    >
                      editar
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="text-xs font-semibold text-zinc-500 hover:text-red-400"
                    >
                      remover
                    </button>
                  </div>
                </div>
                <p className="mt-2 line-clamp-3 whitespace-pre-wrap font-mono text-[11px] text-zinc-500">
                  {t.conteudo.slice(0, 200)}…
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Aba: Termos e Condições                                             */
/* ------------------------------------------------------------------ */

const DOC_SUGGESTIONS = ['Keeta Customer', 'Keeta Rider', 'Keeta Merchant'];

function TermosTab() {
  const [termos, setTermos] = useState<Termo[]>([]);
  const [documento, setDocumento] = useState('');
  const [versao, setVersao] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/termos');
      const data = (await res.json()) as { termos?: Termo[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Falha ao carregar.');
      setTermos(data.termos ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleUpload = useCallback(async () => {
    setError(null);
    setMsg(null);
    if (!documento.trim() || !file) {
      setError('Informe o documento (ex.: Keeta Customer) e selecione o PDF.');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('documento', documento.trim());
      fd.append('versao', versao.trim());
      fd.append('arquivo', file);
      const res = await fetch('/api/termos', { method: 'POST', body: fd });
      const data = (await res.json()) as { error?: string; caracteres?: number };
      if (!res.ok) throw new Error(data.error ?? 'Falha no upload.');
      setMsg(`T&C carregado: ${data.caracteres?.toLocaleString('pt-BR')} caracteres extraídos ✅ — a IA já usa este texto nas análises.`);
      setFile(null);
      setVersao('');
      if (inputRef.current) inputRef.current.value = '';
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.');
    } finally {
      setUploading(false);
    }
  }, [documento, versao, file, load]);

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await fetch(`/api/termos?id=${id}`, { method: 'DELETE' });
        load();
      } catch {
        setError('Erro ao remover.');
      }
    },
    [load]
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Upload */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <h3 className="text-sm font-bold text-zinc-100">Carregar / Atualizar T&C da Keeta</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Envie o PDF vigente — o texto é extraído e usado como base factual nas análises. Reenviar substitui a versão anterior.
        </p>

        <input
          value={documento}
          onChange={(e) => setDocumento(e.target.value)}
          placeholder="Nome do documento"
          list="doc-suggestions"
          className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-keeta-teal"
        />
        <datalist id="doc-suggestions">
          {DOC_SUGGESTIONS.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>
        <input
          value={versao}
          onChange={(e) => setVersao(e.target.value)}
          placeholder="Versão / data (opcional, ex.: v2026-09)"
          className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-keeta-teal"
        />

        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) setFile(f);
          }}
          className="mt-3 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-zinc-700 p-8 transition-colors hover:border-zinc-500"
        >
          <DocumentArrowUpIcon className="h-8 w-8 text-zinc-500" />
          <p className="text-xs text-zinc-400">
            {file ? `📄 ${file.name}` : 'Arraste o PDF dos T&C ou clique para selecionar'}
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />

        <button
          onClick={handleUpload}
          disabled={uploading || !file || !documento.trim()}
          className="mt-4 rounded-xl bg-keeta-teal px-5 py-2 text-sm font-bold text-zinc-950 transition-colors hover:bg-keeta-teal-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          {uploading ? 'Extraindo texto…' : 'Carregar T&C'}
        </button>
        {msg && <p className="mt-3 text-xs text-keeta-teal">{msg}</p>}
        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      </section>

      {/* Lista */}
      <section>
        {loading ? (
          <p className="text-sm text-zinc-500">Carregando…</p>
        ) : termos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-700 p-6 text-center text-sm text-zinc-500">
            Nenhum T&C carregado. A IA usa apenas conhecimento genérico até você carregar os oficiais.
          </p>
        ) : (
          <ul className="space-y-3">
            {termos.map((t) => (
              <li key={t.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-200">{t.documento}</h4>
                    <p className="text-[11px] text-zinc-500">
                      {t.versao && `versão ${t.versao} · `}
                      {t.conteudo.length.toLocaleString('pt-BR')} caracteres · atualizado{' '}
                      {new Date(t.atualizadoEm).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="text-xs font-semibold text-zinc-500 hover:text-red-400"
                  >
                    remover
                  </button>
                </div>
                <p className="mt-2 line-clamp-2 text-[11px] text-zinc-600">{t.conteudo.slice(0, 150)}…</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
