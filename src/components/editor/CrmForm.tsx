'use client';

import { useMemo, useState } from 'react';
import { MOTIVOS_PROCON } from '@/constants/motivos';
import { calculateKeetaBusinessDeadline, isoParaBR } from '@/lib/prazo';
import type { CrmSnapshot } from '@/lib/types';

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
  /** Snapshot salvo (reabrindo do histórico) — repõe os campos preenchidos. */
  snapshot?: CrmSnapshot | null;
  /** ID do caso no histórico — habilita salvar/atualizar o formulário. */
  casoId?: number | null;
  /** Timestamp (ms) do início do caso — âncora do TMO, de propriedade do
   *  MainDashboard (não remonta ao alternar formulário/minuta, então o
   *  cronômetro nunca zera ao voltar do editor). */
  inicioCaso?: number;
  /** Congela o TMO quando o caso é Encerrado — notifica o dashboard. */
  onTmoFrozen?: (segundos: number) => void;
  /** Sincroniza o acumulado de TMO do dashboard após cada salvamento. */
  onTmoAcumulado?: (segundos: number) => void;
  /** Minuta editada no TemplateEditor — reposta no estado local ao voltar. */
  minutaEditada?: string | null;
  /** Notifica o dashboard de que a minuta foi alterada. */
  onMinutaChange?: (texto: string) => void;
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

export default function CrmForm({ dadosIA, prazoDefesa, onOpenTemplate, snapshot: snapshotSalvo, casoId, inicioCaso, onTmoFrozen, onTmoAcumulado, minutaEditada, onMinutaChange }: Props) {
  // ── Campos pré-preenchidos pela IA (editáveis; snapshot repõe os salvos) ──
  const saved = snapshotSalvo?.campos ?? {};
  const [salvando, setSalvando] = useState(false);
  const [msgSalvo, setMsgSalvo] = useState<string | null>(null);
  const [responsavel] = useState(saved.responsavel ?? 'Anderson Figueredo');
  const [motivo, setMotivo] = useState(saved.motivo ?? dadosIA.motivoClassificado ?? '');
  const [mcdonalds, setMcdonalds] = useState<'' | 'Sim' | 'Não'>(
    ((saved.mcdonalds as 'Sim' | 'Não') ?? (dadosIA.mcdonalds ? 'Sim' : 'Não')) as '' | 'Sim' | 'Não'
  );
  const [mcdonaldsTocado, setMcdonaldsTocado] = useState(false);
  const mcdonaldsValor = mcdonaldsTocado
    ? mcdonalds
    : ((saved.mcdonalds as 'Sim' | 'Não') ?? (dadosIA.mcdonalds ? 'Sim' : 'Não'));

  // ── Campos manuais (snapshot repõe os salvos) ──
  const [tt, setTT] = useState(saved.tt ?? '');
  const [solicitacao, setSolicitacao] = useState(saved.solicitacao ?? '');
  const [idRa, setIdRa] = useState(saved.idRa ?? '');
  const [idProcon, setIdProcon] = useState(saved.idProcon ?? '');
  const [flagKsProcon, setFlagKsProcon] = useState<'' | 'Sim' | 'Não'>(
    (saved.flagKsProcon as '' | 'Sim' | 'Não') ?? ''
  );
  const [idT1, setIdT1] = useState(saved.idT1 ?? '');
  const [idT2, setIdT2] = useState(saved.idT2 ?? '');
  const [t1OuT2, setT1OuT2] = useState<'' | 'T1' | 'T2'>((saved.t1OuT2 as '' | 'T1' | 'T2') ?? '');
  const [dataEncerramento, setDataEncerramento] = useState(saved.dataEncerramento ?? '');
  const [status, setStatus] = useState<'' | (typeof STATUS_OPCOES)[number]>(
    (saved.status as '' | (typeof STATUS_OPCOES)[number]) ?? ''
  );
  const [virouProcesso, setVirouProcesso] = useState<'' | 'Sim' | 'Não'>(
    (saved.virouProcesso as '' | 'Sim' | 'Não') ?? ''
  );
  const [statusProcAdm, setStatusProcAdm] = useState<'' | (typeof STATUS_OPCOES)[number]>(
    (saved.statusProcAdm as '' | (typeof STATUS_OPCOES)[number]) ?? ''
  );
  const [reembolso, setReembolso] = useState(saved.reembolso ?? '');
  const [compensacao, setCompensacao] = useState(saved.compensacao ?? '');
  const [comentarios, setComentarios] = useState(saved.comentarios ?? '');

  // ── TMO: cronômetro ACUMULATIVO do caso ──
  // Soma todas as sessões de trabalho (inclusive saindo para outra análise
  // e voltando depois). Congela de vez apenas quando o caso é Encerrado.
  const tmoSalvo = snapshotSalvo?.tmoSegundos ?? 0;
  const casoEncerrado =
    (snapshotSalvo?.campos?.status ?? '').trim().toLowerCase() === 'encerrado';
  // Base acumulada + âncora da sessão atual (retomada do banco se houver,
  // senão agora — primeira sessão do caso).
  const retomadoEm = snapshotSalvo?.tmoRetomadoEm ?? Date.now();
  // TMO congelado: caso encerrado (registro definitivo).
  const [tmoCongelado, setTmoCongelado] = useState<number | null>(() =>
    casoEncerrado ? tmoSalvo : null
  );
  // TMO vivo = acumulado salvo + tempo da sessão atual.
  const [tmoBase] = useState<number>(() => tmoSalvo);
  // Âncora da sessão: prop do dashboard (não remonta ao alternar
  // formulário ↔ minuta) — retoma da hora em que o caso foi (re)aberto.
  const inicioEfeito = inicioCaso ?? retomadoEm;
  const tmoVivoAgora =
    tmoBase + Math.max(0, Math.floor((Date.now() - inicioEfeito) / 1000));

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

  const salvarFormulario = async () => {
    if (!casoId || salvando) return;
    setSalvando(true);
    setMsgSalvo(null);
    try {
      const snapshot: CrmSnapshot = {
        prazoDefesa: prazoDefesa ?? null,
        dadosIA,
        campos: {
          responsavel,
          motivo,
          mcdonalds: mcdonaldsValor,
          tt,
          solicitacao,
          idRa,
          idProcon,
          flagKsProcon,
          idT1,
          idT2,
          t1OuT2,
          dataEncerramento,
          status,
          virouProcesso,
          statusProcAdm,
          reembolso,
          compensacao,
          comentarios,
        },
        // Minuta editada no TemplateEditor — preservada no snapshot
        // (nunca se perde ao navegar/fechar/reabrir o caso).
        minutaEditada: minutaEditada ?? snapshotSalvo?.minutaEditada ?? null,
        // TMO acumulado: soma o tempo da sessão atual ao que já estava
        // salvo. Congela de vez quando o caso é Encerrado — antes disso,
        // cada salvamento apenas atualiza o acumulado (nunca zera).
        tmoSegundos:
          tmoCongelado != null
            ? tmoCongelado
            : tmoVivoAgora,
        // Âncora da sessão atual — para retomar dali na próxima abertura.
        tmoRetomadoEm: tmoCongelado != null ? null : inicioEfeito,
        atualizadoEm: new Date().toISOString(),
      };
      const tmoSalvo = snapshot.tmoSegundos;
      const res = await fetch('/api/historico', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: casoId, snapshot }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? 'Falha ao salvar formulário.');
      }
      setMsgSalvo(
        `Formulário salvo às ${new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        })} — reabra este caso pelo Histórico quando quiser atualizar.`
      );
      // Sincroniza o acumulado do dashboard com o TMO recém-salvo.
      // Só congela de vez se o caso acabou de ser Encerrado neste salvamento.
      if (tmoSalvo != null) {
        onTmoAcumulado?.(tmoSalvo);
        const encerrouAgora =
          (status ?? '').trim().toLowerCase() === 'encerrado';
        if (encerrouAgora) setTmoCongelado(tmoSalvo);
        onTmoFrozen?.(tmoSalvo);
      }
    } catch (err) {
      setMsgSalvo(err instanceof Error ? err.message : 'Erro inesperado ao salvar.');
    } finally {
      setSalvando(false);
    }
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
      <form
        className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2 xl:grid-cols-3"
        onSubmit={(e) => e.preventDefault()}
      >
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
          {casoId ? (
            <ActionButton type="button" onClick={salvarFormulario}>
              {salvando ? 'Salvando…' : 'Salvar no histórico'}
            </ActionButton>
          ) : null}
          <ActionButton variant="ghost" type="button" onClick={onOpenTemplate}>
            Abrir minuta no editor
          </ActionButton>
          <ActionButton variant="ghost" type="button" onClick={limparCamposManuais}>
            Limpar campos manuais
          </ActionButton>
        </div>
        {msgSalvo && (
          <p
            role="status"
            className={`mt-1 text-xs font-semibold md:col-span-2 xl:col-span-3 ${
              msgSalvo.startsWith('Formulário salvo')
                ? 'text-keeta-teal-dark'
                : 'text-danger-red'
            }`}
          >
            {msgSalvo}
          </p>
        )}
      </form>
    </div>
  );
}
