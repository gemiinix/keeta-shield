'use client';

import { useCallback, useState } from 'react';

const MIN_CHARS = 20;

export default function SubsidioFlow({
  onAnalysisComplete,
}: {
  onAnalysisComplete: (result: {
    extracted: Record<string, string>;
    templateText: string;
  }) => void;
}) {
  const [requisicao, setRequisicao] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const charCount = requisicao.trim().length;
  const canSubmit = charCount >= MIN_CHARS;

  const handleAnalysis = useCallback(async () => {
    if (!canSubmit) return;
    setIsProcessing(true);
    setError(null);
    try {
      const res = await fetch('/api/analisar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'subsidio', conteudo: requisicao.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Falha na análise (${res.status})`);
      }
      const data = (await res.json()) as {
        resumoExecutivo: string;
        clausulaAplicavel: string;
        templateSugerido: string;
      };
      onAnalysisComplete({
        extracted: {
          RESUMO_EXECUTIVO: data.resumoExecutivo,
          CLAUSULA_APLICAVEL: data.clausulaAplicavel,
        },
        templateText: data.templateSugerido,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado na análise.');
    } finally {
      setIsProcessing(false);
    }
  }, [requisicao, canSubmit, onAnalysisComplete]);

  return (
    <div>
      {/* Grande área de texto para colar o ofício */}
      <div className="overflow-hidden rounded-lg border border-line bg-white focus-within:border-ink/40">
        <label htmlFor="subsidio-oficio" className="sr-only">
          Íntegra da requisição de subsídio
        </label>
        <textarea
          id="subsidio-oficio"
          value={requisicao}
          onChange={(e) => setRequisicao(e.target.value)}
          placeholder="Cole aqui a íntegra da requisição de subsídio…"
          rows={16}
          disabled={isProcessing}
          className="w-full resize-y bg-transparent px-5 py-4 text-sm leading-relaxed text-ink placeholder:text-ink/35 focus:outline-none disabled:opacity-60"
        />
        <div className="flex items-center justify-between border-t border-line bg-surface px-5 py-2">
          <span className="text-xs font-semibold text-ink/60">
            {charCount.toLocaleString('pt-BR')} caracteres
          </span>
          <span
            className={`text-xs font-medium ${
              canSubmit ? 'text-keeta-teal-dark' : 'text-warn-amber'
            }`}
          >
            {canSubmit
              ? 'Mínimo atingido — pronto para análise'
              : `Mínimo de ${MIN_CHARS} caracteres para análise`}
          </span>
        </div>
      </div>

      {/* Erro */}
      {error && (
        <p
          role="alert"
          className="mt-4 rounded border border-danger-red bg-danger-bg px-4 py-3 text-sm text-danger-red"
        >
          {error}
        </p>
      )}

      {/* Ação principal */}
      <div className="mt-6">
        <button
          onClick={handleAnalysis}
          disabled={!canSubmit || isProcessing}
          className="rounded-lg bg-ink px-6 py-3 text-sm font-bold text-white transition-colors duration-150 hover:bg-keeta-teal-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isProcessing ? 'Analisando…' : 'Analisar Requisição'}
        </button>

        {/* Loading visível */}
        {isProcessing && (
          <div
            role="status"
            aria-live="polite"
            className="mt-5 rounded-lg border border-line bg-surface px-4 py-4"
          >
            <p className="text-sm font-semibold text-ink">Analisando o ofício…</p>
            <p className="mt-1 text-xs text-ink/55">
              A análise leva de 10 a 30 segundos. Não feche esta tela.
            </p>
            <div
              aria-hidden
              className="mt-3 h-1.5 w-full overflow-hidden rounded bg-line"
            >
              <div className="h-full w-1/3 animate-pulse rounded bg-keeta-teal" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
