'use client';

import { useCallback, useRef, useState } from 'react';
import { DocumentArrowUpIcon, XMarkIcon } from '@heroicons/react/24/outline';

const REQUIRED_PREFIX = 'atendimento_cip_';
const ACCEPTED_MIME = 'application/pdf';

/** Item de arquivo com estado de erro de formato por arquivo. */
type FileItem = {
  file: File;
  error: string | null;
};

export default function ProconFlow({
  onAnalysisComplete,
}: {
  onAnalysisComplete: (result: {
    extracted: Record<string, string>;
    templateText: string;
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
    };
  }) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /** Valida nome e tipo antes de aceitar o arquivo. */
  const validateFiles = useCallback((incoming: FileList | File[]): FileItem[] => {
    const items: FileItem[] = [];
    for (const f of Array.from(incoming)) {
      const isPdf = f.type === ACCEPTED_MIME || f.name.toLowerCase().endsWith('.pdf');
      const hasValidName = f.name.toLowerCase().startsWith(REQUIRED_PREFIX);
      const error = !isPdf
        ? 'Formato inválido — envie apenas PDF.'
        : !hasValidName
          ? `Nome inválido — deve iniciar com "${REQUIRED_PREFIX}".`
          : null;
      items.push({ file: f, error });
    }
    return items;
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const items = validateFiles(e.dataTransfer.files);
      setFiles((prev) => [...prev, ...items]);
    },
    [validateFiles]
  );

  const validFiles = files.filter((f) => !f.error);

  const handleAnalysis = useCallback(async () => {
    if (validFiles.length === 0) return;
    setIsProcessing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('tipo', 'procon');
      validFiles.forEach((f) => formData.append('arquivos', f.file));
      const res = await fetch('/api/analisar', { method: 'POST', body: formData });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Falha na análise (${res.status})`);
      }
      const data = (await res.json()) as {
        resumoExecutivo: string;
        clausulaAplicavel: string;
        templateSugerido: string;
        prazoDefesa?: {
          dataAberturaISO: string;
          deadlineFinalISO: string;
          diasRestantes: number;
        };
        dadosFormulario?: {
          cipProcon: string;
          numeroPedido: string;
          mcdonalds: boolean;
          motivoClassificado: string;
        };
      };

      // Transmissão do prazo dentro de `extracted` (contrato de props):
      // PRAZO-BADGE → texto formatado; PRAZO-STATUS → semântica de cor.
      const extracted: Record<string, string> = {
        RESUMO_EXECUTIVO: data.resumoExecutivo,
        CLAUSULA_APLICAVEL: data.clausulaAplicavel,
      };
      if (data.prazoDefesa) {
        const { deadlineFinalISO, diasRestantes } = data.prazoDefesa;
        const [y, mo, d] = deadlineFinalISO.split('-');
        const dataFinal = `${d}/${mo}/${y}`;
        const diasTexto =
          diasRestantes < 0
            ? `${Math.abs(diasRestantes)} ${Math.abs(diasRestantes) === 1 ? 'dia' : 'dias'} de atraso`
            : `${diasRestantes} ${diasRestantes === 1 ? 'dia' : 'dias'} restantes`;
        extracted['PRAZO_BADGE'] = `${dataFinal} · ${diasTexto}`;
        extracted['PRAZO_STATUS'] =
          diasRestantes < 0 ? 'vencido' : diasRestantes <= 3 ? 'critico' : 'ok';
      }

      onAnalysisComplete({
        extracted,
        templateText: data.templateSugerido,
        crm:
          data.dadosFormulario || data.prazoDefesa
            ? {
                dadosIA:
                  data.dadosFormulario ??
                  {
                    cipProcon: '',
                    numeroPedido: '',
                    mcdonalds: false,
                    motivoClassificado: '',
                  },
                prazoDefesa: data.prazoDefesa ?? null,
              }
            : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado na análise.');
    } finally {
      setIsProcessing(false);
    }
  }, [validFiles, onAnalysisComplete]);

  return (
    <div>
      {/* Área de upload — ação central com faixa vertical amarela */}
      <div className="flex overflow-hidden rounded-lg border border-line bg-white">
        <div aria-hidden className="w-2 shrink-0 bg-keeta-yellow" />
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !isProcessing && inputRef.current?.click()}
          role="button"
          tabIndex={isProcessing ? -1 : 0}
          aria-label="Anexar PDFs de atendimento Procon"
          onKeyDown={(e) =>
            (e.key === 'Enter' || e.key === ' ') && !isProcessing && inputRef.current?.click()
          }
          className={`flex min-h-[260px] flex-1 cursor-pointer flex-col items-center justify-center gap-4 px-8 py-10 transition-colors duration-150 ${
            isDragging ? 'bg-keeta-teal/10' : 'bg-white hover:bg-surface'
          }`}
        >
          <DocumentArrowUpIcon className="h-10 w-10 text-keeta-teal" />
          <div className="text-center">
            <p className="font-display text-lg font-bold text-ink">
              Anexe os PDFs de atendimento
            </p>
            <p className="mt-1 text-sm text-ink/60">
              Arraste os arquivos aqui ou clique para selecionar
            </p>
            <p className="mt-3 text-xs text-ink/50">
              Padrão de nomenclatura:{' '}
              <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[11px] text-keeta-teal-dark">
                atendimento_cip_*.pdf
              </code>
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            hidden
            onChange={(e) => {
              const items = validateFiles(e.target.files ?? []);
              setFiles((prev) => [...prev, ...items]);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {/* Erro geral */}
      {error && (
        <p
          role="alert"
          className="mt-4 rounded border border-danger-red bg-danger-bg px-4 py-3 text-sm text-danger-red"
        >
          {error}
        </p>
      )}

      {/* Lista de arquivos — nomes, tamanhos, remoção individual, erros */}
      {files.length > 0 && (
        <ul className="mt-5 divide-y divide-line rounded-lg border border-line bg-white">
          {files.map(({ file, error: fileError }, i) => (
            <li
              key={`${file.name}-${i}`}
              className={`flex items-center gap-3 px-4 py-3 text-sm ${
                fileError ? 'bg-danger-bg' : ''
              }`}
            >
              <div className="min-w-0 flex-1">
                <p
                  className={`truncate font-mono text-xs ${
                    fileError ? 'text-danger-red' : 'text-ink'
                  }`}
                >
                  {file.name}
                </p>
                <p className="mt-0.5 text-[11px] text-ink/45">
                  {fileError ? (
                    <span className="font-semibold text-danger-red">{fileError}</span>
                  ) : (
                    `${(file.size / 1024).toFixed(1)} KB · pronto para análise`
                  )}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFiles((prev) => prev.filter((_, idx) => idx !== i));
                }}
                aria-label={`Remover ${file.name}`}
                disabled={isProcessing}
                className="rounded p-1 text-ink/40 transition-colors duration-150 hover:bg-surface hover:text-danger-red disabled:opacity-30"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Ação principal */}
      <div className="mt-6">
        <button
          onClick={handleAnalysis}
          disabled={validFiles.length === 0 || isProcessing}
          className="rounded-lg bg-ink px-6 py-3 text-sm font-bold text-white transition-colors duration-150 hover:bg-keeta-teal-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isProcessing ? 'Analisando…' : 'Analisar Requisição'}
        </button>

        {/* Loading visível durante toda a análise */}
        {isProcessing && (
          <div
            role="status"
            aria-live="polite"
            className="mt-5 rounded-lg border border-line bg-surface px-4 py-4"
          >
            <p className="text-sm font-semibold text-ink">
              Analisando {validFiles.length}{' '}
              {validFiles.length === 1 ? 'PDF' : 'PDFs'}…
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
