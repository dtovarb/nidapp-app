'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FinanceChart, FinanceTable, MonthDonuts, type FinanceData } from '../dashboard/finance';
import { money, monthLabel } from '../dashboard/sections';

// Reporte mensual para imprimir o guardar como PDF (desde la ventana de impresión del navegador).
function Report(){
 const month=useSearchParams().get('mes')||'';
 const [data,setData]=useState<FinanceData|null>(null);const [error,setError]=useState('');
 useEffect(()=>{fetch(`/api/finance?month=${month}&months=12`).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error||'No se pudo cargar el reporte');setData(j)}).catch(e=>setError(e.message))},[month]);
 if(error)return <main className="report"><p>{error}</p><Link href="/login">Entrar</Link></main>;
 if(!data)return <main className="report"><p>Preparando el reporte...</p></main>;
 const cur=data.series.find(s=>s.month===data.month)!;
 const pending=data.payments.filter(p=>p.due_date.slice(0,7)===data.month&&!p.paid&&!p.cancelled);
 return <main className="report">
  <div className="report-actions no-print"><button className="button purple" onClick={()=>window.print()}>🖨️ Imprimir o guardar PDF</button><Link className="button" href="/dashboard?s=finanzas">← Volver</Link></div>
  <header className="report-head"><img src="/icons/icon-192.png" alt="" className="report-logo"/><div><h1>Finanzas · <span className="cap">{monthLabel(data.month)}</span></h1><p>{data.home} · generado el {new Date().toLocaleDateString('es-AR')}</p></div></header>
  <section className="report-kpis"><div><span>Ingresos</span><b>{money(cur.income)}</b><small>Alquileres {money(cur.rent)} · otros {money(cur.other)}</small></div><div><span>Gastos</span><b>{money(cur.expenses)}</b></div><div className="profit"><span>Ganancia</span><b>{money(cur.profit)}</b></div><div><span>Sin cobrar</span><b>{money(cur.pending)}</b></div></section>
  <section><h2>Reparto del mes</h2><MonthDonuts data={data}/></section>
  <section><h2>Ganancia mensual · últimos 12 meses</h2><FinanceChart series={data.series} printable/><FinanceTable series={data.series}/></section>
  <section><h2>Alquileres cobrados en el mes</h2>{data.detail.collected.length?<table className="report-table"><thead><tr><th>Habitante</th><th>Mes del alquiler</th><th>Pagado el</th><th>Monto</th></tr></thead><tbody>{data.detail.collected.map(c=><tr key={c.id}><td>{c.name}{c.room?` (Hab. ${c.room})`:''}</td><td className="cap">{monthLabel(c.due_date.slice(0,7))}</td><td>{new Date(c.paid_at).toLocaleDateString('es-AR')}</td><td>{money(c.total)}</td></tr>)}</tbody></table>:<p>Sin cobros confirmados.</p>}</section>
  {pending.length>0&&<section><h2>Pendientes del mes</h2><table className="report-table"><thead><tr><th>Habitante</th><th>Vence</th><th>Monto</th></tr></thead><tbody>{pending.map(p=><tr key={p.id}><td>{p.name}</td><td>{new Date(p.due_date+'T12:00:00').toLocaleDateString('es-AR')}</td><td>{money(p.total)}</td></tr>)}</tbody></table></section>}
  {data.detail.incomes.length>0&&<section><h2>Otros ingresos</h2><table className="report-table"><thead><tr><th>Fecha</th><th>Concepto</th><th>Categoría</th><th>Monto</th></tr></thead><tbody>{data.detail.incomes.map(i=><tr key={i.id}><td>{new Date(i.received_on+'T12:00:00').toLocaleDateString('es-AR')}</td><td>{i.concept}</td><td>{i.category}</td><td>{money(i.amount)}</td></tr>)}</tbody></table></section>}
  <section><h2>Gastos</h2>{data.detail.expenses.length?<table className="report-table"><thead><tr><th>Fecha</th><th>Artículo o trabajo</th><th>Categoría</th><th>Monto</th></tr></thead><tbody>{data.detail.expenses.map(x=><tr key={x.id}><td>{new Date(x.spent_on+'T12:00:00').toLocaleDateString('es-AR')}</td><td>{x.item}{x.quantity>1?` ×${x.quantity}`:''}</td><td>{x.category}</td><td>{money(x.amount)}</td></tr>)}</tbody></table>:<p>Sin gastos cargados.</p>}</section>
  <footer className="report-foot">NIDAPP · Los alquileres cuentan en el mes en que se confirmó el pago; otros ingresos y gastos, en el mes de su fecha.</footer>
 </main>;
}
export default function ReportPage(){return <Suspense><Report/></Suspense>}
