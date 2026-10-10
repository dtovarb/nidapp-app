'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage(){
 const [username,setUsername]=useState(''); const [password,setPassword]=useState(''); const [loading,setLoading]=useState(false); const [error,setError]=useState(''); const router=useRouter();
 async function submit(e:FormEvent){e.preventDefault();setLoading(true);setError(''); const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})}); const j=await r.json(); setLoading(false); if(!r.ok){setError(j.error||'No se pudo iniciar sesión');return} router.push('/dashboard');}
 return <main className="auth-wrap"><section className="auth-card"><div className="auth-brand"><div className="house">🏠</div><h1 className="pixel">NIDAPP</h1><p>Tu residencia, organizada.</p></div><form className="form" onSubmit={submit}><div className="field"><label htmlFor="login-user">USUARIO</label><input id="login-user" required autoComplete="username" autoCapitalize="none" value={username} onChange={e=>setUsername(e.target.value)} placeholder="tu usuario"/></div><div className="field"><label htmlFor="login-pass">CONTRASEÑA</label><input id="login-pass" required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></div>{error&&<div className="notice red" role="alert">⚠️ <div>{error}</div></div>}<button className="button" disabled={loading}>{loading?'ENTRANDO...':'ENTRAR'}</button></form><div className="auth-switch">¿No tenés usuario? Pedíselo al dueño de la residencia.</div></section></main>
}
