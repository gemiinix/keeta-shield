'use client';

import { useMemo, useState } from 'react';
import { MOTIVOS_PROCON } from '@/constants/motivos';
import { calculateKeetaBusinessDeadline, isoParaBR } from '@/lib/prazo';

/** Dados extraídos pela IA que chegam ao formulário. */
export type CrmDadosIA = {
  cipProcon: string;
  numeroPedido: string;
  mcdonalds: boolean;
  motivoClassificado: string;
};

type Props = {
  dadosIA: CrmDadosIA;
  prazoDefesa?: {
    dataAberturaISO: string;
    deadlineFinalISO: string;
    diasRestantes: number;
  } | null;
  onOpenTemplate: () => void;
};

const SIM_NAO = ['Sim', 'Não'] as const;
const STATUS_OPCOES = ['Em andamento', 'Encerrado'] as const;
const T_OPCOES = ['T1', 'T2'] as const;

/** Bloco de rótulo visual consistente com o sistema "Operação Viva". */
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink/60">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-ink/40">{hint}</p>}
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus:border-ink/40 focus:outline-none';

/** Botão de ação no padrão do sistema. */
function ActionButton({
  onClick,
  children,
  variant = 'primary',
  type = 'button',
}: {
  onClick?: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'ghost';
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={
        variant === 'primary'
          ? 'rounded-lg bg-ink px-4 py-2.5 text-sm font-bold text-white transition-colors duration-150 hover:bg-keeta-teal-dark'
          : 'rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink/60 transition-colors duration-150 hover:bg-surface hover:text-ink'
      }
    >
      {children}
    </button>
  );
}

export default function CrmForm({ dadosIA, prazoDefesa, onOpenTemplate }: Props) {
  // ── Campos pré-preenchidos pela IA (editáveis) ──
  const [responsavel] = useState('Anderson Figueredo');
  const [motivo, setMotivo] = useState(dadosIA.motivoClassificado || '');
  const [mcdonalds, setMcdonalds] = useState<'' | 'Sim' | 'Não'>(
    dadosIA.mcdonalds ? 'Sim' : ''
  );
  const [mcdonaldsTocado, setMcdonaldsTocado] = useState(false);
  const mcdonaldsValor = mcdonaldsTocado
    ? mcdonalds
    : dadosIA.mcdonalds
      ? ('Sim' as const)
      : ('Não' as const);

  // ── Campos manuais ──
  const [tt, setTT] = useState('');
  const [solicitacao, setSolicitacao] = useState('');
  const [idRa, setIdRa] = useState('');
  const [idProcon, setIdProcon] = useState('');
  const [flagKsProcon, setFlagKsProcon] = useState<'' | 'Sim' | 'Não'>('');
  const [idT1, setIdT1] = useState('');
  const [idT2, setIdT2] = useState('');
  const [t1OuT2, setT1OuT2] = useState<'' | 'T1' | 'T2'>('');
  const [dataEncerramento, setDataEncerramento] = useState('');
  const [status, setStatus] = useState<'' | (typeof STATUS_OPCOES)[number]>('');
  const [virouProcesso, setVirouProcesso] = useState<'' | 'Sim' | 'Não'>('');
  const [statusProcAdm, setStatusProcAdm] = useState<'' | (typeof STATUS_OPCOES)[number]>('');
  const [reembolso, setReembolso] = useState('');
  const [compensacao, setCompensacao] = useState('');
  const [comentarios, setComentarios] = useState('');

  // ── Prazo de processo administrativo: 10 dias úteis a partir de HOJE ──
  // Mesma regra utilitária do backend (prazo.ts) — cálculo no cliente.
  const prazoProcAdm = useMemo(() => {
    if (virouProcesso !== 'Sim') return null;
    const hoje = new Date();
    const dd = String(hoje.getDate()).padStart(2, '0');
    const mm = String(hoje.getMonth() + 1).padStart(2, '0');
    const hojeBR = `${dd}/${mm}/${hoje.getFullYear()}`;
    try {
      return calculateKeetaBusinessDeadline(hojeBR);
    } catch {
      return null;
    }
  }, [virouProcesso]);

  const limparCamposManuais = () => {
    setTT('');
    setSolicitacao('');
    setIdRa('');
    setIdProcon('');
    setFlagKsProcon('');
    setIdT1('');
    setIdT2('');
    setT1OuT2('');
    setDataEncerramento('');
    setStatus('');
    setVirouProcesso('');
    setStatusProcAdm('');
    setReembolso('');
    setCompensacao('');
    setComentarios('');
  };

  const prazoStatus =
    prazoDefesa && prazoDefesa.diasRestantes < 0
      ? 'vencido'
      : prazoDefesa && prazoDefesa.diasRestantes <= 3
        ? 'critico'
        : 'ok';

  return (
    <div className="animate-fade-in-up">
      {/* Banner de prazo de defesa no topo */}
      {prazoDefesa && (
        <div
          role="status"
          className={`mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-4 py-3 text-sm font-semibold ${
            prazoStatus === 'vencido'
              ? 'border-danger-red bg-danger-bg text-danger-red'
              : prazoStatus === 'critico'
                ? 'border-amber-500 bg-amber-50 text-amber-700'
                : 'border-keeta-teal bg-keeta-teal/10 text-keeta-teal-dark'
          }`}
        >
          <span className="font-display uppercase tracking-wider">Prazo de defesa</span>
          <span>{isoParaBR(prazoDefesa.deadlineFinalISO)}</span>
          <span aria-hidden>·</span>
          <span>
            {prazoDefesa.diasRestantes < 0
              ? `Prazo vencido — ${Math.abs(prazoDefesa.diasRestantes)} ${
                  Math.abs(prazoDefesa.diasRestantes) === 1 ? 'dia' : 'dias'
                } de atraso`
              : `${prazoDefesa.diasRestantes} ${
                  prazoDefesa.diasRestantes === 1 ? 'dia' : 'dias'
                } restantes`}
          </span>
        </div>
      )}

      {/* Formulário em grid 2 colunas (3 em monitores largos) */}
      <form className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
        {/* ── Seção: dados do caso (IA) ── */}
        <Field label="Data abertura">
          <input
            readOnly
            value={prazoDefesa ? isoParaBR(prazoDefesa.dataAberturaISO) : '—'}
            className={`${inputCls} cursor-default bg-surface`}
            aria-readonly="true"
          />
        </Field>

        <Field label="Prazo" hint="10 dias corridos da abertura, ajustado a dia útil">
          <input
            readOnly
            value={prazoDefesa ? isoParaBR(prazoDefesa.deadlineFinalISO) : '—'}
            className={`${inputCls} cursor-default bg-surface`}
            aria-readonly="true"
          />
        </Field>

        <Field label="CIP Procon">
          <input
            readOnly
            value={dadosIA.cipProcon || '—'}
            className={`${inputCls} cursor-default bg-surface`}
            aria-readonly="true"
          />
        </Field>

        <Field label="Motivo" hint="Classificado pela IA — ajuste se necessário">
          <select
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className={inputCls}
          >
            <option value="">— selecione —</option>
            {MOTIVOS_PROCON.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Número do Pedido">
          <input
            readOnly
            value={dadosIA.numeroPedido || '—'}
            className={`${inputCls} cursor-default bg-surface`}
            aria-readonly="true"
          />
        </Field>

        <Field label="McDonalds">
          <select
            value={mcdonaldsValor}
            onChange={(e) => {
              setMcdonaldsTocado(true);
              setMcdonalds(e.target.value as '' | 'Sim' | 'Não');
            }}
            className={inputCls}
          >
            <option value="Sim">Sim</option>
            <option value="Não">Não</option>
          </select>
        </Field>

        <Field label="Responsável Tratativa">
          <input
            readOnly
            value={responsavel}
            className={`${inputCls} cursor-default bg-surface`}
            aria-readonly="true"
          />
        </Field>

        {/* ── Seção: tratativa (manual) ── */}
        <Field label="TT">
          <input
            value={tt}
            onChange={(e) => setTT(e.target.value)}
            placeholder="Nº do ticket"
            className={inputCls}
          />
        </Field>

        <Field label="ID RA">
          <input
            inputMode="numeric"
            value={idRa}
            onChange={(e) => setIdRa(e.target.value.replace(/\D/g, ''))}
            placeholder="Reclame Aqui"
            className={inputCls}
          />
        </Field>

        <Field label="ID Procon">
          <input
            inputMode="numeric"
            value={idProcon}
            onChange={(e) => setIdProcon(e.target.value.replace(/\D/g, ''))}
            placeholder="Identificador Procon"
            className={inputCls}
          />
        </Field>

        <Field label="Flag KS Procon">
          <select
            value={flagKsProcon}
            onChange={(e) => setFlagKsProcon(e.target.value as '' | 'Sim' | 'Não')}
            className={inputCls}
          >
            <option value="">— selecione —</option>
            {SIM_NAO.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </Field>

        <Field label="ID T1 (se houver)">
          <input
            inputMode="numeric"
            value={idT1}
            onChange={(e) => setIdT1(e.target.value.replace(/\D/g, ''))}
            className={inputCls}
          />
        </Field>

        <Field label="ID T2 (se houver)">
          <input
            inputMode="numeric"
            value={idT2}
            onChange={(e) => setIdT2(e.target.value.replace(/\D/g, ''))}
            className={inputCls}
          />
        </Field>

        <Field label="T1 ou T2?">
          <select
            value={t1OuT2}
            onChange={(e) => setT1OuT2(e.target.value as '' | 'T1' | 'T2')}
            className={inputCls}
          >
            <option value="">— selecione —</option>
            {T_OPCOES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Data Encerramento">
          <input
            type="date"
            value={dataEncerramento}
            onChange={(e) => setDataEncerramento(e.target.value)}
            className={inputCls}
          />
        </Field>

        <Field label="Status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as '' | (typeof STATUS_OPCOES)[number])}
            className={inputCls}
          >
            <option value="">— selecione —</option>
            {STATUS_OPCOES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Virou processo admin?">
          <select
            value={virouProcesso}
            onChange={(e) => setVirouProcesso(e.target.value as '' | 'Sim' | 'Não')}
            className={inputCls}
          >
            <option value="">— selecione —</option>
            {SIM_NAO.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </Field>

        {/* Prazo processo admin — só aparece quando virou processo = Sim */}
        {prazoProcAdm && (
          <Field label="Prazo processo admin" hint="10 dias corridos de hoje, ajustado a dia útil">
            <input
              readOnly
              value={isoParaBR(prazoProcAdm.deadlineFinalISO)}
              className={`${inputCls} cursor-default bg-surface`}
              aria-readonly="true"
            />
          </Field>
        )}

        <Field label="Status encerramento proc. adm">
          <select
            value={statusProcAdm}
            onChange={(e) => setStatusProcAdm(e.target.value as '' | (typeof STATUS_OPCOES)[number])}
            className={inputCls}
          >
            <option value="">— selecione —</option>
            {STATUS_OPCOES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </Field>

        {/* ── Seção: valores e observações ── */}
        <Field label="REEMBOLSO (R$)">
          <input
            inputMode="decimal"
            value={reembolso}
            onChange={(e) => setReembolso(e.target.value.replace(/[^\d,.\-]/g, ''))}
            placeholder="0,00"
            className={inputCls}
          />
        </Field>

        <Field label="COMPENSAÇÃO (R$)">
          <input
            inputMode="decimal"
            value={compensacao}
            onChange={(e) => setCompensacao(e.target.value.replace(/[^\d,.\-]/g, ''))}
            placeholder="0,00"
            className={inputCls}
          />
        </Field>

        <Field label="Solicitação">
          <input
            value={solicitacao}
            onChange={(e) => setSolicitacao(e.target.value)}
            placeholder="O que o cliente solicita"
            className={inputCls}
          />
        </Field>

        <div className="md:col-span-2 xl:col-span-3">
          <Field label="Comentários">
            <textarea
              value={comentarios}
              onChange={(e) => setComentarios(e.target.value)}
              rows={4}
              placeholder="Observações da tratativa…"
              className={`${inputCls} resize-y`}
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-3 md:col-span-2 xl:col-span-3">
          <ActionButton onClick={onOpenTemplate}>
            Abrir minuta no editor
          </ActionButton>
          <ActionButton variant="ghost" onClick={limparCamposManuais}>
            Limpar campos manuais
          </ActionButton>
        </div>
      </form>
    </div>
  );
}
