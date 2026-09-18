'use client';

import { useEffect, useState } from 'react';
import { Bars3Icon, ClockIcon } from '@heroicons/react/24/outline';
import ProconFlow from '@/components/flows/ProconFlow';
import SubsidioFlow from '@/components/flows/SubsidioFlow';
import TemplateEditor from '@/components/editor/TemplateEditor';
import CrmForm, { type CrmDadosIA } from '@/components/editor/CrmForm';
import HistoricoPage from '@/components/pages/HistoricoPage';
import TemplatesPage from '@/components/pages/TemplatesPage';
import TermosPage from '@/components/pages/TermosPage';
import DashboardPage from '@/components/pages/DashboardPage';
import type { NavKey } from '@/app/page';
import type { CrmSnapshot } from '@/lib/types';

type Tab = 'procon' | 'subsidio';

export type AnalysisResult = {
  extracted: Record<string, string>;
  templateText: string;
  casoId?: number | null;
  crm?: {
    dadosIA: CrmDadosIA;
    prazoDefesa: {
      dataAberturaISO: string;
      deadlineFinalISO: string;
      diasRestantes: number;
    } | null;
    snapshot?: CrmSnapshot | null;
  };
};

const PAGE_TITLES: Record<NavKey, { title: string; subtitle: string }> = {
  'nova-analise': {
    title: 'Nova Análise',
    subtitle: 'Central de triagem — selecione o fluxo e submeta a requisição.',
  },
  historico: {
    title: 'Histórico',
    subtitle: 'Análises registradas — reabra qualquer uma no editor.',
  },
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Relatório gerencial mensal — métricas e insights dos casos CRM.',
  },
  templates: {
    title: 'Templates',
    subtitle: 'Minutas de resposta reutilizáveis para novos casos.',
  },
  termos: {
    title: 'Termos',
    subtitle: 'PDFs oficiais de T&C que alimentam as análises.',
  },
};

export default function MainDashboard({
  activeNav,
  onNavigate,
}: {
  activeNav: NavKey;
  onNavigate: (key: NavKey) => void;
}) {
  const [activeTab, setActiveTab] = useState<Tab>('procon');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  // Modo pós-análise Procon: 'crm' (formulário) | 'editor' (minuta)
  const [posAnalise, setPosAnalise] = useState<'crm' | 'editor'>('crm');

  // ── Cronômetro do caso (TMO ao vivo) ──
  // De propriedade do MainDashboard: NÃO remonta ao alternar
  // formulário ↔ minuta, então o tempo total do caso nunca zera.
  // Acumulado: tempo salvo no caso (sessões anteriores) + sessão atual.
  // Congela de vez quando o caso é Encerrado.
  const [inicioCaso, setInicioCaso] = useState<number | null>(null);
  const [tmoCongelado, setTmoCongelado] = useState<number | null>(null);
  const [tmoAcumulado, setTmoAcumulado] = useState<number>(0);
  const [tmoAoVivo, setTmoAoVivo] = useState(0);
  // Minuta editada do caso em andamento — vive no MainDashboard para
  // sobreviver à alternância formulário ↔ minuta (o TemplateEditor é o
  // mesmo componente, então o estado intern dele já persiste; esta cópia
  // serve de prop estável para reaberturas e salvamento junto ao caso).
  const [minutaEditada, setMinutaEditada] = useState<string | null>(null);
  const tmoAtivo =
    analysisResult?.crm != null && tmoCongelado == null && inicioCaso != null;

  useEffect(() => {
    if (!tmoAtivo) return;
    const id = window.setInterval(() => {
      setTmoAoVivo(tmoAcumulado + Math.floor((Date.now() - (inicioCaso as number)) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [tmoAtivo, inicioCaso, tmoAcumulado]);

  /** Salva a minuta editada no caso do histórico — chamada pelo botão
   *  'Salvar minuta' do TemplateEditor. Atualiza apenas o campo minutaEditada
   *  do snapshot, preservando todo o resto (campos do CRM, TMO etc.). */
  const salvarMinuta = async (texto: string) => {
    const id = analysisResult?.casoId;
    if (!id) return;
    const res = await fetch('/api/historico', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        snapshot: {
          ...(analysisResult?.crm?.snapshot ?? {}),
          minutaEditada: texto,
          atualizadoEm: new Date().toISOString(),
        },
      }),
    });
    setMinutaEditada(texto);
    if (!res.ok) throw new Error('Falha ao salvar minuta.');
  };

  const tmoExibido =
    tmoCongelado != null
      ? tmoCongelado
      : tmoAoVivo || tmoAcumulado;
  const tmoBadge = `${String(Math.floor(tmoExibido / 60)).padStart(2, '0')}:${String(tmoExibido % 60).padStart(2, '0')}`;

  /** Persiste o TMO acumulado (sessões somadas) no caso — chamado ao SAIR
   *  do caso (nova análise / fechar / navegar). Best-effort com patch na rota:
   *  nunca sobrescreve campos salvos por outro caminho. */
  const persistirTmo = () => {
    const id = analysisResult?.casoId;
    if (!id) return;
    const encerrado =
      (analysisResult?.crm?.snapshot?.campos?.status ?? '')
        .trim()
        .toLowerCase() === 'encerrado';
    if (encerrado || analysisResult?.crm == null) return;
    const total =
      tmoCongelado != null
        ? tmoCongelado
        : tmoAcumulado +
          Math.max(0, Math.floor((Date.now() - (inicioCaso ?? Date.now())) / 1000));
    void fetch('/api/historico', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        patch: { tmoSegundos: total, tmoRetomadoEm: null },
      }),
    }).catch(() => {
      /* best-effort: falha ao persistir TMO não bloqueia a navegação */
    });
  };

  const abrirResultado = (r: AnalysisResult | null) => {
    setAnalysisResult(r);
    // Procon com dados de CRM → começa no formulário; Subsídio → direto no editor
    setPosAnalise(r?.crm ? 'crm' : 'editor');
    // Cronômetro acumulativo: início da SESSÃO = agora, sobre o TMO já
    // salvo no caso — sair e voltar nunca zera; congela se Encerrado.
    setInicioCaso(Date.now());
    // TMO acumulado: tempo já salvo no caso (sessões anteriores) continua
    // contando dali — sair para outra análise e voltar NUNCA zera o tempo.
    const encerrado =
      (r?.crm?.snapshot?.campos?.status ?? '').trim().toLowerCase() === 'encerrado';
    setTmoCongelado(encerrado ? (r?.crm?.snapshot?.tmoSegundos ?? 0) : null);
    setTmoAcumulado(encerrado ? 0 : (r?.crm?.snapshot?.tmoSegundos ?? 0));
    setTmoAoVivo(r?.crm?.snapshot?.tmoSegundos ?? 0);
    // Minuta salva no caso (se houver) — repõe o texto editado anteriormente.
    setMinutaEditada(r?.crm?.snapshot?.minutaEditada ?? null);
  };

  // Fluxo de processamento concluído → exibe o CRM (Procon) ou TemplateEditor,
  // MAS apenas enquanto a aba Nova Análise estiver ativa.
  // Navegar para Histórico/Templates/Termos funciona normalmente; voltar
  // para Nova Análise retoma tudo exatamente onde estava.
  if (analysisResult && activeNav === 'nova-analise') {
    return (
      <main className="flex h-full min-w-0 flex-1 flex-col overflow-y-auto bg-white">
        {analysisResult.crm ? (
          <>
            {/* Formulário e minuta permanecem MONTADOS (hidden) enquanto o
                caso está aberto — alternar um ↔ outro nunca perde o estado
                dos campos digitados nem zera o cronômetro do TMO. */}
            <div
              className={posAnalise === 'crm' ? 'block' : 'hidden'}
            >
            <div className="mx-auto w-full max-w-6xl px-5 py-8 pl-16 lg:px-10 lg:pl-10">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <div>
                  <h2 className="font-display text-lg font-bold uppercase tracking-tight text-ink">
                    Formulário de CRM — Caso Procon
                  </h2>
                  <p className="mt-0.5 text-sm font-medium text-keeta-teal-dark">
                    Campos da IA pré-preenchidos; complete os manuais.
                  </p>
                </div>
                {/* Cronômetro do caso — TMO ao vivo (MM:SS) */}
                <div
                  className="flex items-center gap-2 rounded-lg border border-keeta-teal/40 bg-keeta-teal/10 px-3 py-1.5"
                  title="Tempo Médio de Operação — tempo total do caso; congela no primeiro salvamento"
                >
                  <ClockIcon className="h-4 w-4 text-keeta-teal-dark" />
                  <span className="font-mono text-lg font-bold tabular-nums text-keeta-teal-dark">
                    {tmoBadge}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  persistirTmo();
                  setAnalysisResult(null);
                }}
                className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-ink/55 transition-colors duration-150 hover:bg-surface hover:text-ink"
              >
                nova análise
              </button>
            </div>
            <CrmForm
              dadosIA={analysisResult.crm.dadosIA}
              prazoDefesa={analysisResult.crm.prazoDefesa}
              snapshot={analysisResult.crm.snapshot}
              casoId={analysisResult.casoId}
              inicioCaso={inicioCaso ?? undefined}
              onOpenTemplate={() => setPosAnalise('editor')}
              onTmoFrozen={setTmoCongelado}
              onTmoAcumulado={(seg) => {
                setTmoAcumulado(seg);
                setTmoAoVivo(seg);
                // Reancora a sessão a partir de agora — senão o próximo
                // salvamento contaria o mesmo intervalo duas vezes.
                setInicioCaso(Date.now());
              }}
              minutaEditada={minutaEditada}
              onMinutaChange={setMinutaEditada}
            />
            </div>
            </div>
            <div className={posAnalise === 'editor' ? 'contents' : 'hidden'}>
            <TemplateEditor
              extracted={analysisResult.extracted}
              templateText={minutaEditada ?? analysisResult.templateText}
              cronometro={tmoBadge}
              onClose={() => {
                persistirTmo();
                setAnalysisResult(null);
              }}
              onBackToForm={() => setPosAnalise('crm')}
              onSaveMinuta={analysisResult.casoId ? salvarMinuta : undefined}
              onEditedChange={setMinutaEditada}
            />
            </div>
          </>
        ) : (
          <TemplateEditor
            extracted={analysisResult.extracted}
            templateText={analysisResult.templateText}
            onClose={() => setAnalysisResult(null)}
          />
        )}
      </main>
    );
  }

  const { title, subtitle } = PAGE_TITLES[activeNav];

  return (
    <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-white">
      {/* Cabeçalho fixo de 72px — escondido na impressão do relatório */}
      <header className="no-print flex h-[72px] shrink-0 items-center border-b border-line bg-white px-5 pl-16 lg:px-10 lg:pl-10">
        <div className="animate-fade-in-up min-w-0">
          <h1 className="font-display text-lg font-bold uppercase tracking-tight text-ink lg:text-xl">
            {title}
          </h1>
          <p className="mt-0.5 truncate text-sm font-medium text-keeta-teal-dark">
            {subtitle}
          </p>
        </div>
        {/* Infos secundárias discretas */}
        <div className="ml-auto hidden shrink-0 items-center gap-3 text-xs text-ink/45 md:flex">
          <span>Procon · Subsídio</span>
          <span aria-hidden className="h-1 w-1 rounded-full bg-keeta-yellow" />
          <span>Operação Viva</span>
        </div>
      </header>

      {/* Área de trabalho */}
      <div className="min-w-0 flex-1 overflow-y-auto px-5 py-8 pl-16 lg:px-10 lg:pl-10">
        {activeNav === 'historico' && (
        <HistoricoPage
          onOpenAnalysis={abrirResultado}
          onNavigateToEditor={() => onNavigate('nova-analise')}
        />
      )}

        {activeNav === 'dashboard' && <DashboardPage />}

        {activeNav === 'templates' && <TemplatesPage />}

        {activeNav === 'termos' && <TermosPage />}

        {activeNav === 'nova-analise' && (
          <div className="mx-auto max-w-6xl">
            {/* Seletores grandes de fluxo */}
            <div
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
              role="tablist"
              aria-label="Fluxo de trabalho"
            >
              {(
                [
                  { key: 'procon', label: 'Fluxo 01 — Procon', hint: 'PDFs de atendimento' },
                  {
                    key: 'subsidio',
                    label: 'Fluxo 02 — Subsídio',
                    hint: 'Ofício colado como texto',
                  },
                ] as const
              ).map(({ key, label, hint }) => {
                const isActive = activeTab === key;
                return (
                  <button
                    key={key}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(key)}
                    className={`rounded-lg border px-5 py-4 text-left transition-colors duration-150 ${
                      isActive
                        ? 'border-2 border-ink bg-white shadow-sm'
                        : 'border-line bg-surface hover:border-ink/30'
                    }`}
                  >
                    <span className="block text-sm font-bold text-ink">{label}</span>
                    <span className="mt-0.5 block text-xs font-medium text-ink/50">
                      {hint}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Fluxo ativo + coluna lateral de contexto */}
            <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_300px]">
              <section key={activeTab} className="animate-fade-in-up min-w-0">
                {activeTab === 'procon' ? (
                  <ProconFlow onAnalysisComplete={abrirResultado} />
                ) : (
                  <SubsidioFlow onAnalysisComplete={abrirResultado} />
                )}
              </section>

              {/* Coluna lateral de contexto — empilha abaixo em tablet/celular */}
              <aside className="animate-fade-in-up border-t border-line pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
                <h2 className="font-display text-xs font-bold uppercase tracking-wider text-ink">
                  Requisitos do fluxo
                </h2>
                <ul className="mt-4 space-y-3 text-sm text-ink/70">
                  <li className="flex gap-2.5">
                    <span
                      aria-hidden
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-keeta-teal"
                    />
                    <span>
                      {activeTab === 'procon'
                        ? 'PDFs com nome iniciando em atendimento_cip_'
                        : 'Texto integral do ofício colado no campo'}
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <span
                      aria-hidden
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-keeta-teal"
                    />
                    <span>
                      {activeTab === 'procon'
                        ? 'Múltiplos arquivos são combinados em uma única análise'
                        : 'Mínimo de 20 caracteres para iniciar a análise'}
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <span
                      aria-hidden
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-keeta-teal"
                    />
                    <span>
                      A IA retorna resumo, cláusula aplicável e minuta pronta
                    </span>
                  </li>
                </ul>

                <hr className="my-6 border-line" />

                <h2 className="font-display text-xs font-bold uppercase tracking-wider text-ink">
                  Próximos passos
                </h2>
                <ol className="mt-4 space-y-3 text-sm text-ink/70">
                  <li className="flex gap-2.5">
                    <span
                      aria-hidden
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-keeta-yellow"
                    />
                    <span>A análise leva de 10 a 30 segundos</span>
                  </li>
                  <li className="flex gap-2.5">
                    <span
                      aria-hidden
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-keeta-yellow"
                    />
                    <span>Revise a minuta no editor com variáveis preenchidas</span>
                  </li>
                  <li className="flex gap-2.5">
                    <span
                      aria-hidden
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-keeta-yellow"
                    />
                    <span>Exporte a peça final em .txt para o time jurídico</span>
                  </li>
                </ol>
              </aside>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
