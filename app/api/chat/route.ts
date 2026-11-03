import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
  try {
    const { message, materialTitle } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Mensagem obrigatória.' }, { status: 400 });
    }

    const systemPrompt = `
Você é o "Instrutor FAB", um assistente militar de elite focado na preparação de soldados da Força Aérea Brasileira para os cursos CESD e CFC.
A matéria de estudo atual é: "${materialTitle}".

Suas regras de conduta:
1. Mantenha tom militar respeitoso, claro, objetivo e disciplinado (ex: "Positivo, combatente", "Na escuta").
2. Esclareça dúvidas técnicas de acordo com os manuais oficiais da Aeronáutica.
3. Se o militar solicitar simulado ou questões: crie questões de múltipla escolha (A, B, C, D) no padrão das bancas da FAB e inclua o gabarito comentado ao final.
4. Mantenha o foco absoluto nos estudos da FAB.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\nSolicitação do militar: ${message}` }],
        },
      ],
    });

    return NextResponse.json({ reply: response.text });
  } catch (error: any) {
    console.error('Erro na rota Gemini:', error);
    return NextResponse.json(
      { error: 'Falha na comunicação com o Instrutor FAB.' },
      { status: 500 }
    );
  }
}