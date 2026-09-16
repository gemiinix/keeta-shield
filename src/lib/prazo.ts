/**
 * Cálculo de prazo de defesa Procon (CDC): 10 dias corridos a partir da
 * abertura; se o 10º dia cair em fim de semana ou feriado nacional,
 * posterga para o próximo dia útil.
 *
 * Toda a aritmética é feita AQUI, em TypeScript determinístico — nunca
 * delegada ao modelo de IA (LLMs erram soma de datas).
 */

const MS_DIA = 86_400_000;

/** Feriados nacionais de caráter fixo (MM-DD). */
const FERIADOS_FIXOS: readonly string[] = [
  '01-01', // Confraternização Universal
  '04-21', // Tiradentes
  '05-01', // Dia do Trabalho
  '09-07', // Independência
  '10-12', // N. Sra. Aparecida
  '11-02', // Finados
  '11-15', // Proclamação da República
  '11-20', // Consciência Negra
  '12-25', // Natal
];

/** Domingo de Páscoa (algoritmo gregoriano anônimo) — base dos móveis. */
function pascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

const iso = (d: Date): string => d.toISOString().slice(0, 10);

/** Feriados móveis derivados da Páscoa, no ano dado. */
function feriadosMoveis(ano: number): string[] {
  const p = pascoa(ano).getTime();
  return [
    iso(new Date(p - 48 * MS_DIA)), // Carnaval (terça)
    iso(new Date(p - 47 * MS_DIA)), // Quarta-feira de Cinzas
    iso(new Date(p - 2 * MS_DIA)), // Sexta-feira Santa
    iso(new Date(p + 60 * MS_DIA)), // Corpus Christi
  ];
}

const cacheFeriados = new Map<number, Set<string>>();

/** Conjunto 'YYYY-MM-DD' de todos os feriados nacionais do ano. */
function feriadosDoAno(ano: number): Set<string> {
  let set = cacheFeriados.get(ano);
  if (!set) {
    set = new Set<string>([
      ...FERIADOS_FIXOS.map((md) => `${ano}-${md}`),
      ...feriadosMoveis(ano),
    ]);
    cacheFeriados.set(ano, set);
  }
  return set;
}

function ehDiaUtil(d: Date): boolean {
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) return false; // domingo/sábado
  return !feriadosDoAno(d.getUTCFullYear()).has(iso(d));
}

export type PrazoDefesa = {
  /** Data de abertura em ISO (YYYY-MM-DD). */
  dataAberturaISO: string;
  /** Abertura + 10 dias corridos, sem ajuste (ISO). */
  prazoCalculadoISO: string;
  /** Prazo final pós-ajuste para dia útil (ISO). */
  deadlineFinalISO: string;
  /** Dias restantes hoje (negativo = vencido). */
  diasRestantes: number;
};

/**
 * Recebe a data de abertura em "DD/MM/YYYY" e devolve o prazo de defesa.
 * Lança erro se a data for inválida.
 */
export function calculateKeetaBusinessDeadline(dataAberturaStr: string): PrazoDefesa {
  const m = dataAberturaStr.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) throw new Error(`Data de abertura inválida: "${dataAberturaStr}"`);

  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const ano = Number(m[3]);
  const abertura = new Date(Date.UTC(ano, mes - 1, dia));
  if (abertura.getUTCMonth() !== mes - 1 || abertura.getUTCDate() !== dia) {
    throw new Error(`Data de abertura inexistente: "${dataAberturaStr}"`);
  }

  // 10 dias corridos
  const prazo = new Date(abertura.getTime() + 10 * MS_DIA);

  // Posterga para o próximo dia útil se cair em fim de semana/feriado
  const deadlineFinal = new Date(prazo);
  while (!ehDiaUtil(deadlineFinal)) {
    deadlineFinal.setUTCDate(deadlineFinal.getUTCDate() + 1);
  }

  // Dias restantes a partir de HOJE (meia-noite local do servidor)
  const agora = new Date();
  const hoje = Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const diasRestantes = Math.round((deadlineFinal.getTime() - hoje) / MS_DIA);

  return {
    dataAberturaISO: iso(abertura),
    prazoCalculadoISO: iso(prazo),
    deadlineFinalISO: iso(deadlineFinal),
    diasRestantes,
  };
}

/** Formata ISO (YYYY-MM-DD) para DD/MM/YYYY. */
export function isoParaBR(isoDate: string): string {
  const [y, mo, d] = isoDate.split('-');
  return `${d}/${mo}/${y}`;
}
