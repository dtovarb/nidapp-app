// Clave pública VAPID de las notificaciones push. No es secreta: el navegador la recibe igual.
// La privada (VAPID_PRIVATE_KEY) va solo en las variables de entorno de Vercel.
export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BHe7UbrqQe_8pcRTuhyUZLpoYnZ8z0L_EWvo2w7vfQ0s0Py0s5g2Br44NqRkVMaaKNgEcT3bsyZxwdSxG3UYi6k';
export const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:danielatovar310594@gmail.com';
