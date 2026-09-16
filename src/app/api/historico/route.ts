import { NextResponse } from 'next/server';
import { store } from '@/lib/store';

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
