import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Dashboard from './ui';

export default async function DashboardPage(){const session=await getSession();if(!session)redirect('/login');return <Dashboard session={session}/>;}
