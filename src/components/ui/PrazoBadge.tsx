'use client';

/**
 * Banner/badge de prazo de defesa com cores semânticas.
 * Status: 'vencido' (vermelho) | 'critico' <=3 dias (âmbar) | 'ok' (teal).
 */

export type PrazoStatus = 'vencido' | 'critico' | 'ok';

const STATUS_STYLES: Record<PrazoStatus, { banner: string; label: string; badge: string }> = {
  vencido: {
    banner: 'border-danger-red bg-danger-bg',
    label: 'Prazo vencido',
    badge: 'bg-danger-red text-white',
  },
  critico: {
    banner: 'border-warn-amber bg-warn-bg',
    label: 'Prazo crítico',
    badge: 'bg-warn-amber text-white',
  },
  ok: {
    banner: 'border-keeta-teal bg-keeta-teal/10',
    label: 'Prazo em dia',
    badge: 'bg-keeta-teal text-white',
  },
};

export function prazoStatusDe(diasRestantes: number): PrazoStatus {
  if (diasRestantes < 0) return 'vencido';
  if (diasRestantes <= 3) return 'critico';
  return 'ok';
}

/** Banner de prazo exibido no topo do TemplateEditor. */
export function PrazoBanner(props: { status: PrazoStatus; text: string }) {
  const s = STATUS_STYLES[props.status];
  return (
    <div role="status" className={`flex items-center gap-3 rounded border px-4 py-3 ${s.banner}`}>
      <span className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${s.badge}`}>
        {s.label}
      </span>
      <span className="text-sm font-semibold text-ink">{props.text}</span>
    </div>
  );
}

/** Badge compacto de prazo (usado em listas densas). */
export default function PrazoBadge(props: { status: PrazoStatus; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-bold ${
        STATUS_STYLES[props.status].badge
      }`}
    >
      {props.children}
    </span>
  );
}
