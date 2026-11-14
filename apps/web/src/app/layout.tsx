import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Ehécatl', description: 'Rotación y cambio de cultivos', icons: { icon: 'data:,' } };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
