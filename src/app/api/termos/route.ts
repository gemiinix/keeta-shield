import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import ensureCanvasPolyfills from '@/lib/canvas-polyfill';

/**
 * API dos Termos e Condições da Keeta.
 *
 * GET    /api/termos            — lista os T&C carregados
 * POST   /api/termos            — multipart: { documento, versao?, arquivo (PDF) }
 *                                 extrai o texto e salva (substitui o anterior do mesmo documento)
 * DELETE /api/termos?id=1       — remove
 */
export async function GET() {
  try {
    const termos = await store.listTermos();
    return NextResponse.json({ termos });
  } catch (err) {
    console.error('[termos:list]', err);
    return NextResponse.json({ error: 'Falha ao listar termos.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const documento = String(formData.get('documento') ?? '').trim();
    const versao = String(formData.get('versao') ?? '').trim();
    const file = formData.get('arquivo') as File | null;

    if (!documento) {
      return NextResponse.json(
        { error: 'Campo "documento" obrigatório (ex.: Keeta Customer, Keeta Rider, Keeta Merchant).' },
        { status: 400 }
      );
    }
    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'Envie o PDF em "arquivo".' }, { status: 400 });
    }

    // Extrai o texto do PDF
    ensureCanvasPolyfills();
    const { PDFParse } = await import('pdf-parse');
    const buf = Buffer.from(await file.arrayBuffer());
    const parser = new PDFParse({ data: buf });
    let texto = '';
    try {
      const result = await parser.getText();
      texto = (result.text ?? '').trim();
    } finally {
      await parser.destroy();
    }

    if (texto.length < 100) {
      return NextResponse.json(
        { error: 'PDF com pouco texto — envie o PDF textual dos T&C, não imagem.' },
        { status: 422 }
      );
    }

    // Substitui a versão anterior do mesmo documento
    const existentes = await store.listTermos();
    const anterior = existentes.find((t) => t.documento === documento);
    if (anterior) {
      await store.deleteTermo(anterior.id);
    }

    const termo = await store.saveTermo({ documento, versao, conteudo: texto });
    return NextResponse.json({ termo, caracteres: texto.length });
  } catch (err) {
    console.error('[termos:upload]', err);
    return NextResponse.json({ error: 'Falha ao processar o PDF dos termos.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = Number(new URL(req.url).searchParams.get('id'));
    if (!id) {
      return NextResponse.json({ error: 'Parâmetro id obrigatório.' }, { status: 400 });
    }
    await store.deleteTermo(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[termos:delete]', err);
    return NextResponse.json({ error: 'Falha ao remover termo.' }, { status: 500 });
  }
}
