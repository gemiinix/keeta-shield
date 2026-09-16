'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChartBarIcon,
  ArrowPathIcon,
  LightBulbIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

type Contagem = { qtd: number; pct: number };
type TopItem = { nome: string; qtd: number; pct: number };

type DashboardData = {
  periodo: { ano: number; mes: number; total: number };
  totalCasos: number;
  funilAtendimento: {
    apenasT1: Contagem;
    t1MaisT2: Contagem;
    naDiretoProcon: Contagem;
  };
  cruzamentoRA: { comRA: Contagem; semRA: Contagem };
  top5MotivosGeral: TopItem[];
  top5PorEtapa: {
    apenasT1: TopItem[];
    t1MaisT2: TopItem[];
    naDiretoProcon: TopItem[];
  };
  insightsGerados: string;
};

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function pctFmt(p: number) {
  return `${p.toFixed(1).replace('.', ',')}%`;
}

function Barra({ pct, tone = 'teal' }: { pct: number; tone?: 'teal' | 'yellow' | 'ink' }) {
  const cor =
    tone === 'teal' ? 'bg-keeta-teal' : tone === 'yellow' ? 'bg-keeta-yellow' : 'bg-ink/70';
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface" aria-hidden="true">
      <div
        className={`h-full rounded-full ${cor}`}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}

function LinhaTabela({ nome, qtd, pct }: { nome: string; qtd: number; pct: number }) {
  return (
    <tr className="border-b border-line last:border-0">
      <td className="px-3 py-2 text-[13px] text-ink/80">{nome}</td>
      <td className="px-3 py-2 text-right text-[13px] font-semibold text-ink">{qtd}</td>
      <td className="px-3 py-2 text-right text-[13px] text-ink/60">{pctFmt(pct)}</td>
    </tr>
  );
}

const thCls = 'px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-ink/50';
const tdNum = 'px-3 py-2 text-right text-[13px] font-semibold text-ink';

export default function DashboardPage() {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [data, setData] = useState<DashboardData | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const load = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/dashboard?ano=${ano}&mes=${mes}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Erro ${res.status} ao carregar dashboard.`);
      }
      setData((await res.json()) as DashboardData);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro inesperado.');
    } finally {
      setCarregando(false);
    }
  }, [ano, mes]);

  useEffect(() => {
    load();
  }, [load]);

  const anos = useMemo(() => {
    const atual = new Date().getFullYear();
    return [atual, atual - 1, atual - 2].filter((a, i, arr) => arr.indexOf(a) === i);
  }, []);

  const semDados = data && data.totalCasos === 0;

  return (
    <div className="mx-auto max-w-6xl">
      {/* Cabeçalho */}
      <header className="mb-6">
        <h1 className="font-display text-2xl font-extrabold uppercase tracking-tight text-ink">
          Dashboard Analítico
        </h1>
        <p className="mt-1 text-sm text-ink/60">
          Relatório gerencial mensal dos casos encerrados — dados do formulário CRM.
        </p>
      </header>

      {/* Controles de período */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-ink/70">
          <span>Período</span>
          <select
            value={mes}
            onChange={(e) => setMes(Number(e.target.value))}
            className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink focus:border-keeta-teal focus:outline-none"
            aria-label="Mês"
          >
            {MESES.map((nome, i) => (
              <option key={nome} value={i + 1}>
                {nome}
              </option>
            ))}
          </select>
          <select
            value={ano}
            onChange={(e) => setAno(Number(e.target.value))}
            className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink focus:border-keeta-teal focus:outline-none"
            aria-label="Ano"
          >
            {anos.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={load}
          disabled={carregando}
          className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink/70 transition-colors hover:bg-surface disabled:opacity-50"
        >
          <ArrowPathIcon className={`h-4 w-4 ${carregando ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {erro && (
        <div className="mb-6 rounded-lg border border-danger-red/30 bg-danger-bg px-4 py-3 text-sm font-semibold text-danger-red">
          {erro}
        </div>
      )}

      {carregando && !data && (
        <div className="animate-pulse space-y-4">
          <div className="h-24 rounded-lg bg-surface" />
          <div className="h-40 rounded-lg bg-surface" />
        </div>
      )}

      {data && (
        <>
          {/* Card principal: total de casos + funil */}
          <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-line bg-white p-6">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-ink/50">
                <ChartBarIcon className="h-4 w-4 text-keeta-teal" />
                Total de Casos Encerrados
              </div>
              <div className="mt-3 font-display text-5xl font-extrabold text-ink">
                {data.totalCasos}
              </div>
              <div className="mt-1 text-sm text-ink/60">
                {MESES[data.periodo.mes - 1]} de {data.periodo.ano}
              </div>
            </div>

            {/* Funil de atendimento */}
            <div className="rounded-lg border border-line bg-white p-6 lg:col-span-2">
              <div className="mb-4 text-[11px] font-bold uppercase tracking-wider text-ink/50">
                Funil de Atendimento
              </div>
              <div className="space-y-4">
                {(
                  [
                    { label: 'Apenas T1', c: data.funilAtendimento.apenasT1, tone: 'teal' as const },
                    { label: 'T1 + T2', c: data.funilAtendimento.t1MaisT2, tone: 'yellow' as const },
                    { label: 'N/A — direto ao Procon', c: data.funilAtendimento.naDiretoProcon, tone: 'ink' as const },
                  ]
                ).map(({ label, c, tone }) => (
                  <div key={label}>
                    <div className="mb-1 flex items-baseline justify-between">
                      <span className="text-sm font-semibold text-ink">{label}</span>
                      <span className="text-sm text-ink/60">
                        <strong className="text-ink">{c.qtd}</strong> · {pctFmt(c.pct)}
                      </span>
                    </div>
                    <Barra pct={c.pct} tone={tone} />
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Insights da IA */}
          <section className="mb-6">
            <div className="rounded-lg border border-line bg-white p-6">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-ink/50">
                <LightBulbIcon className="h-4 w-4 text-keeta-yellow-dark" />
                Insights da IA
              </div>
              {data.insightsGerados ? (
                <p className="text-[15px] leading-relaxed text-ink/85">{data.insightsGerados}</p>
              ) : (
                <p className="text-sm text-ink/50">
                  Insights indisponíveis (IA fora do ar ou sem chave configurada) — métricas acima seguem completas.
                </p>
              )}
            </div>
          </section>

          {semDados && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-warn-amber/30 bg-warn-bg px-4 py-3 text-sm text-warn-amber">
              <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0" />
              <p>
                Nenhum caso encerrado em {MESES[data.periodo.mes - 1]} de {data.periodo.ano}. Os
                casos aparecem aqui conforme a <strong>Data de Encerramento</strong> é preenchida no
                formulário CRM e salva.
              </p>
            </div>
          )}

          {/* Grid de tabelas */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Tabela 1: por etapa */}
            <div className="overflow-hidden rounded-lg border border-line bg-white">
              <div className="border-b border-line px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-ink/50">
                Por Etapa de Atendimento
              </div>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className={thCls}>Etapa</th>
                    <th className={thCls + ' text-right'}>Qtd</th>
                    <th className={thCls + ' text-right'}>%</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-line">
                    <td className="px-3 py-2 text-[13px] text-ink/80">Apenas T1</td>
                    <td className={tdNum}>{data.funilAtendimento.apenasT1.qtd}</td>
                    <td className="px-3 py-2 text-right text-[13px] text-ink/60">{pctFmt(data.funilAtendimento.apenasT1.pct)}</td>
                  </tr>
                  <tr className="border-b border-line">
                    <td className="px-3 py-2 text-[13px] text-ink/80">T1 + T2</td>
                    <td className={tdNum}>{data.funilAtendimento.t1MaisT2.qtd}</td>
                    <td className="px-3 py-2 text-right text-[13px] text-ink/60">{pctFmt(data.funilAtendimento.t1MaisT2.pct)}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-[13px] text-ink/80">N/A — direto ao Procon</td>
                    <td className={tdNum}>{data.funilAtendimento.naDiretoProcon.qtd}</td>
                    <td className="px-3 py-2 text-right text-[13px] text-ink/60">{pctFmt(data.funilAtendimento.naDiretoProcon.pct)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Tabela 2: Reclame Aqui */}
            <div className="overflow-hidden rounded-lg border border-line bg-white">
              <div className="border-b border-line px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-ink/50">
                Acionados em Reclame Aqui
              </div>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className={thCls}>Origem</th>
                    <th className={thCls + ' text-right'}>Qtd</th>
                    <th className={thCls + ' text-right'}>%</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-line">
                    <td className="px-3 py-2 text-[13px] text-ink/80">Com numeração ID RA</td>
                    <td className={tdNum}>{data.cruzamentoRA.comRA.qtd}</td>
                    <td className="px-3 py-2 text-right text-[13px] text-ink/60">{pctFmt(data.cruzamentoRA.comRA.pct)}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-[13px] text-ink/80">N/A</td>
                    <td className={tdNum}>{data.cruzamentoRA.semRA.qtd}</td>
                    <td className="px-3 py-2 text-right text-[13px] text-ink/60">{pctFmt(data.cruzamentoRA.semRA.pct)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Tabela 3: Top 5 geral */}
            <div className="overflow-hidden rounded-lg border border-line bg-white lg:col-span-2">
              <div className="border-b border-line px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-ink/50">
                Top 5 Motivos — Geral
              </div>
              {data.top5MotivosGeral.length === 0 ? (
                <p className="px-4 py-6 text-sm text-ink/50">Sem motivos classificados no período.</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className={thCls}>#</th>
                      <th className={thCls}>Motivo</th>
                      <th className={thCls + ' text-right'}>Qtd</th>
                      <th className={thCls + ' text-right'}>% do total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top5MotivosGeral.map((m, i) => (
                      <tr key={m.nome} className="border-b border-line last:border-0">
                        <td className="px-3 py-2 text-[13px] font-bold text-keeta-teal-dark">{i + 1}</td>
                        <td className="px-3 py-2 text-[13px] text-ink/80">{m.nome}</td>
                        <td className={tdNum}>{m.qtd}</td>
                        <td className="px-3 py-2 text-right text-[13px] text-ink/60">{pctFmt(m.pct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Sub-grid: Top 5 por etapa */}
            {(
              [
                { titulo: 'Top 5 — Apenas T1', itens: data.top5PorEtapa.apenasT1 },
                { titulo: 'Top 5 — T1 + T2', itens: data.top5PorEtapa.t1MaisT2 },
                { titulo: 'Top 5 — N/A (Direto Procon)', itens: data.top5PorEtapa.naDiretoProcon },
              ] as const
            ).map(({ titulo, itens }) => (
              <div key={titulo} className="overflow-hidden rounded-lg border border-line bg-white">
                <div className="border-b border-line px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-ink/50">
                  {titulo}
                </div>
                {itens.length === 0 ? (
                  <p className="px-4 py-4 text-xs text-ink/50">Sem casos nesta etapa.</p>
                ) : (
                  <table className="w-full">
                    <tbody>
                      {itens.map((m, i) => (
                        <LinhaTabela key={m.nome} nome={`${i + 1}. ${m.nome}`} qtd={m.qtd} pct={m.pct} />
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
