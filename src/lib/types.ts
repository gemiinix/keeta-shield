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
