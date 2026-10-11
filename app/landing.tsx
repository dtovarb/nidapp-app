'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useInstall } from './dashboard/app-features';
import { LEGAL } from './legal';

const features = [
  ['💰', 'Alquiler', 'Los cobros de cada mes se crean solos. Avisás a todos con un toque y cada habitante marca "Ya pagué" con su comprobante.'],
  ['📊', 'Finanzas', 'Ingresos, gastos y ganancia de cada mes en gráficos. Reporte para imprimir o guardar en PDF.'],
  ['🧹', 'Tareas', 'Basura, baños y cocina rotan solos por semana. Cada uno ve qué le toca y lo marca como hecho.'],
  ['📣', 'Avisos', 'Con foto y prioridad. Llegan como notificación al celular de todos.'],
  ['🧺', 'Lavarropas', 'Reservas por horario, sin turnos superpuestos.'],
  ['🙋', 'Invitados', 'Quién viene y cuándo. La foto del documento solo la ve el dueño.'],
  ['📜', 'Normas', 'Las reglas de la casa siempre a mano, editables por el dueño.'],
  ['🏘️', 'Varias residencias', 'Una sola cuenta para todas tus casas, con dueño, encargados y habitantes.'],
];
const steps = [
  ['1', 'Creá tu residencia', 'Poné el nombre, las habitaciones y el precio por persona. Tarda un minuto.'],
  ['2', 'Invitá a los habitantes', 'Les mandás un código o un link por WhatsApp y entran directo a tu casa.'],
  ['3', 'Listo', 'Cobros, tareas y avisos se organizan solos. Vos lo ves todo desde el celular.'],
];
const faqs = [
  ['¿Es gratis?', 'Sí. NIDAPP está en etapa de prueba y es gratis. Si algún día sumamos planes pagos, te avisamos antes y nada se cobra sin que lo aceptes.'],
  ['¿Tengo que bajarla de una tienda?', 'No. Se instala desde el navegador del celular (Chrome en Android, Safari en iPhone) y queda con su ícono como cualquier app.'],
  ['¿Funciona en iPhone?', 'Sí. En Safari tocá Compartir y después "Agregar a pantalla de inicio".'],
  ['¿NIDAPP cobra el alquiler por mí?', 'No mueve plata: registra los pagos, los comprobantes y los recibos. Cada habitante te sigue pagando como siempre.'],
  ['¿Quién ve mis datos?', 'Cada residencia solo ve lo suyo. Los datos de contacto, pagos y comprobantes los ven el dueño y los encargados.'],
];

// Instagram, TikTok y Facebook abren los links en su propio navegador, donde no se puede instalar.
const inAppBrowser = () => /Instagram|FBAN|FBAV|TikTok|musical_ly|Bytedance|Line\//i.test(navigator.userAgent);

function InstallPanel() {
  const { canPrompt, installed, isIos, install } = useInstall();
  const [env, setEnv] = useState<'loading' | 'inapp' | 'mobile' | 'desktop'>('loading');
  const [copied, setCopied] = useState(false);
  useEffect(() => { setEnv(inAppBrowser() ? 'inapp' : /android|iphone|ipad|ipod/i.test(navigator.userAgent) ? 'mobile' : 'desktop'); }, []);
  async function copy() { try { await navigator.clipboard.writeText(`${location.origin}/descargar`); setCopied(true); } catch {} }

  if (installed) return <div className="lp-install"><p className="lp-install-title">✅ NIDAPP ya está instalada</p><p>Abrila desde el ícono de tu pantalla de inicio.</p><Link className="lp-btn lp-btn-main" href="/dashboard">Abrir NIDAPP</Link></div>;
  if (env === 'inapp') return <div className="lp-install"><p className="lp-install-title">Abrí este link en tu navegador</p><p>Desde Instagram o TikTok no se puede instalar. Tocá <b>⋯</b> arriba a la derecha y elegí <b>"Abrir en el navegador"</b> (Chrome o Safari).</p><button className="lp-btn lp-btn-main" onClick={copy}>{copied ? '¡Link copiado!' : 'Copiar link'}</button></div>;
  if (canPrompt) return <div className="lp-install"><p className="lp-install-title">Instalala en un toque</p><p>Queda con su ícono, se abre a pantalla completa y te llegan las notificaciones.</p><button className="lp-btn lp-btn-main" onClick={install}>📲 Descargar NIDAPP</button></div>;
  if (isIos) return <div className="lp-install"><p className="lp-install-title">En iPhone, desde Safari</p><ol className="lp-ios"><li>Tocá <b>Compartir</b> <span aria-hidden>⬆️</span> abajo en la pantalla.</li><li>Elegí <b>"Agregar a pantalla de inicio"</b>.</li><li>Tocá <b>Agregar</b>. ¡Listo, ya tenés NIDAPP!</li></ol></div>;
  if (env === 'desktop') return <div className="lp-install lp-install-desk"><img src="/landing/qr-descargar.svg" alt="Código QR para descargar NIDAPP" width={180} height={180}/><div><p className="lp-install-title">Escaneá con tu celular</p><p>Apuntá la cámara al código y abrí el link. También podés usarla desde la compu.</p><Link className="lp-btn" href="/crear-cuenta">Usarla en la compu</Link></div></div>;
  return <div className="lp-install"><p className="lp-install-title">Instalala desde Chrome</p><p>Tocá el menú <b>⋮</b> arriba a la derecha y elegí <b>"Instalar app"</b> o <b>"Agregar a pantalla de inicio"</b>.</p></div>;
}

export default function Landing({ focus }: { focus?: 'descargar' }) {
  useEffect(() => { if (focus) document.getElementById(focus)?.scrollIntoView(); }, [focus]);
  return <div className="lp">
    <header className="lp-nav"><Link href="/" className="lp-brand"><img src="/icons/icon-192.png" alt="" width={40} height={40}/><span className="pixel">NIDAPP</span></Link><nav><a href="#funciones">Funciones</a><a href="#descargar">Descargar</a><Link className="lp-btn lp-btn-sm" href="/login">Entrar</Link></nav></header>

    <section className="lp-hero">
      <div className="lp-hero-text">
        <span className="lp-badge">✨ Gratis en etapa de prueba</span>
        <h1>Tu residencia, <span>ordenada.</span></h1>
        <p className="lp-lead">La app para dueños de residencias y colivings: alquileres, gastos, tareas y avisos en un solo lugar. Chau planillas y grupos de WhatsApp.</p>
        <div className="lp-cta"><a className="lp-btn lp-btn-main" href="#descargar">📲 Descargar la app</a><Link className="lp-btn" href="/crear-cuenta">Crear mi residencia</Link></div>
        <p className="lp-small">¿Te pasaron un código de invitación? <Link href="/crear-cuenta?codigo=NID-">Unite acá</Link></p>
      </div>
      <div className="lp-phone"><video src="/landing/demo.mp4" poster="/landing/demo-poster.webp" autoPlay muted loop playsInline aria-label="Video de NIDAPP funcionando"/></div>
    </section>

    <section className="lp-strip"><span>💬 Cobros por WhatsApp</span><span>📄 Planillas de Excel</span><span>🧾 Transferencias sin comprobante</span><b>→ todo en NIDAPP</b></section>

    <section className="lp-section" id="funciones"><h2>Todo lo que pasa en la casa, en una app</h2>
      <div className="lp-grid">{features.map(([i, t, d]) => <article className="lp-card" key={t}><span className="lp-icon" aria-hidden>{i}</span><h3>{t}</h3><p>{d}</p></article>)}</div>
    </section>

    <section className="lp-section"><h2>Empezá en 3 pasos</h2>
      <div className="lp-steps">{steps.map(([n, t, d]) => <article className="lp-card" key={n}><span className="lp-step">{n}</span><h3>{t}</h3><p>{d}</p></article>)}</div>
    </section>

    <section className="lp-section lp-download" id="descargar"><h2>Descargá NIDAPP</h2><p className="lp-lead">Sin tiendas de apps: se instala desde el navegador en Android, iPhone o la compu.</p><InstallPanel/><p className="lp-small">¿Todavía no tenés cuenta? <Link href="/crear-cuenta">Creá tu residencia gratis</Link> · ¿Ya tenés? <Link href="/login">Entrá</Link></p></section>

    <section className="lp-section"><h2>Preguntas frecuentes</h2>
      <div className="lp-faq">{faqs.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
    </section>

    <section className="lp-final"><h2>¿Administrás una residencia o un coliving?</h2><p>Probala gratis y contanos qué te sirve.</p><div className="lp-cta"><Link className="lp-btn lp-btn-main" href="/crear-cuenta">Probala gratis →</Link><a className="lp-btn" href="#descargar">📲 Descargar</a></div></section>

    <footer className="lp-foot"><span>© NIDAPP · {LEGAL.country}</span><Link href="/privacidad">Privacidad</Link><Link href="/terminos">Términos</Link><a href={`mailto:${LEGAL.contact}`}>Contacto</a></footer>
  </div>;
}
