'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { Upload, Trash2, BookOpen, AlertCircle, CheckCircle2, Loader2, FileText } from 'lucide-react'
import { useRouter } from 'next/navigation'

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

export default function AdminDashboardClient({ initialCourses }: { initialCourses: Course[] }) {
  const router = useRouter()
  const supabase = createClient()

  const [courses, setCourses] = useState<Course[]>(initialCourses)
  const [selectedCourseId, setSelectedCourseId] = useState<string>(initialCourses[0]?.id || '')
  
  const [title, setTitle] = useState('')
  const [orderIndex, setOrderIndex] = useState<number>(1)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const activeCourse = courses.find((c) => c.id === selectedCourseId)

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !activeCourse || !title.trim()) {
      setFeedback({ type: 'error', message: 'Preencha o título e anexe o arquivo PDF.' })
      return
    }

    if (file.type !== 'application/pdf') {
      setFeedback({ type: 'error', message: 'Formato inválido. O arquivo deve ser um PDF.' })
      return
    }

    try {
      setLoading(true)
      setFeedback(null)

      // Sanitizar nome do arquivo
      const cleanFileName = file.name
        .toLowerCase()
        .replace(/[^a-z0-9.]/g, '-')
        .replace(/-+/g, '-')
      const storagePath = `${activeCourse.slug}/${Date.now()}-${cleanFileName}`

      // 1. Upload no Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('materials')
        .upload(storagePath, file, { cacheControl: '3600', upsert: false })

      if (uploadError) throw new Error(`Erro no Storage: ${uploadError.message}`)

      // 2. Registro no Banco de Dados
      const { data: newMaterial, error: dbError } = await supabase
        .from('materials')
        .insert({
          course_id: activeCourse.id,
          title: title.trim(),
          order_index: orderIndex,
          file_url: storagePath
        })
        .select()
        .single()

      if (dbError) throw new Error(`Erro no Banco: ${dbError.message}`)

      // 3. Atualizar estado local
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
      setFeedback({ type: 'success', message: 'Apostila enviada e cadastrada com sucesso!' })
      router.refresh()
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Falha na operação.' })
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(material: Material) {
    if (!confirm(`Deseja realmente apagar a apostila: "${material.title}"?`)) return

    try {
      setLoading(true)
      // Remove do Storage
      await supabase.storage.from('materials').remove([material.file_url])

      // Remove do Banco
      const { error } = await supabase.from('materials').delete().eq('id', material.id)
      if (error) throw error

      setCourses((prev) =>
        prev.map((c) =>
          c.id === selectedCourseId
            ? { ...c, materials: c.materials.filter((m) => m.id !== material.id) }
            : c
        )
      )
      router.refresh()
    } catch (err: any) {
      alert(`Erro ao remover: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Formulário de Upload */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 h-fit shadow-md">
        <h2 className="text-base font-bold text-slate-100 flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
          <Upload className="w-5 h-5 text-blue-500" /> Cadastrar Manual
        </h2>

        {feedback && (
          <div
            className={`p-3 rounded-lg text-sm flex items-start gap-2 mb-4 ${
              feedback.type === 'success'
                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                : 'bg-red-950/60 text-red-400 border border-red-800/60'
            }`}
          >
            {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
            <span>{feedback.message}</span>
          </div>
        )}

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
              Título da Apostila
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
              Arquivo PDF
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
            disabled={loading}
            className="w-full mt-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {loading ? 'Subindo documento...' : 'Salvar Manual'}
          </button>
        </form>
      </section>

      {/* Lista de Apostilas do Curso Selecionado */}
      <section className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-500" />
            Apostilas: <span className="text-blue-400">{activeCourse?.title}</span>
          </h2>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300">
            {activeCourse?.materials.length || 0} manuais
          </span>
        </div>

        {activeCourse?.materials.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            Nenhuma apostila cadastrada para este curso. Envie a primeira pelo formulário ao lado.
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

                <button
                  onClick={() => handleDelete(m)}
                  disabled={loading}
                  className="text-slate-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                  title="Excluir apostila"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}