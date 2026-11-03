// lib/supabase.ts
import { createBrowserClient } from '@supabase/ssr'

// 1. Função para quem importar: import { createClient } from '@/lib/supabase'
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// 2. Instância direta para quem importar: import { supabase } from '@/lib/supabase'
export const supabase = createClient()