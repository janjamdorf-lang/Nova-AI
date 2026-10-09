
/**
 * Nova Core 0.1
 * Ein kleiner, selbst entwickelter Text-Kern.
 * Noch kein großes Sprachmodell wie ChatGPT.
 */

const trainingData = [
  {
    input: ["hallo", "hi", "guten tag", "hey"],
    output: "Hallo! Ich bin Nova AI. Wie kann ich dir helfen?"
  },
  {
    input: ["wer bist du", "wie heißt du", "was bist du"],
    output: "Ich bin Nova AI, ein KI-Projekt, das Schritt für Schritt entwickelt wird."
  },
  {
    input: ["was kannst du", "hilfe", "was machst du"],
    output: "Ich kann einfache Fragen beantworten. Mein nächstes Ziel ist, aus mehr Textbeispielen zu lernen."
  },
  {
    input: ["danke", "vielen dank"],
    output: "Gern geschehen! Was möchtest du als Nächstes machen?"
  },
  {
    input: ["tschüss", "auf wiedersehen", "bis später"],
    output: "Bis später! Ich freue mich, wenn du wieder mit Nova AI arbeitest."
  }
];

function normalize(text) {
  return String(text)
    .toLocaleLowerCase("de-DE")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function similarity(a, b) {
  const wordsA = new Set(normalize(a).split(" ").filter(Boolean));
  const wordsB = new Set(normalize(b).split(" ").filter(Boolean));

  if (!wordsA.size || !wordsB.size) return 0;

  let common = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) common++;
  }

  return common / Math.max(wordsA.size, wordsB.size);
}

export function getNovaCoreInfo() {
  return {
    name: "Nova Core",
    version: "0.1.0",
    language: "de",
    type: "regelbasierter Text-Prototyp",
    trainingExamples: trainingData.length,
    externalAIRequired: false
  };
}

export function trainOnExamples(examples) {
  if (!Array.isArray(examples)) {
    throw new TypeError("Die Trainingsdaten müssen eine Liste sein.");
  }

  let added = 0;

  for (const example of examples) {
    if (
      typeof example?.input === "string" &&
      example.input.trim() &&
      typeof example?.output === "string" &&
      example.output.trim()
    ) {
      trainingData.push({
        input: [example.input.trim()],
        output: example.output.trim()
      });
      added++;
    }
  }

  return {
    added,
    totalExamples: trainingData.length
  };
}

export function askNovaCore(question) {
  const text = String(question ?? "").trim();

  if (!text) {
    return "Schreibe bitte eine Nachricht, damit ich antworten kann.";
  }

  let bestMatch = null;
  let bestScore = 0;

  for (const example of trainingData) {
    for (const input of example.input) {
      const score = similarity(text, input);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = example;
      }
    }
  }

  if (bestMatch && bestScore >= 0.5) {
    return bestMatch.output;
  }

  return "Das weiß ich noch nicht zuverlässig. Mein eigener Nova-Kern ist noch klein. Wir können ihn mit guten Beispielen erweitern.";
}
