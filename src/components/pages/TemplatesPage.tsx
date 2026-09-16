'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Template } from '@/lib/types';
import { PLACEHOLDER_TEMPLATE } from '@/components/editor/TemplateEditor';

/**
 * Página de Templates: lista + editor lado a lado quando há espaço.
 * Criar/editar/excluir claramente diferenciados; checkbox "padrão".
 */
export default function TemplatesPage() {
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

  const resetForm = () => {
    setEditing(null);
    setNome('');
    setConteudo('');
    setPadrao(false);
  };

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
      setMsg(editing ? 'Template atualizado.' : 'Template criado.');
      resetForm();
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
        if (editing?.id === id) resetForm();
        load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao remover.');
      }
    },
    [load, editing]
  );

  return (
    <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(320px,1fr)_minmax(320px,1fr)]">
      {/* Editor */}
      <section aria-label="Editor de template" className="animate-fade-in-up">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink">
          {editing ? `Editando: ${editing.nome}` : 'Novo Template'}
        </h2>
        <div className="mt-4 space-y-3">
          <div>
            <label
              htmlFor="template-nome"
              className="mb-1 block text-xs font-semibold text-ink/70"
            >
              Nome
            </label>
            <input
              id="template-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Resposta Procon Padrão"
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus:border-ink/40 focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="template-conteudo"
              className="mb-1 block text-xs font-semibold text-ink/70"
            >
              Conteúdo (use {'{{VARIAVEL}}'} para campos interpoláveis)
            </label>
            <textarea
              id="template-conteudo"
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              placeholder={PLACEHOLDER_TEMPLATE}
              rows={14}
              spellCheck={false}
              className="w-full resize-y rounded-lg border border-line bg-white p-3 font-mono text-xs leading-relaxed text-ink placeholder:text-ink/35 focus:border-ink/40 focus:outline-none"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-ink/70">
            <input
              type="checkbox"
              checked={padrao}
              onChange={(e) => setPadrao(e.target.checked)}
              className="h-4 w-4 accent-keeta-teal"
            />
            Usar como template padrão nas novas análises
          </label>
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <button
              onClick={handleSave}
              className="rounded-lg bg-ink px-5 py-2 text-sm font-bold text-white transition-colors duration-150 hover:bg-keeta-teal-dark"
            >
              {editing ? 'Salvar alterações' : 'Criar template'}
            </button>
            {editing && (
              <button
                onClick={resetForm}
                className="text-sm font-semibold text-ink/50 transition-colors duration-150 hover:text-ink"
              >
                cancelar edição
              </button>
            )}
            {!editing && (
              <button
                onClick={() => setConteudo(PLACEHOLDER_TEMPLATE)}
                className="text-sm font-semibold text-ink/50 transition-colors duration-150 hover:text-keeta-teal-dark"
              >
                usar padrão Procon
              </button>
            )}
          </div>
          {msg && (
            <p role="status" className="text-xs font-semibold text-keeta-teal-dark">
              {msg}
            </p>
          )}
          {error && (
            <p role="alert" className="text-xs font-semibold text-danger-red">
              {error}
            </p>
          )}
        </div>
      </section>

      {/* Lista */}
      <section aria-label="Templates salvos" className="animate-fade-in-up">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink">
          Templates Salvos
        </h2>
        <div className="mt-4">
          {loading ? (
            <p className="text-sm text-ink/50">Carregando…</p>
          ) : templates.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line bg-surface px-6 py-8 text-center text-sm text-ink/55">
              Nenhum template salvo. Crie o primeiro ao lado — ou clique em &quot;usar
              padrão Procon&quot;.
            </p>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line bg-white">
              {templates.map((t) => (
                <li key={t.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <h3 className="truncate text-sm font-bold text-ink">{t.nome}</h3>
                      {t.padrao && (
                        <span className="shrink-0 rounded bg-keeta-teal/15 px-2 py-0.5 text-[10px] font-bold uppercase text-keeta-teal-dark">
                          padrão
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => {
                          setEditing(t);
                          setNome(t.nome);
                          setConteudo(t.conteudo);
                          setPadrao(t.padrao);
                        }}
                        className="rounded border border-line px-2.5 py-1 text-xs font-bold text-ink/70 transition-colors duration-150 hover:border-ink/40 hover:text-ink"
                      >
                        editar
                      </button>
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="rounded border border-danger-red/30 px-2.5 py-1 text-xs font-bold text-danger-red transition-colors duration-150 hover:bg-danger-bg"
                      >
                        excluir
                      </button>
                    </div>
                  </div>
                  <p className="mt-1.5 line-clamp-2 whitespace-pre-wrap font-mono text-[11px] text-ink/45">
                    {t.conteudo.slice(0, 200)}…
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
