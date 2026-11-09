
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 3000);

const uploadLimit =
  Math.max(1, Number(process.env.MAX_UPLOAD_MB || 25)) * 1024 * 1024;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '2mb' }));

// Supabase-Konfiguration aus Render oder .env lesen
function getSupabaseConfig() {
  const url = (
    process.env.SUPABASE_URL || ''
  ).trim().replace(/\/+$/, '');

  // Unterstützt neuen und alten Supabase-Schlüsselnamen
  const key = (
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ''
  ).trim();

  if (!url || !key) {
    return {
      config: null,
      reason: 'SUPABASE_URL oder Supabase Publishable Key fehlt.'
    };
  }

  try {
    const parsed = new URL(url);

    if (!['https:', 'http:'].includes(parsed.protocol)) {
      throw new Error('Ungültiges URL-Protokoll.');
    }
  } catch {
    return {
      config: null,
      reason: 'SUPABASE_URL ist keine gültige URL.'
    };
  }

  // Niemals einen geheimen Schlüssel an den Browser ausliefern.
  if (key.startsWith('sb_secret_')) {
    return {
      config: null,
      reason: 'Es wurde ein geheimer Supabase-Schlüssel verwendet. Bitte den Publishable Key eintragen.'
    };
  }

  // Auch ältere JWT-Service-Role-Schlüssel erkennen.
  const parts = key.split('.');
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf8')
      );

      if (payload.role === 'service_role') {
        return {
          config: null,
          reason: 'Service-Role-Schlüssel dürfen nicht im Browser verwendet werden.'
        };
      }
    } catch {
      // Ungültige JWT-Formate werden weiter unten nicht als
      // gültiger Publishable Key behandelt, falls nicht passend.
    }
  }

  return {
    config: { url, key },
    reason: null
  };
}

// Supabase-Konfiguration für die Website
app.get('/api/auth-config', (_req, res) => {
  res.set('Cache-Control', 'no-store');

  const result = getSupabaseConfig();

  if (!result.config) {
    console.error('Supabase-Konfiguration:', result.reason);

    return res.status(503).json({
      configured: false,
      error: result.reason
    });
  }

  res.json({
    configured: true,
    url: result.config.url,
    anonKey: result.config.key,
    publishableKey: result.config.key
  });
});

// Serverstatus
app.get('/api/status', (_req, res) => {
  const supabase = getSupabaseConfig();

  res.json({
    aiConfigured: Boolean(
      process.env.AI_BASE_URL &&
      process.env.AI_API_KEY &&
      process.env.AI_MODEL
    ),

    searchConfigured: Boolean(process.env.TAVILY_API_KEY),

    authConfigured: Boolean(supabase.config),

    authError: supabase.reason,

    videoAnalysis: false
  });
});

app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: uploadLimit,
    files: 1
  }
});

// Echte Websuche
async function searchWeb(query) {
  if (!process.env.TAVILY_API_KEY) {
    return {
      error: 'Websuche ist nicht konfiguriert.',
      results: []
    };
  }

  const response = await fetch(
    'https://api.tavily.com/search',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        search_depth: 'basic',
        max_results: 5,
        include_answer: false
      })
    }
  );

  if (!response.ok) {
    throw new Error(
      `Websuche fehlgeschlagen (${response.status})`
    );
  }

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

// KI-Chat
app.post('/api/chat', async (req, res) => {
  try {
    const {
      messages,
      webSearch = false
    } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: 'Bitte sende eine Nachricht.'
      });
    }

    if (
      !process.env.AI_BASE_URL ||
      !process.env.AI_API_KEY ||
      !process.env.AI_MODEL
    ) {
      return res.status(503).json({
        error: 'Die KI ist noch nicht eingerichtet. Ergänze AI_BASE_URL, AI_API_KEY und AI_MODEL.'
      });
    }

    const lastUser = [...messages]
      .reverse()
      .find(m => m && m.role === 'user');

    let sources = [];
    let searchNote = '';

    if (
      lastUser &&
      (webSearch || asksForSearch(String(lastUser.content || '')))
    ) {
      const search = await searchWeb(
        String(lastUser.content || '').slice(0, 500)
      );

      sources = search.results || [];

      if (search.error) {
        searchNote = search.error;
      }
    }

    const system = `Du bist Nova AI, ein hilfreicher deutschsprachiger KI-Assistent.
Antworte ehrlich und präzise.
Erfinde keine Recherche, Quellen, Datei-Inhalte oder ausgeführten Aktionen.
Wenn bereitgestellte Webquellen vorhanden sind, nutze sie kritisch.
Wenn keine Webquellen bereitgestellt wurden, sage nicht, dass du recherchiert hast.
Wenn etwas technisch nicht unterstützt wird, erkläre die Einschränkung offen.`;

    const sourceContext = sources.length
      ? '\n\nEchte Suchergebnisse:\n' +
        sources.map((s, i) =>
          `[${i + 1}] ${s.title}\nURL: ${s.url}\nAuszug: ${s.snippet}`
        ).join('\n\n')
      : '';

    const providerMessages = [
      {
        role: 'system',
        content: system + sourceContext
      },
      ...messages.slice(-20).map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: typeof m.content === 'string'
          ? m.content.slice(0, 20000)
          : String(m.content ?? '')
      }))
    ];

    const base = process.env.AI_BASE_URL.replace(/\/+$/, '');

    const response = await fetch(
      `${base}/chat/completions`,
      {
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
      }
    );

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 800);

      return res.status(502).json({
        error: `Der KI-Anbieter hat einen Fehler gemeldet (${response.status}). ${detail}`
      });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;

    if (!reply) {
      return res.status(502).json({
        error: 'Der KI-Anbieter hat keine Antwort zurückgegeben.'
      });
    }

    res.json({
      reply: typeof reply === 'string'
        ? reply
        : JSON.stringify(reply),
      sources,
      searchNote,
      searched: sources.length > 0
    });

  } catch (error) {
    console.error('Chat-Fehler:', error);

    res.status(500).json({
      error: error.message || 'Interner Serverfehler.'
    });
  }
});

// Datei-Upload
app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: 'Keine Datei empfangen.'
    });
  }

  const file = req.file;
  const type = file.mimetype || 'application/octet-stream';
  const ext = path.extname(file.originalname).toLowerCase();

  let extractedText = '';
  let note = '';

  if (
    ['.txt', '.md', '.csv', '.json'].includes(ext) ||
    type.startsWith('text/')
  ) {
    extractedText = file.buffer
      .toString('utf8')
      .slice(0, 30000);

  } else if (type.startsWith('video/')) {
    note = 'Video empfangen. Eine echte Videoanalyse ist noch nicht eingerichtet.';

  } else if (type.startsWith('image/')) {
    note = 'Bild empfangen. Für die Bildanalyse wird ein Vision-Modell benötigt.';

  } else if (type === 'application/pdf' || ext === '.pdf') {
    note = 'PDF erkannt. Die PDF-Textextraktion ist noch nicht eingerichtet.';

  } else {
    note = 'Datei empfangen. Dieses Format wird noch nicht ausgewertet.';
  }

  res.json({
    file: {
      name: file.originalname,
      type,
      size: file.size
    },
    extractedText,
    note
  });
});

// Website ausliefern
app.get('/{*path}', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      error: 'API-Endpunkt nicht gefunden.'
    });
  }

  res.sendFile(
    path.join(__dirname, 'public', 'index.html'),
    err => {
      if (err) next(err);
    }
  );
});

app.listen(port, '0.0.0.0', () => {
  const auth = getSupabaseConfig();

  console.log(`Nova AI läuft auf Port ${port}`);
  console.log(
    `Supabase: ${auth.config ? 'konfiguriert' : auth.reason}`
  );
});
