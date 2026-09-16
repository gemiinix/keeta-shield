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
