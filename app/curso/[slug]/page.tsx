'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  ArrowLeft, 
  BookOpen, 
  FileText, 
  Sparkles, 
  Loader2,
  AlertCircle,
  X,
  Send,
  HelpCircle,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';

interface Material {
  id: string;
  title: string;
  order_index: number;
  file_url: string | null;
}

interface Course {
  id: string;
  title: string;
  slug: string;
  description: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

function CourseContent() {
  const params = useParams();
  const rawSlug = params?.slug;
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

  const [course, setCourse] = useState<Course | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Estados de Usuário e Progresso
  const [userId, setUserId] = useState<string | null>(null);
  const [completedMaterialIds, setCompletedMaterialIds] = useState<string[]>([]);
  const [updatingProgress, setUpdatingProgress] = useState(false);

  // Estados dos Modais
  const [selectedPdfMaterial, setSelectedPdfMaterial] = useState<Material | null>(null);
  const [selectedAiMaterial, setSelectedAiMaterial] = useState<Material | null>(null);

  // Estados do Chat da IA
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Scroll automático para última mensagem do chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  // Carregar dados iniciais (Curso, Materiais, Usuário e Progresso)
  useEffect(() => {
    async function loadData() {
      if (!slug) return;

      try {
        setLoading(true);
        setErrorMessage(null);

        // 1. Obter usuário logado
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
        }

        // 2. Buscar Curso
        const { data: courseData, error: courseErr } = await supabase
          .from('courses')
          .select('*')
          .eq('slug', slug.toLowerCase())
          .maybeSingle();

        if (courseErr) throw new Error(`Erro: ${courseErr.message}`);
        if (!courseData) throw new Error(`Curso "${slug}" não encontrado.`);
        setCourse(courseData);

        // 3. Buscar Apostilas
        const { data: materialsData, error: matErr } = await supabase
          .from('materials')
          .select('*')
          .eq('course_id', courseData.id)
          .order('order_index', { ascending: true });

        if (matErr) throw new Error(`Erro ao buscar apostilas: ${matErr.message}`);
        setMaterials(materialsData || []);

        // 4. Buscar Progresso do Usuário
        if (user) {
          const { data: progressData } = await supabase
            .from('user_progress')
            .select('material_id')
            .eq('user_id', user.id)
            .eq('is_completed', true);

          if (progressData) {
            setCompletedMaterialIds(progressData.map((p) => p.material_id));
          }
        }
      } catch (err: any) {
        console.error('Erro:', err);
        setErrorMessage(err.message || 'Erro inesperado.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [slug]);

  // Obter a URL real do PDF no Supabase Storage
  function getFullPdfUrl(fileUrl: string | null): string {
    if (!fileUrl) return '';
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      return fileUrl;
    }
    const { data } = supabase.storage.from('materiais').getPublicUrl(fileUrl);
    return data.publicUrl;
  }

  // Alternar o status de leitura no Supabase
  async function toggleComplete(materialId: string) {
    if (!userId) {
      alert('Sessão expirada. Por favor, refaça o login.');
      return;
    }

    try {
      setUpdatingProgress(true);
      const isCurrentlyCompleted = completedMaterialIds.includes(materialId);
      const newStatus = !isCurrentlyCompleted;

      const { error } = await supabase
        .from('user_progress')
        .upsert(
          {
            user_id: userId,
            material_id: materialId,
            is_completed: newStatus,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,material_id' }
        );

      if (error) throw error;

      setCompletedMaterialIds((prev) =>
        newStatus ? [...prev, materialId] : prev.filter((id) => id !== materialId)
      );
    } catch (err: any) {
      console.error('Erro ao atualizar progresso:', err);
      alert('Não foi possível salvar o progresso: ' + err.message);
    } finally {
      setUpdatingProgress(false);
    }
  }

  // Abrir Modal de IA e inicializar o chat
  function openAiModal(material: Material) {
    setSelectedAiMaterial(material);
    setChatMessages([
      {
        role: 'assistant',
        text: `Na escuta, combatente! Sou seu Instrutor IA para a matéria **"${material.title}"**. Como posso orientar sua instrução hoje?`,
      },
    ]);
  }

  // Enviar mensagem para a API do Gemini
  async function handleSendAiMessage(customText?: string) {
    const textToSend = customText || chatInput;
    if (!textToSend.trim() || chatLoading || !selectedAiMaterial) return;

    const userMsg: ChatMessage = { role: 'user', text: textToSend };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          materialTitle: selectedAiMaterial.title,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro na resposta do servidor.');

      setChatMessages((prev) => [...prev, { role: 'assistant', text: data.reply }]);
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', text: `❌ Falha de transmissão: ${err.message}` },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-sm text-slate-400">Carregando apostilas ({slug || '...'})...</p>
      </main>
    );
  }

  if (errorMessage || !course) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-2xl max-w-md w-full">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-red-400 mb-2">Aviso do Sistema</h2>
          <p className="text-sm text-slate-300 mb-6">{errorMessage || 'Curso não encontrado.'}</p>
          <Link 
            href="/" 
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-colors w-full"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar ao início
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 relative">
      <div className="max-w-5xl mx-auto">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar aos Cursos
        </Link>

        {/* Cabeçalho */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md uppercase tracking-wider">
              {course.slug}
            </span>
            <h1 className="text-2xl md:text-3xl font-black text-white mt-2 mb-2">
              {course.title}
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl">
              {course.description}
            </p>
          </div>

          <div className="bg-slate-950 border border-slate-800 px-5 py-3 rounded-xl flex items-center gap-4 shrink-0">
            <div>
              <p className="text-xs text-slate-500 font-medium">Progresso da Tropa</p>
              <p className="text-lg font-bold text-white">
                {completedMaterialIds.length} / {materials.length} <span className="text-xs font-normal text-slate-400">lidas</span>
              </p>
            </div>
            <BookOpen className="w-8 h-8 text-blue-500 opacity-80" />
          </div>
        </div>

        {/* Grade de Apostilas */}
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-400" /> Grade de Apostilas
        </h2>

        <div className="grid grid-cols-1 gap-3">
          {materials.map((mat) => {
            const isCompleted = completedMaterialIds.includes(mat.id);

            return (
              <div 
                key={mat.id}
                className={`bg-slate-900/60 border rounded-xl p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                  isCompleted ? 'border-emerald-500/30 bg-emerald-950/10' : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-4">
                  <span className={`w-8 h-8 rounded-lg border font-bold text-xs flex items-center justify-center shrink-0 ${
                    isCompleted 
                      ? 'bg-emerald-950 border-emerald-500/40 text-emerald-400' 
                      : 'bg-slate-800 border-slate-700 text-slate-300'
                  }`}>
                    {mat.order_index.toString().padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className="font-semibold text-white text-sm md:text-base flex items-center gap-2">
                      {mat.title}
                      {isCompleted && (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-medium">
                          Concluído
                        </span>
                      )}
                    </h3>
                    <span className="text-xs text-slate-500">Material Oficial FAB</span>
                  </div>
                </div>

                {/* Botões */}
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button 
                    onClick={() => setSelectedPdfMaterial(mat)}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-lg shadow-blue-600/10"
                  >
                    <BookOpen className="w-3.5 h-3.5" /> Ler Apostila
                  </button>

                  <button 
                    onClick={() => openAiModal(mat)}
                    className="px-3 py-2 bg-purple-600/10 hover:bg-purple-600/20 text-purple-400 border border-purple-500/20 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Estudar com IA
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL 1: LEITOR DE APOSTILA */}
      {selectedPdfMaterial && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-5xl h-[90vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl">
            {/* Topo do Modal */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2 truncate pr-4">
                <BookOpen className="w-5 h-5 text-blue-500 shrink-0" />
                <h3 className="font-bold text-white text-sm md:text-base truncate">
                  {selectedPdfMaterial.title}
                </h3>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {selectedPdfMaterial.file_url && (
                  <a
                    href={getFullPdfUrl(selectedPdfMaterial.file_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                    title="Abrir em aba separada"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button 
                  onClick={() => setSelectedPdfMaterial(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Visualizador de PDF com Iframe */}
            <div className="flex-1 bg-slate-950 w-full relative">
              {selectedPdfMaterial.file_url ? (
                <iframe
                  src={`${getFullPdfUrl(selectedPdfMaterial.file_url)}#toolbar=1`}
                  className="w-full h-full border-none"
                  title={selectedPdfMaterial.title}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
                  <AlertCircle className="w-10 h-10 text-amber-500 mb-2" />
                  <p className="text-white font-semibold">Arquivo ainda não configurado</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Preencha o campo <code>file_url</code> desta apostila no Supabase.
                  </p>
                </div>
              )}
            </div>

            {/* Rodapé com Botão "Marcar como Lido" */}
            <div className="p-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {completedMaterialIds.includes(selectedPdfMaterial.id) 
                  ? '✅ Marcado como estudado' 
                  : '⏳ Leitura ainda não concluída'}
              </span>
              <button 
                disabled={updatingProgress}
                onClick={() => toggleComplete(selectedPdfMaterial.id)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors ${
                  completedMaterialIds.includes(selectedPdfMaterial.id)
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                {completedMaterialIds.includes(selectedPdfMaterial.id) 
                  ? 'Desmarcar Conclusão' 
                  : 'Marcar como Lido'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ASSISTENTE DE IA */}
      {selectedAiMaterial && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl h-[85vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl">
            {/* Topo do Modal */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2 truncate pr-4">
                <Sparkles className="w-5 h-5 text-purple-400 shrink-0" />
                <div className="truncate">
                  <h3 className="font-bold text-white text-sm">Instrutor IA - FAB</h3>
                  <p className="text-[11px] text-slate-400 truncate">{selectedAiMaterial.title}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedAiMaterial(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Chat / Área de Interação */}
            <div className="flex-1 bg-slate-950 p-4 overflow-y-auto space-y-3">
              {chatMessages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-4 py-2.5 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-purple-600 text-white rounded-br-none'
                        : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none shadow'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-900 border border-slate-800 text-slate-400 px-4 py-2 rounded-xl text-xs flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                    Instrutor redigindo resposta técnica...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Sugestões Rápidas de Estudo */}
            <div className="p-2 bg-slate-900 border-t border-slate-800 flex gap-2 overflow-x-auto text-xs">
              <button
                onClick={() => handleSendAiMessage('Gere um simulado com 3 questões de múltipla escolha desta apostila com gabarito ao final.')}
                disabled={chatLoading}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg whitespace-nowrap transition cursor-pointer border border-slate-700/60"
              >
                📝 Gerar Simulado
              </button>
              <button
                onClick={() => handleSendAiMessage('Faça um resumo dos 4 tópicos mais importantes desta apostila para a prova.')}
                disabled={chatLoading}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg whitespace-nowrap transition cursor-pointer border border-slate-700/60"
              >
                📌 Resumo dos Pontos-Chave
              </button>
            </div>

            {/* Input de Pergunta */}
            <div className="p-3 border-t border-slate-800 bg-slate-950 flex items-center gap-2">
              <input 
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendAiMessage()}
                placeholder="Tire dúvidas sobre a apostila com o instrutor..."
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
              />
              <button 
                onClick={() => handleSendAiMessage()}
                disabled={chatLoading || !chatInput.trim()}
                className="p-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl transition-colors cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function CoursePage() {
  return (
    <Suspense 
      fallback={
        <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-2" />
          <p className="text-sm text-slate-400">Carregando parâmetros...</p>
        </main>
      }
    >
      <CourseContent />
    </Suspense>
  );
}