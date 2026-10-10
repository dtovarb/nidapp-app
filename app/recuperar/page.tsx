'use client';
import { FormEvent, useState } from 'react';
import Link from 'next/link';

export default function ForgotPage(){
 const [email,setEmail]=useState(''); const [msg,setMsg]=useState(''); const [error,setError]=useState(''); const [loading,setLoading]=useState(false);
 async function submit(e:FormEvent){e.preventDefault();setLoading(true);setError('');setMsg('');const r=await fetch('/api/auth/forgot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});const j=await r.json();setLoading(false);if(!r.ok)setError(j.error||'No se pudo enviar el email');else setMsg(j.message);}
 return <main className="auth-wrap"><section className="auth-card"><div className="auth-brand"><div className="house">🔐</div><h1 className="pixel">RECUPERAR</h1><p>Te mandamos un link para elegir una contraseña nueva.</p></div><form className="form" onSubmit={submit}><div className="field"><label htmlFor="fg-email">EMAIL DE TU CUENTA</label><input id="fg-email" required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></div>{msg&&<div className="notice green" role="status">📧 <div>{msg}</div></div>}{error&&<div className="notice red" role="alert">⚠️ <div>{error}</div></div>}<button className="button" disabled={loading}>{loading?'ENVIANDO...':'ENVIAR LINK'}</button></form><div className="auth-switch"><Link href="/login">← Volver a entrar</Link></div></section></main>;
}
