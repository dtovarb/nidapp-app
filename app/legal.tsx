import Link from 'next/link';

// Datos del responsable que aparecen en Privacidad y Términos.
export const LEGAL = {
  owner: 'el equipo de NIDAPP',
  contact: 'dani.a.t.boscan@gmail.com',
  country: 'Argentina',
  updated: '11 de octubre de 2026',
};

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return <main className="legal"><article className="card"><Link href="/login" className="mini">← Volver</Link><img className="app-logo small" src="/icons/icon-192.png" alt="NIDAPP"/><h1 className="pixel">{title}</h1><p className="mini muted">Última actualización: {LEGAL.updated}</p>{children}</article></main>;
}
