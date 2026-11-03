// components/QuizRunnerClient.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Award,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  RotateCcw,
  BookOpen,
  Send,
  Loader2,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react'

interface Question {
  id: string
  statement: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option: 'A' | 'B' | 'C' | 'D'
  explanation: string
  order_index: number
}

interface QuizProps {
  quiz: {
    id: string
    title: string
    passing_score: number
    material_title: string
    course_slug: string
    questions: Question[]
  }
  userId: string
  bestAttempt: { score: number; is_passed: boolean } | null
}

export default function QuizRunnerClient({ quiz, userId, bestAttempt }: QuizProps) {
  const router = useRouter()
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, 'A' | 'B' | 'C' | 'D'>>({})
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{
    score: number
    correctCount: number
    totalQuestions: number
    isPassed: boolean
  } | null>(null)

  function handleSelectOption(questionId: string, option: 'A' | 'B' | 'C' | 'D') {
    if (isSubmitted) return
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: option,
    }))
  }

  async function handleSubmit() {
    // Valida se todas foram respondidas
    const total = quiz.questions.length
    const answeredCount = Object.keys(selectedAnswers).length

    if (answeredCount < total) {
      if (
        !confirm(
          `Atenção: Você respondeu ${answeredCount} de ${total} questões. Deseja entregar a prova mesmo com questões em branco?`
        )
      ) {
        return
      }
    }

    try {
      setSubmitting(true)

      // Cálculo da nota
      let correct = 0
      quiz.questions.forEach((q) => {
        if (selectedAnswers[q.id] === q.correct_option) {
          correct++
        }
      })

      const finalScore = Math.round((correct / total) * 100)
      const passed = finalScore >= quiz.passing_score

      // Salva a tentativa no Supabase
      const { error } = await supabase.from('quiz_attempts').insert({
        user_id: userId,
        quiz_id: quiz.id,
        score: finalScore,
        is_passed: passed,
        total_questions: total,
        correct_answers: correct,
        user_answers: selectedAnswers,
      })

      if (error) throw error

      setResult({
        score: finalScore,
        correctCount: correct,
        totalQuestions: total,
        isPassed: passed,
      })

      setIsSubmitted(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err: any) {
      alert(`Erro ao registrar resultado: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  function handleRetry() {
    setSelectedAnswers({})
    setIsSubmitted(false)
    setResult(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const answeredTotal = Object.keys(selectedAnswers).length
  const totalQuestions = quiz.questions.length
  const progressPercent = Math.round((answeredTotal / totalQuestions) * 100)

  return (
    <div className="space-y-6">
      {/* Botão Voltar */}
      <Link
        href={`/curso/${quiz.course_slug}`}
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retornar à Grade do Curso
      </Link>

      {/* CABEÇALHO DA PROVA */}
      <header className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-2 border border-blue-500/20">
              <Award className="w-3.5 h-3.5" /> Verificação de Aprendizagem (VA)
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white">{quiz.title}</h1>
            <p className="text-xs text-slate-400 mt-1">
              Nota mínima de aprovação militar: <strong className="text-amber-400">{quiz.passing_score}%</strong> (Média {(quiz.passing_score / 10).toFixed(1)})
            </p>
          </div>

          {bestAttempt && !isSubmitted && (
            <div className="bg-slate-950/80 border border-slate-800 px-4 py-2.5 rounded-xl text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Sua Melhor Nota
              </span>
              <span
                className={`text-lg font-black font-mono ${
                  bestAttempt.is_passed ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {bestAttempt.score}%
              </span>
            </div>
          )}
        </div>

        {/* Barra de Progresso de Resposta (quando ainda está fazendo) */}
        {!isSubmitted && (
          <div className="mt-5 pt-4 border-t border-slate-800 flex items-center gap-4">
            <div className="flex-1 bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
              <div
                className="bg-blue-600 h-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="font-mono text-xs text-slate-400 shrink-0">
              {answeredTotal}/{totalQuestions} respondidas
            </span>
          </div>
        )}
      </header>

      {/* PLACAR DE RESULTADO APÓS ENVIO */}
      {isSubmitted && result && (
        <section
          className={`p-6 rounded-2xl border shadow-2xl animate-in fade-in duration-300 ${
            result.isPassed
              ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
              : 'bg-red-950/40 border-red-500/50 text-red-200'
          }`}
        >
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
            <div className="flex items-center gap-4">
              <div
                className={`p-3 rounded-2xl ${
                  result.isPassed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                }`}
              >
                {result.isPassed ? (
                  <ShieldCheck className="w-10 h-10" />
                ) : (
                  <AlertTriangle className="w-10 h-10" />
                )}
              </div>
              <div>
                <span className="text-xs uppercase font-bold tracking-widest block opacity-80">
                  Parecer da Banca
                </span>
                <h2 className="text-2xl font-black text-white">
                  {result.isPassed ? 'APROVADO NA VERIFICAÇÃO' : 'ÍNDICE NÃO ALCANÇADO'}
                </h2>
                <p className="text-xs mt-1 text-slate-300">
                  {result.isPassed
                    ? `Parabéns, combatente! Você superou o corte de ${quiz.passing_score}%.`
                    : `Você precisa de no mínimo ${quiz.passing_score}% para aprovação. Revise o material e refaça a prova.`}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:items-end gap-2">
              <div className="bg-slate-950/80 px-5 py-3 rounded-xl border border-slate-800 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Sua Nota</span>
                <span className="text-3xl font-black font-mono text-white">
                  {result.score}%
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  ({result.correctCount} de {result.totalQuestions} acertos)
                </span>
              </div>

              <button
                type="button"
                onClick={handleRetry}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer w-full"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Refazer Prova
              </button>
            </div>
          </div>
        </section>
      )}

      {/* LISTA DE QUESTÕES */}
      <div className="space-y-5">
        {quiz.questions.map((q, idx) => {
          const userAnswer = selectedAnswers[q.id]
          const isCorrect = userAnswer === q.correct_option

          return (
            <div
              key={q.id}
              className={`p-6 rounded-2xl border transition-all ${
                isSubmitted
                  ? isCorrect
                    ? 'bg-emerald-950/10 border-emerald-500/30'
                    : 'bg-red-950/10 border-red-500/30'
                  : 'bg-slate-900 border-slate-800'
              }`}
            >
              {/* Enunciado e Indicador */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-slate-800 text-slate-300 shrink-0">
                  ITEM {String(idx + 1).padStart(2, '0')}
                </span>

                {isSubmitted && (
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      isCorrect
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {isCorrect ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {isCorrect ? 'Correto (+1)' : 'Incorreto'}
                  </span>
                )}
              </div>

              <p className="text-sm sm:text-base font-medium text-slate-100 leading-relaxed mb-5">
                {q.statement}
              </p>

              {/* Opções A, B, C, D */}
              <div className="space-y-2.5">
                {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                  const isSelected = userAnswer === opt
                  const isTheCorrectOne = q.correct_option === opt

                  let optionStyle = 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'

                  if (isSubmitted) {
                    if (isTheCorrectOne) {
                      optionStyle = 'bg-emerald-950/50 border-emerald-500 text-emerald-200 font-semibold'
                    } else if (isSelected && !isTheCorrectOne) {
                      optionStyle = 'bg-red-950/50 border-red-500 text-red-200 font-semibold line-through'
                    } else {
                      optionStyle = 'bg-slate-950/30 border-slate-900 text-slate-500 opacity-60'
                    }
                  } else if (isSelected) {
                    optionStyle = 'bg-blue-950/60 border-blue-500 text-white font-semibold shadow-md shadow-blue-950/50'
                  }

                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={isSubmitted}
                      onClick={() => handleSelectOption(q.id, opt)}
                      className={`w-full text-left p-3.5 rounded-xl border text-xs sm:text-sm flex items-start gap-3 transition-all cursor-pointer disabled:cursor-default ${optionStyle}`}
                    >
                      <span
                        className={`w-6 h-6 rounded-lg font-mono font-bold text-xs flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : isSubmitted && isTheCorrectOne
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {opt}
                      </span>
                      <span className="flex-1 mt-0.5 leading-snug">
                        {q[`option_${opt.toLowerCase()}` as keyof Question]}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Fundamentação / Comentário da Banca */}
              {isSubmitted && q.explanation && (
                <div className="mt-4 pt-4 border-t border-slate-800/80 text-xs text-slate-400 leading-relaxed bg-slate-950/50 p-3 rounded-xl">
                  <strong className="text-slate-200 block mb-1">Fundamentação Regulamentar:</strong>
                  {q.explanation}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* BOTÃO DE ENTREGA */}
      {!isSubmitted && (
        <div className="sticky bottom-6 z-20 bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-slate-800 shadow-2xl flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Respondeu <strong className="text-white">{answeredTotal}</strong> de{' '}
            <strong className="text-white">{totalQuestions}</strong>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || answeredTotal === 0}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-blue-950 transition-all cursor-pointer"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {submitting ? 'Apurando nota...' : 'Entregar Prova'}
          </button>
        </div>
      )}
    </div>
  )
}