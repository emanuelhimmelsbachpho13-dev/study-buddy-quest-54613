import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import pdfParse from 'pdf-parse';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Inicializar clientes
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!supabaseUrl || !supabaseServiceKey || !geminiApiKey) {
      return res.status(500).json({ error: 'Missing environment variables' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const genAI = new GoogleGenerativeAI(geminiApiKey);

    // 2. Receber dados
    const { file_path, material_title } = req.body;

    if (!file_path) {
      return res.status(400).json({ error: 'file_path is required' });
    }

    // 3. Obter ID do usuário do token
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header required' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const userId = user.id;

    // 4. Download do arquivo do Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('uploads')
      .download(file_path);

    if (downloadError) {
      console.error('Download error:', downloadError);
      return res.status(500).json({ error: 'Failed to download file' });
    }

    // 5. Parsing - Extrair texto do PDF
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const pdfData = await pdfParse(buffer);
    const textContent = pdfData.text;

    if (!textContent || textContent.trim().length === 0) {
      return res.status(400).json({ error: 'No text content found in PDF' });
    }

    // 6. IA - Gemini
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      systemInstruction: 'Você é um assistente educacional especialista em criar quizzes. Baseado no texto fornecido, gere 7 perguntas de múltipla escolha. Sua resposta deve ser APENAS um JSON válido, seguindo este formato exato: [ { "pergunta": "...", "opcoes": ["A", "B", "C", "D"], "resposta_correta": "A" } ] Não inclua ```json ou qualquer outro texto antes ou depois do array JSON.'
    });

    const prompt = `Analise o seguinte texto e gere 7 perguntas de múltipla escolha:\n\n${textContent.substring(0, 30000)}`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const generatedText = response.text();

    // Parse JSON da resposta
    let questions;
    try {
      // Remove qualquer markdown ou texto extra
      const cleanedText = generatedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      questions = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Generated text:', generatedText);
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(500).json({ error: 'Invalid questions format from AI' });
    }

    // 7. Salvar no Banco - Criar Quiz
    const { data: quizData, error: quizError } = await supabase
      .from('quizzes')
      .insert({
        user_id: userId,
        material_title: material_title || 'Quiz sem título',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (quizError) {
      console.error('Quiz insert error:', quizError);
      return res.status(500).json({ error: 'Failed to create quiz' });
    }

    const quizId = quizData.id;

    // 8. Inserir perguntas
    const questionsToInsert = questions.map((q, index) => ({
      quiz_id: quizId,
      pergunta: q.pergunta,
      opcoes: q.opcoes,
      resposta_correta: q.resposta_correta,
      ordem: index + 1
    }));

    const { error: questionsError } = await supabase
      .from('questions')
      .insert(questionsToInsert);

    if (questionsError) {
      console.error('Questions insert error:', questionsError);
      return res.status(500).json({ error: 'Failed to insert questions' });
    }

    // 9. Responder ao Frontend
    return res.status(200).json({ quizId });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
