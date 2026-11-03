// app/api/admin/generate-quiz/route.ts
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

    const { materialTitle, courseName, count = 5 } = await req.json();

    if (!materialTitle) {
      return NextResponse.json({ error: 'Título do material obrigatório.' }, { status: 400 });
    }

    const systemPrompt = `
Você é um oficial e instrutor da Força Aérea Brasileira (FAB) especialista em bancas de provas militares (CESD e CFC).
Sua missão é criar exatamente ${count} questões de concurso militar em formato JSON.

REGRAS RÍGIDAS:
1. Responda SOMENTE o objeto JSON. Não escreva nenhuma palavra antes ou depois. Sem blocos markdown com crases.
2. Cada questão deve ter enunciado formal, 4 opções (A, B, C, D), indicação da correta ("A", "B", "C" ou "D") e fundamentação regulamentar.

EXEMPLO EXATO DO FORMATO:
{
  "questions": [
    {
      "statement": "Enunciado da questão militar sobre a disciplina...",
      "option_a": "Alternativa A",
      "option_b": "Alternativa B",
      "option_c": "Alternativa C",
      "option_d": "Alternativa D",
      "correct_option": "A",
      "explanation": "Artigo ou justificativa militar do regulamento."
    }
  ]
}
`;

    const userPrompt = `Gere ${count} questões militares de concurso para:
Curso Militar: ${courseName || 'Aeronáutica'}
Disciplina/Apostila: ${materialTitle}`;

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
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.3,
            max_tokens: 3500,
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
        { error: `Erro ao gerar questões com a IA: ${lastError}` },
        { status: 500 }
      );
    }

    // Limpeza e extração segura do JSON
    let clean = finalReply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error('A IA não retornou um JSON identificável.');
    }

    const jsonString = clean.substring(firstBrace, lastBrace + 1);
    const parsed = JSON.parse(jsonString);

    const questions = parsed.questions || parsed.data || (Array.isArray(parsed) ? parsed : []);

    return NextResponse.json({ questions });

  } catch (error: any) {
    console.error('Erro na rota de geração de provas:', error);
    return NextResponse.json(
      { error: error?.message || 'Falha ao processar as questões.' },
      { status: 500 }
    );
  }
}