# Wenn ich König von Deutschland wäre

Eine politische Regierungssimulation: ein fiktives Land gründen, eine eigene Agenda verfolgen und mit den Folgen leben. Grundlage ist das [Project Pack](docs/project-pack.md), erweitert um eine acht Quartale lange Amtszeit mit konkurrierenden Anliegen, laufenden Projekten und reagierenden Interessengruppen. Die Spielschleife ist in [campaign-plan.md](campaign-plan.md) beschrieben.

## Lokal starten

Voraussetzung: Node.js 22 oder neuer, npm.

```sh
npm ci
npm run dev
```

Öffnen: http://localhost:3000/. Ohne API-Schlüssel sind die komplette Amtszeit, Projekte, Krisen, Lernkarten und Nachfolgetest nutzbar. Der Tutor verwendet dann ausdrücklich hinterlegte Kabinettsnotizen. Eigene Anweisungen werden in diesem Modus per Schlüsselwortsuche passenden simulierten Beschlüssen zugeordnet.

Für einen Produktionslauf:

```sh
npm run build
npm start
```

## Enthalten

- Eigene Vision, zwei überprüfbare Regierungsversprechen und eine Verfassung mit unterschiedlichen Machtgrenzen.
- Acht Quartale mit je zwei Beschlüssen. Mehrere Dossiers stehen gleichzeitig zur Wahl; nicht bearbeitete Krisen haben Folgen. Ein Quartal kann bewusst vorzeitig abgeschlossen werden.
- Mehrstufige Projekte mit späteren Effekten, fiktive Pressestimmen und unterschiedliche Reaktionen von Bevölkerung, Wirtschaft und Zivilgesellschaft. Das Kabinett vertritt widersprüchliche Interessen.
- Deterministische Regeln mit kanonischem Replay: vergangene Beschlüsse, tatsächlich vorhandene Institutionen und aktuelle Kennzahlen beeinflussen die Anliegen der nächsten Runde.
- Eigene Anweisungen werden als Vorschläge zu aktuell verfügbaren Beschlüssen ausgearbeitet. Die Umsetzung erfordert immer eine sichtbare Bestätigung. Beliebige, nicht simulierte Maßnahmen werden nicht als ausgeführt behauptet.
- Getrennte Werte für Staatskasse, Rückhalt, Wohnkosten, Wirtschaft und Umwelt sowie institutionelle Rechte und Machtkontrolle. Keine realen Geldbeträge oder Wahlprognosen, kein moralischer Gesamtscore.
- Unterschiedliche Enden und persönliches Vermächtnis: Versprechen, Erfolge, Kosten und ein interaktiver Nachfolgetest auf Basis der wirklich geschaffenen Regeln.
- Sechs Lernkarten mit Quellen, Verständnis- und Transferfragen, Wiederholung nach einer weiteren Entscheidung sowie nach 1/3/7 Tagen. Falsche Antworten kehren früher zurück.
- Kampagne und Lernkartei in LocalStorage; nach einem Neuladen fortsetzen. Eine neue Amtszeit ersetzt den Kampagnenverlauf, behält aber die Lernkartei. Der alte Drei-Szenen-Spielstand bleibt unter seinem bisherigen Speicherschlüssel erhalten.
- Text-Tutor sowie optionale Gemma- und ElevenLabs-Anbindung. Sprachvorschläge müssen sichtbar per Button bestätigt werden.

## Gemma und Sprache aktivieren

`.env.example` als `.env.local` kopieren und die benötigten Werte lokal eintragen. Schlüssel niemals committen.

| Variable | Zweck |
| --- | --- |
| `OPENROUTER_API_KEY` | Gemma über OpenRouter aktivieren |
| `GEMMA_MODEL` | Standard: `google/gemma-3-27b-it` |
| `GEMMA_BASE_URL` | Optionaler OpenAI-kompatibler Gemma-Endpunkt, inklusive `/v1` |
| `GEMMA_API_KEY` | Schlüssel für einen alternativen Veranstalter-Endpunkt |
| `ELEVENLABS_API_KEY` | Serverseitiger ElevenLabs-Zugang |
| `ELEVENLABS_AGENT_ID` | Privater, konfigurierter deutschsprachiger Agent |

Nach Änderungen am Environment den Server neu starten. Die Einrichtung der vier Sprachwerkzeuge und ein Agenten-Prompt stehen in [docs/voice-agent.md](docs/voice-agent.md). Das in ElevenLabs gewählte Dialogmodell steuert das Gespräch; fachliche Fragen werden über das Werkzeug an Gemma weitergeleitet. Mikrofon und Sprache sind optional.

Echte Gemma-Antworten und Sprachgespräche sind erst mit gültigen Anbieterzugängen prüfbar. Ohne Zugang wird kein Anbietererfolg vorgetäuscht. Bei Ausfällen bleibt der Text-/Klickablauf mit kuratierten Erklärungen erhalten. Eine Aufnahme-/Scribe-/TTS-Alternative zur Live-Sprachsession ist in diesem ersten Prototyp noch nicht enthalten.

## Aufbau und Schnittstellen

Next.js App Router, React, TypeScript, Tailwind und Zod. Kein Konto, keine Datenbank, kein geräteübergreifendes Speichern.

| Pfad | Aufgabe |
| --- | --- |
| `src/lib/campaign/engine.ts` | Regierungsrunden, Projekte, Krisen, Replay, Ziele und Vermächtnis |
| `src/lib/campaign/content.ts` | Eigene Dossiers, Beschlüsse, Beraterstimmen und Modellfolgen |
| `src/lib/game/engine.ts` | Ursprünglicher Drei-Szenen-Prototyp und gemeinsame Begriffskarten |
| `src/lib/game/learning.ts` | Wiederholungsregeln der Lernkarten |
| `src/data/*.json` | Kuratierte Szenen, Begriffe, Quellen und Fragen |
| `src/lib/server/campaign-gemma.ts` | Kontextbezogene Kabinettsanalyse und kuratierter Fallback |
| `src/lib/server/campaign-order.ts` | Freie Anweisung auf erlaubte aktuelle Beschlüsse abbilden |
| `src/components/` | Austauschbare einfache Oberfläche und Sprachadapter |
| `POST /api/campaign` | `{ state, command, revision }` → Zustand und unmittelbarer Spielbericht, ohne Modellwartezeit |
| `POST /api/campaign/tutor` | `{ state, question, conceptId? }` → kontextbezogene Antwort, Begriffs-IDs und Quelle |
| `POST /api/campaign/order` | `{ state, order }` → geprüfte Vorschläge aus den aktuellen Dossiers, noch keine Umsetzung |
| `POST /api/voice-session` | Kurzlebiger WebRTC-Gesprächstoken; keine Schlüssel für den Browser |
| `GET /api/health` | Konfigurierte Fähigkeiten ohne Zugangsdaten |

Das Backend rekonstruiert Kennzahlen und Institutionen aus dem geordneten Verlauf. Mitgeschickte Indizes sind nicht vertrauenswürdig. Nur Spielregeln ändern Werte; Modellantworten werden begrenzt und validiert. Revisionen und eine Sperre im Browser verhindern doppelte oder veraltete Bestätigungen innerhalb einer Sitzung. Das ist ein browsergebundener Prototyp, kein gemeinsamer Mehrspieler-Server.

## Prüfen

```sh
npm test
npm run typecheck
npm run build
```

Die Tests prüfen Kampagnenstrategien, Aktionsgrenzen, ignorierte Krisen, Projekte und Enden, kanonisches Replay, veraltete Befehle, die Anweisungsinterpretation, Lernintervalle und Anbieterfehler. Die 27 Wege des ursprünglichen Regelmoduls bleiben zusätzlich abgedeckt. Anbieterantworten sind gemockt.

Kurzer manueller Durchlauf: Agenda und Verfassung wählen → zwischen konkurrierenden Dossiers entscheiden → Projekt starten → weiteres Anliegen bearbeiten oder liegen lassen → Quartal abschließen → Presse und Projektfortschritt ansehen → Begriff ins Notizbuch übernehmen → bis zum Vermächtnis spielen. Zum Vergleich dieselbe Agenda mit anderen Prioritäten oder einer anderen Verfassung erneut spielen.

Inspiration für die stärkere Spielschleife ist [Eurocracy](https://eurocracy.xyz/): persönliche Agenda, begrenzte Amtszeit, Berater und spätere Konsequenzen. Inhalte, Figuren, Regeln und Gestaltung dieser App sind eigenständig; fremder Code und fremde Bilder wurden nicht übernommen.

## Bereitstellung

Als Next.js-Projekt in Vercel importierbar: Build `npm run build`, übrige Framework-Einstellungen automatisch. Benötigte Environment-Variablen in der Hosting-Umgebung eintragen. Sprachzugriff braucht HTTPS oder localhost. Es wurde noch keine öffentliche Bereitstellung und kein Demo-Video erstellt.

Quellen und fiktive Modellannahmen sind getrennt. Demokratische Werte und Menschenrechte sind der offengelegte normative Maßstab; politische Präferenzen werden nicht als richtige oder falsche Lernantwort bewertet.
