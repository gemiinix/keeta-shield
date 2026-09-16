'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { HistoricoEntry } from '@/lib/types';
import { interpolate } from '@/components/editor/TemplateEditor';

type FiltroTipo = 'todos' | 'procon' | 'subsidio';

export default function HistoricoPage({
  onOpenAnalysis,
}: {
  onOpenAnalysis: (r: { extracted: Record<string, string>; templateText: string }) => void;
}) {
  const [entries, setEntries] = useState<HistoricoEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');
  const [busca, setBusca] = useState<string>('');

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

  // Filtros simples no front (sem API nova)
  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return entries.filter((e) => {
      if (filtroTipo !== 'todos' && e.tipo !== filtroTipo) return false;
      if (termo) {
        const alvo = `${e.resumo} ${e.clausula} ${e.templateGerado}`.toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  }, [entries, filtroTipo, busca]);

  if (loading) {
    return <p className="mt-8 text-sm text-ink/50">Carregando histórico…</p>;
  }

  if (error) {
    return (
      <div className="mt-8">
        <p
          role="alert"
          className="rounded border border-danger-red bg-danger-bg px-4 py-3 text-sm text-danger-red"
        >
          {error}
        </p>
        <button
          onClick={load}
          className="mt-3 text-xs font-bold text-keeta-teal-dark hover:underline"
        >
          tentar novamente
        </button>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="mt-8 rounded-lg border border-dashed border-line bg-surface px-8 py-10 text-center text-sm text-ink/55">
        Nenhuma análise registrada ainda. Faça a primeira em{' '}
        <strong className="text-ink">Nova Análise</strong>.
      </p>
    );
  }

  return (
    <div className="mt-6">
      {/* Filtros objetivos */}
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="filtro-tipo" className="sr-only">
          Filtrar por tipo de fluxo
        </label>
        <select
          id="filtro-tipo"
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value as FiltroTipo)}
          className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink focus:border-ink/40 focus:outline-none"
        >
          <option value="todos">Todos os fluxos</option>
          <option value="procon">Procon</option>
          <option value="subsidio">Subsídio</option>
        </select>
        <label htmlFor="filtro-busca" className="sr-only">
          Buscar no histórico
        </label>
        <input
          id="filtro-busca"
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por resumo, cláusula ou peça…"
          className="min-w-[220px] flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus:border-ink/40 focus:outline-none"
        />
        <span className="text-xs text-ink/45">
          {filtradas.length} de {entries.length} registros
        </span>
      </div>

      {/* Tabela densa e escaneável */}
      {filtradas.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-line bg-surface px-8 py-8 text-center text-sm text-ink/55">
          Nenhum registro corresponde aos filtros atuais.
        </p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg border border-line bg-white">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Histórico de análises</caption>
            <thead>
              <tr className="border-b border-line bg-surface text-[11px] font-bold uppercase tracking-wider text-ink/55">
                <th scope="col" className="px-4 py-2.5">Data</th>
                <th scope="col" className="px-4 py-2.5">Tipo</th>
                <th scope="col" className="px-4 py-2.5">Resumo</th>
                <th scope="col" className="px-4 py-2.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtradas.map((e) => (
                <ExpandableRow
                  key={e.id}
                  entry={e}
                  expanded={expanded === e.id}
                  onToggle={() => setExpanded(expanded === e.id ? null : e.id)}
                  onOpenAnalysis={onOpenAnalysis}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Linha expansível — um <tr> principal + <tr> de detalhes (sem fragmento). */
function ExpandableRow({
  entry: e,
  expanded,
  onToggle,
  onOpenAnalysis,
}: {
  entry: HistoricoEntry;
  expanded: boolean;
  onToggle: () => void;
  onOpenAnalysis: (r: {
    extracted: Record<string, string>;
    templateText: string;
  }) => void;
}) {
  return (
    <>
      <tr className="align-top transition-colors duration-150 hover:bg-surface/60">
        <td className="whitespace-nowrap px-4 py-3 text-xs text-ink/60">
          {new Date(e.criadoEm).toLocaleDateString('pt-BR')}
          <span className="block text-[10px] text-ink/40">
            {new Date(e.criadoEm).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </td>
        <td className="whitespace-nowrap px-4 py-3">
          <span
            className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
              e.tipo === 'procon'
                ? 'bg-keeta-yellow/25 text-ink'
                : 'bg-keeta-teal/15 text-keeta-teal-dark'
            }`}
          >
            {e.tipo === 'procon' ? 'Procon' : 'Subsídio'}
          </span>
          <span className="mt-1 block text-[10px] uppercase tracking-wide text-ink/40">
            {e.origem}
          </span>
        </td>
        <td className="px-4 py-3">
          <p className="line-clamp-2 max-w-2xl text-sm leading-snug text-ink/80">{e.resumo}</p>
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-right">
          <div className="flex justify-end gap-2">
            <button
              onClick={onToggle}
              className="rounded px-2 py-1 text-xs font-semibold text-ink/55 transition-colors duration-150 hover:bg-surface hover:text-ink"
            >
              {expanded ? 'recolher' : 'detalhes'}
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
              className="rounded bg-ink px-2.5 py-1 text-xs font-bold text-white transition-colors duration-150 hover:bg-keeta-teal-dark"
            >
              abrir no editor
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-surface/50">
          <td colSpan={4} className="border-b border-line px-4 py-4">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h4 className="font-display text-[10px] font-bold uppercase tracking-wider text-keeta-teal-dark">
                  Cláusula aplicável
                </h4>
                <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-ink/70">
                  {e.clausula}
                </p>
              </div>
              <div>
                <h4 className="font-display text-[10px] font-bold uppercase tracking-wider text-keeta-teal-dark">
                  Peça gerada
                </h4>
                <p className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-ink/70">
                  {interpolate(e.templateGerado, {})}
                </p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
