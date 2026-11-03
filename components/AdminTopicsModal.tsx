// components/AdminTopicsModal.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import {
  X,
  Sparkles,
  CheckCircle2,
  Trash2,
  Loader2,
  BookOpen,
  Plus,
  Clock,
  Layers,
} from 'lucide-react'

export interface Topic {
  id?: string
  title: string
  content: string
  estimated_minutes: number
}

interface AdminTopicsModalProps {
  material: { id: string; title: string }
  course: { id: string; title: string; slug: string }
  isOpen: boolean
  onClose: () => void
}

export default function AdminTopicsModal({
  material,
  course,
  isOpen,
  onClose,
}: AdminTopicsModalProps) {
  const [loading, setLoading] = useState(false)
  const [generatingAI, setGeneratingAI] = useState(false)
  const [topics, setTopics] = useState<Topic[]>([])
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const supabase = createClient()

  // Carrega tópicos existentes no banco
  useEffect(() => {
    if (!isOpen) return

    async function loadTopics() {
      setLoading(true)
      setStatusMessage(null)

      const { data } = await supabase
        .from('material_topics')
        .select('*')
        .eq('material_id', material.id)
        .order('order_index', { ascending: true })

      setTopics(data || [])
      setLoading(false)
    }

    loadTopics()
  }, [isOpen, material.id])

  // Gerar tópicos resumidos via IA (Groq)
  async function handleGenerateWithAI() {
    try {
      setGeneratingAI(true)
      setStatusMessage(null)

      const res = await fetch('/api/admin/generate-topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialTitle: material.title,
          courseName: course.title,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar tópicos.')

      setTopics((prev) => [...prev, ...data.topics])
      setStatusMessage(`✅ ${data.topics.length} tópicos resumidos gerados pela IA! Você pode editá-los abaixo.`)
    } catch (err: any) {
      alert(`Falha: ${err.message}`)
    } finally {
      setGeneratingAI(false)
    }
  }

  // Adicionar tópico em branco manualmente
  function handleAddManualTopic() {
    setTopics((prev) => [
      ...prev,
      {
        title: '',
        content: '',
        estimated_minutes: 3,
      },
    ])
  }

  function updateTopicField<K extends keyof Topic>(index: number, field: K, value: Topic[K]) {
    setTopics((prev) =>
      prev.map((t, i) => (i === index ? { ...t, [field]: value } : t))
    )
  }

  function handleDeleteTopic(index: number) {
    setTopics((prev) => prev.filter((_, i) => i !== index))
  }

  // Salvar alterações no Supabase
  async function handleSaveTopics() {
    if (topics.length === 0) {
      alert('Adicione pelo menos um tópico antes de salvar.')
      return
    }

    for (let i = 0; i < topics.length; i++) {
      if (!topics[i].title.trim() || !topics[i].content.trim()) {
        alert(`O Tópico ${i + 1} possui título ou conteúdo em branco. Preencha-os antes de salvar.`)
        return
      }
    }

    try {
      setLoading(true)
      setStatusMessage(null)

      // Substitui os tópicos anteriores pelos atualizados
      await supabase.from('material_topics').delete().eq('material_id', material.id)

      const payload = topics.map((t, index) => ({
        material_id: material.id,
        title: t.title.trim(),
        content: t.content.trim(),
        estimated_minutes: Number(t.estimated_minutes) || 3,
        order_index: index + 1,
      }))

      const { error } = await supabase.from('material_topics').insert(payload)
      if (error) throw error

      setStatusMessage('🎯 Resumo em tópicos salvo com sucesso para os militares!')
    } catch (err: any) {
      alert(`Erro ao salvar: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Cabeçalho */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
              <Layers className="w-4 h-4" /> Gestão de Resumo em Tópicos (Microlearning)
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
            <div className="p-3.5 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-emerald-300 text-sm flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Painel Superior de Ações */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950/80 p-4 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={handleGenerateWithAI}
              disabled={generatingAI || loading}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-lg text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/40 transition-colors cursor-pointer"
            >
              {generatingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-300" />}
              {generatingAI ? 'IA sintetizando manual...' : 'Gerar Resumo em Tópicos com IA'}
            </button>

            <button
              type="button"
              onClick={handleAddManualTopic}
              disabled={loading}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium py-2.5 px-4 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              Adicionar Tópico Manual
            </button>
          </div>

          {/* Lista de Tópicos */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                Tópicos de Estudo ({topics.length})
              </h4>
              {topics.length > 0 && (
                <button
                  type="button"
                  onClick={() => confirm('Limpar todos os tópicos?') && setTopics([])}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Limpar lista
                </button>
              )}
            </div>

            {loading ? (
              <div className="py-12 text-center text-slate-500 flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                <span>Carregando tópicos...</span>
              </div>
            ) : topics.length === 0 ? (
              <div className="py-12 border border-dashed border-slate-800 rounded-xl text-center text-sm text-slate-500">
                Nenhum tópico cadastrado para esta apostila. Gere automaticamente com a IA ou crie manualmente acima.
              </div>
            ) : (
              topics.map((t, idx) => (
                <div
                  key={idx}
                  className="p-5 bg-slate-950/90 border border-slate-800 rounded-xl space-y-3 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                        #{idx + 1}
                      </span>
                      <input
                        type="text"
                        value={t.title}
                        onChange={(e) => updateTopicField(idx, 'title', e.target.value)}
                        placeholder="Título do Tópico (Ex: Princípios da Hierarquia e Disciplina)"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-sm font-semibold text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 px-2 py-1 rounded-lg text-xs text-slate-400">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={t.estimated_minutes}
                          onChange={(e) => updateTopicField(idx, 'estimated_minutes', Number(e.target.value))}
                          className="w-8 bg-transparent text-center text-slate-200 focus:outline-none"
                        />
                        <span>min</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteTopic(idx)}
                        className="text-slate-500 hover:text-red-400 p-1.5 rounded hover:bg-red-500/10 transition-colors"
                        title="Excluir tópico"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Conteúdo Sintetizado (Suporta marcadores • e quebras de linha)
                    </label>
                    <textarea
                      rows={5}
                      value={t.content}
                      onChange={(e) => updateTopicField(idx, 'content', e.target.value)}
                      placeholder="Pontos-chave a serem memorizados, artigos do regulamento, definições..."
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 resize-y leading-relaxed font-mono"
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Rodapé de Ações */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSaveTopics}
            disabled={loading || topics.length === 0}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-2 px-5 rounded-lg text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-md shadow-emerald-950"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Salvar Resumo ({topics.length} tópicos)
          </button>
        </div>
      </div>
    </div>
  )
}