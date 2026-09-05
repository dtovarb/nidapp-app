'use client';
import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function RegisterPage(){
 const [form,setForm]=useState({name:'',username:'',password:'',role:'resident',room:'',homeName:'Casa NIDAPP'}); const [loading,setLoading]=useState(false); const [error,setError]=useState(''); const router=useRouter();
 function update(k:string,v:string){setForm(x=>({...x,[k]:v}))}
 async function submit(e:FormEvent){e.preventDefault();setLoading(true);setError('');const r=await fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});const j=await r.json();setLoading(false);if(!r.ok){setError(j.error||'No se pudo crear el usuario');return}router.push('/dashboard');}
 return <main className="auth-wrap"><section className="auth-card"><div className="auth-brand"><div className="house">🪴</div><h1 className="pixel">CREAR USUARIO</h1><p>Sumá una persona a NIDAPP.</p></div><form className="form" onSubmit={submit}><div className="form-row"><div className="field"><label>NOMBRE</label><input required value={form.name} onChange={e=>update('name',e.target.value)}/></div><div className="field"><label>USUARIO</label><input required value={form.username} onChange={e=>update('username',e.target.value.toLowerCase())}/></div></div><div className="field"><label>CONTRASEÑA</label><input required minLength={6} type="password" value={form.password} onChange={e=>update('password',e.target.value)}/></div><div className="field"><label>HABITACIÓN (opcional)</label><input value={form.room} onChange={e=>update('room',e.target.value)} placeholder="3"/></div><div className="field"><label>NOMBRE DE LA RESIDENCIA</label><input value={form.homeName} onChange={e=>update('homeName',e.target.value)}/></div>{error&&<div className="notice red">⚠️ <div>{error}</div></div>}<button className="button purple" disabled={loading}>{loading?'CREANDO...':'CREAR USUARIO'}</button></form><div className="auth-switch"><Link href="/login">← Volver al login</Link></div></section></main>
}
