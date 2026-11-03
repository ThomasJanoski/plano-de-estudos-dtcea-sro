// app/login/page.tsx
'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { GraduationCap, Lock, User, Loader2, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password) {
      setErrorMsg('Informe o seu usuário e senha.')
      return
    }

    try {
      setLoading(true)
      setErrorMsg(null)

      // Se o usuário digitar 'admin' ou 'silva', converte para 'silva@fab.local'
      const cleanUsername = username.trim().toLowerCase()
      const authEmail = cleanUsername.includes('@') 
        ? cleanUsername 
        : `${cleanUsername}@fab.local`

      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password,
      })

      if (error) {
        throw new Error('Usuário ou senha incorretos.')
      }

      // Login bem-sucedido: Redireciona para o início
      window.location.href = '/'
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao autenticar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl w-full max-w-md shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-500 mb-2">
            <GraduationCap className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black text-white">Acesso Militar FAB</h1>
          <p className="text-xs text-slate-400">
            Plataforma de Estudos Preparatórios CESD // CFC
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Nome de Guerra / Usuário
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                autoCapitalize="none"
                placeholder="Ex: admin, silva, santos"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Senha de Acesso
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-950"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? 'Validando Acesso...' : 'Entrar no Sistema'}
          </button>
        </form>
      </div>
    </main>
  )
}