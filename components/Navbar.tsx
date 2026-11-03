'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { GraduationCap, LogIn, LogOut, User, ShieldAlert } from 'lucide-react';

export function Navbar() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserRole(userId: string) {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      
      setRole(data?.role ?? null);
    }

    // 1. Checa a sessão atual
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        fetchUserRole(currentUser.id);
      }
    });

    // 2. Escuta mudanças (login/logout) em tempo real
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        fetchUserRole(currentUser.id);
      } else {
        setRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    window.location.href = '/login';
  }

  return (
    <header className="w-full bg-slate-900/50 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-white tracking-wide">
          <GraduationCap className="w-5 h-5 text-blue-500" />
          <span>ESTUDOS <span className="text-blue-500 font-black">FAB</span></span>
        </Link>

        <div>
          {user ? (
            <div className="flex items-center gap-3">
              {/* Botão exclusivo de Administrador */}
              {role === 'admin' && (
                <Link
                  href="/admin"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 text-xs font-semibold uppercase tracking-wider transition-colors"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Painel Admin</span>
                </Link>
              )}

              {/* Informações do Militar */}
              <span className="text-xs text-slate-300 hidden sm:flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
                <User className="w-3.5 h-3.5 text-blue-400" />
                {user.user_metadata?.full_name || user.email}
              </span>

              {/* Botão de Logout */}
              <button
                onClick={handleLogout}
                className="text-xs text-slate-400 hover:text-red-400 flex items-center gap-1.5 py-1.5 px-3 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" /> Sair
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" /> Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}