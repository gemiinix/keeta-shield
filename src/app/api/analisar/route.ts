import { NextRequest, NextResponse } from 'next/server';
import ensureCanvasPolyfills from '@/lib/canvas-polyfill';
import type { GenerateContentResponse } from '@google/genai';

/**
 * Chama o Gemini com retry automático, cadeia de fallback entre modelos e
 * rotação entre múltiplas chaves de API (todas gratuitas — o limite de uso é
 * por chave, então 2–3 chaves multiplicam a capacidade em horários de pico).
 *
 * Variáveis de ambiente:
 *   GEMINI_API_KEY     (obrigatória — a principal)
 *   GEMINI_API_KEY_2   (opcional — entra na rotação)
 *   GEMINI_API_KEY_3   (opcional — entra na rotação)
 */
const MODEL_CHAIN = ['gemini-3.6-flash', 'gemini-flash-latest'] as const;

function getApiKeys(): string[] {
  return [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_2, process.env.GEMINI_API_KEY_3].filter(
    (k): k is string => Boolean(k)
  );
}

async function generateWithRetry(
  userPrompt: string,
  systemPrompt: string
): Promise<GenerateContentResponse> {
  const keys = getApiKeys();
  const MAX_ATTEMPTS = 3;
  let lastError: unknown;

  for (const key of keys) {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: key });

    for (const model of MODEL_CHAIN) {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          return await ai.models.generateContent({
            model,
            contents: userPrompt,
            config: {
              systemInstruction: systemPrompt,
              responseMimeType: 'application/json',
              temperature: 0.2,
            },
          });
        } catch (err) {
          lastError = err;
          const msg = err instanceof Error ? err.message : String(err);
          const transient =
            /high demand|overloaded|429|503|RESOURCE_EXHAUSTED|UNAVAILABLE|rate limit|quota/i.test(msg);
          if (!transient) break; // erro não transitório: pula para o próximo modelo
          if (attempt === MAX_ATTEMPTS) break; // esgotou tentativas: próximo modelo
          // 2s → 4s (com jitter)
          const waitMs = 2000 * attempt + Math.random() * 1000;
          await new Promise((r) => setTimeout(r, waitMs));
        }
      }
    }
  }
  throw lastError;
}

/**
 * POST /api/analisar
 *
 * Corpo: JSON { tipo: 'procon' | 'subsidio', conteudo: string }
 *         — ou multipart/form-data { tipo, arquivos: File[] } (PDFs atendimento_cip_*)
 *
 * Devolve JSON estruturado com:
 *   - resumoExecutivo: síntese factual da manifestação do consumidor
 *   - clausulaAplicavel: cláusula dos T&C aplicável ao caso (CDC)
 *   - templateSugerido: minuta de resposta com variáveis {{VARIAVEL}}
 *
 * Modelo: gemini-3.6-flash (@google/genai oficial), com retry em picos de demanda.
 * Requer GEMINI_API_KEY nas variáveis de ambiente.
 *
 * Nota: @google/genai e pdf-parse são importados dinamicamente (lazy) dentro do
 * handler — evita crash no boot do módulo no runtime serverless (Vercel) e
 * garante que qualquer falha de import caia no try/catch com erro legível.
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') ?? '';

    let tipo: string | null = null;
    let conteudo = '';

    if (contentType.includes('multipart/form-data')) {
      // Fluxo Procon: PDFs enviados via FormData
      const formData = await req.formData();
      tipo = formData.get('tipo') === 'procon' ? 'procon' : null;
      const files = formData.getAll('arquivos') as File[];

      if (files.length === 0) {
        return NextResponse.json(
          { error: 'Nenhum arquivo recebido.' },
          { status: 400 }
        );
      }

      const invalid = files.filter(
        (f) => !f.name.toLowerCase().startsWith('atendimento_cip_')
      );
      if (invalid.length > 0) {
        return NextResponse.json(
          { error: `Nomenclatura inválida: ${invalid.map((f) => f.name).join(', ')}` },
          { status: 422 }
        );
      }

      // Extrai o texto de cada PDF no servidor
      // (polyfill de canvas ANTES do pdf-parse: pdfjs precisa de
      //  DOMMatrix/Path2D/ImageData mesmo para extração de texto)
      ensureCanvasPolyfills();
      const { PDFParse } = await import('pdf-parse');
      const textos: string[] = [];
      for (const f of files) {
        const buf = Buffer.from(await f.arrayBuffer());
        const parser = new PDFParse({ data: buf });
        try {
          const result = await parser.getText();
          textos.push(`--- ${f.name} ---\n${result.text ?? ''}`);
        } finally {
          await parser.destroy();
        }
      }
      conteudo = textos.join('\n\n').trim();
    } else {
      // Fluxo Subsídio: JSON com texto puro
      const body = (await req.json()) as { tipo?: string; conteudo?: string };
      tipo = body.tipo === 'procon' || body.tipo === 'subsidio' ? body.tipo : null;
      conteudo = body.conteudo?.trim() ?? '';
    }

    if (!tipo) {
      return NextResponse.json(
        { error: "Campo 'tipo' inválido — use 'procon' ou 'subsidio'." },
        { status: 400 }
      );
    }
    if (conteudo.length < 20) {
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

    const systemPrompt = `Você é um analista jurídico sênior da Keeta Delivery Brasil, especializado em direito do consumidor (CDC), Procon e subsídios de plataformas de delivery.

Sua tarefa: analisar a manifestação e devolver EXATAMENTE um objeto JSON válido (sem markdown, sem cercas de código, sem texto fora do JSON) com estas três chaves:

{
  "resumoExecutivo": "síntese factual da manifestação em 2-4 frases",
  "clausulaAplicavel": "parecer jurídico identificando quais cláusulas dos Termos e Condições da Keeta (Customer, Rider ou Merchant — a aplicável ao caso) amparam a Keeta quanto a reembolso, penalidade ou obrigação, citando ou parafraseando fielmente a cláusula, com fundamento do CDC quando cabível",
  "templateSugerido": "a minuta de resposta PREENCHIDA, seguindo EXATAMENTE o padrão abaixo"
}

### PADRÃO OBRIGATÓRIO DO templateSugerido (mantenha as seções e títulos na ordem exata):

RESUMO EXECUTIVO DO CASO – PROCON
Protocolo: <número se constar no documento, senão {{PROTOCOLO}}>
Prazo: <prazo de resposta se constar, senão {{PRAZO}}>
Nome: <nome do consumidor se constar, senão {{NOME_CONSUMIDOR}}>
ID do Pedido: <id se constar, senão {{ID_PEDIDO}}>
Nome Estabelecimento: <estabelecimento se constar, senão {{NOME_ESTABELECIMENTO}}>
Motivo: <motivo da reclamação em 1 frase>

CRONOLOGIA E HISTÓRICO DE TRATATIVAS

1. Fato Gerador e Atendimento Inicial

O Problema:
<resumo factual da reclamação do consumidor em 2-4 frases>

Análise:
<parecer com as cláusulas dos T&C da Keeta (Customer, Rider ou Merchant) que amparam a Keeta sobre reembolso, penalidade ou aplicabilidade, com fundamento CDC quando cabível>

2. Tratativa e Resolução

Atendimento Suporte:
<histórico de atendimento se constar no documento, senão {{ATENDIMENTO_SUPORTE}}>

Abertura no Reclame Aqui:
<data da abertura se constar, senão {{DATA_ABERTURA_RA}}>

STATUS ATUAL
<status atual do caso, ex.: Aguardando resposta da empresa em prazo legal>

### Regras de preenchimento:
- Se a informação constar no documento, PREENCHA o campo com o valor extraído (sem as chaves).
- Se NÃO constar, mantenha exatamente a variável entre chaves duplas, ex.: {{NOME_CONSUMIDOR}}.
- NUNCA invente números de protocolo, nomes, datas, IDs ou valores que não estejam no documento.
- A seção Análise é o parecer jurídico: cite cláusulas dos T&C da Keeta (Customer, Rider ou Merchant) que amparem a posição da Keeta sobre reembolso/penalidade, e o CDC aplicável.
- Nunca inclua texto fora do JSON.`;

    const userPrompt = `TIPO DE MANIFESTAÇÃO: ${
      tipo === 'procon' ? 'Reclamação Procon (manifestação fiscalizada, com prazo legal de resposta)' : 'Requisição de Subsídio'
    }

CONTEÚDO DA MANIFESTAÇÃO:
"""
${conteudo.slice(0, 30000)}
"""`;

    const response = await generateWithRetry(userPrompt, systemPrompt);

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

    // Erros da API do Google chegam como JSON serializado dentro da mensagem —
    // extraímos a parte legível para não mostrar sopa de JSON ao usuário.
    let message = err instanceof Error ? err.message : 'Erro inesperado na análise jurídica.';
    try {
      const nested = JSON.parse(message) as { error?: { message?: string } };
      if (nested.error?.message) message = nested.error.message;
    } catch {
      // mensagem já é texto legível — segue como está
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
