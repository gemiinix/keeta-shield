/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-parse (pdfjs-dist) carrega um worker .mjs em runtime que o webpack
  // não consegue empacotar — mantê-lo externo resolve no build do servidor.
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse'],

    // O pdfjs importa o worker com caminho montado em runtime
    // (`import(this.workerSrc)`), que o output file tracing não rastreia.
    // Sem isto, pdf.worker.mjs não é copiado para o lambda da Vercel e
    // quebra com "Cannot find module .../pdf.worker.mjs".
    outputFileTracingIncludes: {
      '/api/analisar': [
        './node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
        './node_modules/pdfjs-dist/legacy/build/pdf.mjs',
      ],
    },
  },
};

export default nextConfig;
