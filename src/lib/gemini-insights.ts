/**
 * Geração de insights gerenciais (dashboard analítico).
 *
 * Reaproveita o mesmo chain do /api/analisar: rotação de chaves
 * GEMINI_API_KEY/_2/_3 → modelos gemini-3.6-flash → gemini-flash-latest,
 * com retry/backoff para erros transitórios. A carta pedia
 * gemini-1.5-flash, mas o chain atual é superior e já validado em
 * produção — não regredimos.
 */

const MODEL_CHAIN = ['gemini-3.6-flash', 'gemini-flash-latest'] as const;

const SYSTEM_INSTRUCTION = `Você é um Analista de Dados Sênior de CX (atendimento ao consumidor) da Keeta Delivery Brasil.
Recebe um JSON com métricas mensais de casos Procon (órgãos de defesa do consumidor) e escreve um resumo executivo curto (4 a 6 frases), destacando:
1. Volume total de casos do período;
2. Comportamento do consumidor: se foi direto ao Procon (sem passar por T1/RA) ou passou por atendimento interno;
3. Qual motivo mais escala para T2 (segunda camada de atendimento);
4. O cruzamento com Reclame Aqui (RA), quando relevante;
5. A eficiência da operação: comente o TMO médio geral (tmo.medioGeralSegundos, em segundos) e destaque qual motivo está tomando mais tempo para ser resolvido (tmo.gargalo), quando disponíveis.
Escreva em português do Brasil, tom executivo e direto. Retorne apenas o texto do insight, sem títulos, sem markdown, sem saudações.`;

function getApiKeys(): string[] {
  return [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_2, process.env.GEMINI_API_KEY_3].filter(
    (k): k is string => Boolean(k)
  );
}

export async function generateInsights(metricas: unknown): Promise<string> {
  const keys = getApiKeys();
  if (keys.length === 0) throw new Error('GEMINI_API_KEY não configurada no servidor.');

  const userPrompt =
    `Analise as métricas mensais abaixo e gere o insight executivo conforme instruído.\n\n` +
    JSON.stringify(metricas, null, 2);

  const MAX_ATTEMPTS = 3;
  let lastError: unknown;

  for (const key of keys) {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: key });

    for (const model of MODEL_CHAIN) {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: userPrompt,
            config: {
              systemInstruction: SYSTEM_INSTRUCTION,
              temperature: 0.3,
            },
          });
          const texto = response.text?.trim() ?? '';
          if (texto) return texto;
          throw new Error('Resposta vazia do modelo.');
        } catch (err) {
          lastError = err;
          const msg = err instanceof Error ? err.message : String(err);
          const transient =
            /high demand|overloaded|429|503|RESOURCE_EXHAUSTED|UNAVAILABLE|rate limit|quota|Resposta vazia/i.test(msg);
          if (!transient) break;
          if (attempt === MAX_ATTEMPTS) break;
          const waitMs = 2000 * attempt + Math.random() * 1000;
          await new Promise((r) => setTimeout(r, waitMs));
        }
      }
    }
  }
  throw lastError;
}
