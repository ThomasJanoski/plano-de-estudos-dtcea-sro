// app/admin/page.tsx
import { connection } from 'next/server'
import { requireAdmin } from '@/lib/auth-admin'
import AdminDashboardClient from '@/components/AdminDashboardClient'

export const instant = false

export default async function AdminPage() {
  // Avisa ao Next.js 16 que a página só deve ser executada quando houver uma requisição real
  await connection()

  const { supabase } = await requireAdmin()

  // Buscar os cursos e as apostilas cadastradas
  const { data: courses } = await supabase
    .from('courses')
    .select(`
      id,
      title,
      slug,
      materials (
        id,
        title,
        order_index,
        file_url
      )
    `)
    .order('order_index', { referencedTable: 'materials', ascending: true })

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="border-b border-slate-800 pb-5">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-amber-500/10 text-amber-400 text-xs font-semibold tracking-wider uppercase mb-2 border border-amber-500/20">
            Acesso Restrito // P-2 Inteligência & Ensino
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Painel de Comando do Administrador
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Gestão de manuais, uploads para o Storage e ordenação das disciplinas CESD / CFC.
          </p>
        </header>

        <AdminDashboardClient initialCourses={courses || []} />
      </div>
    </main>
  )
}