/**
 * Camada de dados do Keeta Shield.
 *
 * - Se DATABASE_URL (Neon/Postgres) estiver configurada → persistência real.
 * - Senão → repositório em memória (funciona para demonstração, mas perde
 *   dados entre reinicializações do serverless).
 *
 * Tabelas: historico (análises + cache), templates (padrões de resposta),
 * termos (T&C da Keeta extraídos de PDFs).
 */
import type { HistoricoEntry, Template, Termo } from './types';
import type { Sql } from 'postgres';

interface Store {
  init(): Promise<void>;

  listHistorico(limit?: number): Promise<HistoricoEntry[]>;
  getHistoricoByHash(hash: string): Promise<HistoricoEntry | null>;
  saveHistorico(
    e: Omit<HistoricoEntry, 'id' | 'criadoEm'>
  ): Promise<HistoricoEntry>;

  listTemplates(): Promise<Template[]>;
  getTemplatePadrao(): Promise<Template | null>;
  saveTemplate(
    t: Omit<Template, 'id' | 'criadoEm' | 'atualizadoEm'> & { id?: number }
  ): Promise<Template>;
  deleteTemplate(id: number): Promise<void>;

  listTermos(): Promise<Termo[]>;
  saveTermo(t: Omit<Termo, 'id' | 'atualizadoEm'>): Promise<Termo>;
  deleteTermo(id: number): Promise<void>;
}

let impl: Store | null = null;
let initPromise: Promise<void> | null = null;

async function getStore(): Promise<Store> {
  if (!impl) {
    impl = process.env.DATABASE_URL ? createPostgresStore() : createMemoryStore();
  }
  if (!initPromise) initPromise = impl.init();
  await initPromise;
  return impl;
}

export const store = {
  async listHistorico(limit = 100) {
    return (await getStore()).listHistorico(limit);
  },
  async getHistoricoByHash(hash: string) {
    return (await getStore()).getHistoricoByHash(hash);
  },
  async saveHistorico(e: Omit<HistoricoEntry, 'id' | 'criadoEm'>) {
    return (await getStore()).saveHistorico(e);
  },
  async listTemplates() {
    return (await getStore()).listTemplates();
  },
  async getTemplatePadrao() {
    return (await getStore()).getTemplatePadrao();
  },
  async saveTemplate(t: Omit<Template, 'id' | 'criadoEm' | 'atualizadoEm'> & { id?: number }) {
    return (await getStore()).saveTemplate(t);
  },
  async deleteTemplate(id: number) {
    return (await getStore()).deleteTemplate(id);
  },
  async listTermos() {
    return (await getStore()).listTermos();
  },
  async saveTermo(t: Omit<Termo, 'id' | 'atualizadoEm'>) {
    return (await getStore()).saveTermo(t);
  },
  async deleteTermo(id: number) {
    return (await getStore()).deleteTermo(id);
  },
};

/* ------------------------------------------------------------------ */
/* Postgres (Neon) — persistência real                                 */
/* ------------------------------------------------------------------ */

function createPostgresStore(): Store {
  const getSql = (() => {
    let sql: Sql | null = null;
    return async () => {
      if (!sql) {
        const mod = (await import('postgres')) as unknown as { default: (url: string, opts?: Record<string, unknown>) => Sql };
        sql = mod.default(process.env.DATABASE_URL!, { max: 1, ssl: 'require' });
      }
      return sql;
    };
  })();

  return {
    async init() {
      const sql = await getSql();
      await sql`
        create table if not exists historico (
          id serial primary key,
          tipo text not null,
          origem text not null,
          resumo text not null default '',
          clausula text not null default '',
          template_gerado text not null default '',
          conteudo_hash text not null,
          criado_em timestamptz not null default now()
        )`;
      await sql`
        create table if not exists templates (
          id serial primary key,
          nome text not null,
          conteudo text not null,
          padrao boolean not null default false,
          criado_em timestamptz not null default now(),
          atualizado_em timestamptz not null default now()
        )`;
      await sql`
        create table if not exists termos (
          id serial primary key,
          documento text not null,
          versao text not null default '',
          conteudo text not null,
          atualizado_em timestamptz not null default now()
        )`;
    },

    async listHistorico(limit = 100) {
      const sql = await getSql();
      const rows = await sql`
        select id, tipo, origem, resumo, clausula, template_gerado, conteudo_hash, criado_em
        from historico order by id desc limit ${limit}`;
      return rows.map(mapHistorico);
    },

    async getHistoricoByHash(hash: string) {
      const sql = await getSql();
      const rows = await sql`
        select id, tipo, origem, resumo, clausula, template_gerado, conteudo_hash, criado_em
        from historico where conteudo_hash = ${hash} order by id desc limit 1`;
      return rows[0] ? mapHistorico(rows[0]) : null;
    },

    async saveHistorico(e) {
      const sql = await getSql();
      const rows = await sql`
        insert into historico (tipo, origem, resumo, clausula, template_gerado, conteudo_hash)
        values (${e.tipo}, ${e.origem}, ${e.resumo}, ${e.clausula}, ${e.templateGerado}, ${e.conteudoHash})
        returning id, tipo, origem, resumo, clausula, template_gerado, conteudo_hash, criado_em`;
      return mapHistorico(rows[0]);
    },

    async listTemplates() {
      const sql = await getSql();
      const rows = await sql`
        select id, nome, conteudo, padrao, criado_em, atualizado_em
        from templates order by id desc`;
      return rows.map(mapTemplate);
    },

    async getTemplatePadrao() {
      const sql = await getSql();
      const rows = await sql`
        select id, nome, conteudo, padrao, criado_em, atualizado_em
        from templates where padrao = true order by id desc limit 1`;
      return rows[0] ? mapTemplate(rows[0]) : null;
    },

    async saveTemplate(t) {
      const sql = await getSql();
      if (t.padrao) {
        await sql`update templates set padrao = false where padrao = true`;
      }
      if (t.id) {
        const rows = await sql`
          update templates set nome = ${t.nome}, conteudo = ${t.conteudo}, padrao = ${t.padrao ?? false},
          atualizado_em = now() where id = ${t.id}
          returning id, nome, conteudo, padrao, criado_em, atualizado_em`;
        return mapTemplate(rows[0]);
      }
      const rows = await sql`
        insert into templates (nome, conteudo, padrao)
        values (${t.nome}, ${t.conteudo}, ${t.padrao ?? false})
        returning id, nome, conteudo, padrao, criado_em, atualizado_em`;
      return mapTemplate(rows[0]);
    },

    async deleteTemplate(id: number) {
      const sql = await getSql();
      await sql`delete from templates where id = ${id}`;
    },

    async listTermos() {
      const sql = await getSql();
      const rows = await sql`
        select id, documento, versao, conteudo, atualizado_em
        from termos order by id desc`;
      return rows.map(mapTermo);
    },

    async saveTermo(t) {
      const sql = await getSql();
      const rows = await sql`
        insert into termos (documento, versao, conteudo)
        values (${t.documento}, ${t.versao}, ${t.conteudo})
        returning id, documento, versao, conteudo, atualizado_em`;
      return mapTermo(rows[0]);
    },

    async deleteTermo(id: number) {
      const sql = await getSql();
      await sql`delete from termos where id = ${id}`;
    },
  };
}

/* mappers snake_case → camelCase */
type AnyRow = Record<string, unknown>;
function mapHistorico(r: AnyRow): HistoricoEntry {
  return {
    id: Number(r.id),
    tipo: r.tipo as HistoricoEntry['tipo'],
    origem: r.origem as HistoricoEntry['origem'],
    resumo: String(r.resumo ?? ''),
    clausula: String(r.clausula ?? ''),
    templateGerado: String(r.template_gerado ?? ''),
    conteudoHash: String(r.conteudo_hash ?? ''),
    criadoEm: new Date(r.criado_em as string).toISOString(),
  };
}
function mapTemplate(r: AnyRow): Template {
  return {
    id: Number(r.id),
    nome: String(r.nome),
    conteudo: String(r.conteudo),
    padrao: Boolean(r.padrao),
    criadoEm: new Date(r.criado_em as string).toISOString(),
    atualizadoEm: new Date(r.atualizado_em as string).toISOString(),
  };
}
function mapTermo(r: AnyRow): Termo {
  return {
    id: Number(r.id),
    documento: String(r.documento),
    versao: String(r.versao ?? ''),
    conteudo: String(r.conteudo),
    atualizadoEm: new Date(r.atualizado_em as string).toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Memória — fallback sem DATABASE_URL (demonstração)                  */
/* ------------------------------------------------------------------ */

function createMemoryStore(): Store {
  const historico: HistoricoEntry[] = [];
  const templates: Template[] = [];
  const termos: Termo[] = [];
  let nextId = 1;

  return {
    async init() { /* nada a criar */ },
    async listHistorico(limit = 100) {
      return [...historico].reverse().slice(0, limit);
    },
    async getHistoricoByHash(hash: string) {
      return historico.find((h) => h.conteudoHash === hash) ?? null;
    },
    async saveHistorico(e) {
      const entry: HistoricoEntry = { ...e, id: nextId++, criadoEm: new Date().toISOString() };
      historico.push(entry);
      return entry;
    },
    async listTemplates() {
      return [...templates].reverse();
    },
    async getTemplatePadrao() {
      return templates.find((t) => t.padrao) ?? null;
    },
    async saveTemplate(t) {
      if (t.padrao) templates.forEach((x) => (x.padrao = false));
      if (t.id) {
        const i = templates.findIndex((x) => x.id === t.id);
        if (i >= 0) {
          templates[i] = { ...templates[i], ...t, atualizadoEm: new Date().toISOString() };
          return templates[i];
        }
      }
      const entry: Template = {
        id: nextId++,
        nome: t.nome,
        conteudo: t.conteudo,
        padrao: t.padrao ?? false,
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      };
      templates.push(entry);
      return entry;
    },
    async deleteTemplate(id: number) {
      const i = templates.findIndex((x) => x.id === id);
      if (i >= 0) templates.splice(i, 1);
    },
    async listTermos() {
      return [...termos].reverse();
    },
    async saveTermo(t) {
      const entry: Termo = { ...t, id: nextId++, atualizadoEm: new Date().toISOString() };
      termos.push(entry);
      return entry;
    },
    async deleteTermo(id: number) {
      const i = termos.findIndex((x) => x.id === id);
      if (i >= 0) termos.splice(i, 1);
    },
  };
}
