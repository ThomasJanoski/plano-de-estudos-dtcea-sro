// components/AdminQuizModal.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import {
  X,
  Sparkles,
  CheckCircle2,
  Trash2,
  Loader2,
  Award,
  BookOpen,
  Plus,
  HelpCircle,
} from 'lucide-react'

export interface Question {
  statement: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option: 'A' | 'B' | 'C' | 'D'
  explanation: string
}

interface AdminQuizModalProps {
  material: { id: string; title: string }
  course: { id: string; title: string; slug: string }
  isOpen: boolean
  onClose: () => void
}

export default function AdminQuizModal({
  material,
  course,
  isOpen,
  onClose,
}: AdminQuizModalProps) {
  const [loading, setLoading] = useState(false)
  const [generatingAI, setGeneratingAI] = useState(false)
  const [quizId, setQuizId] = useState<string | null>(null)
  const [passingScore, setPassingScore] = useState<number>(70)
  const [questions, setQuestions] = useState<Question[]>([])
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const supabase = createClient()

  // Carrega a prova existente ao abrir
  useEffect(() => {
    if (!isOpen) return

    async function loadQuiz() {
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
        .eq('material_id', material.id)
        .maybeSingle()

      if (quiz) {
        setQuizId(quiz.id)
        setPassingScore(Number(quiz.passing_score))
        setQuestions((quiz.questions as any) || [])
      } else {
        setQuizId(null)
        setQuestions([])
        setPassingScore(70)
      }
      setLoading(false)
    }

    loadQuiz()
  }, [isOpen, material.id])

  // Gerar questões via Groq AI
  async function handleGenerateWithAI(count: number = 5) {
    try {
      setGeneratingAI(true)
      setStatusMessage(null)

      const res = await fetch('/api/admin/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialTitle: material.title,
          courseName: course.title,
          count,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro na geração de IA.')

      // Adiciona as novas questões às já existentes ou substitui se estiver vazio
      setQuestions((prev) => [...prev, ...data.questions])
      setStatusMessage(`✅ ${data.questions.length} questões adicionadas pelo Groq! Você pode editá-las abaixo.`)
    } catch (err: any) {
      alert(`Falha ao gerar questões: ${err.message}`)
    } finally {
      setGeneratingAI(false)
    }
  }

  // Adicionar questão em branco manualmente
  function handleAddManualQuestion() {
    const blankQuestion: Question = {
      statement: '',
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_option: 'A',
      explanation: '',
    }
    setQuestions((prev) => [...prev, blankQuestion])
  }

  // Atualizar campo específico de uma questão
  function updateQuestionField<K extends keyof Question>(
    index: number,
    field: K,
    value: Question[K]
  ) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, [field]: value } : q))
    )
  }

  // Deletar uma questão da lista
  function handleDeleteQuestion(index: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== index))
  }

  // Salvar no Banco
  async function handleSaveQuiz() {
    if (questions.length === 0) {
      alert('Adicione pelo menos uma questão antes de salvar a prova.')
      return
    }

    // Validação básica de integridade
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      if (!q.statement.trim() || !q.option_a.trim() || !q.option_b.trim() || !q.option_c.trim() || !q.option_d.trim()) {
        alert(`O Item ${i + 1} possui campos em branco (enunciado ou alternativas). Preencha-os antes de salvar.`)
        return
      }
    }

    try {
      setLoading(true)
      setStatusMessage(null)

      let currentQuizId = quizId

      // 1. Cria ou Atualiza a Prova
      if (!currentQuizId) {
        const { data: newQuiz, error: qErr } = await supabase
          .from('quizzes')
          .insert({
            course_id: course.id,
            material_id: material.id,
            title: `Verificação de Aprendizagem: ${material.title}`,
            passing_score: passingScore,
            is_final: false,
          })
          .select()
          .single()

        if (qErr) throw qErr
        currentQuizId = newQuiz.id
        setQuizId(newQuiz.id)
      } else {
        await supabase
          .from('quizzes')
          .update({ passing_score: passingScore })
          .eq('id', currentQuizId)
      }

      // 2. Substitui as questões antigas pelas editadas
      await supabase.from('questions').delete().eq('quiz_id', currentQuizId)

      const questionsToInsert = questions.map((q, index) => ({
        quiz_id: currentQuizId,
        statement: q.statement.trim(),
        option_a: q.option_a.trim(),
        option_b: q.option_b.trim(),
        option_c: q.option_c.trim(),
        option_d: q.option_d.trim(),
        correct_option: q.correct_option,
        explanation: q.explanation.trim(),
        order_index: index + 1,
      }))

      const { error: insErr } = await supabase.from('questions').insert(questionsToInsert)
      if (insErr) throw insErr

      setStatusMessage('🎯 Prova salva e atualizada com sucesso no banco de dados!')
    } catch (err: any) {
      alert(`Erro ao salvar prova: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Excluir prova inteira
  async function handleDeleteQuiz() {
    if (!quizId || !confirm('Deseja realmente apagar esta prova inteira e todas as notas dos alunos?')) return

    try {
      setLoading(true)
      await supabase.from('quizzes').delete().eq('id', quizId)
      setQuizId(null)
      setQuestions([])
      setStatusMessage('Prova removida com sucesso.')
    } catch (err: any) {
      alert(`Erro: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Cabeçalho */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">
              <Award className="w-4 h-4" /> Gestão de Prova // Verificação de Aprendizagem (VA)
            </div>
            <h3 className="text-lg font-bold text-white line-clamp-1">{material.title}</h3>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo com Scroll */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
          {statusMessage && (
            <div className="p-3.5 bg-blue-950/60 border border-blue-800/80 rounded-xl text-blue-300 text-sm flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-blue-400" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Painel Superior: Nota de Corte + Ações de Criação */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/80 p-4 rounded-xl border border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Nota de Corte (% de acertos)
              </label>
              <input
                type="number"
                min={10}
                max={100}
                value={passingScore}
                onChange={(e) => setPassingScore(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">Padrão FAB: 70% (Média 7.0)</span>
            </div>

            <div className="flex flex-col justify-end">
              <button
                type="button"
                onClick={() => handleGenerateWithAI(5)}
                disabled={generatingAI || loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-lg text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/40 transition-colors cursor-pointer"
              >
                {generatingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-300" />}
                {generatingAI ? 'Groq gerando...' : 'Gerar +5 Questões com IA'}
              </button>
            </div>

            <div className="flex flex-col justify-end">
              <button
                type="button"
                onClick={handleAddManualQuestion}
                disabled={loading}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium py-2.5 px-4 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                Criar Questão Manual
              </button>
            </div>
          </div>

          {/* Lista de Questões Editáveis */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-400" />
                Questões Configuradas ({questions.length})
              </h4>
              {questions.length > 0 && (
                <button
                  type="button"
                  onClick={() => confirm('Apagar todas as questões da lista?') && setQuestions([])}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Limpar lista
                </button>
              )}
            </div>

            {loading ? (
              <div className="py-12 text-center text-slate-500 flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                <span>Carregando dados da prova...</span>
              </div>
            ) : questions.length === 0 ? (
              <div className="py-12 border border-dashed border-slate-800 rounded-xl text-center text-sm text-slate-500">
                Nenhuma questão nesta prova ainda. Use o botão da IA ou crie manualmente uma questão acima.
              </div>
            ) : (
              questions.map((q, idx) => (
                <div
                  key={idx}
                  className="p-5 bg-slate-950/90 border border-slate-800 rounded-xl space-y-4 hover:border-slate-700 transition-colors"
                >
                  {/* Cabeçalho da Questão */}
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      ITEM {String(idx + 1).padStart(2, '0')}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteQuestion(idx)}
                      className="text-slate-500 hover:text-red-400 p-1.5 rounded hover:bg-red-500/10 transition-colors"
                      title="Excluir questão"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Enunciado */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Enunciado Militar
                    </label>
                    <textarea
                      rows={2}
                      value={q.statement}
                      onChange={(e) => updateQuestionField(idx, 'statement', e.target.value)}
                      placeholder="Ex: De acordo com o RDAER, a transgressão da disciplina é configurada por..."
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 resize-y"
                    />
                  </div>

                  {/* Alternativas A, B, C, D */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Alternativas (Selecione a Bolinha da Correta)
                    </label>
                    {(['A', 'B', 'C', 'D'] as const).map((opt) => (
                      <div
                        key={opt}
                        className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                          q.correct_option === opt
                            ? 'border-emerald-600/70 bg-emerald-950/30'
                            : 'border-slate-800 bg-slate-900/60'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`correct_opt_${idx}`}
                          id={`radio_${idx}_${opt}`}
                          checked={q.correct_option === opt}
                          onChange={() => updateQuestionField(idx, 'correct_option', opt)}
                          className="w-4 h-4 text-emerald-500 focus:ring-0 cursor-pointer accent-emerald-500"
                        />
                        <label
                          htmlFor={`radio_${idx}_${opt}`}
                          className={`font-mono font-bold text-xs px-2 py-0.5 rounded cursor-pointer ${
                            q.correct_option === opt ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {opt}
                        </label>
                        <input
                          type="text"
                          value={q[`option_${opt.toLowerCase()}` as keyof Question]}
                          onChange={(e) =>
                            updateQuestionField(
                              idx,
                              `option_${opt.toLowerCase()}` as keyof Question,
                              e.target.value
                            )
                          }
                          placeholder={`Texto da alternativa ${opt}...`}
                          className="flex-1 bg-transparent border-0 text-sm text-slate-200 focus:outline-none placeholder:text-slate-600"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Fundamentação / Artigo */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
                      Fundamentação / Regulamento Oficial (Exibido no Gabarito)
                    </label>
                    <input
                      type="text"
                      value={q.explanation}
                      onChange={(e) => updateQuestionField(idx, 'explanation', e.target.value)}
                      placeholder="Ex: Conforme Art. 14 do RDAER, a advertência é a forma mais branda..."
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Rodapé de Ações */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <div>
            {quizId && (
              <button
                type="button"
                onClick={handleDeleteQuiz}
                disabled={loading}
                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Excluir Prova Inteira
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveQuiz}
              disabled={loading || questions.length === 0}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-2 px-5 rounded-lg text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-md shadow-blue-950"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Salvar Prova ({questions.length} itens)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}