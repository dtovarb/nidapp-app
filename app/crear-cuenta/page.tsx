'use client';
import { FormEvent, Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

function SignupForm(){
 const params=useSearchParams(); const router=useRouter();
 const [mode,setMode]=useState<'owner'|'join'>('owner');
 const [form,setForm]=useState({name:'',email:'',password:'',homeName:'',address:'',rooms:'6',price:'',code:''});
 const [accept,setAccept]=useState(false); const [loading,setLoading]=useState(false); const [error,setError]=useState('');
 useEffect(()=>{const code=params.get('codigo');if(code){setMode('join');setForm(f=>({...f,code}))}},[params]);
 const set=(k:keyof typeof form)=>(e:{target:{value:string}})=>setForm({...form,[k]:e.target.value});
 async function submit(e:FormEvent){e.preventDefault();if(!accept)return setError('Para seguir, aceptá los términos y la política de privacidad.');setLoading(true);setError('');const r=await fetch('/api/auth/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,mode,rooms:Number(form.rooms),price:Number(form.price||0)})});const j=await r.json();setLoading(false);if(!r.ok){setError(j.error||'No se pudo crear la cuenta');return}router.push('/dashboard');}
 return <main className="auth-wrap"><section className="auth-card"><div className="auth-brand"><img className="app-logo" src="/icons/icon-192.png" alt="NIDAPP"/><h1 className="pixel">CREAR CUENTA</h1><p>Empezá a usar NIDAPP.</p></div>
 <div className="mode-tabs" role="tablist"><button type="button" role="tab" aria-selected={mode==='owner'} className={mode==='owner'?'active':''} onClick={()=>setMode('owner')}>🏠 Tengo una residencia</button><button type="button" role="tab" aria-selected={mode==='join'} className={mode==='join'?'active':''} onClick={()=>setMode('join')}>🔑 Tengo un código</button></div>
 <form className="form" onSubmit={submit}>
 {mode==='join'&&<div className="field"><label htmlFor="su-code">CÓDIGO DE INVITACIÓN</label><input id="su-code" required autoCapitalize="characters" value={form.code} onChange={set('code')} placeholder="NID-XXXXXX"/><span className="mini muted">Te lo pasa el dueño de la residencia.</span></div>}
 <div className="field"><label htmlFor="su-name">TU NOMBRE</label><input id="su-name" required autoComplete="name" value={form.name} onChange={set('name')}/></div>
 <div className="field"><label htmlFor="su-email">EMAIL</label><input id="su-email" required type="email" autoComplete="email" value={form.email} onChange={set('email')}/></div>
 <div className="field"><label htmlFor="su-pass">CONTRASEÑA</label><input id="su-pass" required type="password" minLength={8} autoComplete="new-password" value={form.password} onChange={set('password')} placeholder="Mínimo 8 caracteres"/><span className="mini muted">Si ya tenés cuenta en NIDAPP, usá el mismo email y contraseña: la residencia se suma a tu cuenta.</span></div>
 {mode==='owner'&&<><div className="field"><label htmlFor="su-home">NOMBRE DE LA RESIDENCIA</label><input id="su-home" required value={form.homeName} onChange={set('homeName')} placeholder="Ej. Casa Centro"/></div><div className="field"><label htmlFor="su-address">DIRECCIÓN (opcional, sale en los recibos)</label><input id="su-address" maxLength={160} autoComplete="street-address" value={form.address} onChange={set('address')} placeholder="Ej. Av. Corrientes 1234, CABA"/></div><div className="form-row"><div className="field"><label htmlFor="su-rooms">HABITACIONES</label><input id="su-rooms" type="number" min={1} max={30} value={form.rooms} onChange={set('rooms')}/></div><div className="field"><label htmlFor="su-price">PRECIO POR PERSONA</label><input id="su-price" type="number" min={0} inputMode="decimal" value={form.price} onChange={set('price')} placeholder="Ej. 270000"/></div></div><span className="mini muted">Después podés cambiar todo desde Habitantes.</span></>}
 <label className="check"><input type="checkbox" checked={accept} onChange={e=>setAccept(e.target.checked)}/> Acepto los <Link href="/terminos" target="_blank">términos</Link> y la <Link href="/privacidad" target="_blank">política de privacidad</Link>.</label>
 {error&&<div className="notice red" role="alert">⚠️ <div>{error}</div></div>}
 <button className="button purple" disabled={loading}>{loading?'CREANDO...':mode==='owner'?'CREAR MI RESIDENCIA':'UNIRME A LA RESIDENCIA'}</button></form>
 <div className="auth-switch">¿Ya tenés cuenta? <Link href="/login">Entrar</Link></div></section></main>;
}
export default function SignupPage(){return <Suspense><SignupForm/></Suspense>}
