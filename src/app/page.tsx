'use client';

import { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import MainDashboard from '@/components/dashboard/MainDashboard';

export type NavKey = 'nova-analise' | 'historico' | 'templates' | 'termos';

/**
 * Página principal do Keeta Shield.
 * Composition Root: Sidebar (navegação) + MainDashboard (fluxo de trabalho).
 * Em telas menores a sidebar recolhe e abre pelo botão hamburger interno.
 */
export default function Home() {
  const [activeNav, setActiveNav] = useState<NavKey>('nova-analise');

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar activeNav={activeNav} onNavigate={setActiveNav} />
      <MainDashboard activeNav={activeNav} onNavigate={setActiveNav} />
    </div>
  );
}
