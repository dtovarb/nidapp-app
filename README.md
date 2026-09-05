# NIDAPP 🏠

NIDAPP es una app web mobile-first para administrar una residencia. Está preparada para Next.js + Supabase + Vercel.

## Cambios incluidos en esta versión

### Perfil dueño
- Avisos: modificar título, descripción, categoría, prioridad y estado.
- Avisos: eliminar.
- Alquiler: enviar notificaciones internas a un habitante.
- Alquiler: los recordatorios también generan notificación.
- Alquiler: ver quién pagó, comprobantes, total cobrado y total pendiente.
- Habitantes: 6 habitaciones (1 a 6), agrupadas por cuarto.
- Habitantes: crear, modificar y desactivar usuarios.
- Habitantes: correo, número y número de cercano/emergencia.
- Calendario general con reservas pendientes del lavarropas.

### Perfil habitante
- Avisos propios: modificar sin eliminar.
- Lavarropas: modificar sus propias reservas.
- Lavarropas: marcar su reserva como finalizada.
- Alquiler: subir captura o comprobante de pago.
- Perfil: modificar nombre, correo, número, cuarto, número de cercano y foto.
- Perfil: ver desde cuándo está en la residencia.
- Perfil: ver si el alquiler está al día y próxima fecha de pago.
- Notificaciones internas con sonido cuando llegan nuevas.
- Sección de presencia: indicar dónde está dentro de la casa.
- Ver dónde están los demás habitantes.

### Ambos perfiles
- Página de normas de convivencia.
- Calendario.
- Avisos.
- Lavarropas.
- Notificaciones.
- Presencia dentro de la casa.

## Base de datos

El archivo `supabase.sql` funciona como esquema inicial y migración. Si ya ejecutaste la versión anterior, podés volver a ejecutar el archivo: agrega las columnas nuevas que faltan y crea el bucket privado para fotos/comprobantes.

Importante: el bucket `nidapp-files` es privado. Los archivos se manejan desde el servidor con la `SUPABASE_SERVICE_ROLE_KEY`.

## Variables de entorno

Localmente:

```env
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=TU_SERVICE_ROLE_KEY
AUTH_SECRET=UNA_CLAVE_LARGA_ALEATORIA
CRON_SECRET=OTRA_CLAVE_LARGA_ALEATORIA
```

En Vercel cargá exactamente las mismas variables en **Settings → Environment Variables**.

`SUPABASE_SERVICE_ROLE_KEY` es secreta y nunca debe comenzar con `NEXT_PUBLIC_`.

## Usuarios

La creación de habitantes desde el panel del dueño es la forma recomendada de agregar usuarios a la residencia.

Los datos demo del SQL son:

- Dueño: `dueno` / `demo1234`
- Habitante: `sofi` / `demo1234`

Se recomienda cambiar las contraseñas demo después de comprobar que todo funciona.

## Ejecutar

```bash
npm install
npm run dev
```

Abrí `http://localhost:3000`.

## Publicar en GitHub y Vercel

1. Subir esta carpeta al repositorio de GitHub.
2. En Vercel, importar ese repositorio.
3. Framework: Next.js (Vercel lo detecta automáticamente).
4. Root Directory: `./`.
5. Agregar las variables de entorno.
6. Deploy.

Después de cambiar código en GitHub, Vercel vuelve a desplegar automáticamente si el repositorio está conectado.

## Sonido de notificaciones

El navegador puede bloquear audio automático hasta que el usuario interactúe con la página. NIDAPP incluye un botón **Probar sonido** y, una vez habilitado el audio, reproduce un aviso sonoro cuando detecta una nueva notificación.

La aplicación consulta nuevas notificaciones cada 12 segundos. Esto es una notificación interna con sonido; no es todavía una notificación push nativa del sistema operativo.
