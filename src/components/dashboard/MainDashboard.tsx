'use client';

import { useState } from 'react';
import ProconFlow from '@/components/flows/ProconFlow';
import SubsidioFlow from '@/components/flows/SubsidioFlow';
import TemplateEditor from '@/components/editor/TemplateEditor';
import type { NavKey } from '@/app/page';

type Tab = 'procon' | 'subsidio';

export default function MainDashboard({
  activeNav,
  onNavigate,
}: {
  activeNav: NavKey;
  onNavigate: (key: NavKey) => void;
}) {
  const [activeTab, setActiveTab] = useState<Tab>('procon');
  const [analysisResult, setAnalysisResult] = useState<
    { extracted: Record<string, string>; templateText: string } | null
  >(null);

  // Fluxo de processamento concluído → exibe o TemplateEditor
  if (analysisResult) {
    return (
      <main className="flex-1 overflow-hidden bg-zinc-950">
        <TemplateEditor
          extracted={analysisResult.extracted}
          templateText={analysisResult.templateText}
          onClose={() => setAnalysisResult(null)}
        />
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto bg-zinc-950 p-8">
      {/* Cabeçalho */}
      <header className="animate-fade-in-up">
        <h1 className="text-2xl font-bold text-zinc-100">Nova Análise</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Selecione o fluxo de trabalho e submeta a requisição para análise.
        </p>
      </header>

      {/* Abas de fluxo */}
      <div className="mt-6 inline-flex rounded-xl border border-zinc-800 bg-zinc-900 p-1">
        {(
          [
            { key: 'procon', label: 'Procon' },
            { key: 'subsidio', label: 'Subsídio' },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`rounded-lg px-6 py-2 text-sm font-semibold transition-all ${
              activeTab === key
                ? 'bg-keeta-teal text-zinc-950 shadow-glow-teal'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Área de fluxo ativo */}
      <section className="mt-6 animate-fade-in-up">
        {activeTab === 'procon' ? (
          <ProconFlow onAnalysisComplete={setAnalysisResult} />
        ) : (
          <SubsidioFlow onAnalysisComplete={setAnalysisResult} />
        )}
      </section>
    </main>
  );
}
