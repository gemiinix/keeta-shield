# Keeta Shield 🛡️

SaaS de **automação jurídica para CX** — análise de requisições Procon e Subsídio com geração de peças assistida por IA.

## Stack

- **Next.js 14** (App Router)
- **TypeScript** (strict)
- **Tailwind CSS** (identidade Keeta: yellow `#FFD600`, teal `#19B394`, escala zinc)

## Estrutura

```
src/
├── app/
│   ├── layout.tsx              # Root layout (fonte Poppins, tema escuro zinc)
│   ├── page.tsx                # Página principal (Sidebar + MainDashboard)
│   ├── globals.css             # Estilos globais + token .template-variable
│   └── api/
│       ├── analyze-procon/route.ts    # POST — PDFs atendimento_cip_* (placeholder LLM)
│       └── analyze-subsidio/route.ts  # POST — texto da requisição (placeholder LLM)
├── components/
│   ├── layout/
│   │   └── Sidebar.tsx         # Navegação + perfil do usuário
│   ├── dashboard/
│   │   └── MainDashboard.tsx   # Abas Procon/Subsídio + estado do fluxo
│   ├── flows/
│   │   ├── ProconFlow.tsx      # Drag & Drop de PDFs atendimento_cip_*
│   │   └── SubsidioFlow.tsx    # Textarea + "Analisar Requisição"
│   └── editor/
│       └── TemplateEditor.tsx  # Tela dividida: dados extraídos | editor {{VARIAVEL}}
```

## Como rodar

```bash
npm install
npm run dev
```

Acesse http://localhost:3000

## Fluxo de trabalho

1. **Nova Análise** → escolha a aba (Procon ou Subsídio)
2. **Procon**: arraste PDFs `atendimento_cip_*.pdf` → validação de nome no frontend e backend
3. **Subsídio**: cole a íntegra da requisição (mín. 20 caracteres)
4. Após processamento → **TemplateEditor**: dados extraídos à esquerda, editor com variáveis `{{NOME_CONSUMIDOR}}` interpoladas à direita

## Próximos passos

- [ ] Integrar API do LLM em `analyze-procon` e `analyze-subsidio`
- [ ] Persistência de templates (Gerir Templates)
- [ ] Histórico de análises
- [ ] Autenticação de usuários
