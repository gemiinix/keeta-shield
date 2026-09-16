import { NextRequest, NextResponse } from 'next/server';
import ensureCanvasPolyfills from '@/lib/canvas-polyfill';
import type { GenerateContentResponse } from '@google/genai';
import { store } from '@/lib/store';
import type { TipoAnalise } from '@/lib/types';
import { calculateKeetaBusinessDeadline, isoParaBR } from '@/lib/prazo';

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

    // ── Cache: se já analisamos este conteúdo (mesmo hash), reaproveita ──
    // o sistema "aprende com si mesmo" sem repetir requisições ao Gemini.
    const { default: crypto } = await import('node:crypto');
    const conteudoHash = crypto.createHash('sha256').update(`${tipo}:${conteudo}`).digest('hex');
    const cached = await store.getHistoricoByHash(conteudoHash);
    if (cached) {
      return NextResponse.json(
        {
          resumoExecutivo: cached.resumo,
          clausulaAplicavel: cached.clausula,
          templateSugerido: cached.templateGerado,
          cache: true,
        },
        { status: 200 }
      );
    }

    // ── T&C da Keeta carregados — base factual para a seção Análise ──
    const termos = await store.listTermos();
    const termosBloco =
      termos.length > 0
        ? `\n\n### TERMOS E CONDIÇÕES OFICIAIS DA KEETA (texto extraído dos PDFs vigentes — cite cláusulas destes textos, na letra, quando aplicáveis):\n${termos
            .map((t) => `--- ${t.documento}${t.versao ? ` (versão ${t.versao})` : ''} ---\n${t.conteudo.slice(0, 15000)}`)
            .join('\n\n')}`
        : '';

    // ── systemInstruction bifurcado: Procon e Subsídio são ofícios diferentes ──
    // Mesmo contrato de saída (resumoExecutivo/clausulaAplicavel/templateSugerido)
    // para frontend, cache e histórico — mas o papel e o foco mudam por fluxo.
    const REGRAS_SAIDA = `
### Regras de preenchimento:
- Se a informação constar no documento, PREENCHA o campo com o valor extraído (sem as chaves).
- Se NÃO constar, mantenha exatamente a variável entre chaves duplas, ex.: {{NOME_CONSUMIDOR}}.
- NUNCA invente números de protocolo, nomes, datas, IDs ou valores que não estejam no documento.
- Nunca inclua texto fora do JSON.`;

    const CONTRATO_JSON = `Você deve devolver EXATAMENTE um objeto JSON válido (sem markdown, sem cercas de código, sem texto fora do JSON) com estas chaves:

{
  "resumoExecutivo": "...",
  "clausulaAplicavel": "...",
  "templateSugerido": "...",
  "dataAbertura": "DD/MM/YYYY"
}`;

    const PROCON_REGRAS = `### Regras do campo dataAbertura:
- Procure no cabeçalho a data de abertura, geralmente no formato "Cidade, DD/MM/YYYY" (ex.: "São Paulo, 09/09/2026") — extraia apenas "09/09/2026".
- Procure também em campos como "Data da Abertura", "Data de Recebimento", "Registrado em", datas de assinatura ou protocolo.
- Se houver múltiplas datas, use a mais antiga associada à abertura/registro da manifestação.
- Se NÃO houver data alguma no documento, devolva "" (string vazia). NUNCA invente uma data.`;

    const systemPrompt =
      tipo === 'procon'
        ? `Você é um especialista em CX e análise de Procon para a Keeta Delivery Brasil. Sua função é analisar notificações e reclamações de consumidores fiscalizadas pelo Procon (com prazo legal de resposta).

Foco de cada campo:
- "resumoExecutivo": a queixa do consumidor e o pedido principal, em 2-4 frases factuais.
- "clausulaAplicavel": os T&Cs de uso do app, atrasos de entrega, estornos/reembolsos ou responsabilidade do restaurante/estabelecimento que amparam a posição da Keeta, com fundamento do CDC quando cabível.
- "templateSugerido": minuta de defesa Procon, seguindo EXATAMENTE o padrão abaixo.
- "dataAbertura": a data de abertura da manifestação (regras abaixo).

${CONTRATO_JSON}

${PROCON_REGRAS}

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
<parecer com as cláusulas dos T&C da Keeta que amparam a Keeta sobre reembolso, penalidade ou aplicabilidade, com fundamento CDC quando cabível>

2. Tratativa e Resolução

Atendimento Suporte:
<histórico de atendimento se constar no documento, senão {{ATENDIMENTO_SUPORTE}}>

Abertura no Reclame Aqui:
<data da abertura se constar, senão {{DATA_ABERTURA_RA}}>

STATUS ATUAL
<status atual do caso, ex.: Aguardando resposta da empresa em prazo legal>
${REGRAS_SAIDA}`
        : `Você é o Motor de Extração de Dados Rigoroso do fluxo de Subsídio da Keeta Delivery Brasil. O usuário vai te enviar e-mails, ofícios ou documentos jurídicos em "juridiquês" — seu objetivo NÃO é justificar com T&Cs, e sim atuar como parser rigoroso que traduz o documento num checklist acionável para o time de operação.

Instruções:

1. IDENTIFIQUE A ENTIDADE-ALVO: nome, identificador (CPF/CNPJ/Nº do pedido/ID de entregador) e o status atual desejado (ex.: reativação de cadastro).

2. EXTRAIA OS DADOS REQUISITADOS: identifique rigorosamente TODOS os pontos de dados pedidos individualmente (ex.: histórico de infrações, rendimentos detalhados, motivos de penalidade). Se o ofício usar lista numerada, extraia cada item como item separado do checklist.

3. IDENTIFIJE PRAZOS E AÇÕES CRÍTICAS: procure datas, pedidos legais específicos (liminares, reativações) e pessoas envolvidas.

Foco de cada campo:
- "resumoExecutivo": as informações da entidade-alvo — nome, identificador e status desejado — mais uma síntese do que é pedido, em 2-4 frases.
- "clausulaAplicavel": o CHECKLIST acionável — lista numerada de TODOS os dados a extrair, prazos/liminares identificados e ações necessárias. Justificação por T&Cs/LGPD fica em UMA única frase breve ao final (não é o foco).
- "templateSugerido": minuta de resposta jurídica/subsídio, seguindo EXATAMENTE o padrão abaixo.

${CONTRATO_JSON}

### PADRÃO OBRIGATÓRIO DO templateSugerido (mantenha as seções e títulos na ordem exata):

RESUMO EXECUTIVO DO CASO – REQUISIÇÃO DE SUBSÍDIO
Protocolo/Processo: <número se constar no documento, senão {{PROTOCOLO}}>
Prazo: <prazo de resposta se constar, senão {{PRAZO}}>
Solicitante: <advogado/órgão/juízo se constar, senão {{SOLICITANTE}}>
Referência: <ID do pedido/entregador/estabelecimento citado, se constar, senão {{REFERENCIA}}>
Objeto: <o que foi requisitado, em 1 frase>

DADOS SOLICITADOS
<lista numerada dos dados/documents requisitados, traduzidos do juridiquês>

ENTIDADE-ALVO
Nome: <nome se constar, senão {{NOME_ENTIDADE}}>
Identificador: <CPF/CNPJ/pedido/ID se constar, senão {{IDENTIFICADOR}}>
Status desejado: <ex.: reativação, se aplicável, senão {{STATUS_DESEJADO}}>

PRAZOS E AÇÕES CRÍTICAS
<datas, liminares e responsáveis identificados; senão {{PRAZOS_ACOES}}>

ANÁLISE E FUNDAMENTOS
<uma frase breve com o fundamento legal/T&C aplicável — NÃO é o foco>

STATUS ATUAL
<status atual, ex.: Aguardando compilação dos dados pela operação>
${REGRAS_SAIDA}`;

    const userPrompt = `TIPO DE MANIFESTAÇÃO: ${
      tipo === 'procon'
        ? 'Reclamação Procon (manifestação fiscalizada, com prazo legal de resposta)'
        : 'Requisição de Subsídio (ofício judicial ou extrajudicial)'
    }

CONTEÚDO DA MANIFESTAÇÃO:
"""
${conteudo.slice(0, 30000)}
"""${termosBloco}`;

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

    const { resumoExecutivo, clausulaAplicavel, templateSugerido, dataAbertura } = parsed as {
      resumoExecutivo?: string;
      clausulaAplicavel?: string;
      templateSugerido?: string;
      dataAbertura?: string;
    };

    // ── Prazo de defesa: cálculo determinístico no servidor ──
    // 10 dias corridos da abertura; caindo em fim de semana/feriado nacional,
    // posterga p/ o próximo dia útil. Nunca delegamos aritmética de datas ao LLM.
    let prazoDefesa: ReturnType<typeof calculateKeetaBusinessDeadline> | null = null;
    if (tipo === 'procon' && dataAbertura) {
      try {
        prazoDefesa = calculateKeetaBusinessDeadline(dataAbertura);
      } catch (pErr) {
        console.error('[analisar:prazo]', pErr);
      }
    }

    // Preenche o campo Prazo do template com a data final calculada
    let templateFinal = templateSugerido ?? '';
    if (prazoDefesa && templateSugerido) {
      templateFinal = templateSugerido.replace(
        /^(Prazo:\s*)\{\{PRAZO\}\}$/m,
        `$1${isoParaBR(prazoDefesa.deadlineFinalISO)} (10 dias corridos da abertura, ajustado p/ dia útil)`
      );
    }

    if (!resumoExecutivo || !clausulaAplicavel || !templateFinal) {
      return NextResponse.json(
        { error: 'Resposta do modelo incompleta — faltam campos obrigatórios.' },
        { status: 502 }
      );
    }

    // Grava no histórico — alimenta o cache (hash) e a página Histórico.
    // Falha ao gravar NUNCA derruba a análise (best-effort).
    try {
      await store.saveHistorico({
        tipo: tipo as TipoAnalise,
        origem: req.headers.get('content-type')?.includes('multipart/form-data') ? 'pdf' : 'texto',
        resumo: resumoExecutivo,
        clausula: clausulaAplicavel,
        templateGerado: templateFinal,
        conteudoHash,
      });
    } catch (dbErr) {
      console.error('[analisar:saveHistorico]', dbErr);
    }

    const resposta: Record<string, unknown> = {
      resumoExecutivo,
      clausulaAplicavel,
      templateSugerido: templateFinal,
    };
    if (prazoDefesa) {
      resposta.dataAbertura = dataAbertura;
      resposta.prazoDefesa = prazoDefesa;
    }

    return NextResponse.json(resposta);
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
