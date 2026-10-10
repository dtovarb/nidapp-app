# NIDAPP 🏠

NIDAPP es una app web mobile-first para administrar una residencia. Está preparada para Next.js + Supabase + Vercel.

## Novedades v2

### Perfil dueño
- **Habitaciones:** agregar o quitar habitaciones, definir el cupo de personas y el precio mensual de cada una. Si una habitación es compartida, el precio se divide entre quienes viven ahí. No se puede asignar más gente que el cupo.
- **Servicios y otros cobros:** monto fijo por habitante (luz, gas, internet…) que se suma al alquiler del mes. Se pueden pausar o eliminar.
- **Alquiler por mes:** cada mes tiene su propio registro. Los meses impagos quedan como deuda vencida en vez de desaparecer.
- **Tareas del mes:** "Tirar la basura" y "Limpiar el baño" rotan solas cada mes entre las habitaciones ocupadas. El dueño puede reasignar a mano y agregar o quitar tareas.
- **Gastos:** lista mensual de compras y arreglos (jabón, escoba, reparaciones…), con categoría, cantidad, monto y total del mes.
- **Habitantes:** reactivar habitantes desactivados y resetear contraseñas.

### Perfil habitante
- **Invitados:** avisar quién viene, qué día y en qué horario, con una imagen opcional que **solo ve el dueño**.
- **Tareas:** ver la tarea de su habitación y marcarla como hecha.
- **Alquiler:** detalle de alquiler + servicios, y deudas anteriores.
- **Perfil:** cambiar la contraseña. La habitación ahora la asigna solo el dueño.

### Ambos perfiles
- Cada aviso nuevo llega como **notificación** a todos los de la residencia.
- Navegación completa en celular (botón **Más**) y una URL por sección (`/dashboard?s=alquiler`), así el botón "atrás" funciona.
- El calendario muestra también visitas y el vencimiento del alquiler.
- Lavarropas: no permite reservas superpuestas y se pueden cancelar.

### Seguridad
- Se eliminó el registro público (`/register`): los habitantes los crea el dueño.
- La sesión se valida contra la base en cada pedido: desactivar a alguien lo saca de la app al instante.
- La app no arranca en producción sin `AUTH_SECRET`.
- Límite de 5 intentos de login fallidos cada 15 minutos por usuario.
- RLS activado en todas las tablas (bloquea el acceso directo con la clave `anon`).
- Se validan las rutas de archivos subidos y no se muestran errores internos de la base.

## Versión anterior

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

El archivo `supabase.sql` funciona como esquema inicial y migración. Si ya ejecutaste la versión anterior, volvé a ejecutar el archivo completo en **Supabase → SQL Editor**: crea las tablas nuevas (habitaciones, servicios, tareas, invitados, gastos), carga las habitaciones 1 a 6 con precio $60.000 y cupo 1, las tareas "Tirar la basura" y "Limpiar el baño", y activa RLS. Es seguro ejecutarlo más de una vez.

**Ejecutá el SQL antes de desplegar esta versión**, porque el código nuevo usa esas tablas.

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

Los habitantes se crean desde el panel del dueño (**Habitantes → Crear habitante**), con una contraseña inicial de al menos 8 caracteres que después cada uno puede cambiar en **Mi perfil**.

Los datos demo del SQL son:

- Dueño: `dueno` / `demo1234`
- Habitante: `sofi` / `demo1234`

**Cambiá estas contraseñas** (en Mi perfil) antes de cargar datos reales.

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
