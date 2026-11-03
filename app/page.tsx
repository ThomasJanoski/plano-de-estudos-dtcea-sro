'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { BookOpen, GraduationCap, Loader2, AlertCircle } from 'lucide-react';

interface Course {
  id: string;
  title: string;
  slug: string;
  description: string;
}

export default function Home() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCourses() {
      try {
        setLoading(true);
        const { data, error: err } = await supabase
          .from('courses')
          .select('*')
          .order('created_at', { ascending: true });

        if (err) throw err;
        setCourses(data || []);
      } catch (err: any) {
        console.error('Erro ao buscar cursos:', err);
        setError(err.message || 'Erro ao conectar ao Supabase.');
      } finally {
        setLoading(false);
      }
    }

    loadCourses();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-6 md:p-12">
      {/* Header */}
      <div className="max-w-4xl w-full text-center mb-12">
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-4">
          <GraduationCap className="w-4 h-4" /> Plano de Estudos FAB
        </span>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-4">
          Base Preparatória
        </h1>
        <p className="text-slate-400 max-w-xl mx-auto">
          Selecione o seu curso para acessar o material de estudo, simulados e assistente de IA.
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-sm">Carregando cursos disponíveis...</p>
        </div>
      )}

      {/* Erro */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-xl max-w-md text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <h2 className="text-lg font-bold text-red-400 mb-2">Erro de Conexão</h2>
          <p className="text-sm text-slate-300">{error}</p>
        </div>
      )}

      {/* Lista de Cursos */}
      {!loading && !error && (
        <>
          {courses.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center max-w-md">
              <p className="text-slate-400 text-sm">Nenhum curso encontrado no banco.</p>
            </div>
          ) : (
            <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-6">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="group relative bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-2xl p-6 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/5 flex flex-col justify-between"
                >
                  <div>
                    <div className="w-12 h-12 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">
                      {course.title}
                    </h2>
                    <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                      {course.description || 'Sem descrição informada.'}
                    </p>
                  </div>

                  <Link
                    href={`/curso/${course.slug}`}
                    className="w-full py-3 px-4 bg-slate-800 hover:bg-blue-600 text-white font-medium rounded-xl text-sm transition-colors text-center block"
                  >
                    Acessar Módulos
                  </Link>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}