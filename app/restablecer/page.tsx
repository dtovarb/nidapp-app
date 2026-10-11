'use client';
import { FormEvent, Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function ResetForm(){
 const token=useSearchParams().get('token')||'';
 const [password,setPassword]=useState(''); const [confirm,setConfirm]=useState(''); const [done,setDone]=useState(false); const [error,setError]=useState(''); const [loading,setLoading]=useState(false);
 async function submit(e:FormEvent){e.preventDefault();if(password!==confirm)return setError('Las contraseñas no coinciden.');setLoading(true);setError('');const r=await fetch('/api/auth/reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,password})});const j=await r.json();setLoading(false);if(!r.ok)setError(j.error||'No se pudo cambiar');else setDone(true);}
 return <main className="auth-wrap"><section className="auth-card"><div className="auth-brand"><img className="app-logo" src="/icons/icon-192.png" alt="NIDAPP"/><h1 className="pixel">NUEVA CLAVE</h1><p>Elegí tu contraseña nueva.</p></div>{done?<div className="form"><div className="notice green">✅ <div>Listo, ya podés entrar con tu contraseña nueva.</div></div><Link href="/login" className="button" style={{textAlign:'center'}}>ENTRAR</Link></div>:<form className="form" onSubmit={submit}><div className="field"><label htmlFor="rs-pass">CONTRASEÑA NUEVA</label><input id="rs-pass" required type="password" minLength={8} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo 8 caracteres"/></div><div className="field"><label htmlFor="rs-conf">REPETIR</label><input id="rs-conf" required type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)}/></div>{error&&<div className="notice red" role="alert">⚠️ <div>{error}</div></div>}<button className="button" disabled={loading||!token}>{loading?'GUARDANDO...':'GUARDAR CONTRASEÑA'}</button>{!token&&<p className="mini muted">El link no es válido. <Link href="/recuperar">Pedí uno nuevo</Link>.</p>}</form>}</section></main>;
}
export default function ResetPage(){return <Suspense><ResetForm/></Suspense>}
