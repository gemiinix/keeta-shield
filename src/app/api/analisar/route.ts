import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

/**
 * POST /api/analisar
 *
 * Recebe { tipo: 'procon' | 'subsidio', conteudo: string } e devolve
 * JSON estruturado com:
 *   - resumoExecutivo: síntese da manifestação do consumidor
 *   - clausulaAplicavel: cláusula dos Termos e Condições que rege o caso
 *   - templateSugerido: minuta de resposta com variáveis {{VARIAVEL}}
 *
 * Modelo: gemini-2.5-flash (@google/genai oficial).
 * Requer GEMINI_API_KEY nas variáveis de ambiente.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { tipo?: string; conteudo?: string };

    const tipo = body.tipo === 'procon' || body.tipo === 'subsidio' ? body.tipo : null;
    const conteudo = body.conteudo?.trim();

    if (!tipo) {
      return NextResponse.json(
        { error: "Campo 'tipo' inválido — use 'procon' ou 'subsidio'." },
        { status: 400 }
      );
    }
    if (!conteudo || conteudo.length < 20) {
      return NextResponse.json(
        { error: 'Conteúdo ausente ou muito curto para análise (mín. 20 caracteres).' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY não configurada no servidor.' },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const systemPrompt = `Você é um analista jurídico sênior especializado em direito do consumidor (CDC), atuação em Procon e subsídios de plataformas de delivery.

Receberá a manifestação de um consumidor e deverá produzir um parecer técnico objetivo, EM PORTUGUÊS, retornando EXATAMENTE um objeto JSON válido (sem markdown, sem cercas de código) com esta forma:

{
  "resumoExecutivo": "síntese factual da manifestação em 2-4 frases: quem, o que pede, valor envolvido, data",
  "clausulaAplicavel": "identificação e citação textual (ou paráfrase fiel) da cláusula dos Termos e Condições de uso da plataforma de delivery aplicável ao caso, com o fundamento legal do CDC quando cabível",
  "templateSugerido": "minuta de resposta ao consumidor, pronta para edição, usando variáveis entre chaves duplas como {{NOME_CONSUMIDOR}}, {{NUMERO_PEDIDO}}, {{VALOR_REEMBOLSO}}, {{DATA_PROTOCOLO}}"
}

Regras:
- Seja preciso: não invente cláusulas nem valores que não constem no texto.
- Se a informação necessária não estiver presente, use a variável correspondente no template.
- Nunca inclua texto fora do JSON.`;

    const userPrompt = `TIPO DE MANIFESTAÇÃO: ${tipo === 'procon' ? 'Reclamação Procon' : 'Requisição de Subsídio'}

CONTEÚDO DA MANIFESTAÇÃO:
"""
${conteudo}
"""`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const raw = response.text ?? '';

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Defesa: tenta extrair o objeto JSON mesmo se vier cercado de texto
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('Resposta do modelo não é JSON válido.');
      parsed = JSON.parse(match[0]);
    }

    const { resumoExecutivo, clausulaAplicavel, templateSugerido } = parsed as {
      resumoExecutivo?: string;
      clausulaAplicavel?: string;
      templateSugerido?: string;
    };

    if (!resumoExecutivo || !clausulaAplicavel || !templateSugerido) {
      return NextResponse.json(
        { error: 'Resposta do modelo incompleta — faltam campos obrigatórios.' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      resumoExecutivo,
      clausulaAplicavel,
      templateSugerido,
    });
  } catch (err) {
    console.error('[analisar]', err);
    const message =
      err instanceof Error ? err.message : 'Erro inesperado na análise jurídica.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
