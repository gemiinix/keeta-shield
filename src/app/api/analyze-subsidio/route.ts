import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/analyze-subsidio
 *
 * Recebe JSON { requisicao: string } com a íntegra da requisição
 * de subsídio, extrai dados relevantes e devolve campos + template.
 *
 * ⚠️ PLACEHOLDER — integrar API do LLM aqui.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { requisicao?: string };

    const requisicao = body.requisicao?.trim();
    if (!requisicao || requisicao.length < 20) {
      return NextResponse.json(
        { error: 'Requisição ausente ou muito curta para análise.' },
        { status: 400 }
      );
    }

    // TODO: integração LLM — pseudocódigo do fluxo futuro:
    //   1. const extracted = await llm.extractSubsidioFields(requisicao);
    //   2. const templateText = await templateRepo.getDefault('subsidio');
    //   3. return { extracted, templateText };

    return NextResponse.json({
      extracted: {},
      templateText: '',
      message: 'Endpoint operacional. Integração de LLM pendente.',
    });
  } catch (err) {
    console.error('[analyze-subsidio]', err);
    return NextResponse.json(
      { error: 'Erro interno ao processar a análise.' },
      { status: 500 }
    );
  }
}
