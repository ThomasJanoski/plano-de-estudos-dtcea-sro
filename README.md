# 🦅 Plataforma de Estudos Preparatórios — Força Aérea Brasileira (FAB)
> **Seção de Instrução e Treinamento Militar (P-2 Ensino)**  
> Sistema de preparação tática para os concursos e processos seletivos internos do **CESD** (Especialização de Soldados) e **CFC** (Formação de Cabos).

---

## 📋 Sumário Executivo
Esta plataforma web foi desenvolvida com arquitetura de alta disponibilidade para fornecer aos militares um ambiente unificado de instrução. A ferramenta combina leitura de manuais oficiais, microlearning adaptativo em tópicos, avaliações contínuas com nota de corte militar e um Copilot de Inteligência Artificial integrado via Groq API.

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia | Detalhes |
| :--- | :--- | :--- |
| **Framework** | **Next.js 16** (Turbopack, App Router) | Sem pasta `src/`, renderização dinâmica no servidor com `await connection()` |
| **Estilização** | **Tailwind CSS + Lucide React** | Design System escuro militar tático (Slate / Dark HUD) |
| **Backend & BD** | **Supabase (PostgreSQL)** | RLS ativado, funções Security Definer, Triggers e Índices B-Tree |
| **Storage** | **Supabase Storage** | Bucket público `materials` com sanitização militar de PDFs |
| **Motor de IA** | **Groq Cloud API** | Modelos Llama & Qwen de alta performance (< 1s de resposta) |
| **Deploy** | **Vercel** | Otimizado para Edge e Serverless Functions |

---

## 🚀 Funcionalidades Principais

### 1. Autenticação Militar por Nome de Guerra
- **Ambiente Restrito:** Bloqueio server-side de visitantes não autenticados na tela raiz (`/`), redirecionando-os para `/login`.

### 2. Painel de Comando do Administrador (`/admin`)
- **Proteção por Patente (Role):** Acesso concedido exclusivamente a usuários com `role = 'admin'` via checagem em Server Component (`lib/auth-admin.ts`).
- **Upload Dinâmico de Manuais:** Envio de arquivos PDF direto para o bucket do Storage com exclusão sincronizada no banco e no disco.
- **Gerador de Provas em Lote (IA):** Criação automatizada de questões no padrão FAB com opção de **Preservar Manuais Existentes** ou **Sobrescrever Todos**.
- **Gerador de Tópicos Adaptativo (IA):** Decomposição automática de apostilas densas em resumos cirúrgicos (de 4 a 12 tópicos dinâmicos).
- **Gestão Manual:** Adição, edição e exclusão de questões (enunciados, alternativas A, B, C, D e gabarito comentado) e tópicos individuais.
- **HUD Militar de Notificações:** Substituição de `alert()` e `confirm()` nativos por Toasts e Modais táticos de confirmação.

### 3. Sala de Instrução do Aluno (`/curso/[slug]`)
- **Leitor de PDF Embutido:** Visualizador integrado para consulta integral das publicações oficiais da Aeronáutica (RDAER, RCONT, RSA, etc.).
- **Microlearning (Resumos em Tópicos):** Modal de leitura rápida por pílulas com marcação de **"Tópico Dominado"** e barra de progresso em tempo real.
- **Copilot Militar Integrado:** Chatbot instrutor para tirar dúvidas sobre o manual aberto em tempo real.

### 4. Sistema de Avaliações Militares (VA e VF)
- **Verificação de Aprendizagem (VA por Apostila):**
  - Múltipla escolha (A, B, C, D).
  - Nota mínima de corte configurável (Padrão: 70% / Média 7,0).
  - Feedback imediato com exibição do artigo regulamentar correspondente.
  - Tentativas ilimitadas: o militar pode refazer o simulado até atingir o índice de aprovação.
- **Verificação Final (VF - Simulado Global do Curso):**
  - Exame abrangente integrando todas as matérias cadastradas para simular o dia real da prova da FAB.