'use client';

import { useCallback, useRef, useState } from 'react';
import { DocumentArrowUpIcon } from '@heroicons/react/24/outline';

const REQUIRED_PREFIX = 'atendimento_cip_';
const ACCEPTED_MIME = 'application/pdf';

export default function ProconFlow({
  onAnalysisComplete,
}: {
  onAnalysisComplete: (result: {
    extracted: Record<string, string>;
    templateText: string;
  }) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /** Valida nome e tipo antes de aceitar o arquivo. */
  const validateFiles = useCallback((incoming: FileList | File[]): File[] => {
    const accepted: File[] = [];
    const rejected: string[] = [];
    for (const f of Array.from(incoming)) {
      const isPdf = f.type === ACCEPTED_MIME || f.name.toLowerCase().endsWith('.pdf');
      const hasValidName = f.name.toLowerCase().startsWith(REQUIRED_PREFIX);
      if (isPdf && hasValidName) accepted.push(f);
      else rejected.push(f.name);
    }
    if (rejected.length > 0) {
      setError(
        `Arquivos ignorados: ${rejected.join(', ')}. Envie PDFs com nome iniciando em "${REQUIRED_PREFIX}".`
      );
    } else {
      setError(null);
    }
    return accepted;
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const accepted = validateFiles(e.dataTransfer.files);
      setFiles((prev) => [...prev, ...accepted]);
    },
    [validateFiles]
  );

  const handleAnalysis = useCallback(async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('tipo', 'procon');
      files.forEach((f) => formData.append('arquivos', f));
      const res = await fetch('/api/analisar', { method: 'POST', body: formData });
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
  }, [files, onAnalysisComplete]);

  return (
    <div className="mx-auto max-w-3xl">
      {/* Zona de Drag & Drop */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-12 transition-all ${
          isDragging
            ? 'border-keeta-teal bg-keeta-teal/10 shadow-glow-teal'
            : 'border-zinc-700 bg-zinc-900 hover:border-zinc-500'
        }`}
      >
        <DocumentArrowUpIcon className="h-12 w-12 text-zinc-500" />
        <div className="text-center">
          <p className="text-sm font-semibold text-zinc-200">
            Arraste os PDFs do Procon aqui
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Nomenclatura obrigatória: <code className="font-mono text-keeta-teal">atendimento_cip_*.pdf</code>
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          onChange={(e) => {
            const accepted = validateFiles(e.target.files ?? []);
            setFiles((prev) => [...prev, ...accepted]);
            e.target.value = '';
          }}
        />
      </div>

      {/* Erro de validação */}
      {error && (
        <p className="mt-3 rounded-lg border border-red-900/50 bg-red-950/40 p-3 text-xs text-red-300">
          {error}
        </p>
      )}

      {/* Lista de arquivos aceitos */}
      {files.length > 0 && (
        <ul className="mt-4 divide-y divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-900">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="truncate font-mono text-xs text-zinc-300">{f.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFiles((prev) => prev.filter((_, idx) => idx !== i));
                }}
                className="text-xs font-semibold text-zinc-500 hover:text-red-400"
              >
                remover
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Ação */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleAnalysis}
          disabled={files.length === 0 || isProcessing}
          className="rounded-xl bg-keeta-yellow px-6 py-3 text-sm font-bold text-zinc-900 shadow-glow-yellow transition-all hover:bg-keeta-yellow-dark disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          {isProcessing ? 'Analisando…' : 'Analisar Requisição'}
        </button>
      </div>
    </div>
  );
}
