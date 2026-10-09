
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

// =====================================================
// NOVA CORE 0.2 — eigener, kostenloser Text-Prototyp
// Funktioniert ohne externe KI und ohne API-Schlüssel.
// Dies ist ein lernbarer Antwort-Prototyp, kein LLM.
// =====================================================

const examples = [
  { inputs: ['hallo', 'hi', 'hey', 'guten tag'], answer: 'Hallo! Ich bin Nova AI. Was möchtest du heute machen?' },
  { inputs: ['wer bist du', 'wie heißt du'], answer: 'Ich bin Nova AI, ein eigenes KI-Projekt, das Schritt für Schritt entwickelt wird.' },
  { inputs: ['was kannst du', 'was kannst du machen'], answer: 'Ich kann einfache Fragen beantworten und passende Antworten aus meinen Beispielen finden. Wir erweitern meine Fähigkeiten nach und nach.' },
  { inputs: ['danke', 'vielen dank'], answer: 'Sehr gern! Gibt es noch etwas, bei dem ich dir helfen kann?' },
  { inputs: ['tschüss', 'auf wiedersehen'], answer: 'Bis bald! Dein Nova-Core-Projekt wird Schritt für Schritt besser.' },
  { inputs: ['was ist künstliche intelligenz', 'was ist ki'], answer: 'Künstliche Intelligenz ist Software, die Aufgaben wie Texterkennung, Mustererkennung oder das Erzeugen von Antworten ausführen kann.' },
  { inputs: ['was ist html'], answer: 'HTML beschreibt die Struktur einer Webseite. CSS gestaltet das Aussehen und JavaScript fügt interaktive Funktionen hinzu.' },
  { inputs: ['was ist javascript'], answer: 'JavaScript ist eine Programmiersprache, mit der Webseiten interaktiv werden und auch Serverprogramme geschrieben werden können.' },
  { inputs: ['was ist roblox studio'], answer: 'Roblox Studio ist ein Entwicklungsprogramm, mit dem du Roblox-Spiele bauen und mit Luau programmieren kannst.' },
  { inputs: ['wie geht es dir'], answer: 'Danke der Nachfrage! Ich bin ein Programm und habe keine Gefühle, aber ich bin bereit, dir zu helfen.' }
];

function normalize(text) {
  return String(text ?? '')
    .toLocaleLowerCase('de-DE')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function wordSet(text) {
  return new Set(normalize(text).split(' ').filter(word => word.length > 1));
}

function similarity(a, b) {
  const first = wordSet(a);
  const second = wordSet(b);

  if (!first.size || !second.size) return 0;

  let common = 0;
  for (const word of first) {
    if (second.has(word)) common++;
  }

  // Kleine Belohnung für ähnlich lange Texte mit gemeinsamen Wörtern.
  return common / Math.max(first.size, second.size);
}

function coreAnswer(question) {
  const text = normalize(question);

  if (!text) {
    return 'Schreibe bitte eine Nachricht.';
  }

  if (text.length > 2000) {
    return 'Deine Nachricht ist für Nova Core noch zu lang. Bitte fasse sie kürzer.';
  }

  let best = null;
  let bestScore = 0;

  for (const example of examples) {
    for (const input of example.inputs) {
      const score = similarity(text, input);
      if (score > bestScore) {
        bestScore = score;
        best = example;
      }
    }
  }

  if (best && bestScore >= 0.5) {
    return best.answer;
  }

  return 'Das kann ich noch nicht zuverlässig beantworten. Mein eigener Nova Core ist noch ein kleiner Prototyp. Wir können ihn mit weiteren Beispielen erweitern.';
}

function addTrainingExample(input, answer) {
  if (
    typeof input !== 'string' ||
    typeof answer !== 'string' ||
    !input.trim() ||
    !answer.trim()
  ) {
    return false;
  }

  if (input.length > 500 || answer.length > 2000) return false;
  if (examples.length >= 5000) return false;

  examples.push({
    inputs: [input.trim()],
    answer: answer.trim()
  });

  return true;
}

// Optionaler externer KI-Anbieter.
// Ohne vollständige Konfiguration wird kein externer KI-Aufruf gemacht.
function externalAIConfigured() {
  return Boolean(
    process.env.AI_BASE_URL &&
    process.env.AI_API_KEY &&
    process.env.AI_MODEL
  );
}

async function askExternalAI(messages) {
  const base = process.env.AI_BASE_URL.replace(/\/+$/, '');

  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.AI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL,
      messages: [
        {
          role: 'system',
          content: 'Du bist Nova AI, ein hilfreicher deutschsprachiger Assistent. Antworte ehrlich und erfinde keine Fakten.'
        },
        ...messages.slice(-20).map(message => ({
          role: message.role === 'assistant' ? 'assistant' : 'user',
          content: String(message.content ?? '').slice(0, 10000)
        }))
      ],
      temperature: 0.7,
      stream: false
    }),
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    throw new Error(`Externer KI-Anbieter meldet HTTP ${response.status}.`);
  }

  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content;

  if (typeof reply !== 'string' || !reply.trim()) {
    throw new Error('Der externe KI-Anbieter hat keine Textantwort geliefert.');
  }

  return reply;
}

// Status-Endpunkt für Webseite und Render.
app.get('/api/status', (_req, res) => {
  res.json({
    ok: true,
    name: 'Nova AI',
    core: 'Nova Core 0.2',
    coreReady: true,
    trainingExamples: examples.length,
    externalAIConfigured: externalAIConfigured(),
    searchConfigured: Boolean(process.env.TAVILY_API_KEY),
    authConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
    imageAnalysis: false,
    videoAnalysis: false
  });
});

// Grundlegende Auth-Konfiguration bleibt kompatibel.
app.get('/api/auth-config', (_req, res) => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return res.status(503).json({ error: 'Supabase ist noch nicht konfiguriert.' });
  }

  res.json({
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY
  });
});

// Chat: verwendet optional einen konfigurierten Anbieter,
// ansonsten immer den eigenen Nova Core.
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Bitte sende eine Nachricht.' });
    }

    const lastUser = [...messages].reverse().find(
      message => message && message.role === 'user'
    );

    if (!lastUser || typeof lastUser.content !== 'string') {
      return res.status(400).json({ error: 'Keine gültige Textnachricht gefunden.' });
    }

    const question = lastUser.content.slice(0, 2000);

    // Nur wenn Zugangsdaten vollständig vorhanden sind,
    // darf ein externer KI-Anbieter angesprochen werden.
    if (externalAIConfigured()) {
      try {
        const reply = await askExternalAI(messages);
        return res.json({
          reply,
          mode: 'external',
          sources: [],
          searched: false
        });
      } catch (error) {
        console.error('Externe KI fehlgeschlagen:', error.message);
        // Sicherer Fallback: eigener Kern statt Chat-Ausfall.
      }
    }

    return res.json({
      reply: coreAnswer(question),
      mode: 'nova-core',
      sources: [],
      searched: false,
      note: 'Antwort vom eigenen Nova Core. Dieser Prototyp besitzt noch kein großes Sprachmodell.'
    });
  } catch (error) {
    console.error('Chat-Fehler:', error);
    res.status(500).json({ error: 'Nova AI konnte die Nachricht nicht verarbeiten.' });
  }
});

// Trainingsbeispiele hinzufügen.
// Dieser Endpunkt ist nur für Tests gedacht und NICHT öffentlich abgesichert.
// Deshalb wird das Hinzufügen über HTTP standardmäßig deaktiviert.
app.post('/api/train', (_req, res) => {
  return res.status(403).json({
    error: 'Das öffentliche Training ist deaktiviert. Trainingsdaten müssen erst sicher gespeichert und geschützt werden.'
  });
});

// Einfacher lokaler Test-Endpunkt für Textbeispiele.
app.post('/api/core/test', (req, res) => {
  const question = String(req.body?.message ?? '').slice(0, 2000);
  if (!question.trim()) {
    return res.status(400).json({ error: 'Bitte gib eine Testnachricht ein.' });
  }

  res.json({
    reply: coreAnswer(question),
    mode: 'nova-core'
  });
});

// Datei-Upload: Textdateien werden gelesen.
// Bild-, PDF- und Videoinhalte werden ausdrücklich nicht als analysiert ausgegeben.
app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Keine Datei empfangen.' });
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
    extractedText = file.buffer.toString('utf8').slice(0, 30000);
    note = 'Textdatei eingelesen. Eine weitergehende Analyse ist noch nicht eingebaut.';
  } else if (type.startsWith('image/')) {
    note = 'Bild empfangen, aber noch nicht visuell analysiert. Dafür wird ein Bildmodell benötigt.';
  } else if (type.startsWith('video/')) {
    note = 'Video empfangen, aber noch nicht analysiert. Dafür sind Videoframe-Verarbeitung und ein passendes Modell erforderlich.';
  } else if (type === 'application/pdf' || ext === '.pdf') {
    note = 'PDF empfangen, aber der PDF-Text wird noch nicht extrahiert.';
  } else {
    note = 'Datei empfangen. Dieses Dateiformat wird noch nicht inhaltlich ausgewertet.';
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

// Nicht gefundene API-Pfade bekommen JSON.
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API-Endpunkt nicht gefunden.' });
});

// Alle übrigen Pfade liefern die Weboberfläche.
app.get('/{*path}', (req, res, next) => {
  res.sendFile(
    path.join(__dirname, 'public', 'index.html'),
    error => {
      if (error) next(error);
    }
  );
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Nova AI läuft auf Port ${port}`);
  console.log('Nova Core ist bereit.');
  console.log(`Externe KI konfiguriert: ${externalAIConfigured()}`);
});
