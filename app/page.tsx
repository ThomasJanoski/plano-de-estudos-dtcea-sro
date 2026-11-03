// app/page.tsx
import { connection } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { GraduationCap, ArrowRight, BookOpen } from 'lucide-react'

export const instant = false

export default async function HomePage() {
  await connection();
  const supabase = await createClient()

  // 1. CHECAGEM DE SEGURANÇA: Se não estiver logado, redireciona para o login
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // 2. Busca os cursos disponíveis
  const { data: courses } = await supabase
    .from('courses')
    .select('*')
    .order('title', { ascending: true })

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="border-b border-slate-800 pb-6">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 text-xs font-bold uppercase tracking-wider mb-2 border border-blue-500/20">
            Força Aérea Brasileira // P-2 Ensino
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white">
            Plataforma de Preparação Militar
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Selecione o seu curso de formação ou especialização para iniciar os estudos e simulados.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {courses?.map((course) => (
            <Link
              key={course.id}
              href={`/curso/${course.slug}`}
              className="group p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-900/80 transition-all shadow-xl flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase">
                    {course.slug}
                  </span>
                  <BookOpen className="w-5 h-5 text-slate-500 group-hover:text-blue-400 transition-colors" />
                </div>
                <h2 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
                  {course.title}
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
                  {course.description}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-blue-400">
                <span>Acessar Disciplinas e Simulados</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}