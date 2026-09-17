'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClockIcon } from '@heroicons/react/24/outline';
import type { HistoricoEntry, CrmSnapshot } from '@/lib/types';
import { interpolate } from '@/components/editor/TemplateEditor';

/** Segundos → MM:SS (ex.: 125 → "02:05"). */
function tmoFmtDetalhe(seg: number) {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

type FiltroTipo = 'todos' | 'procon' | 'subsidio';

export default function HistoricoPage({
  onOpenAnalysis,
  onNavigateToEditor,
}: {
  onOpenAnalysis: (r: {
    extracted: Record<string, string>;
    templateText: string;
    casoId?: number | null;
    crm?: {
      dadosIA: {
        cipProcon: string;
        numeroPedido: string;
        mcdonalds: boolean;
        motivoClassificado: string;
      };
      prazoDefesa: {
        dataAberturaISO: string;
        deadlineFinalISO: string;
        diasRestantes: number;
      } | null;
      snapshot?: CrmSnapshot | null;
    };
  }) => void;
  onNavigateToEditor: () => void;
}) {
  const [entries, setEntries] = useState<HistoricoEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');
  const [busca, setBusca] = useState<string>('');
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [removendo, setRemovendo] = useState(false);
  const [confirmarLimpar, setConfirmarLimpar] = useState(false);

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

  const toggleSelecionado = (id: number) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const todosVisiveisSelecionados =
    filtradas.length > 0 && filtradas.every((e) => selecionados.has(e.id));

  const alternarTodos = () => {
    setSelecionados((prev) => {
      if (filtradas.every((e) => prev.has(e.id))) {
        return new Set();
      }
      return new Set(filtradas.map((e) => e.id));
    });
  };

  const excluirSelecionados = async () => {
    if (selecionados.size === 0 || removendo) return;
    setRemovendo(true);
    setError(null);
    try {
      const ids = [...selecionados].join(',');
      const res = await fetch(`/api/historico?ids=${ids}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? 'Falha ao excluir registros.');
      }
      setSelecionados(new Set());
      setExpanded(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.');
    } finally {
      setRemovendo(false);
    }
  };

  const excluirUm = async (id: number) => {
    if (removendo) return;
    setRemovendo(true);
    setError(null);
    try {
      const res = await fetch(`/api/historico?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? 'Falha ao excluir registro.');
      }
      setSelecionados((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (expanded === id) setExpanded(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.');
    } finally {
      setRemovendo(false);
    }
  };

  const limparTudo = async () => {
    if (removendo) return;
    setRemovendo(true);
    setError(null);
    try {
      const res = await fetch('/api/historico?all=true', { method: 'DELETE' });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? 'Falha ao limpar histórico.');
      }
      setSelecionados(new Set());
      setExpanded(null);
      setConfirmarLimpar(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.');
    } finally {
      setRemovendo(false);
    }
  };

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

        {/* Ações de exclusão em massa */}
        <div className="ml-auto flex items-center gap-2">
          {selecionados.size > 0 && (
            <button
              onClick={excluirSelecionados}
              disabled={removendo}
              className="rounded-lg border border-danger-red bg-white px-3 py-2 text-xs font-bold text-danger-red transition-colors duration-150 hover:bg-danger-bg disabled:cursor-not-allowed disabled:opacity-50"
            >
              excluir {selecionados.size === 1 ? '1 registro' : `${selecionados.size} registros`}
            </button>
          )}
          {confirmarLimpar ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-danger-red">limpar TODO o histórico?</span>
              <button
                onClick={limparTudo}
                disabled={removendo}
                className="rounded-lg bg-danger-red px-3 py-2 text-xs font-bold text-white transition-colors duration-150 disabled:opacity-50"
              >
                confirmar
              </button>
              <button
                onClick={() => setConfirmarLimpar(false)}
                disabled={removendo}
                className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-ink/60 transition-colors duration-150 hover:bg-surface"
              >
                cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmarLimpar(true)}
              disabled={removendo || entries.length === 0}
              className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-ink/55 transition-colors duration-150 hover:border-danger-red hover:text-danger-red disabled:cursor-not-allowed disabled:opacity-40"
            >
              limpar tudo
            </button>
          )}
        </div>
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
                <th scope="col" className="w-10 px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={todosVisiveisSelecionados}
                    onChange={alternarTodos}
                    aria-label="Selecionar todos os registros visíveis"
                    className="size-4 cursor-pointer accent-ink"
                  />
                </th>
                <th scope="col" className="px-4 py-2.5">Data</th>
                <th scope="col" className="px-4 py-2.5">Tipo</th>
                <th scope="col" className="px-4 py-2.5">Status</th>
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
                  selecionado={selecionados.has(e.id)}
                  onToggle={() => setExpanded(expanded === e.id ? null : e.id)}
                  onOpenAnalysis={onOpenAnalysis}
                  onNavigateToEditor={onNavigateToEditor}
                  onToggleSelecionado={() => toggleSelecionado(e.id)}
                  onExcluir={() => excluirUm(e.id)}
                  removendo={removendo}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Badge de status da tratativa — leitura visual rápida na listagem.
 *  Encerrado → verde · Em andamento (ou outro) → âmbar · vazio → neutro. */
function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = (status ?? '').trim();
  if (!s) {
    return (
      <span className="inline-block border border-slate-200 bg-slate-100 px-2 py-1 rounded-md text-xs font-semibold text-slate-600">
        Não definido
      </span>
    );
  }
  const encerrado = s.toLowerCase() === 'encerrado';
  return (
    <span
      className={
        encerrado
          ? 'inline-block border border-emerald-200 bg-emerald-100 px-2 py-1 rounded-md text-xs font-semibold text-emerald-800'
          : 'inline-block border border-amber-200 bg-amber-100 px-2 py-1 rounded-md text-xs font-semibold text-amber-800'
      }
    >
      {s}
    </span>
  );
}

/** Linha expansível — um <tr> principal + <tr> de detalhes (sem fragmento). */
function ExpandableRow({
  entry: e,
  expanded,
  selecionado,
  onToggle,
  onOpenAnalysis,
  onNavigateToEditor,
  onToggleSelecionado,
  onExcluir,
  removendo,
}: {
  entry: HistoricoEntry;
  expanded: boolean;
  selecionado: boolean;
  onToggle: () => void;
  onOpenAnalysis: (r: {
    extracted: Record<string, string>;
    templateText: string;
    casoId?: number | null;
    crm?: {
      dadosIA: {
        cipProcon: string;
        numeroPedido: string;
        mcdonalds: boolean;
        motivoClassificado: string;
      };
      prazoDefesa: {
        dataAberturaISO: string;
        deadlineFinalISO: string;
        diasRestantes: number;
      } | null;
      snapshot?: CrmSnapshot | null;
    };
  }) => void;
  onNavigateToEditor: () => void;
  onToggleSelecionado: () => void;
  onExcluir: () => void;
  removendo: boolean;
}) {
  const abrirNoEditor = () => {
    onOpenAnalysis({
      extracted: {
        RESUMO_EXECUTIVO: e.resumo,
        CLAUSULA_APLICAVEL: e.clausula,
      },
      templateText: e.templateGerado,
      casoId: e.id,
      crm:
        e.tipo === 'procon'
          ? {
              dadosIA:
                e.dadosCrm?.dadosIA ?? {
                  cipProcon: '',
                  numeroPedido: '',
                  mcdonalds: false,
                  motivoClassificado: '',
                },
              prazoDefesa: e.dadosCrm?.prazoDefesa ?? null,
              snapshot: e.dadosCrm ?? null,
            }
          : undefined,
    });
    onNavigateToEditor();
  };

  return (
    <>
      <tr className={`align-top transition-colors duration-150 hover:bg-surface/60 ${selecionado ? 'bg-surface' : ''}`}>
        <td className="px-4 py-3">
          <input
            type="checkbox"
            checked={selecionado}
            onChange={onToggleSelecionado}
            aria-label={`Selecionar registro de ${new Date(e.criadoEm).toLocaleDateString('pt-BR')}`}
            className="size-4 cursor-pointer accent-ink"
          />
        </td>
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
        <td className="whitespace-nowrap px-4 py-3">
          <StatusBadge status={e.dadosCrm?.campos?.status ?? null} />
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
              onClick={abrirNoEditor}
              className="rounded bg-ink px-2.5 py-1 text-xs font-bold text-white transition-colors duration-150 hover:bg-keeta-teal-dark"
            >
              abrir no editor
            </button>
            <button
              onClick={onExcluir}
              disabled={removendo}
              title="Excluir este registro"
              aria-label="Excluir este registro"
              className="rounded px-2 py-1 text-xs font-semibold text-ink/40 transition-colors duration-150 hover:bg-danger-bg hover:text-danger-red disabled:cursor-not-allowed disabled:opacity-50"
            >
              excluir
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-surface/50">
          <td colSpan={6} className="border-b border-line px-4 py-4">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h4 className="font-display text-[10px] font-bold uppercase tracking-wider text-keeta-teal-dark">
                  Cláusula aplicável
                </h4>
                <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-ink/70">
                  {e.clausula}
                </p>
                {e.dadosCrm && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {e.dadosCrm.tmoSegundos != null && (
                      <span
                        className="inline-flex items-center gap-1 rounded border border-keeta-teal/40 bg-keeta-teal/10 px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums text-keeta-teal-dark"
                        title="Tempo Total de Tratativa (TMO) — tempo até o primeiro salvamento do caso"
                      >
                        <ClockIcon className="h-3 w-3" />
                        TMO {tmoFmtDetalhe(e.dadosCrm.tmoSegundos)}
                      </span>
                    )}
                    {e.dadosCrm.campos?.motivo && (
                      <span
                        className="max-w-[260px] truncate rounded border border-line bg-white px-2 py-0.5 text-[11px] font-semibold text-ink/70"
                        title={e.dadosCrm.campos.motivo}
                      >
                        {e.dadosCrm.campos.motivo}
                      </span>
                    )}
                    {e.dadosCrm.dadosIA?.cipProcon && (
                      <span className="rounded border border-line bg-white px-2 py-0.5 font-mono text-[11px] text-ink/70">
                        CIP {e.dadosCrm.dadosIA.cipProcon}
                      </span>
                    )}
                  </div>
                )}
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
