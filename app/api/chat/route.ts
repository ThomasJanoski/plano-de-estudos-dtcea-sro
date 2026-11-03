// app/api/chat/route.ts
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Chave GROQ_API_KEY não configurada no .env.local.' },
        { status: 500 }
      );
    }

    const { message, materialTitle } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Mensagem vazia.' }, { status: 400 });
    }

    const systemPrompt = `
Você é o "Instrutor FAB", um instrutor militar prestativo e focado na preparação de soldados para os cursos CESD e CFC da Força Aérea Brasileira.
A matéria de estudo atual é: "${materialTitle || 'Apostila Militar da FAB'}".

DIRETRIZES DE COMUNICAÇÃO:
1. Responda SEMPRE em Português do Brasil com tom militar respeitoso, claro, objetivo e disciplinado (ex: "Atenção, combatente!").
2. Utilize formatação Markdown limpa:
   - Use ### para títulos principais.
   - Use tópicos com marcadores (* ou -).
   - Use **negrito** para destacar conceitos fundamentais da doutrina militar.
3. Se o militar solicitar simulado ou questões:
   - Crie questões de múltipla escolha (A, B, C, D) no padrão das provas da Força Aérea Brasileira.
   - Coloque o Gabarito Comentado de forma clara ao final da mensagem.
`;

    // Modelos ativos confirmados na sua conta
    const modelsToTry = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'];

    let finalReply = '';
    let lastError = '';

    for (const model of modelsToTry) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: message },
            ],
            temperature: 0.5,
            max_tokens: 1500,
          }),
        });

        const data = await response.json();

        if (response.ok && data.choices?.[0]?.message?.content) {
          finalReply = data.choices[0].message.content;
          break; // Sucesso, encerra o loop!
        } else {
          lastError = data.error?.message || `Erro HTTP ${response.status}`;
        }
      } catch (err: any) {
        lastError = err.message;
      }
    }

    if (!finalReply) {
      return NextResponse.json(
        { error: `Erro ao gerar resposta com o Instrutor: ${lastError}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ reply: finalReply.trim() });

  } catch (error: any) {
    console.error('Erro geral na rota de chat:', error);
    return NextResponse.json(
      { error: error?.message || 'Falha ao conectar com o Instrutor.' },
      { status: 500 }
    );
  }
}