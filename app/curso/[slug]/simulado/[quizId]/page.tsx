// app/curso/[slug]/simulado/[quizId]/page.tsx
import { createClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import QuizRunnerClient from '@/components/QuizRunnerClient'

export const instant = false

interface PageProps {
  params: Promise<{
    slug: string
    quizId: string
  }>
}

export default async function QuizPage({ params }: PageProps) {
  const { slug, quizId } = await params
  const supabase = await createClient()

  // 1. Checa autenticação
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 2. Busca a Prova e as Questões ordenadas
  const { data: quiz, error } = await supabase
    .from('quizzes')
    .select(`
      id,
      title,
      passing_score,
      is_final,
      course:courses (
        id,
        title,
        slug
      ),
      material:materials (
        id,
        title
      ),
      questions (
        id,
        statement,
        option_a,
        option_b,
        option_c,
        option_d,
        correct_option,
        explanation,
        order_index
      )
    `)
    .eq('id', quizId)
    .single()

  if (error || !quiz) {
    notFound()
  }

  // Ordena as questões pelo order_index
  const sortedQuestions = ((quiz.questions as any[]) || []).sort(
    (a, b) => a.order_index - b.order_index
  )

  // 3. Busca a melhor nota anterior do militar nesta prova
  const { data: previousAttempts } = await supabase
    .from('quiz_attempts')
    .select('id, score, is_passed, created_at')
    .eq('user_id', user.id)
    .eq('quiz_id', quizId)
    .order('score', { ascending: false })
    .limit(1)

  const bestAttempt = previousAttempts?.[0] || null

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        <QuizRunnerClient
          quiz={{
            id: quiz.id,
            title: quiz.title,
            passing_score: Number(quiz.passing_score),
            material_title: (quiz.material as any)?.title || 'Geral',
            course_slug: (quiz.course as any)?.slug || slug,
            questions: sortedQuestions,
          }}
          userId={user.id}
          bestAttempt={bestAttempt}
        />
      </div>
    </main>
  )
}