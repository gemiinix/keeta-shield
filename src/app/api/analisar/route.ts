import { NextRequest, NextResponse } from 'next/server';
import ensureCanvasPolyfills from '@/lib/canvas-polyfill';
import type { GenerateContentResponse } from '@google/genai';
import { store } from '@/lib/store';
import type { TipoAnalise, CrmSnapshot } from '@/lib/types';
import { calculateKeetaBusinessDeadline, isoParaBR } from '@/lib/prazo';
import { MOTIVOS_PROCON } from '@/constants/motivos';

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

/** Versão do prompt de análise — incrementar a cada mudança de comportamento
 *  da IA invalida o cache de análises antigas (o hash inclui este valor). */
const PROMPT_VERSION = 'v5';

/** Dados estruturados extraídos pela IA para o formulário de CRM (Procon). */
type DadosFormulario = {
  cipProcon: string;
  numeroPedido: string;
  mcdonalds: boolean;
  motivoClassificado: string;
};

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
 *         — ou multipart/form-data:
 *           • Procon:   { tipo, arquivos: File[] } (PDFs atendimento_cip_*)
 *           • Subsídio: { tipo, conteudo: texto manual, file: PDF do processo }
 *             (texto e/ou PDF — o backend cruza as duas fontes quando ambas
 *              existem; nenhuma é obrigatoriamente exclusiva)
 *
 * Devolve JSON estruturado com:
 *   - resumoExecutivo: síntese factual da manifestação/conteúdo
 *   - clausulaAplicavel: cláusula dos T&C aplicável (Procon) ou checklist
 *     acionável (Subsídio)
 *   - templateSugerido: minuta de resposta com variáveis {{VARIAVEL}}
 *   - minutaSugerida (Subsídio): minuta de resposta completa baseada no
 *     cruzamento entre a solicitação do advogado e o documento do processo
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
    let origem: 'pdf' | 'texto' = 'texto';

    if (contentType.includes('multipart/form-data')) {
      // FormData unificado — Procon (PDFs atendimento_cip_*) OU Subsídio
      // (texto manual + PDF do processo judicial; qualquer um ou ambos).
      // A presença de arquivo NÃO significa mais "caso Procon": o campo
      // 'tipo' é quem decide o fluxo.
      const formData = await req.formData();
      const tipoBruto = String(formData.get('tipo') ?? '');
      tipo = tipoBruto === 'procon' || tipoBruto === 'subsidio' ? tipoBruto : null;

      // ── Extração unificada: arquivo(s) se houver + texto manual se houver ──
      // Aceita tanto 'arquivos' (Procon, múltiplo) quanto 'file' (Subsídio,
      // singular) — o fluxo é decidido pelo 'tipo', não pelo nome do campo.
      const files = [
        ...(formData.getAll('arquivos') as File[]),
        ...(formData.getAll('file') as File[]),
      ].filter((f): f is File => f instanceof File && f.size > 0);
      const textoManual = String(formData.get('conteudo') ?? '').trim();

      if (tipo === 'procon') {
      // Validações exclusivas do fluxo Procon (nomenclatura obrigatória)
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
      } // fim das validações Procon

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
      const textoDoPdf = textos.join('\n\n').trim();

      if (tipo === 'subsidio') {
        // Subsídio: cruzamento das duas fontes (texto manual + PDF do
        // processo). Nenhuma é obrigatória — mas pelo menos uma deve existir.
        if (!textoManual && !textoDoPdf) {
          return NextResponse.json(
            { error: 'Envie o texto da solicitação e/ou o PDF do processo judicial.' },
            { status: 400 }
          );
        }
        conteudo = `--- SOLICITAÇÃO DO ADVOGADO / TIME JURÍDICO ---\n${
          textoManual || 'Não informado'
        }\n\n--- DOCUMENTO DO PROCESSO ANEXO ---\n${textoDoPdf || 'Sem anexo'}`;
        origem = textoDoPdf ? 'pdf' : 'texto';
      } else {
        // Procon: conteúdo é o texto extraído dos PDFs de atendimento
        conteudo = textoDoPdf;
        origem = 'pdf';
      }
    } else {
      // Fluxo texto puro (JSON) — Subsídio textual ou Procon colado
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
    // Subsídio multipart sempre passa pelo mínimo (os marcadores de seção
    // garantem comprimento); a exigência real de conteúdo foi validada acima,
    // por fonte. JSON puro e Procon continuam com o mínimo de 20 caracteres.
    const minimoConteudo = tipo === 'subsidio' && origem === 'pdf' ? 0 : 20;
    if (conteudo.length < minimoConteudo) {
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
    // O hash inclui a versão do prompt e a assinatura dos T&C — melhorar a
    // engenharia invalida o cache velho automaticamente.
    const { default: crypto } = await import('node:crypto');
    const termosParaHash = await store.listTermos();
    const assinaturaTermos = termosParaHash
      .map((t) => `${t.documento}:${t.versao}:${t.conteudo.length}`)
      .sort()
      .join('|');
    const conteudoHash = crypto
      .createHash('sha256')
      .update(`${tipo}:${PROMPT_VERSION}:${assinaturaTermos}:${conteudo}`)
      .digest('hex');
    const cached = await store.getHistoricoByHash(conteudoHash);
    if (cached) {
      // Cache-hit devolve o contrato COMPLETO: além das três chaves clássicas,
      // recompõe prazoDefesa/dadosFormulario (sempre presentes em Procon v4+)
      // e o formulário salvo — assim a reanálise reabre o CRM como se fresh.
      const cacheResp: Record<string, unknown> = {
        resumoExecutivo: cached.resumo,
        clausulaAplicavel: cached.clausula,
        templateSugerido: cached.templateGerado,
        // minutaSugerida persistida junto ao caso (snapshot) — o cache-hit
        // devolve o contrato completo também para o fluxo Subsídio.
        minutaSugerida: cached.dadosCrm?.minutaSugerida ?? cached.templateGerado,
        cache: true,
        casoId: cached.id,
      };
      const snap = cached.dadosCrm;
      if (snap?.prazoDefesa) cacheResp.prazoDefesa = snap.prazoDefesa;
      if (snap?.dadosIA) cacheResp.dadosFormulario = snap.dadosIA;
      if (snap) cacheResp.dadosCrm = snap;
      return NextResponse.json(cacheResp, { status: 200 });
    }
    // ── T&C da Keeta carregados — base factual para a seção Análise ──
    const termos = termosParaHash;
    const termosBloco =
      termos.length > 0
        ? `\n\n### BASE DE CONHECIMENTO OFICIAL — TERMOS E CONDIÇÕES DA KEETA (texto vigente extraído dos PDFs):\n${termos
            .map((t) => `--- ${t.documento}${t.versao ? ` (versão ${t.versao})` : ''} ---\n${t.conteudo.slice(0, 15000)}`)
            .join('\n\n')}\n\n### DIRECTIVA DE CROSS-REFERENCE CLAUSE MATCHING (obrigatória):\n- Sua análise de cláusulas deve se apoiar ESTRITAMENTE na BASE DE CONHECIMENTO OFICIAL acima — não em conhecimento genérico sobre plataformas de delivery.\n- Quando o assunto envolver REEMBOLSO, ESTORNO, CANCELAMENTO ou DEVOLUÇÃO, você DEVE procurar na base as regras de CANCELAMENTO/ESTORNO aplicáveis e citá-las (número da cláusula e/ou trecho na letra) antes de concluir qualquer parecer.\n- Se a base não contiver regra aplicável ao tema, declare explicitamente que não localizou cláusula específica na base vigente — NUNCA invente cláusula.`
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

    const CONTRATO_JSON_PROCON = `Você deve devolver EXATAMENTE um objeto JSON válido (sem markdown, sem cercas de código, sem texto fora do JSON) com estas chaves:

{
  "resumoExecutivo": "...",
  "clausulaAplicavel": "...",
  "templateSugerido": "...",
  "dataAbertura": "DD/MM/YYYY",
  "dadosFormulario": {
    "cipProcon": "...",
    "numeroPedido": "...",
    "mcdonalds": false,
    "motivoClassificado": "..."
  }
}`;

    const CONTRATO_JSON = `Você deve devolver EXATAMENTE um objeto JSON válido (sem markdown, sem cercas de código, sem texto fora do JSON) com estas chaves:

{
  "resumoExecutivo": "...",
  "clausulaAplicavel": "...",
  "templateSugerido": "...",
  "minutaSugerida": "Write a comprehensive draft response (minuta) based on the facts found in the lawsuit document that directly answers the lawyer's request."
}`;

    const PROCON_REGRAS = `### Regras do campo dataAbertura:
- Procure no cabeçalho a data de abertura, geralmente no formato "Cidade, DD/MM/YYYY" (ex.: "São Paulo, 09/09/2026") — extraia apenas "09/09/2026".
- Procure também em campos como "Data da Abertura", "Data de Recebimento", "Registrado em", datas de assinatura ou protocolo.
- Se houver múltiplas datas, use a mais antiga associada à abertura/registro da manifestação.
- Se NÃO houver data alguma no documento, devolva "" (string vazia). NUNCA invente uma data.

### Regras do campo dadosFormulario:
- "cipProcon": o número do protocolo/CIP Procon (do campo "Protocolo", "CIP" ou equivalente; pode ser também o número presente no padrão atendimento_cip_NNNN de identificadores do documento). Se não constar, "".
- "numeroPedido": o número do pedido mencionado no caso. Se não constar, "".
- "mcdonalds": booleano — true somente se "McDonalds" ou "Mc Donalds" for mencionado no texto.
- "motivoClassificado": uma das strings EXATAS da lista de motivos oficiais (injetada abaixo) que melhor descreve a reclamação central. Se nenhuma se aplicar, use "".`;

    const systemPrompt =
      tipo === 'procon'
        ? `Você é um especialista em CX e análise de Procon para a Keeta Delivery Brasil. Sua função é analisar notificações e reclamações de consumidores fiscalizadas pelo Procon (com prazo legal de resposta).

Foco de cada campo:
- "resumoExecutivo": a queixa do consumidor e o pedido principal, em 2-4 frases factuais.
- "clausulaAplicavel": os T&Cs de uso do app, atrasos de entrega, estornos/reembolsos ou responsabilidade do restaurante/estabelecimento que amparam a posição da Keeta, com fundamento do CDC quando cabível.
- "templateSugerido": minuta de defesa Procon, seguindo EXATAMENTE o padrão abaixo.
- "dataAbertura": a data de abertura da manifestação (regras abaixo).
- "dadosFormulario": dados estruturados do caso para o formulário de CRM (regras abaixo).

${CONTRATO_JSON_PROCON}

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

### LISTA OFICIAL DE MOTIVOS (para "motivoClassificado" — use a string EXATA, sem traduzir/reformular):
${MOTIVOS_PROCON.map((m) => `- ${m}`).join('\n')}
${REGRAS_SAIDA}`
        : `Você é o Motor de Extração de Dados Rigoroso do fluxo de Subsídio da Keeta Delivery Brasil. O usuário vai te enviar e-mails, ofícios ou documentos jurídicos em "juridiquês" — seu objetivo NÃO é justificar com T&Cs, e sim atuar como parser rigoroso que traduz o documento num checklist acionável para o time de operação.

Instruções:

1. IDENTIFIQUE A ENTIDADE-ALVO: nome, identificador (CPF/CNPJ/Nº do pedido/ID de entregador) e o status atual desejado (ex.: reativação de cadastro).

2. EXTRAIA OS DADOS REQUISITADOS: identifique rigorosamente TODOS os pontos de dados pedidos individualmente (ex.: histórico de infrações, rendimentos detalhados, motivos de penalidade). Se o ofício usar lista numerada, extraia cada item como item separado do checklist.

3. IDENTIFIJE PRAZOS E AÇÕES CRÍTICAS: procure datas, pedidos legais específicos (liminares, reativações) e pessoas envolvidas.

4. CONTEXT CROSS-REFERENCING: You will receive two inputs: a direct request from a lawyer (SOLICITAÇÃO) and the raw lawsuit document (DOCUMENTO DO PROCESSO). You must read BOTH. Use the 'SOLICITAÇÃO' to understand exactly what the legal team needs you to extract or answer. Use the 'DOCUMENTO DO PROCESSO' to find the factual context, dates, and values to build a highly accurate, case-specific summary and action checklist. When only one input is present (the other shows 'Não informado' or 'Sem anexo'), work with what you have and note the absence explicitly.

Foco de cada campo:
- "resumoExecutivo": as informações da entidade-alvo — nome, identificador e status desejado — mais uma síntese do que é pedido, em 2-4 frases.
- "clausulaAplicavel": o CHECKLIST acionável — lista numerada de TODOS os dados a extrair, prazos/liminares identificados e ações necessárias. Justificação por T&Cs/LGPD fica em UMA única frase breve ao final (não é o foco).
- "templateSugerido": minuta de resposta jurídica/subsídio, seguindo EXATAMENTE o padrão abaixo.
- "minutaSugerida": minuta COMPLETA de resposta ao ofício — redigida em português jurídico formal, respondendo ponto a ponto o que o advogado solicitou na SOLICITAÇÃO, com os fatos, datas, identificadores e valores encontrados no DOCUMENTO DO PROCESSO. Onde um dado não estiver disponível nos autos, use {{VARIAVEL}}. Estrutura sugerida: endereçamento ao juízo/advogado, qualificação do processo, resposta item a item, conclusão e data/assinatura.

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
        : tipo === 'subsidio' && origem === 'pdf'
          ? 'Requisição de Subsídio (solicitação do advogado + documento do processo — as duas fontes vêm marcadas abaixo)'
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

    const { resumoExecutivo, clausulaAplicavel, templateSugerido, minutaSugerida, dataAbertura, dadosFormulario } =
      parsed as {
        resumoExecutivo?: string;
        clausulaAplicavel?: string;
        templateSugerido?: string;
        minutaSugerida?: string;
        dataAbertura?: string;
        dadosFormulario?: {
          cipProcon?: string;
          numeroPedido?: string;
          mcdonalds?: boolean;
          motivoClassificado?: string;
        };
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

    // ── dadosFormulario: extração estruturada para o CRM (apenas Procon) ──
    // Tolerante a ausência: campos vazios se o modelo não preencheu — o
    // formulário no front continua utilizável com preenchimento manual.
    const dadosForm: DadosFormulario | null =
      tipo === 'procon'
        ? {
            cipProcon: String(dadosFormulario?.cipProcon ?? '').slice(0, 100),
            numeroPedido: String(dadosFormulario?.numeroPedido ?? '').slice(0, 100),
            mcdonalds: dadosFormulario?.mcdonalds === true,
            motivoClassificado: MOTIVOS_PROCON.includes(dadosFormulario?.motivoClassificado ?? '')
              ? (dadosFormulario?.motivoClassificado as string)
              : '',
          }
        : null;

    // ── Preenche o Protocolo do template com o CIP extraído (quando houver) ──
    if (dadosForm?.cipProcon) {
      templateFinal = templateFinal.replace(
        /^(Protocolo:\s*)\{\{PROTOCOLO\}\}$/m,
        `$1${dadosForm.cipProcon}`
      );
    }
    // ── Preenche o ID do Pedido do template quando houver e o template ainda tem a variável ──
    if (dadosForm?.numeroPedido) {
      templateFinal = templateFinal.replace(
        /^(ID do Pedido:\s*)\{\{ID_PEDIDO\}\}$/m,
        `$1${dadosForm.numeroPedido}`
      );
    }

    // Grava no histórico — alimenta o cache (hash) e a página Histórico.
    // Falha ao gravar NUNCA derruba a análise (best-effort).
    let casoId: number | null = null;
    try {
      // O snapshot inicial nasce junto com o registro: dados da IA + prazo
      // calculado. Assim o cache-hit e o Histórico reabrem o CRM completo,
      // mesmo antes do primeiro "Salvar no histórico". No Subsídio, a
      // minutaSugerida (cruzamento solicitação × documento) vai junto —
      // cache-hit e Histório a repõem no editor.
      const snapshotInicial: CrmSnapshot = {
        prazoDefesa: prazoDefesa ?? null,
        dadosIA: dadosForm ?? undefined,
        minutaSugerida: tipo === 'subsidio' ? (minutaSugerida ?? null) : undefined,
      };
      const salvo = await store.saveHistorico({
        tipo: tipo as TipoAnalise,
        origem,
        resumo: resumoExecutivo,
        clausula: clausulaAplicavel,
        templateGerado: templateFinal,
        conteudoHash,
        dadosCrm: snapshotInicial,
      });
      casoId = salvo.id;
    } catch (dbErr) {
      console.error('[analisar:saveHistorico]', dbErr);
    }

    const resposta: Record<string, unknown> = {
      resumoExecutivo,
      clausulaAplicavel,
      templateSugerido: templateFinal,
    };
    // minutaSugerida — exclusiva do fluxo Subsídio (cruzamento solicitação ×
    // documento). Tolerante à ausência: o templateSugerido segue como base.
    if (tipo === 'subsidio' && minutaSugerida) {
      resposta.minutaSugerida = minutaSugerida;
    }
    if (prazoDefesa) {
      resposta.dataAbertura = dataAbertura;
      resposta.prazoDefesa = prazoDefesa;
    }
    if (dadosForm) resposta.dadosFormulario = dadosForm;
    if (casoId !== null) resposta.casoId = casoId;
    // dadosCrm: sempre presente — Procon (prazo + dados IA) e Subsídio
    // (minutaSugerida persistida) reabrem completos no cache/histórico.
    resposta.dadosCrm = {
      prazoDefesa: prazoDefesa ?? null,
      dadosIA: dadosForm ?? undefined,
      minutaSugerida: tipo === 'subsidio' ? (minutaSugerida ?? null) : undefined,
    };

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
