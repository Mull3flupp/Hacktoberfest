# Gemeinsam weiterbauen

## Start

```sh
git clone https://github.com/Mull3flupp/Hacktoberfest.git
cd Hacktoberfest
cp .env.example .env.local
```

Das private Repository erfordert GitHub-Zugriff. In `.env.local` einen gültigen Gemma-Zugang und einen dauerhaften `SIMULATION_SIGNING_KEY` eintragen, dann `npm run dev` starten und **http://127.0.0.1:3000/** öffnen. Die genaue Konfiguration steht in der [README](README.md). Zugangsdaten niemals committen oder in Testausgaben schreiben.

Der Entwicklungsstart richtet Abhängigkeiten und Build-Cache außerhalb des Cloud-Ordners ein. Der Quellcode bleibt live mit dem Projekt verbunden; vorhandene Ordner werden gesichert. Für lokale Prüfungen ohne Server zuerst `npm run runtime:prepare` ausführen. CI und Produktionsumgebungen können unverändert `npm ci` verwenden.

## Wo Änderungen hingehören

| Aufgabe | Einstieg |
| --- | --- |
| Aktive Oberfläche und freie Spielinteraktion | `src/components/open-world.tsx`, `src/components/world-panels.tsx`, `src/components/pixel-game.css` |
| Welt- und Analyseverträge | `src/lib/simulation/types.ts` |
| Validierung, Ausgangszustand, bestätigte und verzögerte Folgen | `src/lib/simulation/state.ts` |
| Signaturen, Gültigkeitsdauer und Bindung an die Welt | `src/lib/server/simulation-signing.ts` |
| Individuelle Analyse und Weltkontext | `src/lib/server/world-model.ts` |
| Google-/OpenRouter-Anbindung | `src/lib/server/gemma-client.ts` |
| HTTP-Verträge | `src/app/api/simulation/` |
| Lernkarten, Fragen und Quellen | `src/components/learning-panel.tsx`, `src/data/concepts.json`, `src/lib/game/learning.ts` |
| Sprache | `src/components/voice-panel.tsx`, `docs/voice-agent.md` |

Der aktive Entwurf steht in [open-simulation-plan.md](open-simulation-plan.md). `cabinet.tsx`, `src/lib/campaign/` sowie der Drei-Szenen-Prototyp bleiben als frühere Ansätze im Repository. Ihre Regeln und APIs sind nicht der Ablauf der Startseite. Gemeinsame Lernkarten werden weiterverwendet.

## Entwicklungsregeln

- Freie Entscheidungen werden individuell vom echten Modell analysiert. Keine stille Zuordnung zu alten Dossiers und kein erfundener KI-Fallback bei Anbieterfehlern.
- Modellfolgen müssen vor der Vorschau strikt validiert werden. Änderungen an Kennzahlen, Gruppen, Institutionen, Fakten und verzögerten Folgen benötigen eine ausdrücklich bestätigte, gültig signierte Analyse.
- Vorschauen bleiben an Welt-ID, Revision, exakten Ausgangszustand und ihre Gültigkeitsdauer gebunden. Beim Bestätigen kein zweiter Modellaufruf; angekündigte Folgen genau einmal zum vorgesehenen Zeitpunkt anwenden.
- Kein festes Rundenlimit oder automatisches Ende durch Kennzahlenschwellen einführen. Technische Größenlimits dienen begrenztem Kontext und sicheren Datenformaten.
- Tatsächlich vorhandene Institutionen berücksichtigen. Eine neue Entscheidung darf Institutionen ändern; sie dürfen nicht ohne begründeten Beschluss plötzlich vorhanden sein.
- Für inkompatible Zustandsänderungen Version und Speicherung bewusst migrieren. Alte HMAC-Signaturen nicht durch Normalisierung oder automatische Reparatur umgehen. Den Signaturschlüssel über Neustarts hinweg stabil halten.
- Fiktive Indizes und nominale Spielpreise sind keine realen Prognosen. Grundrechte, Machtkontrolle und persönliche Zustimmung getrennt halten; politische Vorlieben sind keine richtigen oder falschen Quizantworten.

## Vor einem Pull Request

```sh
npm test
npm run typecheck
npm run build
```

`typecheck` erzeugt die Next.js-Routentypen und funktioniert im frischen Checkout. GitHub Actions führt dieselben Prüfungen auf Push und Pull Requests aus. Modellantworten werden in Tests gemockt; echte Anbieteraufrufe separat und ohne Zugangsdaten in den Ausgaben prüfen.

Bei Spieländerungen zusätzlich im Browser prüfen: freie Maßnahme eingeben, Analyse und konkrete Annahmen lesen, bestätigen, spätere Folge eintreten lassen, Tutor und Zwischenbilanz nutzen sowie speichern/neuladen. Anbieterfehler müssen Eingabe und letzten bestätigten Zustand erhalten. Ein veralteter oder veränderter Vorschlag darf nicht übernommen werden.

Für Änderungen einen eigenen Branch und einen Pull Request mit geändertem Verhalten und passender Validierung verwenden. Neue UI-Arbeit kann auf der schlanken Oberfläche aufbauen, ohne Modellzugang, Weltzustand und Signierung umzuschreiben.
