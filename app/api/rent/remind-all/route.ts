import { homeContext, fail, json } from '@/lib/api';
import { remindPending } from '@/lib/rent';

// El dueño avisa de una vez a todos los que tienen el alquiler pendiente.
export async function POST(){try{const {db,homeId}=await homeContext({ownerOnly:true,ownerMessage:'Solo el dueño puede enviar recordatorios.'});const sent=await remindPending(db,homeId);return json({ok:true,sent});}catch(e){return fail(e)}}
