import type { Metadata } from 'next';
import { LEGAL, LegalPage } from '../legal';

export const metadata: Metadata = { title: 'Política de privacidad · NIDAPP' };

// Plantilla base: revisala con un profesional antes de publicar en las tiendas.
export default function PrivacyPage() {
  return <LegalPage title="Privacidad">
    <h2>Quién es responsable</h2>
    <p>NIDAPP es operada por {LEGAL.owner}, {LEGAL.country}. Para cualquier consulta sobre tus datos escribí a {LEGAL.contact}.</p>
    <h2>Qué datos guardamos</h2>
    <ul>
      <li>Datos de cuenta: nombre, email y contraseña (guardada cifrada, nadie puede leerla).</li>
      <li>Datos que cargás en tu residencia: habitación, teléfono, contacto de emergencia, foto de perfil, avisos, reservas, tareas, invitados, pagos, comprobantes y gastos.</li>
      <li>Datos técnicos mínimos para que funcione: la sesión iniciada y, si las activás, la suscripción a notificaciones del dispositivo.</li>
    </ul>
    <h2>Para qué los usamos</h2>
    <p>Solo para que la residencia funcione: mostrar la información a las personas de tu residencia según su rol, enviarte notificaciones y emails de la app (por ejemplo, recuperar tu contraseña). No vendemos tus datos ni los usamos para publicidad.</p>
    <h2>Quién los ve</h2>
    <ul>
      <li>El dueño y los encargados de tu residencia ven tus datos de contacto, pagos y comprobantes.</li>
      <li>Los demás habitantes ven tu nombre, tu habitación, tu ubicación dentro de la casa si la marcás, tus avisos y tus reservas.</li>
      <li>Las imágenes de invitados solo las ve el dueño o los encargados.</li>
      <li>Proveedores que usamos para funcionar: Supabase (base de datos y archivos), Vercel (servidor) y, para los emails, Resend.</li>
    </ul>
    <h2>Tus derechos</h2>
    <p>Podés ver y corregir tus datos en Mi perfil, y eliminar tu cuenta en cualquier momento desde Mi perfil → Eliminar mi cuenta. Al eliminarla borramos tu cuenta y tus datos personales; en las residencias que siguen activas se conserva el historial de pagos y reservas sin tu nombre ni tus datos de contacto. En Argentina podés ejercer tus derechos de acceso, rectificación y supresión según la Ley 25.326; la Agencia de Acceso a la Información Pública es el órgano de control.</p>
    <h2>Seguridad</h2>
    <p>La información viaja cifrada (HTTPS), los archivos se guardan en un almacenamiento privado y cada residencia solo accede a sus propios datos.</p>
  </LegalPage>;
}
