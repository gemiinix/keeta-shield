import type { Metadata } from 'next';
import { Sora, Manrope } from 'next/font/google';
import './globals.css';

const sora = Sora({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-sora',
  display: 'swap',
});

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-manrope',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Keeta Shield — Triagem Jurídica para CX',
  description:
    'Central de triagem jurídica para Customer Experience: análise Procon e Subsídio com geração de peças assistida por IA.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${sora.variable} ${manrope.variable}`}>
      <body className="min-h-screen bg-white font-sans text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
