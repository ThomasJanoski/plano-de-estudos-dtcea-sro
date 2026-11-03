// components/AdminFinalExamModal.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import {
  X,
  Trophy,
  Shuffle,
  Sparkles,
  CheckCircle2,
  Trash2,
  Loader2,
  BookOpen,
  Plus,
} from 'lucide-react'
import { Question } from '@/components/AdminQuizModal'

interface AdminFinalExamModalProps {
  course: { id: string; title: string; slug: string; materials: { id: string; title: string }[] }
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

export default function AdminFinalExamModal({
  course,
  isOpen,
  onClose,
  onSaved,
}: AdminFinalExamModalProps) {
  const [loading, setLoading] = useState(false)
  const [examId, setExamId] = useState<string | null>(null)
  const [passingScore, setPassingScore] = useState<number>(70)
  const [questions, setQuestions] = useState<Question[]>([])
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [targetCount, setTargetCount] = useState<number>(30)

  const supabase = createClient()

  // Carrega a VF existente
  useEffect(() => {
    if (!isOpen) return

    async function loadFinalExam() {
      setLoading(true)
      setStatusMessage(null)

      const { data: quiz } = await supabase
        .from('quizzes')
        .select(`
          id,
          passing_score,
          questions (
            statement,
            option_a,
            option_b,
            option_c,
            option_d,
            correct_option,
            explanation
          )
        `)
        .eq('course_id', course.id)
        .eq('is_final', true)
        .maybeSingle()

      if (quiz) {
        setExamId(quiz.id)
        setPassingScore(Number(quiz.passing_score))
        setQuestions((quiz.questions as any) || [])
      } else {
        setExamId(null)
        setQuestions([])
        setPassingScore(70)
      }
      setLoading(false)
    }

    loadFinalExam()
  }, [isOpen, course.id])

  // ESTRATÉGIA 1: Sortear questões das matérias cadastradas
  async function handleSampleFromMaterials() {
    try {
      setLoading(true)
      setStatusMessage(null)

      const materialIds = course.materials.map((m) => m.id)
      if (materialIds.length === 0) {
        alert('Nenhuma apostila cadastrada neste curso para sortear questões.')
        return
      }

      // Busca todas as provas e questões das apostilas deste curso
      const { data: quizzesData } = await supabase
        .from('quizzes')
        .select(`
          questions (
            statement,
            option_a,
            option_b,
            option_c,
            option_d,
            correct_option,
            explanation
          )
        `)
        .in('material_id', materialIds)

      const pool: Question[] = []
      quizzesData?.forEach((q) => {
        if (Array.isArray(q.questions)) {
          pool.push(...(q.questions as any))
        }
      })

      if (pool.length === 0) {
        alert('As apostilas ainda não possuem questões cadastradas. Gere as provas das apostilas primeiro.')
        return
      }

      // Embaralha o banco e seleciona a quantidade desejada
      const shuffled = [...pool].sort(() => 0.5 - Math.random())
      const selected = shuffled.slice(0, targetCount)

      setQuestions(selected)
      setStatusMessage(
        `🎲 ${selected.length} questões sorteadas com sucesso a partir de um banco de ${pool.length} questões das apostilas!`
      )
    } catch (err: any) {
      alert(`Falha no sorteio: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // ESTRATÉGIA 2: Gerar questões inéditas via Groq
  async function handleGenerateWithAI() {
    try {
      setLoading(true)
      setStatusMessage(null)

      const res = await fetch('/api/admin/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialTitle: `Simulado Geral Abrangente de todas as matérias: ${course.materials.map((m) => m.title).join(', ')}`,
          courseName: course.title,
          count: 10, // Adiciona 10 questões inéditas por clique
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro na IA.')

      setQuestions((prev) => [...prev, ...data.questions])
      setStatusMessage(`✨ +${data.questions.length} questões globais geradas pela IA! Total atual: ${questions.length + data.questions.length}`)
    } catch (err: any) {
      alert(`Falha: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Salvar a Prova Final no Banco
  async function handleSaveFinalExam() {
    if (questions.length === 0) {
      alert('A prova final precisa de questões antes de ser salva.')
      return
    }

    try {
      setLoading(true)
      setStatusMessage(null)

      let currentExamId = examId

      // 1. Cria ou atualiza o registro na tabela 'quizzes'
      if (!currentExamId) {
        const { data: newQuiz, error: qErr } = await supabase
          .from('quizzes')
          .insert({
            course_id: course.id,
            material_id: null, // NULL porque é a prova geral do curso todo
            title: `Verificação Final (VF) - Simulado Geral do ${course.title}`,
            passing_score: passingScore,
            is_final: true,
          })
          .select()
          .single()

        if (qErr) throw qErr
        currentExamId = newQuiz.id
        setExamId(newQuiz.id)
      } else {
        await supabase
          .from('quizzes')
          .update({ passing_score: passingScore })
          .eq('id', currentExamId)
      }

      // 2. Insere as questões
      await supabase.from('questions').delete().eq('quiz_id', currentExamId)

      const questionsToInsert = questions.map((q, idx) => ({
        quiz_id: currentExamId,
        statement: q.statement.trim(),
        option_a: q.option_a.trim(),
        option_b: q.option_b.trim(),
        option_c: q.option_c.trim(),
        option_d: q.option_d.trim(),
        correct_option: q.correct_option,
        explanation: q.explanation.trim(),
        order_index: idx + 1,
      }))

      const { error: insErr } = await supabase.from('questions').insert(questionsToInsert)
      if (insErr) throw insErr

      setStatusMessage(`🏆 Verificação Final (VF) salva com sucesso com ${questions.length} itens!`)
      onSaved()
    } catch (err: any) {
      alert(`Erro ao salvar VF: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Cabeçalho VIP */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-amber-950/40 via-slate-950 to-indigo-950/40">
          <div>
            <div className="flex items-center gap-2 text-xs font-black text-amber-400 uppercase tracking-wider mb-1">
              <Trophy className="w-4 h-4" /> Exame Geral do Curso // Verificação Final (VF)
            </div>
            <h3 className="text-lg font-bold text-white">Simulado de Conclusão: {course.title}</h3>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo com Scroll */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
          {statusMessage && (
            <div className="p-3.5 bg-amber-950/40 border border-amber-500/40 rounded-xl text-amber-300 text-sm flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-amber-400" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Configurações da Prova */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/80 p-4 rounded-xl border border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Nota de Corte (%)
              </label>
              <input
                type="number"
                min={10}
                max={100}
                value={passingScore}
                onChange={(e) => setPassingScore(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white font-mono"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">Padrão FAB: 70%</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Tamanho da Prova (Alvo)
              </label>
              <select
                value={targetCount}
                onChange={(e) => setTargetCount(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white"
              >
                <option value={30}>30 Questões</option>
                <option value={40}>40 Questões (Extenso)</option>
                <option value={50}>50 Questões (Concurso Completo)</option>
              </select>
            </div>

            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={handleSampleFromMaterials}
                disabled={loading}
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold py-2.5 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-lg shadow-amber-950/40"
                title="Monta a prova sorteando questões existentes das apostilas"
              >
                <Shuffle className="w-4 h-4" />
                Sortear das Apostilas
              </button>

              <button
                type="button"
                onClick={handleGenerateWithAI}
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                title="Gera +10 questões inéditas via Groq"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                +10 IA
              </button>
            </div>
          </div>

          {/* Listagem das Questões */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-amber-400" />
                Banco de Questões da VF ({questions.length} itens)
              </h4>
              {questions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setQuestions([])}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Limpar lista
                </button>
              )}
            </div>

            {loading ? (
              <div className="py-12 text-center text-slate-500 flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                <span>Carregando dados da Verificação Final...</span>
              </div>
            ) : questions.length === 0 ? (
              <div className="py-12 border border-dashed border-slate-800 rounded-xl text-center text-sm text-slate-500">
                A Prova Final ainda não tem questões. Clique em <strong>"Sortear das Apostilas"</strong> para puxar 30 ou 40 questões automaticamente das suas matérias!
              </div>
            ) : (
              questions.map((q, idx) => (
                <div key={idx} className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      ITEM {String(idx + 1).padStart(2, '0')}
                    </span>
                    <button
                      onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-slate-500 hover:text-red-400 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm text-slate-200">{q.statement}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                    {(['A', 'B', 'C', 'D'] as const).map((opt) => (
                      <div
                        key={opt}
                        className={`p-2 rounded-lg border ${
                          q.correct_option === opt
                            ? 'bg-emerald-950/40 border-emerald-700 text-emerald-300 font-bold'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        {opt}) {q[`option_${opt.toLowerCase()}` as keyof Question]}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Rodapé */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Total selecionado: <strong className="text-white">{questions.length}</strong> questões
          </span>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveFinalExam}
              disabled={loading || questions.length === 0}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2 px-5 rounded-lg text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-950/40"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin text-slate-950" /> : <Trophy className="w-4 h-4" />}
              Salvar Prova Final (VF)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}