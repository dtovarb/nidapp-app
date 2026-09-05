import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NIDAPP · Tu residencia, organizada',
  description: 'Administración visual de residencias, alquileres, avisos y reservas.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
