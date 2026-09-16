'use client';

import { UserCircleIcon, DocumentPlusIcon, ClockIcon, Squares2X2Icon } from '@heroicons/react/24/outline';

import type { NavKey } from '@/app/page';

type NavKeyLocal = NavKey;

const NAV_ITEMS: { key: NavKeyLocal; label: string; Icon: typeof UserCircleIcon }[] = [
  { key: 'nova-analise', label: 'Nova Análise', Icon: DocumentPlusIcon },
  { key: 'historico', label: 'Histórico', Icon: ClockIcon },
  { key: 'templates', label: 'Gerir Templates', Icon: Squares2X2Icon },
];

export default function Sidebar({
  activeNav,
  onNavigate,
}: {
  activeNav: NavKeyLocal;
  onNavigate: (key: NavKeyLocal) => void;
}) {
  return (
    <aside className="flex h-full w-64 flex-col border-r border-zinc-800 bg-zinc-900">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-keeta-yellow font-black text-zinc-900 shadow-glow-yellow">
          K
        </div>
        <div>
          <p className="text-sm font-bold leading-tight text-zinc-100">Keeta Shield</p>
          <p className="text-[11px] text-zinc-500">Automação Jurídica CX</p>
        </div>
      </div>

      {/* Navegação */}
      <nav className="mt-2 flex flex-col gap-1 px-3">
        {NAV_ITEMS.map(({ key, label, Icon }) => {
          const isActive = activeNav === key;
          return (
            <button
              key={key}
              onClick={() => onNavigate(key)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-keeta-teal/15 text-keeta-teal'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
              {isActive && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-keeta-teal" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Perfil do usuário na base */}
      <div className="mt-auto border-t border-zinc-800 p-4">
        <div className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-zinc-800">
          <UserCircleIcon className="h-9 w-9 text-zinc-500" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-200">Anderson</p>
            <p className="truncate text-[11px] text-zinc-500">anderson@keeta.com</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
