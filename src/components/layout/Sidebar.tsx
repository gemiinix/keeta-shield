'use client';

import { useState } from 'react';
import {
  DocumentPlusIcon,
  ClockIcon,
  ChartBarIcon,
  Squares2X2Icon,
  BookOpenIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

import type { NavKey } from '@/app/page';

const NAV_ITEMS: { key: NavKey; label: string; Icon: typeof DocumentPlusIcon }[] = [
  { key: 'nova-analise', label: 'Nova Análise', Icon: DocumentPlusIcon },
  { key: 'historico', label: 'Histórico', Icon: ClockIcon },
  { key: 'dashboard', label: 'Dashboard', Icon: ChartBarIcon },
  { key: 'templates', label: 'Templates', Icon: Squares2X2Icon },
  { key: 'termos', label: 'Termos', Icon: BookOpenIcon },
];

/**
 * Sidebar fixa e compacta (~250px), branca, borda fina à direita.
 * Item ativo: fundo grafite, texto claro, marcador amarelo vertical.
 * Em telas menores recolhe e vira painel acessível por botão hamburger.
 */
export default function Sidebar({
  activeNav,
  onNavigate,
}: {
  activeNav: NavKey;
  onNavigate: (key: NavKey) => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNavigate = (key: NavKey) => {
    onNavigate(key);
    setMobileOpen(false);
  };

  const content = (
    <>
      {/* Marca */}
      <div className="flex items-center gap-3 border-b border-line px-5 py-5">
        <div
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded font-display text-base font-bold text-ink"
          style={{ backgroundColor: '#FFD600' }}
        >
          K
        </div>
        <div className="min-w-0">
          <p className="font-display text-sm font-bold leading-tight text-ink">
            Keeta Shield
          </p>
          <p className="text-[11px] font-semibold text-keeta-teal">Operação Viva</p>
        </div>
      </div>

      {/* Navegação */}
      <nav aria-label="Navegação principal" className="mt-4 flex flex-col gap-0.5 px-3">
        {NAV_ITEMS.map(({ key, label, Icon }) => {
          const isActive = activeNav === key;
          return (
            <button
              key={key}
              onClick={() => handleNavigate(key)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex items-center gap-3 rounded px-3 py-2.5 text-sm font-semibold transition-colors duration-150 ${
                isActive
                  ? 'bg-ink text-white'
                  : 'text-ink/70 hover:bg-surface hover:text-ink'
              }`}
            >
              {isActive && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r bg-keeta-yellow"
                />
              )}
              <Icon className="h-5 w-5 shrink-0" />
              {label}
            </button>
          );
        })}
      </nav>

      {/* Rodapé discreto */}
      <div className="mt-auto border-t border-line px-5 py-4">
        <p className="text-[11px] leading-relaxed text-ink/40">
          Triagem jurídica de CX
          <br />
          Procon · Subsídio
        </p>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop: coluna fixa — escondida na impressão do relatório */}
      <aside className="no-print hidden h-full w-[250px] shrink-0 flex-col border-r border-line bg-white lg:flex">
        {content}
      </aside>

      {/* Menor que desktop: hamburger + painel deslizante */}
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menu de navegação"
        className="fixed left-3 top-3 z-40 rounded border border-line bg-white p-2 text-ink shadow-sm lg:hidden"
      >
        <Bars3Icon className="h-5 w-5" />
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink/20 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-[250px] flex-col border-r border-line bg-white transition-transform duration-150 lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex justify-end px-3 pt-3">
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu de navegação"
            className="rounded p-1.5 text-ink/60 transition-colors duration-150 hover:bg-surface hover:text-ink"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        {content}
      </aside>
    </>
  );
}
