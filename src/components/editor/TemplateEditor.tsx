'use client';

import { useMemo, useState } from 'react';
import { XCircleIcon } from '@heroicons/react/24/outline';

/**
 * Interpola {{VARIAVEL}} com os dados extraídos.
 * Variáveis sem valor permanecem visíveis para edição manual.
 */
export function interpolate(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    return data[key] !== undefined ? data[key] : match;
  });
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
}: {
  extracted: Record<string, string>;
  templateText?: string;
  onClose: () => void;
}) {
  const [edited, setEdited] = useState(templateText || PLACEHOLDER_TEMPLATE);
  const interpolated = useMemo(() => interpolate(edited, extracted), [edited, extracted]);
  const variables = useMemo(
    () => Array.from(new Set(edited.match(/\{\{\s*[A-Z0-9_]+\s*\}\}/g) ?? [])),
    [edited]
  );

  return (
    <div className="flex h-full flex-col">
      {/* Barra superior */}
      <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-6 py-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-100">Editor de Resposta</h2>
          <p className="text-xs text-zinc-500">
            {variables.length} variáveis • dados extraídos com IA
          </p>
        </div>
        <div className="flex items-center gap-3">
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
            className="rounded-lg bg-keeta-teal px-4 py-2 text-sm font-bold text-zinc-950 transition-colors hover:bg-keeta-teal-dark"
          >
            Exportar Peça
          </button>
          <button
            onClick={onClose}
            className="text-zinc-500 transition-colors hover:text-zinc-200"
            title="Fechar e voltar"
          >
            <XCircleIcon className="h-6 w-6" />
          </button>
        </div>
      </header>

      {/* Tela dividida */}
      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[320px_1fr]">
        {/* Esquerda: resumo dos dados extraídos */}
        <aside className="overflow-y-auto border-r border-zinc-800 bg-zinc-900 p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            Dados Extraídos
          </h3>
          <dl className="mt-4 space-y-3">
            {Object.entries(extracted).map(([key, value]) => (
              <div key={key} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                <dt className="font-mono text-[10px] uppercase text-keeta-teal">{key}</dt>
                <dd className="mt-1 text-sm text-zinc-200">{value || '—'}</dd>
              </div>
            ))}
            {Object.keys(extracted).length === 0 && (
              <p className="rounded-lg border border-dashed border-zinc-700 p-4 text-xs text-zinc-500">
                Nenhum dado extraído ainda. Após a integração do LLM, os campos aparecem aqui.
              </p>
            )}
          </dl>
        </aside>

        {/* Direita: editor com variáveis interpoladas */}
        <section className="flex flex-col overflow-hidden p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              Template
            </h3>
            <button
              onClick={() => setEdited(PLACEHOLDER_TEMPLATE)}
              className="text-xs font-semibold text-zinc-500 hover:text-keeta-teal"
            >
              restaurar padrão Procon
            </button>
          </div>
          <textarea
            value={edited}
            onChange={(e) => setEdited(e.target.value)}
            spellCheck={false}
            className="mt-3 h-1/2 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900 p-4 font-mono text-sm leading-relaxed text-zinc-200 focus:outline-none focus:ring-1 focus:ring-keeta-teal"
          />
          <h3 className="mt-4 text-xs font-bold uppercase tracking-wider text-zinc-500">
            Pré-visualização Interpolada
          </h3>
          <div className="mt-3 flex-1 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-300">
            <HighlightedText text={interpolated} />
          </div>
        </section>
      </div>
    </div>
  );
}
