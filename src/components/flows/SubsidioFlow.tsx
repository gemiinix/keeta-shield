'use client';

import { useCallback, useState } from 'react';

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

  const canSubmit = requisicao.trim().length >= 20;

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
    <div className="mx-auto max-w-3xl">
      {/* Textarea amplo */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-2 shadow-glow-teal/0 focus-within:shadow-glow-teal transition-shadow">
        <textarea
          value={requisicao}
          onChange={(e) => setRequisicao(e.target.value)}
          placeholder="Cole aqui a íntegra da requisição de subsídio…"
          rows={14}
          className="w-full resize-y rounded-xl bg-transparent p-4 text-sm leading-relaxed text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
        />
        <div className="flex items-center justify-between px-4 pb-2">
          <span className="text-[11px] text-zinc-500">
            {requisicao.trim().length} caracteres
          </span>
          <span className="text-[11px] text-zinc-500">
            Mínimo de 20 caracteres para análise
          </span>
        </div>
      </div>

      {/* Erro */}
      {error && (
        <p className="mt-3 rounded-lg border border-red-900/50 bg-red-950/40 p-3 text-xs text-red-300">
          {error}
        </p>
      )}

      {/* Ação */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleAnalysis}
          disabled={!canSubmit || isProcessing}
          className="rounded-xl bg-keeta-teal px-6 py-3 text-sm font-bold text-zinc-950 shadow-glow-teal transition-all hover:bg-keeta-teal-dark disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          {isProcessing ? 'Analisando…' : 'Analisar Requisição'}
        </button>
      </div>
    </div>
  );
}
