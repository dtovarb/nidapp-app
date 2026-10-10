import './globals.css';
import type { Metadata, Viewport } from 'next';
import PwaRegister from './pwa-register';

export const metadata: Metadata = {
  title: 'NIDAPP · Tu residencia, organizada',
  description: 'Administrá tu residencia: alquileres, tareas, avisos, lavarropas, invitados y gastos.',
  applicationName: 'NIDAPP',
  appleWebApp: { capable: true, title: 'NIDAPP', statusBarStyle: 'default' },
  icons: { apple: '/icons/apple-touch-icon.png' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { themeColor: '#9b5de5', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}<PwaRegister/></body></html>;
}
