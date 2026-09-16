import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/analyze-procon
 *
 * Recebe FormData com um ou mais PDFs (atendimento_cip_*.pdf),
 * extrai dados da requisição Procon e devolve os campos + template.
 *
 * ⚠️ PLACEHOLDER — integrar API do LLM aqui.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum arquivo recebido.' },
        { status: 400 }
      );
    }

    // Validação de nomenclatura (defesa no backend)
    const invalid = files.filter(
      (f) => !f.name.toLowerCase().startsWith('atendimento_cip_')
    );
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Arquivos com nomenclatura inválida: ${invalid.map((f) => f.name).join(', ')}` },
        { status: 422 }
      );
    }

    // TODO: integração LLM — pseudocódigo do fluxo futuro:
    //   1. const texts = await Promise.all(files.map(extractPdfText));
    //   2. const extracted = await llm.extractProconFields(texts);
    //   3. const templateText = await templateRepo.getDefault('procon');
    //   4. return { extracted, templateText };

    return NextResponse.json({
      extracted: {},
      templateText: '',
      message: 'Endpoint operacional. Integração de LLM pendente.',
    });
  } catch (err) {
    console.error('[analyze-procon]', err);
    return NextResponse.json(
      { error: 'Erro interno ao processar a análise.' },
      { status: 500 }
    );
  }
}
