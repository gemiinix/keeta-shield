'use client';

import { useCallback, useRef, useState } from 'react';
import { DocumentArrowUpIcon, XMarkIcon } from '@heroicons/react/24/outline';

const MIN_CHARS = 20;
const ACCEPTED_MIME = 'application/pdf';
// Limite da Vercel (Hobby): 4,5 MB por requisição — o 413 acontece ANTES
// de chegar na rota, então a validação tem de ser no cliente mesmo.
const MAX_PDF_MB = 4;
const MAX_PDF_BYTES = MAX_PDF_MB * 1024 * 1024;

export default function SubsidioFlow({
  onAnalysisComplete,
}: {
  onAnalysisComplete: (result: {
    extracted: Record<string, string>;
    templateText: string;
    casoId?: number | null;
  }) => void;
}) {
  const [requisicao, setRequisicao] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const charCount = requisicao.trim().length;
  // Submissão exige: texto com mínimo de caracteres OU PDF anexado —
  // o backend cruza as duas fontes quando ambas existem.
  const canSubmit = charCount >= MIN_CHARS || arquivo !== null;

  /** Valida que o arquivo é um PDF (por MIME ou extensão) e que cabe no
   *  limite de upload da Vercel — evita o 413 que a plataforma devolve
   *  silenciosamente sem chegar ao backend. */
  const validarArquivo = (f: File | null | undefined): File | null => {
    if (!f) return null;
    const isPdf = f.type === ACCEPTED_MIME || f.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setError('Formato inválido — anexe apenas PDF do processo judicial.');
      return null;
    }
    if (f.size > MAX_PDF_BYTES) {
      setError(
        `PDF muito grande (${(f.size / 1024 / 1024).toFixed(1)} MB) — o limite de envio é ${MAX_PDF_MB} MB. ` +
          'Reduza o arquivo: salve/imprima em PDF novamente com qualidade menor, ou separe só as páginas essenciais do processo.'
      );
      return null;
    }
    return f;
  };

  const escolherArquivo = useCallback((f: File | null) => {
    setError(null);
    const valido = validarArquivo(f);
    setArquivo(valido);
  }, []);

  const handleAnalysis = useCallback(async () => {
    if (!canSubmit) return;
    setIsProcessing(true);
    setError(null);
    try {
      // FormData SEMPRE — anexa texto manual E arquivo quando existem.
      // O backend não quebra se um dos dois estiver vazio: o campo ausente
      // é simplesmente ignorado na montagem do contexto.
      const formData = new FormData();
      formData.append('tipo', 'subsidio');
      formData.append('conteudo', requisicao.trim());
      if (arquivo) formData.append('file', arquivo);

      const res = await fetch('/api/analisar', { method: 'POST', body: formData });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Falha na análise (${res.status})`);
      }
      const data = (await res.json()) as {
        resumoExecutivo: string;
        clausulaAplicavel: string;
        templateSugerido: string;
        minutaSugerida?: string;
        casoId?: number;
      };
      onAnalysisComplete({
        extracted: {
          RESUMO_EXECUTIVO: data.resumoExecutivo,
          CLAUSULA_APLICAVEL: data.clausulaAplicavel,
          ...(data.minutaSugerida ? { MINUTA_SUGERIDA: data.minutaSugerida } : {}),
        },
        // Prioridade para a minuta completa (cruzamento das duas fontes);
        // fallback para o template clássico com variáveis.
        templateText: data.minutaSugerida ?? data.templateSugerido,
        casoId: data.casoId ?? null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado na análise.');
    } finally {
      setIsProcessing(false);
    }
  }, [requisicao, arquivo, canSubmit, onAnalysisComplete]);

  return (
    <div>
      {/* Texto manual da solicitação do advogado */}
      <div className="overflow-hidden rounded-lg border border-line bg-white focus-within:border-ink/40">
        <label htmlFor="subsidio-oficio" className="sr-only">
          Solicitação do advogado / time jurídico
        </label>
        <textarea
          id="subsidio-oficio"
          value={requisicao}
          onChange={(e) => setRequisicao(e.target.value)}
          placeholder="Cole aqui a solicitação do advogado / time jurídico — o que exatamente precisa ser extraído ou respondido…"
          rows={12}
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
              ? arquivo
                ? 'Texto + PDF — cruzamento completo ativado'
                : 'Mínimo atingido — pronto para análise'
              : `Cole o texto (mín. ${MIN_CHARS} caracteres) ou anexe o PDF do processo`}
          </span>
        </div>
      </div>

      {/* Upload do documento do processo judicial (PDF) */}
      <div className="mt-4 flex overflow-hidden rounded-lg border border-line bg-white">
        <div aria-hidden className="w-2 shrink-0 bg-keeta-teal" />
        <div
          onDragOver={(e) => {
            e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (isProcessing) return;
            escolherArquivo(e.dataTransfer.files?.[0] ?? null);
          }}
          onClick={() => !isProcessing && inputRef.current?.click()}
          role="button"
          tabIndex={isProcessing ? -1 : 0}
          aria-label="Anexar PDF do processo judicial"
          onKeyDown={(e) =>
            (e.key === 'Enter' || e.key === ' ') && !isProcessing && inputRef.current?.click()
          }
          className="flex min-h-[120px] flex-1 cursor-pointer flex-col items-center justify-center gap-2 px-8 py-6 transition-colors duration-150 hover:bg-surface"
        >
          <div className="flex items-center gap-3">
            <DocumentArrowUpIcon className="h-7 w-7 text-keeta-teal" />
            <div>
              <p className="font-display text-sm font-bold text-ink">
                {arquivo ? 'Documento do processo anexado' : 'Anexe o documento do processo judicial (PDF)'}
              </p>
              <p className="mt-0.5 text-xs text-ink/55">
                {arquivo
                  ? 'A IA vai cruzar a solicitação acima com este documento'
                  : `Opcional — arraste aqui ou clique para selecionar (máx. ${MAX_PDF_MB} MB)`}
              </p>
            </div>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            hidden
            disabled={isProcessing}
            onChange={(e) => {
              escolherArquivo(e.target.files?.[0] ?? null);
              e.target.value = '';
            }}
          />
        </div>
        {arquivo && (
          <button
            onClick={() => setArquivo(null)}
            aria-label={`Remover ${arquivo.name}`}
            disabled={isProcessing}
            className="flex shrink-0 items-center gap-2 border-l border-line px-4 text-xs font-semibold text-ink/55 transition-colors duration-150 hover:bg-surface hover:text-danger-red"
          >
            <XMarkIcon className="h-4 w-4" />
            remover
          </button>
        )}
      </div>

      {/* Nome do arquivo anexado */}
      {arquivo && (
        <p className="mt-2 truncate font-mono text-xs text-ink/60" title={arquivo.name}>
          {arquivo.name} · {(arquivo.size / 1024).toFixed(0)} KB
        </p>
      )}

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
            <p className="text-sm font-semibold text-ink">
              {arquivo
                ? 'Cruzando a solicitação com o documento do processo…'
                : 'Analisando o ofício…'}
            </p>
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
