import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { generateInsights } from '@/lib/gemini-insights';

/**
 * GET /api/dashboard?ano=2026&mes=9
 *
 * Agrega os dados do CRM (coluna dados_crm de historico) para um mês/ano e
 * devolve métricas gerenciais + insights gerados por IA.
 *
 * Mapeamento legado → novo:
 *   close_date                      → campos.dataEncerramento (AAAA-MM-DD)
 *   question_name_translated        → campos.motivo (dadosIA.motivoClassificado
 *   fourth_category_name_translated →   como fallback inicial)
 *
 * Métricas:
 *   totalCasos, funilAtendimento (apenasT1 / t1MaisT2 / naDiretoProcon),
 *   cruzamentoRA (comRA / semRA), top5MotivosGeral, top5PorEtapa.
 *
 * IA de insights: mesmo chain do /api/analisar (rotação de chaves + retry).
 * Falha da IA NUNCA derruba o dashboard — insightsGerados vem vazio.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const agora = new Date();
    const ano = Number(url.searchParams.get('ano') ?? agora.getFullYear());
    const mes = Number(url.searchParams.get('mes') ?? agora.getMonth() + 1);

    if (!Number.isInteger(ano) || ano < 2020 || ano > 2100) {
      return NextResponse.json({ error: 'Parâmetro ano inválido.' }, { status: 400 });
    }
    if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
      return NextResponse.json({ error: 'Parâmetro mes inválido.' }, { status: 400 });
    }

    const storeResolved = store;
    const todos = await storeResolved.listHistorico(2000);
    const casos = todos.filter((e) => {
      const dataEnc = e.dadosCrm?.campos?.dataEncerramento ?? '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dataEnc)) return false;
      const [a, m] = dataEnc.split('-').map(Number);
      return a === ano && m === mes;
    });

    const preenchido = (v: unknown) => typeof v === 'string' && v.trim() !== '';
    const n = casos.length;
    const pct = (v: number) => (n === 0 ? 0 : Math.round((v / n) * 1000) / 10);

    const campo = (e: (typeof casos)[number], k: string) => e.dadosCrm?.campos?.[k];
    const temT1 = (e: (typeof casos)[number]) => preenchido(campo(e, 'idT1'));
    const temT2 = (e: (typeof casos)[number]) => preenchido(campo(e, 'idT2'));
    const temRA = (e: (typeof casos)[number]) => preenchido(campo(e, 'idRa'));

    const apenasT1 = casos.filter((e) => temT1(e) && !temT2(e));
    const t1MaisT2 = casos.filter((e) => temT2(e));
    const naDiretoProcon = casos.filter((e) => !temT1(e) && !temT2(e));
    const comRA = casos.filter((e) => temRA(e));
    const semRA = casos.filter((e) => !temRA(e));

    const motivoDe = (e: (typeof casos)[number]) =>
      (campo(e, 'motivo') ?? e.dadosCrm?.dadosIA?.motivoClassificado ?? '').trim();

    const top5 = (lista: (typeof casos)[number][]) => {
      const contagem = new Map<string, number>();
      for (const e of lista) {
        const motivo = motivoDe(e);
        if (!motivo) continue;
        contagem.set(motivo, (contagem.get(motivo) ?? 0) + 1);
      }
      return [...contagem.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([nome, qtd]) => {
          // TMO médio por motivo (média dos casos com TMO registrado)
          const tmos = lista
            .map((e) => (motivoDe(e) === nome ? e.dadosCrm?.tmoSegundos ?? null : null))
            .filter((v): v is number => v != null);
          const tmoMedio = tmos.length > 0 ? Math.round(tmos.reduce((s, v) => s + v, 0) / tmos.length) : null;
          return { nome, qtd, pct: pct(qtd), tmoMedio };
        });
    };

    // ── TMO: Tempo Médio de Operação (segundos até o 1º salvamento) ──
    const tmosGeral = casos
      .map((e) => e.dadosCrm?.tmoSegundos ?? null)
      .filter((v): v is number => v != null);
    const tmoMedioGeral =
      tmosGeral.length > 0 ? Math.round(tmosGeral.reduce((s, v) => s + v, 0) / tmosGeral.length) : null;
    // Gargalo: motivo com maior TMO médio (entre os motivos do período)
    const tmoPorMotivo = new Map<string, { total: number; n: number }>();
    for (const e of casos) {
      const motivo = motivoDe(e);
      const tmo = e.dadosCrm?.tmoSegundos;
      if (!motivo || tmo == null) continue;
      const atual = tmoPorMotivo.get(motivo) ?? { total: 0, n: 0 };
      atual.total += tmo;
      atual.n += 1;
      tmoPorMotivo.set(motivo, atual);
    }
    const gargalo = [...tmoPorMotivo.entries()]
      .map(([nome, { total, n }]) => ({ nome, tmoMedio: Math.round(total / n) }))
      .sort((a, b) => b.tmoMedio - a.tmoMedio)[0] ?? null;

    const metricas = {
      periodo: { ano, mes, total: n },
      totalCasos: n,
      funilAtendimento: {
        apenasT1: { qtd: apenasT1.length, pct: pct(apenasT1.length) },
        t1MaisT2: { qtd: t1MaisT2.length, pct: pct(t1MaisT2.length) },
        naDiretoProcon: { qtd: naDiretoProcon.length, pct: pct(naDiretoProcon.length) },
      },
      cruzamentoRA: {
        comRA: { qtd: comRA.length, pct: pct(comRA.length) },
        semRA: { qtd: semRA.length, pct: pct(semRA.length) },
      },
      top5MotivosGeral: top5(casos),
      tmo: {
        medioGeralSegundos: tmoMedioGeral,
        casosComTmo: tmosGeral.length,
        gargalo: gargalo ? { motivo: gargalo.nome, tmoMedioSegundos: gargalo.tmoMedio } : null,
      },
      top5PorEtapa: {
        apenasT1: top5(apenasT1),
        t1MaisT2: top5(t1MaisT2),
        naDiretoProcon: top5(naDiretoProcon),
      },
    };

    // IA de insights — best-effort; falha não derruba o dashboard.
    let insightsGerados = '';
    try {
      insightsGerados = await generateInsights(metricas);
    } catch (err) {
      console.error('[dashboard:insights]', err);
    }

    return NextResponse.json({ ...metricas, insightsGerados });
  } catch (err) {
    console.error('[dashboard:GET]', err);
    return NextResponse.json({ error: 'Falha ao carregar o dashboard.' }, { status: 500 });
  }
}
