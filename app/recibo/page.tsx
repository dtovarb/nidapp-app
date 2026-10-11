'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

type Receipt={number:string;home:string;address:string|null;owner:string|null;owner_email:string|null;resident:string;room:string|null;due_date:string;paid_at:string;amount:number;services_amount:number;services_detail:{name:string;amount:number}[];total:number};
const money=(n:number)=>'$'+n.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2});

// Número en letras ("trescientos diez mil"), como se escribe en los recibos.
const U=['','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez','once','doce','trece','catorce','quince','dieciséis','diecisiete','dieciocho','diecinueve','veinte','veintiuno','veintidós','veintitrés','veinticuatro','veinticinco','veintiséis','veintisiete','veintiocho','veintinueve'];
const D=['','','','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa'];
const C=['','ciento','doscientos','trescientos','cuatrocientos','quinientos','seiscientos','setecientos','ochocientos','novecientos'];
function upTo999(n:number):string{if(n===0)return '';if(n===100)return 'cien';const c=Math.floor(n/100),r=n%100;const rest=r<30?U[r]:D[Math.floor(r/10)]+(r%10?' y '+U[r%10]:'');return [C[c],rest].filter(Boolean).join(' ');}
const apocope=(w:string)=>w.replace(/veintiuno$/,'veintiún').replace(/uno$/,'un');
export function inWords(n:number):string{n=Math.floor(n);if(n===0)return 'cero';const mill=Math.floor(n/1e6),th=Math.floor((n%1e6)/1000),rest=n%1000;const parts:string[]=[];
 if(mill)parts.push(mill===1?'un millón':`${apocope(upTo999(mill))} millones`);
 if(th)parts.push(th===1?'mil':`${apocope(upTo999(th))} mil`);
 if(rest)parts.push(upTo999(rest));return parts.join(' ');}

function ReceiptView(){
 const id=useSearchParams().get('id')||'';
 const [r,setR]=useState<Receipt|null>(null);const [error,setError]=useState('');
 useEffect(()=>{fetch(`/api/receipt?id=${encodeURIComponent(id)}`).then(async res=>{const j=await res.json();if(!res.ok)throw new Error(j.error||'No se pudo cargar el recibo');setR(j)}).catch(e=>setError(e.message))},[id]);
 if(error)return <main className="report"><p>{error}</p><Link className="button" href="/dashboard?s=alquiler">← Volver</Link></main>;
 if(!r)return <main className="report"><p>Preparando el recibo...</p></main>;
 const [y,m]=r.due_date.split('-').map(Number);const period=new Date(y,m-1,1).toLocaleDateString('es-AR',{month:'long',year:'numeric'});
 const cents=Math.round((r.total%1)*100);
 return <main className="report receipt">
  <div className="report-actions no-print"><button className="button purple" onClick={()=>window.print()}>🖨️ Imprimir o guardar PDF</button><Link className="button" href="/dashboard?s=alquiler">← Volver</Link></div>
  <article className="receipt-sheet">
   <header className="receipt-head"><img src="/icons/icon-192.png" alt="" className="report-logo"/><div><h1>Recibo de pago</h1><p>{r.home}{r.address?` · ${r.address}`:''}</p></div><div className="receipt-no"><span>N.º</span><b>{r.number}</b></div></header>
   <p className="receipt-text">Recibí de <b>{r.resident}</b>{r.room?<> (habitación {r.room})</>:null} la suma de <b>pesos {inWords(r.total)}{cents?` con ${cents}/100`:''}</b> ({money(r.total)}) en concepto de alquiler del mes de <b>{period}</b>.</p>
   <table className="report-table"><thead><tr><th>Concepto</th><th>Monto</th></tr></thead><tbody>
    <tr><td>Alquiler de {period}{r.room?` · Habitación ${r.room}`:''}</td><td>{money(r.amount)}</td></tr>
    {r.services_detail.length?r.services_detail.map(s=><tr key={s.name}><td>{s.name}</td><td>{money(s.amount)}</td></tr>):r.services_amount>0?<tr><td>Servicios</td><td>{money(r.services_amount)}</td></tr>:null}
    <tr className="receipt-total"><td>Total</td><td>{money(r.total)}</td></tr>
   </tbody></table>
   <div className="receipt-meta"><div><span>Fecha de pago</span><b>{new Date(r.paid_at).toLocaleDateString('es-AR')}</b></div><div><span>Vencimiento</span><b>{new Date(r.due_date+'T12:00:00').toLocaleDateString('es-AR')}</b></div></div>
   <div className="receipt-sign"><div className="sign-line"/><span>{r.owner||'Firma'}{r.owner?' · Firma':''}</span></div>
   <footer className="report-foot">Emitido con NIDAPP el {new Date().toLocaleDateString('es-AR')}. Este recibo deja constancia del pago confirmado por el dueño de la residencia.</footer>
  </article>
 </main>;
}
export default function ReceiptPage(){return <Suspense><ReceiptView/></Suspense>}
