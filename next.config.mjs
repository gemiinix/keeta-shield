/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-parse (pdfjs-dist) carrega um worker .mjs em runtime que o webpack
  // não consegue empacotar — mantê-lo externo resolve no build do servidor.
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse'],
  },
};

export default nextConfig;
