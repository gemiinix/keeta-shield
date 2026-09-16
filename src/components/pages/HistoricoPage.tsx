'use client';

import { useCallback, useEffect, useState } from 'react';
import type { HistoricoEntry } from '@/lib/types';
import { interpolate } from '@/components/editor/TemplateEditor';

export default function HistoricoPage({
  onOpenAnalysis,
}: {
  onOpenAnalysis: (r: { extracted: Record<string, string>; templateText: string }) => void;
}) {
  const [entries, setEntries] = useState<HistoricoEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/historico');
      if (!res.ok) throw new Error('Falha ao carregar histórico.');
      const data = (await res.json()) as { entries: HistoricoEntry[] };
      setEntries(data.entries ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <p className="mt-8 text-sm text-zinc-500">Carregando histórico…</p>;
  }

  if (error) {
    return (
      <div className="mt-8">
        <p className="rounded-lg border border-red-900/50 bg-red-950/40 p-3 text-xs text-red-300">{error}</p>
        <button onClick={load} className="mt-3 text-xs font-semibold text-keeta-teal hover:underline">
          tentar novamente
        </button>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="mt-8 rounded-xl border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-500">
        Nenhuma análise registrada ainda. Faça a primeira em <strong className="text-zinc-300">Nova Análise</strong>.
      </p>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      {entries.map((e) => (
        <article
          key={e.id}
          className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-colors hover:border-zinc-600"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                  e.tipo === 'procon' ? 'bg-keeta-yellow/15 text-keeta-yellow' : 'bg-keeta-teal/15 text-keeta-teal'
                }`}
              >
                {e.tipo}
              </span>
              <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                {e.origem} · {new Date(e.criadoEm).toLocaleString('pt-BR')}
              </span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                className="text-xs font-semibold text-zinc-400 hover:text-zinc-200"
              >
                {expanded === e.id ? 'recolher' : 'detalhes'}
              </button>
              <button
                onClick={() =>
                  onOpenAnalysis({
                    extracted: {
                      RESUMO_EXECUTIVO: e.resumo,
                      CLAUSULA_APLICAVEL: e.clausula,
                    },
                    templateText: e.templateGerado,
                  })
                }
                className="text-xs font-semibold text-keeta-teal hover:underline"
              >
                abrir no editor
              </button>
            </div>
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-zinc-300">{e.resumo}</p>

          {expanded === e.id && (
            <div className="mt-3 space-y-3 border-t border-zinc-800 pt-3">
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-keeta-teal">Cláusula aplicável</h4>
                <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-zinc-400">{e.clausula}</p>
              </div>
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-keeta-teal">Template gerado</h4>
                <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-zinc-400">
                  {interpolate(e.templateGerado, {})}
                </p>
              </div>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
