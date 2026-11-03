// app/curso/[slug]/page.tsx
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  ArrowLeft, 
  BookOpen, 
  FileText, 
  Sparkles, 
  Loader2,
  AlertCircle,
  X,
  CheckCircle2,
  ExternalLink,
  Award,
  Layers,
  Clock,
  Trophy,
  Check,
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import AIChatModal from '@/components/AIChatModal';

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

interface Topic {
  id: string;
  material_id: string;
  title: string;
  content: string;
  estimated_minutes: number;
  order_index: number;
}

interface Quiz {
  id: string;
  material_id: string | null;
  course_id: string;
  title: string;
  passing_score: number;
  is_final: boolean;
}

interface QuizAttempt {
  quiz_id: string;
  score: number;
  is_passed: boolean;
}

function CourseContent() {
  const params = useParams();
  const router = useRouter();
  const rawSlug = params?.slug;
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

  const [course, setCourse] = useState<Course | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Estados de Usuário e Progresso
  const [userId, setUserId] = useState<string | null>(null);
  const [completedMaterialIds, setCompletedMaterialIds] = useState<string[]>([]);
  const [completedTopicIds, setCompletedTopicIds] = useState<string[]>([]);
  const [quizAttempts, setQuizAttempts] = useState<Record<string, QuizAttempt>>({});
  const [updatingTopicId, setUpdatingTopicId] = useState<string | null>(null);

  // Estados dos Modais
  const [selectedPdfMaterial, setSelectedPdfMaterial] = useState<Material | null>(null);
  const [selectedAiMaterial, setSelectedAiMaterial] = useState<Material | null>(null);
  const [selectedTopicsMaterial, setSelectedTopicsMaterial] = useState<Material | null>(null);

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

        const materialIds = (materialsData || []).map((m) => m.id);

        if (materialIds.length > 0) {
          // 4. Buscar Tópicos dessas apostilas
          const { data: topicsData } = await supabase
            .from('material_topics')
            .select('*')
            .in('material_id', materialIds)
            .order('order_index', { ascending: true });
          setTopics(topicsData || []);

          // 5. Buscar Provas do Curso e das Apostilas
          const { data: quizzesData } = await supabase
            .from('quizzes')
            .select('*')
            .eq('course_id', courseData.id);
          setQuizzes(quizzesData || []);

          // 6. Buscar Progresso do Usuário (Apostilas lidas, tópicos lidos e notas)
          if (user) {
            // Apostilas concluídas
            const { data: progressData } = await supabase
              .from('user_progress')
              .select('material_id')
              .eq('user_id', user.id)
              .eq('is_completed', true);

            if (progressData) {
              setCompletedMaterialIds(progressData.map((p) => p.material_id));
            }

            // Tópicos concluídos
            const { data: topicProgressData } = await supabase
              .from('user_topic_progress')
              .select('topic_id')
              .eq('user_id', user.id)
              .eq('is_completed', true);

            if (topicProgressData) {
              setCompletedTopicIds(topicProgressData.map((tp) => tp.topic_id));
            }

            // Melhores notas nas provas
            const { data: attemptsData } = await supabase
              .from('quiz_attempts')
              .select('quiz_id, score, is_passed')
              .eq('user_id', user.id)
              .order('score', { ascending: false });

            if (attemptsData) {
              const bestMap: Record<string, QuizAttempt> = {};
              attemptsData.forEach((att) => {
                if (!bestMap[att.quiz_id] || att.score > bestMap[att.quiz_id].score) {
                  bestMap[att.quiz_id] = att;
                }
              });
              setQuizAttempts(bestMap);
            }
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

  function getFullPdfUrl(fileUrl: string | null): string {
    if (!fileUrl) return '';
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      return fileUrl;
    }
    const { data } = supabase.storage.from('materials').getPublicUrl(fileUrl);
    return data.publicUrl;
  }

  // Alternar conclusão de um tópico individual
  async function toggleTopicComplete(topicId: string) {
    if (!userId) return;

    try {
      setUpdatingTopicId(topicId);
      const isCompleted = completedTopicIds.includes(topicId);

      if (isCompleted) {
        await supabase
          .from('user_topic_progress')
          .delete()
          .eq('user_id', userId)
          .eq('topic_id', topicId);

        setCompletedTopicIds((prev) => prev.filter((id) => id !== topicId));
      } else {
        await supabase
          .from('user_topic_progress')
          .upsert({
            user_id: userId,
            topic_id: topicId,
            is_completed: true,
            updated_at: new Date().toISOString(),
          });

        setCompletedTopicIds((prev) => [...prev, topicId]);
      }
    } catch (err: any) {
      console.error('Erro ao salvar tópico:', err);
    } finally {
      setUpdatingTopicId(null);
    }
  }

  // Alternar leitura do PDF completo
  async function toggleComplete(materialId: string) {
    if (!userId) return;

    try {
      const isCurrentlyCompleted = completedMaterialIds.includes(materialId);
      const newStatus = !isCurrentlyCompleted;

      await supabase.from('user_progress').upsert(
        {
          user_id: userId,
          material_id: materialId,
          is_completed: newStatus,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,material_id' }
      );

      setCompletedMaterialIds((prev) =>
        newStatus ? [...prev, materialId] : prev.filter((id) => id !== materialId)
      );
    } catch (err: any) {
      console.error('Erro ao atualizar progresso:', err);
    }
  }

  // Prova Final do Curso (Global)
  const finalCourseQuiz = quizzes.find((q) => q.is_final || !q.material_id);
  const finalQuizAttempt = finalCourseQuiz ? quizAttempts[finalCourseQuiz.id] : null;

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-sm text-slate-400">Carregando doutrina militar ({slug || '...'})...</p>
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

  // Tópicos da apostila atualmente aberta no leitor de tópicos
  const currentMaterialTopics = selectedTopicsMaterial
    ? topics.filter((t) => t.material_id === selectedTopicsMaterial.id)
    : [];

  const currentMaterialCompletedCount = currentMaterialTopics.filter((t) =>
    completedTopicIds.includes(t.id)
  ).length;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 md:p-12 relative">
      <div className="max-w-5xl mx-auto space-y-8">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar aos Cursos
        </Link>

        {/* CABEÇALHO DO CURSO */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
          <div>
            <span className="text-xs font-bold px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md uppercase tracking-wider">
              {course.slug} // FORÇA AÉREA BRASILEIRA
            </span>
            <h1 className="text-2xl md:text-3xl font-black text-white mt-2 mb-2">
              {course.title}
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm max-w-2xl leading-relaxed">
              {course.description}
            </p>
          </div>

          <div className="bg-slate-950 border border-slate-800 px-5 py-3 rounded-xl flex items-center gap-4 shrink-0">
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Progresso Geral</p>
              <p className="text-lg font-black text-white">
                {completedMaterialIds.length} / {materials.length} <span className="text-xs font-normal text-slate-400">manuais</span>
              </p>
            </div>
            <BookOpen className="w-8 h-8 text-blue-500 opacity-80" />
          </div>
        </div>

        {/* CARD PROVA FINAL DO CURSO (VF - SIMULADO GERAL) */}
        {finalCourseQuiz && (
          <section className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-indigo-950/40 border border-amber-500/40 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-xl shrink-0">
                  <Trophy className="w-7 h-7" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 text-[10px] font-bold uppercase tracking-wider mb-1">
                    Exame de Encerramento // VF Geral
                  </div>
                  <h3 className="text-lg font-black text-white">{finalCourseQuiz.title}</h3>
                  <p className="text-xs text-slate-300 mt-1">
                    Simulado abrangente com questões de todas as matérias. Nota de corte militar: <strong className="text-amber-400">{finalCourseQuiz.passing_score}%</strong>.
                  </p>
                </div>
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 shrink-0">
                {finalQuizAttempt && (
                  <span
                    className={`font-mono text-xs font-bold px-2.5 py-1 rounded-lg border ${
                      finalQuizAttempt.is_passed
                        ? 'bg-emerald-950/80 border-emerald-500 text-emerald-400'
                        : 'bg-red-950/80 border-red-500 text-red-400'
                    }`}
                  >
                    Melhor Nota: {finalQuizAttempt.score}% ({finalQuizAttempt.is_passed ? 'Aprovado' : 'Reprovado'})
                  </span>
                )}

                <Link
                  href={`/curso/${slug}/simulado/${finalCourseQuiz.id}`}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all shadow-lg shadow-amber-950/40 cursor-pointer"
                >
                  <Trophy className="w-4 h-4" />
                  {finalQuizAttempt ? 'Refazer Prova Final' : 'Iniciar Prova Final (VF)'}
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* GRADE DE APOSTILAS */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" /> Grade de Instrução e Apostilas ({materials.length})
            </h2>
            <span className="text-xs text-slate-400 font-mono">Padrão FAB</span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {materials.map((mat) => {
              const isPdfRead = completedMaterialIds.includes(mat.id);
              
              // Tópicos desta apostila
              const matTopics = topics.filter((t) => t.material_id === mat.id);
              const matTopicsCompleted = matTopics.filter((t) => completedTopicIds.includes(t.id)).length;
              const hasTopics = matTopics.length > 0;

              // Prova desta apostila
              const matQuiz = quizzes.find((q) => q.material_id === mat.id && !q.is_final);
              const attempt = matQuiz ? quizAttempts[matQuiz.id] : null;

              return (
                <div 
                  key={mat.id}
                  className={`bg-slate-900/70 border rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all shadow-md ${
                    isPdfRead ? 'border-emerald-500/30 bg-emerald-950/5' : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Lado Esquerdo: Identificação */}
                  <div className="flex items-start sm:items-center gap-3.5">
                    <span className={`w-8 h-8 rounded-xl border font-mono font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 ${
                      isPdfRead 
                        ? 'bg-emerald-950 border-emerald-500/40 text-emerald-400' 
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}>
                      {mat.order_index.toString().padStart(2, '0')}
                    </span>

                    <div>
                      <h3 className="font-semibold text-white text-sm sm:text-base flex items-center gap-2 flex-wrap">
                        {mat.title}
                        {isPdfRead && (
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-semibold">
                            Manual Lido
                          </span>
                        )}
                      </h3>

                      {/* Mini Estatísticas: Tópicos e Nota */}
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {hasTopics ? (
                          <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/50">
                            <Layers className="w-3 h-3" />
                            {matTopicsCompleted}/{matTopics.length} tópicos dominados
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500">Sem resumo</span>
                        )}

                        {attempt && (
                          <span
                            className={`text-[11px] font-bold font-mono px-2 py-0.5 rounded border ${
                              attempt.is_passed
                                ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800'
                                : 'bg-red-950/50 text-red-300 border-red-800'
                            }`}
                          >
                            Nota Simulado: {attempt.score}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Lado Direito: Ações (Tópicos, Prova, PDF, IA) */}
                  <div className="flex items-center gap-2 flex-wrap self-end md:self-auto">
                    {/* Botão Resumo em Tópicos */}
                    {hasTopics && (
                      <button
                        onClick={() => setSelectedTopicsMaterial(mat)}
                        className="px-3 py-1.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Ler resumo em tópicos rápidos"
                      >
                        <Layers className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Resumo ({matTopicsCompleted}/{matTopics.length})</span>
                      </button>
                    )}

                    {/* Botão Simulado da Apostila */}
                    {matQuiz && (
                      <Link
                        href={`/curso/${slug}/simulado/${matQuiz.id}`}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border ${
                          attempt?.is_passed
                            ? 'bg-emerald-950/60 border-emerald-600/50 text-emerald-300 hover:bg-emerald-900/60'
                            : attempt
                            ? 'bg-red-950/60 border-red-600/50 text-red-300 hover:bg-red-900/60'
                            : 'bg-blue-600/10 border-blue-500/30 text-blue-300 hover:bg-blue-600/20'
                        }`}
                      >
                        <Award className="w-3.5 h-3.5 text-amber-400" />
                        <span>
                          {attempt?.is_passed ? `Aprovado (${attempt.score}%)` : attempt ? `Refazer (${attempt.score}%)` : 'Simulado'}
                        </span>
                      </Link>
                    )}

                    {/* Botão PDF */}
                    <button 
                      onClick={() => setSelectedPdfMaterial(mat)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Ver manual oficial na íntegra"
                    >
                      <BookOpen className="w-3.5 h-3.5" /> PDF
                    </button>

                    {/* Botão Copilot IA */}
                    <button 
                      onClick={() => setSelectedAiMaterial(mat)}
                      className="px-3 py-1.5 bg-purple-600/10 hover:bg-purple-600/20 text-purple-400 border border-purple-500/20 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Tirar dúvidas com o Copilot Militar"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> IA
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ================= MODAL LEITOR DE TÓPICOS INTERATIVO ================= */}
      {selectedTopicsMaterial && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-3xl h-[88vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl">
            {/* Topo */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div className="pr-4">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
                  <Layers className="w-4 h-4" /> Resumo em Tópicos de Fixação
                </div>
                <h3 className="font-bold text-white text-base line-clamp-1">
                  {selectedTopicsMaterial.title}
                </h3>
              </div>

              <button 
                onClick={() => setSelectedTopicsMaterial(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Barra de Progresso dos Tópicos */}
            <div className="px-5 py-3 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between gap-4">
              <div className="flex-1 bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                <div 
                  className="bg-emerald-500 h-full transition-all duration-300"
                  style={{
                    width: `${currentMaterialTopics.length > 0 ? (currentMaterialCompletedCount / currentMaterialTopics.length) * 100 : 0}%`
                  }}
                />
              </div>
              <span className="font-mono text-xs text-slate-300 font-bold shrink-0">
                {currentMaterialCompletedCount} de {currentMaterialTopics.length} dominados ({Math.round((currentMaterialCompletedCount / (currentMaterialTopics.length || 1)) * 100)}%)
              </span>
            </div>

            {/* Lista de Tópicos */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-slate-200">
              {currentMaterialTopics.map((topic, idx) => {
                const isDominado = completedTopicIds.includes(topic.id);
                const isProcessing = updatingTopicId === topic.id;

                return (
                  <div
                    key={topic.id}
                    className={`p-5 rounded-2xl border transition-all ${
                      isDominado
                        ? 'bg-emerald-950/20 border-emerald-500/40 shadow-sm'
                        : 'bg-slate-950/80 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-lg font-mono text-xs font-bold flex items-center justify-center ${
                          isDominado ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                        }`}>
                          {idx + 1}
                        </span>
                        <h4 className="font-bold text-white text-sm sm:text-base">
                          {topic.title}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 text-amber-400" /> {topic.estimated_minutes} min
                        </span>

                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => toggleTopicComplete(topic.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                            isDominado
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                          }`}
                        >
                          {isProcessing ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : isDominado ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          <span>{isDominado ? 'Dominado' : 'Marcar Lido'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Conteúdo com quebra de linha */}
                    <div className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans whitespace-pre-line bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
                      {topic.content}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Rodapé */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Pílula de Leitura Rápida FAB
              </span>
              <button
                onClick={() => setSelectedTopicsMaterial(null)}
                className="bg-slate-800 hover:bg-slate-700 text-white font-medium px-4 py-2 rounded-xl text-xs transition-colors"
              >
                Fechar Resumo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL LEITOR DE PDF ================= */}
      {selectedPdfMaterial && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-5xl h-[90vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl">
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
                </div>
              )}
            </div>

            <div className="p-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {completedMaterialIds.includes(selectedPdfMaterial.id) 
                  ? '✅ Marcado como lido' 
                  : '⏳ Leitura ainda pendente'}
              </span>
              <button 
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

      {/* MODAL COPILOT IA */}
      {selectedAiMaterial && (
        <AIChatModal
          isOpen={!!selectedAiMaterial}
          onClose={() => setSelectedAiMaterial(null)}
          materialTitle={selectedAiMaterial.title}
        />
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
          <p className="text-sm text-slate-400">Carregando doutrina militar...</p>
        </main>
      }
    >
      <CourseContent />
    </Suspense>
  );
}