'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DocumentArrowUpIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { Termo } from '@/lib/types';

const DOC_SUGGESTIONS = ['Keeta Customer', 'Keeta Rider', 'Keeta Merchant'];

/**
 * Página de Termos: gestão dos PDFs oficiais de T&C da Keeta.
 * Upload com nome do documento + versão, drag&drop de PDF,
 * lista com nome/versão/caracteres/data e ações explícitas de remover.
 */
export default function TermosPage() {
  const [termos, setTermos] = useState<Termo[]>([]);
  const [documento, setDocumento] = useState('');
  const [versao, setVersao] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/termos');
      const data = (await res.json()) as { termos?: Termo[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Falha ao carregar.');
      setTermos(data.termos ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const acceptFile = useCallback((f: File | undefined | null) => {
    if (!f) return;
    const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setFileError('Formato inválido — envie apenas PDF.');
      return;
    }
    setFileError(null);
    setFile(f);
  }, []);

  const handleUpload = useCallback(async () => {
    setError(null);
    setMsg(null);
    if (!documento.trim() || !file) {
      setError('Informe o nome do documento (ex.: Keeta Customer) e selecione o PDF.');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('documento', documento.trim());
      fd.append('versao', versao.trim());
      fd.append('arquivo', file);
      const res = await fetch('/api/termos', { method: 'POST', body: fd });
      const data = (await res.json()) as { error?: string; caracteres?: number };
      if (!res.ok) throw new Error(data.error ?? 'Falha no upload.');
      setMsg(
        `T&C carregado: ${data.caracteres?.toLocaleString('pt-BR')} caracteres extraídos — a IA já usa este texto nas análises.`
      );
      setFile(null);
      setVersao('');
      if (inputRef.current) inputRef.current.value = '';
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.');
    } finally {
      setUploading(false);
    }
  }, [documento, versao, file, load]);

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await fetch(`/api/termos?id=${id}`, { method: 'DELETE' });
        load();
      } catch {
        setError('Erro ao remover.');
      }
    },
    [load]
  );

  return (
    <div className="mx-auto mt-6 max-w-3xl">
      {/* Upload */}
      <section aria-label="Carregar termo oficial" className="animate-fade-in-up">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink">
          Carregar / Atualizar T&C da Keeta
        </h2>
        <p className="mt-1 text-sm text-ink/60">
          Envie o PDF vigente — o texto é extraído e usado como base factual nas
          análises. Reenviar substitui a versão anterior.
        </p>

        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="termo-documento"
                className="mb-1 block text-xs font-semibold text-ink/70"
              >
                Nome do documento
              </label>
              <input
                id="termo-documento"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                placeholder="Ex.: Keeta Customer"
                list="doc-suggestions"
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus:border-ink/40 focus:outline-none"
              />
              <datalist id="doc-suggestions">
                {DOC_SUGGESTIONS.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>
            <div>
              <label
                htmlFor="termo-versao"
                className="mb-1 block text-xs font-semibold text-ink/70"
              >
                Versão / data (opcional)
              </label>
              <input
                id="termo-versao"
                value={versao}
                onChange={(e) => setVersao(e.target.value)}
                placeholder="Ex.: v2026-09"
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus:border-ink/40 focus:outline-none"
              />
            </div>
          </div>

          {/* Drag & drop de PDF */}
          <div className="flex overflow-hidden rounded-lg border border-line bg-white">
            <div aria-hidden className="w-2 shrink-0 bg-keeta-yellow" />
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                acceptFile(e.dataTransfer.files?.[0]);
              }}
              onClick={() => !uploading && inputRef.current?.click()}
              role="button"
              tabIndex={uploading ? -1 : 0}
              aria-label="Selecionar PDF dos termos"
              onKeyDown={(e) =>
                (e.key === 'Enter' || e.key === ' ') &&
                !uploading &&
                inputRef.current?.click()
              }
              className={`flex min-h-[140px] flex-1 cursor-pointer flex-col items-center justify-center gap-2 px-6 py-6 text-center transition-colors duration-150 ${
                isDragging ? 'bg-keeta-teal/10' : 'hover:bg-surface'
              }`}
            >
              <DocumentArrowUpIcon className="h-7 w-7 text-keeta-teal" />
              {file ? (
                <p className="font-mono text-xs text-ink">{file.name}</p>
              ) : (
                <p className="text-sm text-ink/60">
                  Arraste o PDF dos T&C aqui ou clique para selecionar
                </p>
              )}
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf"
                hidden
                onChange={(e) => acceptFile(e.target.files?.[0] ?? null)}
              />
            </div>
            {file && (
              <div className="flex items-center border-l border-line px-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    if (inputRef.current) inputRef.current.value = '';
                  }}
                  aria-label={`Remover ${file.name}`}
                  disabled={uploading}
                  className="rounded p-1 text-ink/40 transition-colors duration-150 hover:bg-surface hover:text-danger-red disabled:opacity-30"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          {fileError && (
            <p role="alert" className="text-xs font-semibold text-danger-red">
              {fileError}
            </p>
          )}

          <div className="flex items-center gap-3 border-t border-line pt-4">
            <button
              onClick={handleUpload}
              disabled={uploading || !file || !documento.trim()}
              className="rounded-lg bg-ink px-5 py-2 text-sm font-bold text-white transition-colors duration-150 hover:bg-keeta-teal-dark disabled:cursor-not-allowed disabled:opacity-40"
            >
              {uploading ? 'Extraindo texto…' : 'Carregar T&C'}
            </button>
            <span className="text-xs text-ink/45">
              {DOC_SUGGESTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDocumento(d)}
                  className="mr-2 rounded border border-line px-2 py-0.5 text-[11px] font-semibold text-ink/60 transition-colors duration-150 hover:border-keeta-teal hover:text-keeta-teal-dark"
                >
                  {d}
                </button>
              ))}
            </span>
          </div>
          {msg && (
            <p role="status" className="text-xs font-semibold text-keeta-teal-dark">
              {msg}
            </p>
          )}
          {error && (
            <p role="alert" className="text-xs font-semibold text-danger-red">
              {error}
            </p>
          )}
        </div>
      </section>

      <hr className="my-8 border-line" />

      {/* Lista */}
      <section aria-label="Termos carregados" className="animate-fade-in-up">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink">
          Termos Carregados
        </h2>
        <div className="mt-4">
          {loading ? (
            <p className="text-sm text-ink/50">Carregando…</p>
          ) : termos.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line bg-surface px-6 py-8 text-center text-sm text-ink/55">
              Nenhum T&C carregado. A IA usa apenas conhecimento genérico até você
              carregar os oficiais.
            </p>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line bg-white">
              {termos.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-ink">{t.documento}</h3>
                    <p className="mt-0.5 text-[11px] text-ink/50">
                      {t.versao && `versão ${t.versao} · `}
                      {t.conteudo.length.toLocaleString('pt-BR')} caracteres · atualizado{' '}
                      {new Date(t.atualizadoEm).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="shrink-0 rounded border border-danger-red/30 px-2.5 py-1 text-xs font-bold text-danger-red transition-colors duration-150 hover:bg-danger-bg"
                  >
                    remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
