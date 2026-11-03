// components/AIChatModal.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, Sparkles, Loader2 } from 'lucide-react';

interface AIChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  materialTitle: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// Subcomponente formatador de Markdown militar (Zero dependências)
function FormattedMessage({ content }: { content: string }) {
  const lines = content.split('\n');

  // Função auxiliar para converter **negrito** e `código`
  const renderInline = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="text-white font-bold tracking-wide">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="bg-slate-950 text-blue-300 px-1.5 py-0.5 rounded text-xs font-mono border border-slate-800">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  return (
    <div className="space-y-2 text-xs sm:text-sm leading-relaxed text-slate-200">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        // Linhas em branco
        if (!trimmed) {
          return <div key={idx} className="h-1.5" />;
        }

        // Títulos (### ou ## ou #)
        if (trimmed.startsWith('#')) {
          const titleText = trimmed.replace(/^#+\s*/, '');
          return (
            <h4
              key={idx}
              className="font-bold text-blue-400 mt-3 mb-1 text-sm sm:text-base border-b border-slate-700/60 pb-1 flex items-center gap-2"
            >
              <span className="w-1.5 h-3.5 bg-blue-500 rounded-sm inline-block" />
              {renderInline(titleText)}
            </h4>
          );
        }

        // Divisórias (---)
        if (trimmed === '---' || trimmed === '***') {
          return <hr key={idx} className="border-slate-700/80 my-2.5" />;
        }

        // Tópicos (* ou -)
        if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="text-blue-400 font-bold leading-5">•</span>
              <div className="flex-1">{renderInline(trimmed.slice(2))}</div>
            </div>
          );
        }

        // Alternativas de Prova (A), B), C), D) ou 1., 2.)
        if (/^([A-Da-d]\)|\d+\.)\s/.test(trimmed)) {
          const match = trimmed.match(/^([A-Da-d]\)|\d+\.)\s/)![0];
          const rest = trimmed.slice(match.length);
          return (
            <div key={idx} className="flex items-start gap-2.5 pl-2 my-1">
              <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-blue-300 font-bold shrink-0">
                {match.trim()}
              </span>
              <div className="flex-1 text-slate-300">{renderInline(rest)}</div>
            </div>
          );
        }

        // Parágrafo comum
        return (
          <p key={idx} className="text-slate-300">
            {renderInline(line)}
          </p>
        );
      })}
    </div>
  );
}

export default function AIChatModal({ isOpen, onClose, materialTitle }: AIChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Pronto para a instrução! Sou seu assistente de estudos para **${materialTitle}**.\n\nComo posso orientar sua preparação hoje? Você pode pedir um resumo dos pontos-chave ou um simulado de questões.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Scroll automático suave para o final do chat a cada nova resposta
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  if (!isOpen) return null;

  async function sendMessage(textToSend?: string) {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          materialTitle,
        }),
      });

      const data = await res.json();
      const responseText = data.reply || data.text;

      if (responseText) {
        setMessages((prev) => [...prev, { role: 'assistant', content: responseText }]);
      } else {
        throw new Error(data.error || 'Sem resposta do servidor');
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `❌ **Falha de comunicação:** ${err.message || 'Tente novamente.'}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4">
      <div className="flex flex-col w-full max-w-3xl h-[85vh] bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
        
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Bot size={20} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-1.5">
                Instrutor IA <Sparkles size={14} className="text-amber-400" />
              </h3>
              <p className="text-xs text-slate-400 truncate max-w-xs sm:max-w-md">{materialTitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-red-400 transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Lista de Mensagens */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/50">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[88%] rounded-xl px-4 py-3 shadow-md ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-none text-xs sm:text-sm'
                    : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none shadow-xl'
                }`}
              >
                {m.role === 'assistant' ? (
                  <FormattedMessage content={m.content} />
                ) : (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-900 border border-slate-800 text-slate-300 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2.5 shadow-lg">
                <Loader2 size={16} className="animate-spin text-blue-400" />
                Instrutor formulando resposta técnica...
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Ações Rápidas */}
        <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 flex gap-2 overflow-x-auto text-xs">
          <button
            onClick={() => sendMessage('Gere um simulado com 3 questões de múltipla escolha desta apostila com gabarito comentado ao final.')}
            disabled={loading}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 whitespace-nowrap transition cursor-pointer"
          >
            📝 Gerar Simulado
          </button>
          <button
            onClick={() => sendMessage('Faça um resumo dos 4 tópicos mais importantes desta apostila para a prova da FAB.')}
            disabled={loading}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 whitespace-nowrap transition cursor-pointer"
          >
            📋 Resumo Rápido
          </button>
        </div>

        {/* Input */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Tire dúvidas ou peça questões ao Instrutor..."
            className="flex-1 bg-slate-900 border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition-colors cursor-pointer"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}