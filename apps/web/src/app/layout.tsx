import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { DemoProvider } from '@/features/identity/demo-provider';
import './globals.css';
const inter = localFont({
  src: '../shared/fonts/InterVariable.woff2',
  variable: '--font-inter',
  display: 'swap'
});
export const metadata: Metadata = {
  title: 'Ehécatl · Tu siguiente ciclo',
  description: 'El clima, tu parcela y tus prioridades para decidir qué sembrar después.'
};
export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <html lang="es" className={inter.variable}><body><DemoProvider>{children}</DemoProvider></body></html>;
}
