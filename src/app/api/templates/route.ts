import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';

/** GET /api/templates — lista todos os templates. */
export async function GET() {
  try {
    const templates = await store.listTemplates();
    return NextResponse.json({ templates });
  } catch (err) {
    console.error('[templates:list]', err);
    return NextResponse.json({ error: 'Falha ao listar templates.' }, { status: 500 });
  }
}

/** POST /api/templates — cria ou atualiza um template. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      id?: number;
      nome?: string;
      conteudo?: string;
      padrao?: boolean;
    };

    if (!body.nome?.trim() || !body.conteudo?.trim()) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: nome e conteudo.' },
        { status: 400 }
      );
    }

    const t = await store.saveTemplate({
      id: body.id,
      nome: body.nome.trim(),
      conteudo: body.conteudo,
      padrao: Boolean(body.padrao),
    });
    return NextResponse.json({ template: t });
  } catch (err) {
    console.error('[templates:save]', err);
    return NextResponse.json({ error: 'Falha ao salvar template.' }, { status: 500 });
  }
}

/** DELETE /api/templates?id=1 — remove um template. */
export async function DELETE(req: NextRequest) {
  try {
    const id = Number(new URL(req.url).searchParams.get('id'));
    if (!id) {
      return NextResponse.json({ error: 'Parâmetro id obrigatório.' }, { status: 400 });
    }
    await store.deleteTemplate(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[templates:delete]', err);
    return NextResponse.json({ error: 'Falha ao remover template.' }, { status: 500 });
  }
}
