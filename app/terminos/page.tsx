import type { Metadata } from 'next';
import { LEGAL, LegalPage } from '../legal';

export const metadata: Metadata = { title: 'Términos de uso · NIDAPP' };

// Plantilla base: revisala con un profesional antes de publicar en las tiendas.
export default function TermsPage() {
  return <LegalPage title="Términos">
    <h2>El servicio</h2>
    <p>NIDAPP es una herramienta para organizar residencias compartidas: alquileres, tareas, avisos, reservas, invitados y gastos. La ofrece {LEGAL.owner}.</p>
    <h2>Tu cuenta</h2>
    <ul>
      <li>Sos responsable de mantener tu contraseña en secreto y de la información que cargás.</li>
      <li>El dueño de cada residencia decide quién entra (con códigos de invitación) y puede desactivar a las personas de su residencia.</li>
      <li>No uses NIDAPP para cargar contenido ilegal, ofensivo o datos de terceros sin su permiso.</li>
    </ul>
    <h2>Pagos y montos</h2>
    <p>Los montos de alquiler, servicios y gastos los carga el dueño de cada residencia. NIDAPP no procesa pagos ni es parte de los acuerdos entre dueños y habitantes: solo registra la información.</p>
    <h2>Disponibilidad</h2>
    <p>Hacemos lo posible para que NIDAPP funcione siempre, pero puede haber interrupciones o cambios. Podemos actualizar estos términos y te avisaremos dentro de la app cuando haya cambios importantes.</p>
    <h2>Baja</h2>
    <p>Podés eliminar tu cuenta cuando quieras desde Mi perfil. Podemos suspender cuentas que incumplan estos términos.</p>
    <h2>Contacto</h2>
    <p>Escribinos a {LEGAL.contact}.</p>
  </LegalPage>;
}
