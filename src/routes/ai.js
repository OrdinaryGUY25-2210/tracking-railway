import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const CLAUDE_MODEL = 'claude-sonnet-5';

// ---------- get-ai-response: draf jawaban interview real-time ----------
const SYSTEM_PROMPT_INTERVIEW = {
  id: `Kamu adalah asisten interview real-time. Diberikan potongan transkrip percakapan interview,
tugasmu: (1) jika itu pertanyaan dari pewawancara, berikan draf jawaban singkat, jelas, dan percaya diri
(maks 4-5 kalimat); (2) jika bukan pertanyaan, berikan catatan singkat/insight yang relevan. Jawab dalam Bahasa Indonesia.`,
  en: `You are a real-time interview assistant. Given a snippet of interview transcript, your job:
(1) if it's a question, provide a short, clear, confident draft answer (max 4-5 sentences);
(2) if not, provide a brief relevant note instead. Respond in English.`,
};

router.post('/interview-response', async (req, res) => {
  try {
    const { sessionId, transcript, language } = req.body;
    if (!transcript) return res.status(400).json({ error: 'transcript wajib diisi.' });
    if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY belum di-set di server.' });

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 500,
        system: SYSTEM_PROMPT_INTERVIEW[language] || SYSTEM_PROMPT_INTERVIEW.id,
        messages: [{ role: 'user', content: transcript }],
      }),
    });
    const data = await r.json();
    const aiResponse = data.content?.[0]?.text || '';

    if (sessionId) {
      await query(
        'insert into transcript_entries (session_id, speaker, text, ai_response) values ($1,$2,$3,$4)',
        [sessionId, 'interviewer', transcript, aiResponse]
      );
    }
    res.json({ aiResponse });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal memproses respons AI.' });
  }
});

// ---------- tailor-cv: susun ulang CV + cover letter sesuai JD ----------
router.post('/tailor-cv', async (req, res) => {
  try {
    const { jobDescription, cvText } = req.body;
    if (!jobDescription || !cvText) return res.status(400).json({ error: 'jobDescription dan cvText wajib diisi.' });

    const result = await callFreeLLM(
      `Kamu adalah Senior HR Manager berpengalaman 15+ tahun. Diberikan JD dan CV asli kandidat, susun ulang CV
menjadi struktur data relevan dengan JD (tanpa mengarang), dan tulis cover letter singkat 3-4 paragraf.
Balas HANYA JSON valid: {"company":"","position":"","coverLetter":"","cvData":{}}`,
      `JD:\n${jobDescription}\n\nCV:\n${cvText}`
    );
    res.json(JSON.parse(result));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal memproses CV.' });
  }
});

// ---------- parse-profile: ekstrak teks CV jadi data profil terstruktur ----------
router.post('/parse-profile', async (req, res) => {
  try {
    const { cvText } = req.body;
    if (!cvText) return res.status(400).json({ error: 'cvText wajib diisi.' });

    const result = await callFreeLLM(
      `Ekstrak data dari teks CV mentah menjadi struktur profil, TANPA mengarang. Bagian yang tidak ditemukan
kembalikan "" atau []. Balas HANYA JSON valid sesuai struktur tabel "profile" (fullName, tagline, email, phone,
location, summary, skills[], experience[], education[], projects[]).`,
      cvText
    );
    res.json(JSON.parse(result));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal memproses CV.' });
  }
});

// Helper: OpenRouter dulu (model gratis), fallback ke Groq kalau gagal & di-set.
async function callFreeLLM(systemPrompt, userText) {
  const OPENROUTER_MODEL = 'meta-llama/llama-3.1-8b-instruct:free';
  const GROQ_MODEL = 'openai/gpt-oss-20b';

  if (process.env.OPENROUTER_API_KEY) {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userText }],
      }),
    });
    const data = await r.json();
    if (data.choices?.[0]?.message?.content) return stripJsonFence(data.choices[0].message.content);
  }

  if (process.env.GROQ_API_KEY) {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userText }],
      }),
    });
    const data = await r.json();
    if (data.choices?.[0]?.message?.content) return stripJsonFence(data.choices[0].message.content);
  }

  throw new Error('OPENROUTER_API_KEY / GROQ_API_KEY belum di-set di server.');
}

function stripJsonFence(text) {
  return text.replace(/```json|```/g, '').trim();
}

export default router;
