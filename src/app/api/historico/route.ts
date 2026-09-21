import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import type { CrmSnapshot } from '@/lib/types';

/** GET /api/historico — lista as análises recentes (mais novas primeiro). */
export async function GET() {
  try {
    const entries = await store.listHistorico(100);
    return NextResponse.json({ entries });
  } catch (err) {
    console.error('[historico:list]', err);
    return NextResponse.json({ error: 'Falha ao listar histórico.' }, { status: 500 });
  }
}

/**
 * PUT /api/historico — salva/atualiza o snapshot do Formulário de CRM
 * de um caso. Body: { id: number, snapshot: CrmSnapshot } (completo)
 *                         | { id: number, patch: Partial<CrmSnapshot> } (parcial).
 *
 * O modo `patch` faz merge com o snapshot atual no banco — usado para
 * persistir TMO acumulado ao sair do caso e a minuta editada, sem risco
 * de sobrescrever campos salvos por outro caminho (formulário ↔ editor).
 */
export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as {
      id?: number;
      snapshot?: CrmSnapshot;
      patch?: Partial<CrmSnapshot>;
    };
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: 'Envie { id, snapshot } válidos.' }, { status: 400 });
    }
    if (body.patch) {
      const atual = (await store.getCrmSnapshot(id)) ?? {};
      await store.saveCrmSnapshot(id, {
        ...atual,
        ...body.patch,
        atualizadoEm: new Date().toISOString(),
      });
      return NextResponse.json({ ok: true });
    }
    if (!body.snapshot || typeof body.snapshot !== 'object') {
      return NextResponse.json({ error: 'Envie { id, snapshot } válidos.' }, { status: 400 });
    }
    // ── Defesa contra perda de dados do formulário (dadosFormulario) ──
    // Um snapshot "completo" construído de estado em memória pode estar
    // desatualizado/parcial (ex.: sem dadosIA/prazoDefesa/campos). Nesses
    // casos preservamos o que já está salvo no banco — o snapshot recebido
    // só pode APAGAR os campos que ele próprio carrega explicitamente.
    // Isso garante que o formulário (dadosFormulario) nunca seja zerado
    // por um caminho de salvamento que não o conheça.
    const atual = (await store.getCrmSnapshot(id)) ?? {};
    const snapshotFinal: CrmSnapshot = {
      ...body.snapshot,
      dadosIA: body.snapshot.dadosIA ?? atual.dadosIA,
      prazoDefesa:
        body.snapshot.prazoDefesa !== undefined
          ? body.snapshot.prazoDefesa
          : atual.prazoDefesa,
      campos: body.snapshot.campos ?? atual.campos,
    };
    await store.saveCrmSnapshot(id, snapshotFinal);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[historico:putCrm]', err);
    return NextResponse.json({ error: 'Falha ao salvar formulário do caso.' }, { status: 500 });
  }
}

/**
 * DELETE /api/historico — remove registros do histórico.
 * - ?id=123          → exclusão individual
 * - ?ids=1,2,3       → exclusão em massa (lote)
 * - ?all=true        → limpa todo o histórico
 * Responde { removidos: n } com a contagem de registros apagados.
 */
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const idParam = searchParams.get('id');
    if (idParam !== null) {
      const id = Number(idParam);
      if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json({ error: 'Parâmetro "id" inválido.' }, { status: 400 });
      }
      await store.deleteHistorico(id);
      return NextResponse.json({ removidos: 1 });
    }

    const idsParam = searchParams.get('ids');
    if (idsParam !== null) {
      const ids = idsParam
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n > 0);
      if (ids.length === 0) {
        return NextResponse.json({ error: 'Parâmetro "ids" não contém ids válidos.' }, { status: 400 });
      }
      const removidos = await store.deleteHistoricoBulk(ids);
      return NextResponse.json({ removidos });
    }

    if (searchParams.get('all') === 'true') {
      const removidos = await store.clearHistorico();
      return NextResponse.json({ removidos });
    }

    return NextResponse.json(
      { error: 'Informe ?id=, ?ids=1,2,3 ou ?all=true.' },
      { status: 400 }
    );
  } catch (err) {
    console.error('[historico:delete]', err);
    return NextResponse.json({ error: 'Falha ao remover do histórico.' }, { status: 500 });
  }
}
