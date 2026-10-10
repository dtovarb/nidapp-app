'use client';
import { useEffect } from 'react';

// Registra el service worker (app instalable, pantalla sin conexión y notificaciones push)
// y guarda el aviso de instalación de Chrome/Android para mostrar el botón "Instalar app".
export default function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    const onPrompt = (e: Event) => { e.preventDefault(); (window as any).__nidappInstall = e; window.dispatchEvent(new Event('nidapp-installable')); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);
  return null;
}
