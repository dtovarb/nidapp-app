import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Landing from './landing';

export const metadata: Metadata = {
  title: 'NIDAPP · Tu residencia, ordenada',
  description: 'La app para dueños de residencias y colivings: alquileres, gastos, tareas y avisos en un solo lugar. Gratis en etapa de prueba.',
  openGraph: { title: 'NIDAPP · Tu residencia, ordenada', description: 'Alquileres, gastos, tareas y avisos en una sola app. Probala gratis.', images: [{ url: '/landing/og.png', width: 1200, height: 630 }], locale: 'es_AR', type: 'website' },
  twitter: { card: 'summary_large_image', images: ['/landing/og.png'] },
};

// Con sesión iniciada va directo al panel; si no, ve la landing.
export default async function Home() {
  const session = await getSession();
  if (session) redirect('/dashboard');
  return <Landing/>;
}
