import type { Metadata } from 'next';
import Landing from '../landing';

export const metadata: Metadata = {
  title: 'Descargar NIDAPP',
  description: 'Instalá NIDAPP en tu celular sin tiendas de apps. Gratis en etapa de prueba.',
  openGraph: { title: 'Descargá NIDAPP', description: 'Alquileres, gastos, tareas y avisos en una sola app. Probala gratis.', images: [{ url: '/landing/og.png', width: 1200, height: 630 }], locale: 'es_AR', type: 'website' },
  twitter: { card: 'summary_large_image', images: ['/landing/og.png'] },
};

// Link para compartir en redes: muestra la landing directo en la sección de descarga.
export default function DownloadPage() {
  return <Landing focus="descargar"/>;
}
