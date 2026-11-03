// components/AdminDashboardClient.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Upload,
  Trash2,
  BookOpen,
  CheckCircle2,
  Loader2,
  FileText,
  Award,
  Zap,
  ShieldCheck,
  RefreshCw,
  X,
  AlertTriangle,
  Info,
  ShieldAlert,
  Layers,
  Sparkles,
} from 'lucide-react'
import AdminQuizModal from '@/components/AdminQuizModal'
import AdminTopicsModal from '@/components/AdminTopicsModal'
import { Trophy } from 'lucide-react'
import AdminFinalExamModal from '@/components/AdminFinalExamModal'

interface Material {
  id: string
  title: string
  order_index: number
  file_url: string
}

interface Course {
  id: string
  title: string
  slug: string
  materials: Material[]
}

interface ToastNotification {
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  message: string
}

interface ConfirmDialogState {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  isDestructive?: boolean
  onConfirm: () => void
}

export default function AdminDashboardClient({ initialCourses }: { initialCourses: Course[] }) {
  const router = useRouter()
  const [courses, setCourses] = useState<Course[]>(initialCourses)
  const [selectedCourseId, setSelectedCourseId] = useState<string>(initialCourses[0]?.id || '')

  // Estados do formulário de upload
  const [title, setTitle] = useState('')
  const [orderIndex, setOrderIndex] = useState<number>(1)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  // Sistema de Notificações e Confirmação
  const [toast, setToast] = useState<ToastNotification | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)

  const [isFinalExamModalOpen, setIsFinalExamModalOpen] = useState(false)

  function showToast(type: ToastNotification['type'], title: string, message: string) {
    setToast({ type, title, message })
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev))
    }, 4500)
  }

  // Modais Individuais
  const [selectedMaterialForQuiz, setSelectedMaterialForQuiz] = useState<Material | null>(null)
  const [selectedMaterialForTopics, setSelectedMaterialForTopics] = useState<Material | null>(null)

  // LOTE DE PROVAS
  const [isBatchQuizModalOpen, setIsBatchQuizModalOpen] = useState(false)
  const [batchQuizMode, setBatchQuizMode] = useState<'only_missing' | 'overwrite_all'>('only_missing')
  const [batchQuestionCount, setBatchQuestionCount] = useState<number>(5)
  const [isBatchQuizGenerating, setIsBatchQuizGenerating] = useState(false)
  const [batchQuizProgress, setBatchQuizProgress] = useState<{
    current: number
    total: number
    currentTitle: string
  } | null>(null)

  // LOTE DE TÓPICOS
  const [isBatchTopicsModalOpen, setIsBatchTopicsModalOpen] = useState(false)
  const [batchTopicsMode, setBatchTopicsMode] = useState<'only_missing' | 'overwrite_all'>('only_missing')
  const [isBatchTopicsGenerating, setIsBatchTopicsGenerating] = useState(false)
  const [batchTopicsProgress, setBatchTopicsProgress] = useState<{
    current: number
    total: number
    currentTitle: string
  } | null>(null)

  const activeCourse = courses.find((c) => c.id === selectedCourseId)

  // Upload manual PDF
  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !activeCourse || !title.trim()) {
      showToast('warning', 'Campos Incompletos', 'Preencha o título e selecione um arquivo PDF oficial.')
      return
    }

    if (file.type !== 'application/pdf') {
      showToast('error', 'Formato Inválido', 'O arquivo precisa ser obrigatoriamente um documento PDF.')
      return
    }

    try {
      setLoading(true)

      const cleanFileName = file.name
        .toLowerCase()
        .replace(/[^a-z0-9.]/g, '-')
        .replace(/-+/g, '-')
      const storagePath = `${activeCourse.slug}/${Date.now()}-${cleanFileName}`

      const { error: uploadError } = await supabase.storage
        .from('materials')
        .upload(storagePath, file, { cacheControl: '3600', upsert: false })

      if (uploadError) throw new Error(`Erro ao enviar ao Storage: ${uploadError.message}`)

      const { data: newMaterial, error: dbError } = await supabase
        .from('materials')
        .insert({
          course_id: activeCourse.id,
          title: title.trim(),
          order_index: orderIndex,
          file_url: storagePath,
        })
        .select()
        .single()

      if (dbError) throw new Error(`Erro ao registrar no banco: ${dbError.message}`)

      setCourses((prev) =>
        prev.map((c) =>
          c.id === activeCourse.id
            ? { ...c, materials: [...c.materials, newMaterial].sort((a, b) => a.order_index - b.order_index) }
            : c
        )
      )

      setTitle('')
      setFile(null)
      setOrderIndex((prev) => prev + 1)
      showToast('success', 'Manual Armazenado', 'Apostila cadastrada e enviada com sucesso!')
      router.refresh()
    } catch (err: any) {
      showToast('error', 'Falha no Upload', err.message || 'Erro inesperado ao cadastrar material.')
    } finally {
      setLoading(false)
    }
  }

  // Deletar Apostila
  function requestDelete(material: Material) {
    setConfirmDialog({
      isOpen: true,
      title: 'Confirmar Exclusão de Material',
      message: `Tem certeza que deseja excluir o manual "${material.title}"? O PDF, os tópicos e as provas vinculadas a ele serão apagados.`,
      confirmText: 'Excluir Definitivamente',
      isDestructive: true,
      onConfirm: async () => {
        try {
          setLoading(true)
          await supabase.storage.from('materials').remove([material.file_url])
          const { error } = await supabase.from('materials').delete().eq('id', material.id)
          if (error) throw error

          setCourses((prev) =>
            prev.map((c) =>
              c.id === selectedCourseId
                ? { ...c, materials: c.materials.filter((m) => m.id !== material.id) }
                : c
            )
          )
          showToast('success', 'Material Removido', 'Apostila excluída com sucesso.')
          router.refresh()
        } catch (err: any) {
          showToast('error', 'Erro ao Excluir', err.message)
        } finally {
          setLoading(false)
          setConfirmDialog(null)
        }
      },
    })
  }

  // EXECUTA LOTE DE PROVAS
  async function startBatchQuizGeneration() {
    if (!activeCourse || activeCourse.materials.length === 0) return

    setIsBatchQuizModalOpen(false)
    setIsBatchQuizGenerating(true)

    try {
      const materials = activeCourse.materials

      const { data: existingQuizzes } = await supabase
        .from('quizzes')
        .select('id, material_id')
        .eq('course_id', activeCourse.id)

      const existingMap = new Map<string, string>()
      existingQuizzes?.forEach((q) => {
        if (q.material_id) existingMap.set(q.material_id, q.id)
      })

      let targetMaterials = materials
      if (batchQuizMode === 'only_missing') {
        targetMaterials = materials.filter((m) => !existingMap.has(m.id))
      }

      if (targetMaterials.length === 0) {
        showToast('info', 'Tudo Atualizado', 'Todas as apostilas já possuem provas cadastradas.')
        setIsBatchQuizGenerating(false)
        return
      }

      for (let i = 0; i < targetMaterials.length; i++) {
        const mat = targetMaterials[i]

        setBatchQuizProgress({
          current: i + 1,
          total: targetMaterials.length,
          currentTitle: mat.title,
        })

        const res = await fetch('/api/admin/generate-quiz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            materialTitle: mat.title,
            courseName: activeCourse.title,
            count: batchQuestionCount,
          }),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || `Erro ao gerar questões para ${mat.title}`)

        let quizId = existingMap.get(mat.id)

        if (quizId && batchQuizMode === 'overwrite_all') {
          await supabase.from('questions').delete().eq('quiz_id', quizId)
        } else {
          const { data: newQuiz, error: qErr } = await supabase
            .from('quizzes')
            .insert({
              course_id: activeCourse.id,
              material_id: mat.id,
              title: `Verificação de Aprendizagem: ${mat.title}`,
              passing_score: 70,
              is_final: false,
            })
            .select()
            .single()

          if (qErr) throw qErr
          quizId = newQuiz.id
        }

        const questionsToInsert = data.questions.map((q: any, idx: number) => ({
          quiz_id: quizId,
          statement: q.statement,
          option_a: q.option_a,
          option_b: q.option_b,
          option_c: q.option_c,
          option_d: q.option_d,
          correct_option: q.correct_option,
          explanation: q.explanation,
          order_index: idx + 1,
        }))

        await supabase.from('questions').insert(questionsToInsert)
      }

      showToast('success', 'Missão Cumprida', `${targetMaterials.length} provas geradas e salvas com sucesso!`)
      router.refresh()
    } catch (err: any) {
      showToast('error', 'Falha no Lote', err.message)
    } finally {
      setIsBatchQuizGenerating(false)
      setBatchQuizProgress(null)
    }
  }

  // EXECUTA LOTE DE TÓPICOS
  async function startBatchTopicsGeneration() {
    if (!activeCourse || activeCourse.materials.length === 0) return

    setIsBatchTopicsModalOpen(false)
    setIsBatchTopicsGenerating(true)

    try {
      const materials = activeCourse.materials

      // Busca quais apostilas já possuem tópicos
      const materialIds = materials.map((m) => m.id)
      const { data: existingTopics } = await supabase
        .from('material_topics')
        .select('material_id')
        .in('material_id', materialIds)

      const existingMaterialIds = new Set(existingTopics?.map((t) => t.material_id) || [])

      let targetMaterials = materials
      if (batchTopicsMode === 'only_missing') {
        targetMaterials = materials.filter((m) => !existingMaterialIds.has(m.id))
      }

      if (targetMaterials.length === 0) {
        showToast('info', 'Tudo Atualizado', 'Todas as apostilas já possuem resumos em tópicos.')
        setIsBatchTopicsGenerating(false)
        return
      }

      for (let i = 0; i < targetMaterials.length; i++) {
        const mat = targetMaterials[i]

        setBatchTopicsProgress({
          current: i + 1,
          total: targetMaterials.length,
          currentTitle: mat.title,
        })

        const res = await fetch('/api/admin/generate-topics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            materialTitle: mat.title,
            courseName: activeCourse.title,
          }),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || `Erro ao gerar tópicos para ${mat.title}`)

        if (batchTopicsMode === 'overwrite_all') {
          await supabase.from('material_topics').delete().eq('material_id', mat.id)
        }

        const payload = data.topics.map((t: any, idx: number) => ({
          material_id: mat.id,
          title: t.title.trim(),
          content: t.content.trim(),
          estimated_minutes: Number(t.estimated_minutes) || 3,
          order_index: idx + 1,
        }))

        await supabase.from('material_topics').insert(payload)
      }

      showToast('success', 'Missão Cumprida', `${targetMaterials.length} apostilas resumidas em tópicos pela IA!`)
      router.refresh()
    } catch (err: any) {
      showToast('error', 'Falha no Lote de Tópicos', err.message)
    } finally {
      setIsBatchTopicsGenerating(false)
      setBatchTopicsProgress(null)
    }
  }

  const isAnyBatchRunning = isBatchQuizGenerating || isBatchTopicsGenerating

  return (
    <>
      {/* TOAST FLUTUANTE MILITAR */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md w-full animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div
            className={`p-4 rounded-xl border backdrop-blur-md shadow-2xl flex items-start gap-3 ${toast.type === 'success'
              ? 'bg-slate-900/95 border-emerald-500/50 text-emerald-300 shadow-emerald-950/40'
              : toast.type === 'error'
                ? 'bg-slate-900/95 border-red-500/50 text-red-300 shadow-red-950/40'
                : toast.type === 'warning'
                  ? 'bg-slate-900/95 border-amber-500/50 text-amber-300 shadow-amber-950/40'
                  : 'bg-slate-900/95 border-blue-500/50 text-blue-300 shadow-blue-950/40'
              }`}
          >
            <div className="shrink-0 mt-0.5">
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              {toast.type === 'error' && <AlertTriangle className="w-5 h-5 text-red-400" />}
              {toast.type === 'warning' && <ShieldAlert className="w-5 h-5 text-amber-400" />}
              {toast.type === 'info' && <Info className="w-5 h-5 text-blue-400" />}
            </div>
            <div className="flex-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-white">{toast.title}</h4>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{toast.message}</p>
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-slate-500 hover:text-white p-1 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* MODAL TÁTICO DE CONFIRMAÇÃO */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
              <div
                className={`p-2 rounded-lg ${confirmDialog.isDestructive
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Ordem Operacional
                </span>
                <h3 className="text-sm font-bold text-white">{confirmDialog.title}</h3>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">{confirmDialog.message}</p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className={`px-4 py-2 rounded-lg text-xs font-semibold text-white shadow-lg transition-all cursor-pointer ${confirmDialog.isDestructive
                  ? 'bg-red-600 hover:bg-red-500 shadow-red-950/50'
                  : 'bg-blue-600 hover:bg-blue-500 shadow-blue-950/50'
                  }`}
              >
                {confirmDialog.confirmText || 'Confirmar Ação'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BANNER DE PROGRESSO DO LOTE (PROVAS OU TÓPICOS) */}
      {isAnyBatchRunning && (
        <div className="bg-slate-900 border border-slate-700/80 rounded-xl p-4 mb-6 text-slate-200 flex items-center justify-between shadow-2xl animate-pulse">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
            <div>
              <p className="text-sm font-bold text-white">
                {isBatchQuizGenerating ? '⚡ Groq Gerando Provas em Lote' : '⚡ Groq Sintetizando Tópicos em Lote'}{' '}
                [
                {(isBatchQuizGenerating ? batchQuizProgress?.current : batchTopicsProgress?.current) || 1}
                /
                {(isBatchQuizGenerating ? batchQuizProgress?.total : batchTopicsProgress?.total) || 1}
                ]:
              </p>
              <p className="text-xs text-slate-400 line-clamp-1">
                {(isBatchQuizGenerating ? batchQuizProgress?.currentTitle : batchTopicsProgress?.currentTitle) || 'Processando...'}
              </p>
            </div>
          </div>
          <span className="font-mono text-xs font-bold bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 text-amber-300">
            {Math.round(
              (((isBatchQuizGenerating ? batchQuizProgress?.current : batchTopicsProgress?.current) || 1) /
                ((isBatchQuizGenerating ? batchQuizProgress?.total : batchTopicsProgress?.total) || 1)) *
              100
            )}
            %
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* COLUNA 1: Formulário de Adição */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 h-fit shadow-lg shadow-black/40">
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
            <Upload className="w-5 h-5 text-blue-500" /> Cadastrar Manual
          </h2>

          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Curso Alvo
              </label>
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title} ({course.slug.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Título do Manual / Disciplina
              </label>
              <input
                type="text"
                placeholder="Ex: Regulamento Disciplinar da Aeronáutica (RDAER)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Número de Ordem (Index)
              </label>
              <input
                type="number"
                min={1}
                value={orderIndex}
                onChange={(e) => setOrderIndex(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Arquivo PDF Oficial
              </label>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
              />
            </div>

            <button
              type="submit"
              disabled={loading || isAnyBatchRunning}
              className="w-full mt-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-lg shadow-blue-950/40"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {loading ? 'Subindo documento...' : 'Salvar Manual'}
            </button>
          </form>
        </section>

        {/* COLUNA 2 E 3: Lista de Manuais + Botões de Lote */}
        <section className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg shadow-black/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 mb-6 gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-500" />
                Apostilas em: <span className="text-blue-400">{activeCourse?.title}</span>
              </h2>
              <span className="text-xs text-slate-400">
                {activeCourse?.materials.length || 0} manuais cadastrados
              </span>
            </div>

            {/* BOTÕES DE LOTE: PROVAS E TÓPICOS */}
            {activeCourse && activeCourse.materials.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {/* Botão Lote Tópicos */}
                <button
                  type="button"
                  onClick={() => setIsBatchTopicsModalOpen(true)}
                  disabled={isAnyBatchRunning}
                  className="bg-emerald-600/90 hover:bg-emerald-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-950 cursor-pointer"
                  title="Gera resumos em tópicos via IA para todas as apostilas"
                >
                  <Layers className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Gerar Todos os Tópicos (IA)</span>
                </button>

                {/* Botão Lote Provas */}
                <button
                  type="button"
                  onClick={() => setIsBatchQuizModalOpen(true)}
                  disabled={isAnyBatchRunning}
                  className="bg-indigo-600/90 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-950 cursor-pointer"
                  title="Gera provas via IA para todas as apostilas"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-300" />
                  <span>Gerar Todas as Provas (IA)</span>
                </button>

                {/* Botão Prova Final VF */}
                <button
                  type="button"
                  onClick={() => setIsFinalExamModalOpen(true)}
                  disabled={isAnyBatchRunning}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all shadow-md shadow-amber-950 cursor-pointer"
                  title="Configurar a Verificação Final Geral do Curso"
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>Prova Final do Curso (VF)</span>
                </button>
              </div>
            )}
          </div>

          {activeCourse?.materials.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              Nenhuma apostila cadastrada para este curso ainda. Faça o primeiro upload ao lado.
            </div>
          ) : (
            <div className="space-y-3">
              {activeCourse?.materials.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-3.5 bg-slate-950/70 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-7 h-7 rounded bg-slate-800 text-slate-300 font-mono text-xs font-bold shrink-0">
                      {String(m.order_index).padStart(2, '0')}
                    </span>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-200">{m.title}</h4>
                      <p className="text-xs text-slate-500 font-mono flex items-center gap-1">
                        <FileText className="w-3 h-3" /> {m.file_url}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Botão Tópicos */}
                    <button
                      type="button"
                      onClick={() => setSelectedMaterialForTopics(m)}
                      disabled={isAnyBatchRunning}
                      className="text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer disabled:opacity-50"
                      title="Gerenciar Tópicos e Resumos"
                    >
                      <Layers className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Tópicos</span>
                    </button>

                    {/* Botão Prova */}
                    <button
                      type="button"
                      onClick={() => setSelectedMaterialForQuiz(m)}
                      disabled={isAnyBatchRunning}
                      className="text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer disabled:opacity-50"
                      title="Configurar Prova Individual / Gerar com IA"
                    >
                      <Award className="w-3.5 h-3.5 text-amber-400" />
                      <span>Prova</span>
                    </button>

                    {/* Botão Excluir */}
                    <button
                      type="button"
                      onClick={() => requestDelete(m)}
                      disabled={loading || isAnyBatchRunning}
                      className="text-slate-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-50"
                      title="Excluir apostila"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* MODAL LOTE DE TÓPICOS */}
      {isBatchTopicsModalOpen && activeCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <Layers className="w-5 h-5 text-emerald-400" />
                <span>Geração de Tópicos em Lote (IA Groq)</span>
              </div>
              <button
                onClick={() => setIsBatchTopicsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Escolha a estratégia para resumir em tópicos as {activeCourse.materials.length} apostilas de{' '}
              <strong className="text-slate-200">{activeCourse.title}</strong>:
            </p>

            <div className="space-y-3">
              <label
                onClick={() => setBatchTopicsMode('only_missing')}
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${batchTopicsMode === 'only_missing'
                  ? 'border-emerald-500 bg-emerald-950/40 text-white'
                  : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                  }`}
              >
                <input
                  type="radio"
                  name="batchTopicsMode"
                  checked={batchTopicsMode === 'only_missing'}
                  onChange={() => setBatchTopicsMode('only_missing')}
                  className="mt-1 text-emerald-500 cursor-pointer"
                />
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" /> Apenas Sem Tópicos (Seguro)
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Gera resumos apenas para apostilas que ainda não têm tópicos cadastrados.
                  </p>
                </div>
              </label>

              <label
                onClick={() => setBatchTopicsMode('overwrite_all')}
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${batchTopicsMode === 'overwrite_all'
                  ? 'border-red-500/80 bg-red-950/30 text-white'
                  : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                  }`}
              >
                <input
                  type="radio"
                  name="batchTopicsMode"
                  checked={batchTopicsMode === 'overwrite_all'}
                  onChange={() => setBatchTopicsMode('overwrite_all')}
                  className="mt-1 text-red-500 cursor-pointer"
                />
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-red-400">
                    <RefreshCw className="w-4 h-4 text-red-400" /> Sobrescrever Todos os Tópicos
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Apaga os tópicos atuais de todas as matérias e gera novos resumos do zero via IA.
                  </p>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsBatchTopicsModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={startBatchTopicsGeneration}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 px-4 rounded-lg text-xs flex items-center gap-2 shadow-lg shadow-emerald-950 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                Iniciar Resumos em Lote
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL LOTE DE PROVAS */}
      {isBatchQuizModalOpen && activeCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                <Zap className="w-5 h-5 text-amber-400" />
                <span>Geração de Provas em Lote (IA Groq)</span>
              </div>
              <button
                onClick={() => setIsBatchQuizModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Escolha a estratégia para gerar provas para as {activeCourse.materials.length} apostilas de{' '}
              <strong className="text-slate-200">{activeCourse.title}</strong>:
            </p>

            <div className="space-y-3">
              <label
                onClick={() => setBatchQuizMode('only_missing')}
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${batchQuizMode === 'only_missing'
                  ? 'border-indigo-500 bg-indigo-950/40 text-white'
                  : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                  }`}
              >
                <input
                  type="radio"
                  name="batchQuizMode"
                  checked={batchQuizMode === 'only_missing'}
                  onChange={() => setBatchQuizMode('only_missing')}
                  className="mt-1 text-indigo-500 cursor-pointer"
                />
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" /> Apenas Sem Prova (Seguro)
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Gera apenas para manuais que ainda não têm prova. Suas provas criadas ou editadas não serão alteradas.
                  </p>
                </div>
              </label>

              <label
                onClick={() => setBatchQuizMode('overwrite_all')}
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${batchQuizMode === 'overwrite_all'
                  ? 'border-red-500/80 bg-red-950/30 text-white'
                  : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                  }`}
              >
                <input
                  type="radio"
                  name="batchQuizMode"
                  checked={batchQuizMode === 'overwrite_all'}
                  onChange={() => setBatchQuizMode('overwrite_all')}
                  className="mt-1 text-red-500 cursor-pointer"
                />
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-red-400">
                    <RefreshCw className="w-4 h-4 text-red-400" /> Sobrescrever Todas as Provas
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Apaga todas as questões atuais do curso e gera novas questões inéditas do zero.
                  </p>
                </div>
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Questões por Apostila
              </label>
              <select
                value={batchQuestionCount}
                onChange={(e) => setBatchQuestionCount(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value={5}>5 Questões (Rápido - ~1 a 2s por matéria)</option>
                <option value={10}>10 Questões (Completo - Simulado Extenso)</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsBatchQuizModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={startBatchQuizGeneration}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 px-4 rounded-lg text-xs flex items-center gap-2 shadow-lg shadow-indigo-950 cursor-pointer"
              >
                <Zap className="w-4 h-4 text-amber-300" />
                Iniciar Geração
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INDIVIDUAL: PROVA */}
      {selectedMaterialForQuiz && activeCourse && (
        <AdminQuizModal
          isOpen={!!selectedMaterialForQuiz}
          material={selectedMaterialForQuiz}
          course={activeCourse}
          onClose={() => setSelectedMaterialForQuiz(null)}
        />
      )}

      {/* MODAL INDIVIDUAL: TÓPICOS */}
      {selectedMaterialForTopics && activeCourse && (
        <AdminTopicsModal
          isOpen={!!selectedMaterialForTopics}
          material={selectedMaterialForTopics}
          course={activeCourse}
          onClose={() => setSelectedMaterialForTopics(null)}
        />
      )}

      {/* MODAL DA PROVA FINAL DO CURSO (VF) */}
      {isFinalExamModalOpen && activeCourse && (
        <AdminFinalExamModal
          course={activeCourse}
          isOpen={isFinalExamModalOpen}
          onClose={() => setIsFinalExamModalOpen(false)}
          onSaved={() => {
            setIsFinalExamModalOpen(false)
            showToast('success', 'Verificação Final Atualizada', 'A Prova Final do curso foi salva com sucesso!')
            router.refresh()
          }}
        />
      )}
    </>
  )
}