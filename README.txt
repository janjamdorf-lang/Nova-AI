NOVA AI MODELL-PAKET

Wichtig: Dieses Paket enthält eine Ollama-Modellkonfiguration, nicht die mehrere GB großen Gewichte des Sprachmodells. Diese können nicht sinnvoll in diesem kleinen ZIP mitgeliefert werden.

BASISMODELL: qwen2.5:1.5b

WIE DAS MODELL ERSTELLT WIRD:
1. Ollama auf einem unterstützten Computer/Server installieren: https://ollama.com/
2. Modell herunterladen: ollama pull qwen2.5:1.5b
3. Im Ordner mit der Datei Modelfile ausführen: ollama create nova-ai -f Modelfile
4. Testen: ollama run nova-ai

UMGEBUNGSVARIABLEN FÜR NOVA AI:
AI_BACKEND=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
NOVA_MODEL=nova-ai

WICHTIG FÜR DEINE RENDER-WEBSEITE:
127.0.0.1 funktioniert nur, wenn Ollama auf derselben Maschine läuft wie der Node-Server. Auf Render muss OLLAMA_BASE_URL auf eine erreichbare Maschine zeigen, auf der Ollama läuft.

EINSCHRÄNKUNG:
Diese Datei trainiert kein komplett neues KI-Modell von Grund auf. Sie erstellt ein eigenes Nova-AI-Modellprofil auf Basis eines vorhandenen Open-Source-Modells. Das Paket allein kann nicht auf dem iPad ausgeführt werden und kann ohne einen laufenden Modellserver keine Chat-Antworten liefern.
