// app/api/admin/generate-topics/route.ts
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

    const { materialTitle, courseName } = await req.json();

    if (!materialTitle) {
      return NextResponse.json({ error: 'Título do material obrigatório.' }, { status: 400 });
    }

    const systemPrompt = `
Você é um instrutor e examinador de elite da Força Aérea Brasileira (FAB).
Sua missão é criar um RESUMO COMPLETO E EXAUSTIVO do manual militar informado, dividindo-o em tópicos de estudo para o CESD/CFC.

DIRETRIZ DE EXTENSÃO ADAPTATIVA:
1. Adapte a quantidade de tópicos de acordo com a extensão real do manual da FAB.
2. Cada tópico deve ter definições claras, artigos militares, listas com marcadores (•) e macetes para a prova.
3. Responda ESTRITAMENTE em formato JSON puro. Sem texto antes ou depois. Sem blocos markdown com crases.

ESTRUTURA DO JSON:
{
  "topics": [
    {
      "title": "Título Claro do Tópico",
      "content": "• Definições da matéria.\n• Artigos correspondentes na Aeronáutica.\n• Pontos de alta incidência nas provas da FAB.",
      "estimated_minutes": 4
    }
  ]
}
`;

    const userPrompt = `Decomponha e resuma integralmente o conteúdo deste manual militar da FAB:
Curso Militar: ${courseName || 'Aeronáutica'}
Disciplina/Manual Oficial: ${materialTitle}`;

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
        { error: `Erro ao gerar tópicos com a IA: ${lastError}` },
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

    return NextResponse.json({ topics: parsed.topics || [] });

  } catch (error: any) {
    console.error('Erro na rota de geração de tópicos:', error);
    return NextResponse.json(
      { error: error?.message || 'Falha ao processar os tópicos.' },
      { status: 500 }
    );
  }
}