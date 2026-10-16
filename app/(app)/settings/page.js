import { redirect } from 'next/navigation'
import { isConfigured } from '@/lib/supabase'
import { serverClient } from '@/lib/supabase-server'
import SettingsView from './settings-view'

export const metadata = { title: 'Settings — Env Time Machine' }

export default async function SettingsPage() {
  if (!isConfigured()) redirect('/login')
  const supabase = await serverClient()
  const { data } = (await supabase?.auth.getUser()) ?? {}
  if (!data?.user) redirect('/login')
  return <SettingsView email={data.user.email ?? ''} />
}
