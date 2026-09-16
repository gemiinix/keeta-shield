'use client';

/**
 * Cabeçalho padrão de página: título forte em caixa alta (Sora),
 * subtítulo contextual em teal e linha-assinatura amarelo+teal.
 */
export default function PageHeader({
  title,
  subtitle,
  meta,
}: {
  title: string;
  subtitle: string;
  meta?: React.ReactNode;
}) {
  return (
    <header className="animate-fade-in-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold uppercase tracking-tight text-ink">
            {title}
          </h1>
          <p className="mt-1 text-sm font-medium text-keeta-teal-dark">{subtitle}</p>
        </div>
        {meta && <div className="text-xs text-ink/50">{meta}</div>}
      </div>
      {/* Assinatura visual: linha fina amarelo + teal */}
      <div aria-hidden className="mt-4 h-0.5 w-16 bg-keeta-yellow" />
      <div aria-hidden className="mt-1 h-px w-full bg-line" />
    </header>
  );
}
