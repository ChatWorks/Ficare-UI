import { GoogleGenAI } from '@google/genai';

export async function POST(request) {
  const requestId = Math.random().toString(36).substring(7);

  try {
    const body = await request.json();
    const message = body.message;

    if (!message || typeof message !== "string") {
      return Response.json({ error: "Message is required" }, { status: 400 });
    }

    const ai = new GoogleGenAI({
        apiKey: process.env.GOOGLE_API_KEY
      });

    const prompt = `Genereer een korte, beschrijvende titel ... "${message}"
    
    BEANTWOORD DE VRAAG NIET! GENEREER ALLEEN EEN KORTE TITEL VAN MAX 7 WOORDEN`;

    console.log(`🤖 [${requestId}] Calling Gemini...`);

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 200,
      },
    });

    console.log(result.candidates?.[0]);
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text; // dit is de juiste manier
    console.log(`✅ [${requestId}] Gemini output: "${text}"`);

    return Response.json({ title: text });

  } catch (err) {
    console.error(`💥 [${requestId}] Error:`, err);
    return Response.json({ title: "Fallback titel" }, { status: 500 });
  }
}
