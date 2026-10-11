'use client';
import { useEffect, useState } from 'react';
import type { SessionUser } from '@/lib/auth';
import { jsonBody } from './sections';
import { VAPID_PUBLIC_KEY } from '@/lib/push-config';

type Api=(url:string,options?:RequestInit)=>Promise<any>;
type Props={api:Api;show:(s:string)=>void;session:SessionUser};
const errMsg=(e:unknown)=>e instanceof Error?e.message:'Error';

// ---------- Instalar la app (PWA) ----------
export function useInstall(){
 const [canPrompt,setCanPrompt]=useState(false);const [installed,setInstalled]=useState(false);
 useEffect(()=>{const check=()=>setCanPrompt(Boolean((window as any).__nidappInstall));check();setInstalled(window.matchMedia('(display-mode: standalone)').matches||(navigator as any).standalone===true);window.addEventListener('nidapp-installable',check);const done=()=>{setInstalled(true);setCanPrompt(false)};window.addEventListener('appinstalled',done);return()=>{window.removeEventListener('nidapp-installable',check);window.removeEventListener('appinstalled',done)}},[]);
 const isIos=typeof navigator!=='undefined'&&/iphone|ipad|ipod/i.test(navigator.userAgent);
 async function install(){const p=(window as any).__nidappInstall;if(!p)return;p.prompt();await p.userChoice.catch(()=>{});(window as any).__nidappInstall=null;setCanPrompt(false);}
 return {canPrompt,installed,isIos,install};
}

export function InstallCard({compact=false,onDismiss}:{compact?:boolean;onDismiss?:()=>void}){
 const {canPrompt,installed,isIos,install}=useInstall();
 if(installed)return compact?null:<div className="notice green"><div className="notice-icon">📲</div><div className="notice-main"><b>NIDAPP ya está instalada</b><div className="mini">La abrís desde el ícono de tu pantalla de inicio.</div></div></div>;
 if(!canPrompt&&!isIos)return compact?null:<div className="notice"><div className="notice-icon">📲</div><div className="notice-main"><b>Instalá NIDAPP en tu celular</b><div className="mini">Abrí esta página en Chrome (Android) o Safari (iPhone) y elegí "Instalar app" o "Agregar a pantalla de inicio".</div></div></div>;
 return <div className="notice yellow install-card"><div className="notice-icon">📲</div><div className="notice-main"><b>Instalá NIDAPP como app</b>{isIos&&!canPrompt?<div className="mini">En Safari tocá <b>Compartir</b> <span aria-hidden>⬆️</span> y después <b>"Agregar a pantalla de inicio"</b>.</div>:<div className="mini">Queda con su ícono, se abre a pantalla completa y te llegan las notificaciones.</div>}</div>{canPrompt&&<button className="button purple" onClick={install}>Instalar</button>}{onDismiss&&<button className="button" aria-label="Ocultar" onClick={onDismiss}>✕</button>}</div>;
}

// ---------- Notificaciones push del celular ----------
const b64ToBytes=(b64:string)=>{const pad='='.repeat((4-b64.length%4)%4);const raw=atob((b64+pad).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(raw,c=>c.charCodeAt(0));};
export function PushToggle({api,show}:{api:Api;show:(s:string)=>void}){
 const key=VAPID_PUBLIC_KEY;
 const [state,setState]=useState<'loading'|'unsupported'|'off'|'on'|'denied'>('loading');
 useEffect(()=>{(async()=>{if(!key||!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window))return setState('unsupported');if(Notification.permission==='denied')return setState('denied');const reg=await navigator.serviceWorker.ready;setState((await reg.pushManager.getSubscription())?'on':'off')})().catch(()=>setState('unsupported'))},[key]);
 async function enable(){try{const perm=await Notification.requestPermission();if(perm!=='granted'){setState(perm==='denied'?'denied':'off');return show('No se activaron las notificaciones.');}const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToBytes(key!)});await api('/api/push',jsonBody('POST',{subscription:sub.toJSON()}));setState('on');show('Notificaciones activadas 🔔')}catch(e){show(errMsg(e))}}
 async function disable(){try{const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();if(sub){await api('/api/push',jsonBody('DELETE',{endpoint:sub.endpoint}));await sub.unsubscribe();}setState('off');show('Notificaciones desactivadas en este dispositivo')}catch(e){show(errMsg(e))}}
 const text={loading:'Revisando...',unsupported:'Este navegador no permite notificaciones push. En iPhone, primero instalá la app en la pantalla de inicio.',denied:'Bloqueaste las notificaciones para NIDAPP. Activalas desde los ajustes del navegador.',off:'Recibí avisos en el celular aunque la app esté cerrada.',on:'Activadas en este dispositivo.'}[state];
 return <div className={'notice '+(state==='on'?'green':'')}><div className="notice-icon">🔔</div><div className="notice-main"><b>Notificaciones en el celular</b><div className="mini">{text}</div></div>{state==='off'&&<button className="button purple" onClick={enable}>Activar</button>}{state==='on'&&<button className="button" onClick={disable}>Desactivar</button>}</div>;
}

// ---------- Mis residencias: cambiar, crear y unirse ----------
export type Membership={member_id:string;home_id:string;name:string;role:string;room:string|null;unread:number};
export const roleLabel=(r:string)=>r==='owner'?'Dueño/a':r==='admin'?'Encargado/a':'Habitante';
export function HomesSection({api,show,session,homes,onSwitch}:Props&{homes:Membership[];onSwitch:(memberId:string)=>void}){
 const [create,setCreate]=useState({homeName:'',rooms:'6',price:''});const [code,setCode]=useState('');const [busy,setBusy]=useState(false);
 async function run(body:object,msg:string){if(busy)return;setBusy(true);try{await api('/api/homes',jsonBody('POST',body));show(msg);window.location.href='/dashboard';}catch(e){show(errMsg(e));setBusy(false)}}
 return <div className="grid"><div className="card span-12"><h3 className="card-title">🏘️ Mis residencias</h3>{homes.map(h=><div key={h.member_id} className={'notice '+(h.member_id===session.id?'green':'')}><div className="notice-icon">🏠</div><div className="notice-main"><b>{h.name}</b><div className="mini">{roleLabel(h.role)}{h.room?` · Hab. ${h.room}`:''}{h.unread?` · 🔔 ${h.unread} sin leer`:''}</div></div>{h.member_id===session.id?<span className="tag green">ACTUAL</span>:<button className="button blue" onClick={()=>onSwitch(h.member_id)}>Entrar</button>}</div>)}</div>
 <div className="card span-6"><h3 className="card-title">➕ Crear otra residencia</h3><div className="form"><div className="field"><label htmlFor="nh-name">NOMBRE</label><input id="nh-name" value={create.homeName} onChange={e=>setCreate({...create,homeName:e.target.value})} placeholder="Ej. Casa Norte"/></div><div className="form-row"><div className="field"><label htmlFor="nh-rooms">HABITACIONES</label><input id="nh-rooms" type="number" min={1} max={30} value={create.rooms} onChange={e=>setCreate({...create,rooms:e.target.value})}/></div><div className="field"><label htmlFor="nh-price">PRECIO POR PERSONA</label><input id="nh-price" type="number" min={0} value={create.price} onChange={e=>setCreate({...create,price:e.target.value})}/></div></div><button className="button purple" disabled={busy} onClick={()=>run({action:'create',homeName:create.homeName,rooms:Number(create.rooms),price:Number(create.price||0)},'Residencia creada 🏡')}>CREAR RESIDENCIA</button><p className="mini muted">Vas a ser el dueño. Se crea con habitaciones, tareas y normas base que después podés editar.</p></div></div>
 <div className="card span-6"><h3 className="card-title">🔑 Unirme con un código</h3><div className="form"><div className="field"><label htmlFor="jh-code">CÓDIGO DE INVITACIÓN</label><input id="jh-code" autoCapitalize="characters" value={code} onChange={e=>setCode(e.target.value)} placeholder="NID-XXXXXX"/></div><button className="button blue" disabled={busy||!code.trim()} onClick={()=>run({action:'join',code},'Te uniste a la residencia 👋')}>UNIRME</button><p className="mini muted">Te lo pasa el dueño o encargado de la otra residencia.</p></div></div></div>;
}

// ---------- Invitaciones (dueño / encargado) ----------
type Invite={id:string;code:string;role:string;room:string|null;uses:number;max_uses:number;expires_at:string};
export function InvitesCard({api,show,session,rooms}:Props&{rooms:{id:string;number:string;occupants:number;capacity:number}[]}){
 const [items,setItems]=useState<Invite[]>([]);const [form,setForm]=useState({role:'resident',room:'',max_uses:'1'});
 async function load(){try{setItems((await api('/api/invites')).items||[])}catch(e){show(errMsg(e))}}
 useEffect(()=>{load()},[]);
 const link=(c:string)=>`${window.location.origin}/crear-cuenta?codigo=${c}`;
 const message=(i:Invite)=>`Te invito a ${session.home_name||'mi residencia'} en NIDAPP 🏠\nCreá tu cuenta acá: ${link(i.code)}\nO usá el código ${i.code}`;
 async function create(){try{const j=await api('/api/invites',jsonBody('POST',{role:form.role,room:form.room||null,max_uses:Number(form.max_uses)}));show(`Código ${j.item.code} listo para compartir`);await load()}catch(e){show(errMsg(e))}}
 async function share(i:Invite){const text=message(i);try{if(navigator.share){await navigator.share({title:'Invitación a NIDAPP',text});return}await navigator.clipboard.writeText(text);show('Invitación copiada 📋')}catch{}}
 async function revoke(i:Invite){try{await api('/api/invites',jsonBody('DELETE',{id:i.id}));show('Código anulado');await load()}catch(e){show(errMsg(e))}}
 return <div className="card span-12"><h3 className="card-title">🔗 Invitar personas</h3><p className="mini muted">Generá un código o link: la persona crea su cuenta con su email y entra directo a esta residencia. Vence a los 14 días.</p>
 <div className="form-row invite-row"><div className="field"><label htmlFor="iv-role">ROL</label><select id="iv-role" value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option value="resident">Habitante</option>{session.role==='owner'&&<option value="admin">Encargado/a</option>}</select></div>{form.role==='resident'&&<div className="field"><label htmlFor="iv-room">HABITACIÓN</label><select id="iv-room" value={form.room} onChange={e=>setForm({...form,room:e.target.value})}><option value="">La asigno después</option>{rooms.map(r=><option key={r.id} value={r.number} disabled={r.occupants>=r.capacity}>Hab. {r.number} ({r.occupants}/{r.capacity})</option>)}</select></div>}<div className="field"><label htmlFor="iv-uses">USOS</label><select id="iv-uses" value={form.max_uses} onChange={e=>setForm({...form,max_uses:e.target.value})}><option value="1">1 persona</option><option value="3">3 personas</option><option value="10">10 personas</option></select></div></div>
 <button className="button purple" style={{marginTop:10}} onClick={create}>GENERAR CÓDIGO</button>
 {items.map(i=><div className="notice" key={i.id} style={{marginTop:10}}><div className="notice-icon">🔑</div><div className="notice-main"><b className="invite-code">{i.code}</b><div className="mini muted">{i.role==='admin'?'Encargado/a':`Habitante${i.room?` · Hab. ${i.room}`:''}`} · usado {i.uses}/{i.max_uses} · vence {new Date(i.expires_at).toLocaleDateString('es-AR')}</div></div><div className="row-actions"><button className="button blue" onClick={()=>share(i)}>Compartir</button><a className="button" href={`https://wa.me/?text=${encodeURIComponent(message(i))}`} target="_blank" rel="noreferrer">WhatsApp</a><button className="button red" aria-label={`Anular ${i.code}`} onClick={()=>revoke(i)}>✕</button></div></div>)}</div>;
}

// ---------- Eliminar cuenta ----------
export function DeleteAccount({api,show}:{api:Api;show:(s:string)=>void}){
 const [open,setOpen]=useState(false);const [password,setPassword]=useState('');const [busy,setBusy]=useState(false);
 async function del(){if(!confirm('¿Seguro? Se borra tu cuenta y tus datos personales. No se puede deshacer.'))return;setBusy(true);try{await api('/api/account',jsonBody('DELETE',{password}));window.location.href='/login'}catch(e){show(errMsg(e));setBusy(false)}}
 return <div className="danger-zone"><h3 className="card-title">⚠️ Eliminar mi cuenta</h3>{!open?<button className="button red" onClick={()=>setOpen(true)}>Quiero eliminar mi cuenta</button>:<div className="form"><p className="mini">Se borra tu cuenta y tus datos personales en todas tus residencias. Si sos dueño de una residencia con habitantes, antes tenés que invitar a un encargado (queda como dueño) o desactivar a los habitantes.</p><div className="field"><label htmlFor="del-pass">CONFIRMÁ CON TU CONTRASEÑA</label><input id="del-pass" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></div><div className="row-actions"><button className="button red" disabled={busy||!password} onClick={del}>ELIMINAR DEFINITIVAMENTE</button><button className="button" onClick={()=>setOpen(false)}>Cancelar</button></div></div>}</div>;
}

// ---------- Comentarios de la etapa de prueba ----------
const feedbackKinds=[['idea','💡 Idea'],['bug','🐞 Algo no anda'],['like','❤️ Me gusta'],['other','💬 Otro']];
export function FeedbackCard({api,show}:{api:Api;show:(s:string)=>void}){
 const [kind,setKind]=useState('idea');const [rating,setRating]=useState(0);const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);const [sent,setSent]=useState(false);
 async function send(){setBusy(true);try{await api('/api/feedback',jsonBody('POST',{kind,rating:rating||null,message,device:window.innerWidth<700?'mobile':'desktop'}));setSent(true);setMessage('');setRating(0);show('¡Gracias por tu comentario!')}catch(e){show(errMsg(e))}setBusy(false)}
 const off={background:'#fffdf5'};
 return <div className="card span-12"><h3 className="card-title">💬 Contanos qué te parece</h3>{sent?<div className="form"><p>¡Gracias! Leemos todos los comentarios para mejorar NIDAPP.</p><div><button className="button" style={off} onClick={()=>setSent(false)}>Mandar otro comentario</button></div></div>:<div className="form"><p className="mini muted">NIDAPP está en etapa de prueba y es gratis. Contanos ideas, errores o lo que más te sirve.</p>
 <div className="row-actions" role="group" aria-label="Tipo de comentario">{feedbackKinds.map(([k,l])=><button key={k} className={'button'+(kind===k?' purple':'')} style={kind===k?undefined:off} aria-pressed={kind===k} onClick={()=>setKind(k)}>{l}</button>)}</div>
 <div className="field"><label>¿QUÉ TAN ÚTIL TE RESULTA? (opcional)</label><div className="row-actions" role="group" aria-label="Puntaje">{[1,2,3,4,5].map(n=><button key={n} className={'button icon-only'+(rating>=n?' yellow':'')} style={rating>=n?undefined:off} aria-label={`${n} de 5`} aria-pressed={rating===n} onClick={()=>setRating(rating===n?0:n)}>★</button>)}</div></div>
 <div className="field"><label htmlFor="fb-msg">TU COMENTARIO</label><textarea id="fb-msg" maxLength={2000} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Ej. me gustaría poder..."/></div>
 <div><button className="button purple" disabled={busy||message.trim().length<3} onClick={send}>ENVIAR COMENTARIO</button></div></div>}</div>;
}
