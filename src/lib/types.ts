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
  /** Minuta editada no TemplateEditor — persistida junto ao caso. */
  minutaEditada?: string | null;
  /** TMO — Tempo Médio de Operação ACUMULADO em segundos. Soma todas as
   *  sessões de trabalho no caso (inclusive pausas de saída/reentrada),
   *  e só congela de vez quando o caso é Encerrado (status 'Encerrado'). */
  tmoSegundos?: number | null;
  /** Timestamp (ms) da ÚLTIMA retomada do caso — âncora da sessão atual.
   *  Usado para somar o tempo da sessão ao acumulado ao sair/salvar. */
  tmoRetomadoEm?: number | null;
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
