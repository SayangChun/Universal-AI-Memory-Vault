import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { MemoryDetailClient } from './detail-client';

export default async function MemoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const { id } = await params;
  return <MemoryDetailClient id={id} />;
}
