import Link from 'next/link';

// Datos del responsable: completalos antes de publicar en las tiendas.
export const LEGAL = {
  owner: '[Nombre o razón social del responsable]',
  contact: '[email de contacto]',
  country: 'Argentina',
  updated: '10 de octubre de 2026',
};

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return <main className="legal"><article className="card"><Link href="/login" className="mini">← Volver</Link><h1 className="pixel">{title}</h1><p className="mini muted">Última actualización: {LEGAL.updated}</p>{children}</article></main>;
}
