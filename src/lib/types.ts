/** Tipos compartilhados do Keeta Shield. */

export type TipoAnalise = 'procon' | 'subsidio';

export type HistoricoEntry = {
  id: number;
  tipo: TipoAnalise;
  origem: 'pdf' | 'texto';
  resumo: string;
  clausula: string;
  templateGerado: string;
  conteudoHash: string;
  criadoEm: string;
  /** Snapshot do Formulário de CRM (Procon) — dados IA + campos manuais. */
  dadosCrm?: CrmSnapshot | null;
};

/** Prazo de defesa conforme calculado pelo servidor. */
export type PrazoDefesaSnapshot = {
  dataAberturaISO: string;
  deadlineFinalISO: string;
  diasRestantes: number;
};

/** Dados estruturados extraídos pela IA para o CRM. */
export type DadosIAForm = {
  cipProcon: string;
  numeroPedido: string;
  mcdonalds: boolean;
  motivoClassificado: string;
};

/** Estado persistido do formulário de CRM de um caso. */
export type CrmSnapshot = {
  prazoDefesa?: PrazoDefesaSnapshot | null;
  dadosIA?: DadosIAForm;
  /** Campos do formulário (IA + manuais) no momento do salvamento. */
  campos?: Record<string, string>;
  /** TMO — Tempo Médio de Operação: segundos entre a análise chegar e o
   *  primeiro 'Salvar no histórico' do caso. Registrado uma única vez. */
  tmoSegundos?: number | null;
  atualizadoEm?: string;
};

export type Template = {
  id: number;
  nome: string;
  conteudo: string;
  padrao: boolean;
  criadoEm: string;
  atualizadoEm: string;
};

export type Termo = {
  id: number;
  documento: string;
  versao: string;
  conteudo: string;
  atualizadoEm: string;
};
