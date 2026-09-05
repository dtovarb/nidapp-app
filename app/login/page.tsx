'use client';
import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoginPage(){
 const [username,setUsername]=useState(''); const [password,setPassword]=useState(''); const [loading,setLoading]=useState(false); const [error,setError]=useState(''); const router=useRouter();
 async function submit(e:FormEvent){e.preventDefault();setLoading(true);setError(''); const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})}); const j=await r.json(); setLoading(false); if(!r.ok){setError(j.error||'No se pudo iniciar sesión');return} router.push('/dashboard');}
 return <main className="auth-wrap"><section className="auth-card"><div className="auth-brand"><div className="house">🏠</div><h1 className="pixel">NIDAPP</h1><p>Tu residencia, organizada.</p></div><form className="form" onSubmit={submit}><div className="field"><label>USUARIO</label><input required value={username} onChange={e=>setUsername(e.target.value)} placeholder="ej. sofi"/></div><div className="field"><label>CONTRASEÑA</label><input required type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"/></div>{error&&<div className="notice red">⚠️ <div>{error}</div></div>}<button className="button" disabled={loading}>{loading?'ENTRANDO...':'ENTRAR'}</button></form><div className="auth-switch">¿Primera vez? <Link href="/register">Crear usuario</Link></div><div className="navnote" style={{marginTop:16}}>Demo: <b>dueno</b> / <b>demo1234</b> o <b>sofi</b> / <b>demo1234</b></div></section></main>
}
