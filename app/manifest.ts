import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'NIDAPP · Tu residencia, organizada',
    short_name: 'NIDAPP',
    description: 'Administrá tu residencia: alquileres, tareas, avisos, lavarropas, invitados y gastos.',
    lang: 'es-AR',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fff8e8',
    theme_color: '#9b5de5',
    categories: ['productivity', 'lifestyle'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Alquiler', url: '/dashboard?s=alquiler', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Tareas', url: '/dashboard?s=tareas', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Avisos', url: '/dashboard?s=avisos', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
