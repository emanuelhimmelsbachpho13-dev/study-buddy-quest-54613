import { GoogleGenerativeAI } from '@google/generative-ai';
import pdfParse from 'pdf-parse';
import multiparty from 'multiparty';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });
  }

  const form = new multiparty.Form();

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to parse form data' });
    }

    try {
      const file = files.file[0];
      const buffer = fs.readFileSync(file.path);
      
      // 1. Parsing - Extrair texto do PDF
      const pdfData = await pdfParse(buffer);
      const textContent = pdfData.text;

      if (!textContent || textContent.trim().length === 0) {
        return res.status(400).json({ error: 'No text content found in PDF' });
      }

      // 2. IA - Gemini (Modo Convidado)
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        systemInstruction: 'Você é um assistente educacional. Baseado no texto, gere 5 perguntas de múltipla escolha. Sua resposta deve ser APENAS um JSON válido, no formato: [ { "id": 1, "pergunta": "..." }, { "id": 2, "pergunta": "..." } ] Não inclua ```json ou qualquer outro texto.'
      });

      const prompt = `Analise o seguinte texto e gere 5 perguntas de múltipla escolha:\n\n${textContent.substring(0, 20000)}`;
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const generatedText = response.text();

      let questions;
      try {
        const cleanedText = generatedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        questions = JSON.parse(cleanedText);
      } catch (parseError) {
        console.error('JSON parse error (guest):', parseError, 'Generated text:', generatedText);
        return res.status(500).json({ error: 'Failed to parse AI response' });
      }

      // 3. Responder ao Frontend com as perguntas
      return res.status(200).json(questions);

    } catch (error) {
      console.error('Guest API error:', error);
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  });
}
