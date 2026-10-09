import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 3000);
const uploadLimit = Math.max(1, Number(process.env.MAX_UPLOAD_MB || 25)) * 1024 * 1024;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: uploadLimit, files: 1 }
});

app.get('/api/auth-config', (_req, res) => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return res.status(503).json({ error: 'Supabase nicht konfiguriert.' });
  }
  res.json({ url: process.env.SUPABASE_URL, anonKey: process.env.SUPABASE_ANON_KEY });
});

app.get('/api/status', (_req, res) => {
  res.json({
    aiConfigured: Boolean(process.env.AI_BASE_URL && process.env.AI_API_KEY && process.env.AI_MODEL),
    searchConfigured: Boolean(process.env.TAVILY_API_KEY),
    authConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
    videoAnalysis: false
  });
});

async function searchWeb(query) {
  if (!process.env.TAVILY_API_KEY) {
    return { error: 'Websuche ist nicht konfiguriert. Trage TAVILY_API_KEY in .env ein.', results: [] };
  }
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: 'basic',
      max_results: 5,
      include_answer: false
    })
  });
  if (!response.ok) throw new Error(`Websuche fehlgeschlagen (${response.status})`);
  const data = await response.json();
  return {
    results: (data.results || []).map(item => ({
      title: item.title || item.url,
      url: item.url,
      snippet: item.content || ''
    }))
  };
}

function asksForSearch(text) {
  return /\b(recherchier|recherchiere|im internet|online suchen|such im web|websuche|aktuell|neueste|heute|website|webseite|quellen|nachschauen)\b/i.test(text);
}

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, webSearch = false } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Bitte sende eine Nachricht.' });
    }
    if (!process.env.AI_BASE_URL || !process.env.AI_API_KEY || !process.env.AI_MODEL) {
      return res.status(503).json({
        error: 'Die KI ist noch nicht eingerichtet. Ergänze AI_BASE_URL, AI_API_KEY und AI_MODEL in der serverseitigen .env-Datei.'
      });
    }

    const lastUser = [...messages].reverse().find(m => m && m.role === 'user');
    let sources = [];
    let searchNote = '';
    if (lastUser && (webSearch || asksForSearch(String(lastUser.content || '')))) {
      const search = await searchWeb(String(lastUser.content || '').slice(0, 500));
      sources = search.results || [];
      if (search.error) searchNote = search.error;
    }

    const system = `Du bist Nova AI, ein hilfreicher deutschsprachiger KI-Assistent.
Antworte ehrlich und präzise. Erfinde keine Recherche, Quellen, Datei-Inhalte oder ausgeführten Aktionen.
Wenn bereitgestellte Webquellen vorhanden sind, nutze sie kritisch und zitiere sie mit ihren URLs.
Wenn keine Webquellen bereitgestellt wurden, sage nicht, dass du im Web recherchiert hast.
Wenn etwas technisch nicht unterstützt wird, erkläre die Einschränkung offen.`;

    const sourceContext = sources.length
      ? '\n\nEchte Suchergebnisse für diese Anfrage:\n' + sources.map((s, i) => `[${i + 1}] ${s.title}\nURL: ${s.url}\nAuszug: ${s.snippet}`).join('\n\n')
      : '';

    const providerMessages = [
      { role: 'system', content: system + sourceContext },
      ...messages.slice(-20).map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: typeof m.content === 'string' ? m.content.slice(0, 20000) : String(m.content ?? '')
      }))
    ];

    const base = process.env.AI_BASE_URL.replace(/\/+$/, '');
    const response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.AI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL,
        messages: providerMessages,
        temperature: 0.7,
        stream: false
      })
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 800);
      return res.status(502).json({ error: `Der KI-Anbieter hat einen Fehler gemeldet (${response.status}). ${detail}` });
    }
    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;
    if (!reply) return res.status(502).json({ error: 'Der KI-Anbieter hat keine Antwort zurückgegeben.' });

    res.json({
      reply: typeof reply === 'string' ? reply : JSON.stringify(reply),
      sources,
      searchNote,
      searched: sources.length > 0
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Interner Serverfehler.' });
  }
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Keine Datei empfangen.' });
  const file = req.file;
  const type = file.mimetype || 'application/octet-stream';
  const ext = path.extname(file.originalname).toLowerCase();
  let extractedText = '';
  let note = '';

  if (['.txt', '.md', '.csv', '.json'].includes(ext) || type.startsWith('text/')) {
    extractedText = file.buffer.toString('utf8').slice(0, 30000);
  } else if (type.startsWith('video/')) {
    note = 'Video hochgeladen, aber in dieser Starter-Version werden noch keine Videoframes analysiert. Eine passende Video-KI oder Frame-Extraktion muss eingerichtet werden.';
  } else if (type.startsWith('image/')) {
    note = 'Bild hochgeladen. Diese Starter-Version extrahiert noch keine Bildinhalte; für echte Bildanalyse muss ein vision-fähiges Modell eingebunden werden.';
  } else if (type === 'application/pdf' || ext === '.pdf') {
    note = 'PDF erkannt, aber der PDF-Text wird in dieser Starter-Version noch nicht extrahiert.';
  } else {
    note = 'Datei empfangen. Dieses Dateiformat wird noch nicht inhaltlich ausgewertet.';
  }

  res.json({
    file: { name: file.originalname, type, size: file.size },
    extractedText,
    note
  });
});

app.get('/{*path}', (req, res, next) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API-Endpunkt nicht gefunden.' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'), err => err && next(err));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Nova AI läuft auf http://localhost:${port}`);
});
