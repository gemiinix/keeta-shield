'use client';

import { useMemo, useState } from 'react';
import { XMarkIcon, ArrowDownTrayIcon, ArrowLeftIcon, ClockIcon } from '@heroicons/react/24/outline';
import { PrazoBanner, type PrazoStatus } from '@/components/ui/PrazoBadge';

/**
 * Interpola {{VARIAVEL}} com os dados extraídos.
 * Variáveis sem valor permanecem visíveis para edição manual.
 */
export function interpolate(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    return data[key] !== undefined ? data[key] : match;
  });
}

/** Chaves especiais de prazo transmitidas dentro de `extracted`. */
export const PRAZO_BADGE_KEY = 'PRAZO_BADGE';
export const PRAZO_STATUS_KEY = 'PRAZO_STATUS';

function isPrazoStatus(v: string | undefined): v is PrazoStatus {
  return v === 'vencido' || v === 'critico' || v === 'ok';
}

/** Destaca visualmente as variáveis {{VARIAVEL}} no texto renderizado. */
function HighlightedText({ text }: { text: string }) {
  const parts = useMemo(() => {
    const segments = text.split(/(\{\{\s*[A-Z0-9_]+\s*\}\})/g);
    return segments.map((seg, i) =>
      /^\{\{/.test(seg) ? (
        <mark key={i} className="template-variable">
          {seg}
        </mark>
      ) : (
        <span key={i}>{seg}</span>
      )
    );
  }, [text]);
  return <p className="whitespace-pre-wrap leading-relaxed">{parts}</p>;
}

export const PLACEHOLDER_TEMPLATE = `RESUMO EXECUTIVO DO CASO – PROCON
Protocolo: {{PROTOCOLO}}
Prazo: {{PRAZO}}
Nome: {{NOME_CONSUMIDOR}}
ID do Pedido: {{ID_PEDIDO}}
Nome Estabelecimento: {{NOME_ESTABELECIMENTO}}
Motivo: {{MOTIVO}}

CRONOLOGIA E HISTÓRICO DE TRATATIVAS

1. Fato Gerador e Atendimento Inicial

O Problema:
{{RESUMO_RECLAMACAO}}

Análise:
{{ANALISE_JURIDICA}}

2. Tratativa e Resolução

Atendimento Suporte:
{{ATENDIMENTO_SUPORTE}}

Abertura no Reclame Aqui:
{{DATA_ABERTURA_RA}}

STATUS ATUAL
{{STATUS_ATUAL}}`;

export default function TemplateEditor({
  extracted,
  templateText,
  onClose,
  onBackToForm,
  cronometro,
}: {
  extracted: Record<string, string>;
  templateText?: string;
  onClose: () => void;
  /** Quando presente (caso Procon), exibe botão de retorno ao CRM. */
  onBackToForm?: () => void;
  /** Badge do cronômetro do caso (MM:SS), de propriedade do MainDashboard —
   *  mantém o TMO visível enquanto o usuário redige a minuta. */
  cronometro?: string;
}) {
  const [edited, setEdited] = useState(templateText || PLACEHOLDER_TEMPLATE);

  // Prazo de defesa: chaves especiais viram BANNER no topo — não campos.
  const prazoText = extracted[PRAZO_BADGE_KEY];
  const prazoStatusRaw = extracted[PRAZO_STATUS_KEY];
  const prazoStatus = isPrazoStatus(prazoStatusRaw) ? prazoStatusRaw : null;
  const prazo =
    prazoText && prazoStatus ? { text: prazoText, status: prazoStatus } : null;

  // Dados extraídos sem as chaves especiais de prazo.
  const fields = useMemo(() => {
    const clone: Record<string, string> = { ...extracted };
    delete clone[PRAZO_BADGE_KEY];
    delete clone[PRAZO_STATUS_KEY];
    return clone;
  }, [extracted]);

  const interpolated = useMemo(() => interpolate(edited, fields), [edited, fields]);
  const variables = useMemo(
    () => Array.from(new Set(edited.match(/\{\{\s*[A-Z0-9_]+\s*\}\}/g) ?? [])),
    [edited]
  );

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Barra superior */}
      <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-line bg-white px-5 pl-16 lg:px-8 lg:pl-8">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="font-display text-lg font-bold uppercase tracking-tight text-ink">
              Editor de Resposta
            </h2>
            <p className="text-xs font-medium text-keeta-teal-dark">
              {variables.length} variáveis · dados extraídos com IA
            </p>
          </div>
          {cronometro && (
            <div
              className="flex items-center gap-2 rounded-lg border border-keeta-teal/40 bg-keeta-teal/10 px-3 py-1.5"
              title="Tempo Médio de Operação — tempo total do caso; congela no primeiro salvamento do formulário"
            >
              <ClockIcon className="h-4 w-4 text-keeta-teal-dark" />
              <span className="font-mono text-lg font-bold tabular-nums text-keeta-teal-dark">
                {cronometro}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {onBackToForm && (
            <button
              onClick={onBackToForm}
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink/60 transition-colors duration-150 hover:bg-surface hover:text-ink"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Voltar ao formulário
            </button>
          )}
          <button
            onClick={() => {
              // Exporta a peça interpolada como .txt (download real)
              const blob = new Blob([interpolated], { type: 'text/plain;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              const dataHoje = new Date().toISOString().slice(0, 10);
              a.href = url;
              a.download = `keeta-shield-resposta-${dataHoje}.txt`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(url);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-bold text-white transition-colors duration-150 hover:bg-keeta-teal-dark"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            Exportar Peça
          </button>
          <button
            onClick={onClose}
            aria-label="Fechar e voltar"
            className="rounded p-2 text-ink/50 transition-colors duration-150 hover:bg-surface hover:text-ink"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Banner de prazo de defesa — topo do editor */}
      {prazo && (
        <div className="border-b border-line px-5 pl-16 py-4 lg:px-8 lg:pl-8">
          <PrazoBanner status={prazo.status} text={prazo.text} />
        </div>
      )}

      {/* Documento longo: dados + editor + pré-visualização */}
      <div className="grid flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[320px_1fr] lg:overflow-hidden">
        {/* Esquerda: resumo dos dados extraídos */}
        <aside className="overflow-y-auto border-b border-line bg-surface p-5 lg:border-b-0 lg:border-r lg:border-line lg:bg-surface">
          <h3 className="font-display text-xs font-bold uppercase tracking-wider text-ink/60">
            Dados Extraídos
          </h3>
          <dl className="mt-4 space-y-4">
            {Object.entries(fields).map(([key, value]) => (
              <div key={key} className="border-l-2 border-keeta-teal/40 pl-3">
                <dt className="font-mono text-[10px] font-bold uppercase text-keeta-teal-dark">
                  {key}
                </dt>
                <dd className="mt-1 text-sm leading-relaxed text-ink/80">{value || '—'}</dd>
              </div>
            ))}
            {Object.keys(fields).length === 0 && (
              <p className="text-xs leading-relaxed text-ink/50">
                Nenhum dado extraído para este caso.
              </p>
            )}
          </dl>
        </aside>

        {/* Direita: editor com boa largura de leitura + pré-visualização */}
        <section className="flex flex-col overflow-hidden p-6 lg:p-8">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xs font-bold uppercase tracking-wider text-ink/60">
              Minuta
            </h3>
            <button
              onClick={() => setEdited(PLACEHOLDER_TEMPLATE)}
              className="text-xs font-semibold text-ink/50 transition-colors duration-150 hover:text-keeta-teal-dark"
            >
              restaurar padrão Procon
            </button>
          </div>
          <textarea
            value={edited}
            onChange={(e) => setEdited(e.target.value)}
            aria-label="Minuta editável"
            spellCheck={false}
            className="mt-3 h-2/5 w-full resize-none rounded-lg border border-line bg-white p-4 font-mono text-sm leading-relaxed text-ink focus:border-ink/40 focus:outline-none"
          />
          <h3 className="mt-4 font-display text-xs font-bold uppercase tracking-wider text-ink/60">
            Pré-visualização Interpolada
          </h3>
          <div className="mt-3 flex-1 overflow-y-auto rounded-lg border border-line bg-surface p-4 text-sm text-ink/85">
            <HighlightedText text={interpolated} />
          </div>
        </section>
      </div>
    </div>
  );
}
