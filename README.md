# Wenn ich König von Deutschland wäre

Eine offene politische Regierungssimulation: Gründe ein fiktives Land, formuliere eigene Beschlüsse und erlebe ihre Folgen. Nach dem geführten Verfassungseinstieg analysiert Gemma jede freie Entscheidung individuell – etwa „Ich will den Dönerpreis auf 2 € begrenzen“. Erst nach deiner ausdrücklichen Bestätigung werden die vorgeschlagenen Folgen übernommen.

Der aktuelle Entwurf steht in [open-simulation-plan.md](open-simulation-plan.md). Das [Project Pack](docs/project-pack.md) dokumentiert die ursprüngliche Idee; der ältere Kampagnenmodus bleibt als Vergleichscode erhalten.

## Lokal starten

Voraussetzung: Node.js 22 oder neuer, npm und ein funktionierender Gemma-Zugang.

```sh
cp .env.example .env.local
```

In `.env.local` die Platzhalter durch eigene Werte ersetzen:

```dotenv
GEMMA_PROVIDER=google
GEMMA_BASE_URL=https://generativelanguage.googleapis.com/v1beta
GEMMA_MODEL=gemma-4-26b-a4b-it
GEMMA_API_KEY=dein_google_ai_studio_schluessel
SIMULATION_SIGNING_KEY=dein_dauerhafter_zufaelliger_signaturschluessel
```

Den Signaturschlüssel einmal mit `openssl rand -hex 32` erzeugen und dauerhaft behalten. Er muss nach Neustarts und zwischen Serverinstanzen gleich bleiben, damit gespeicherte Welten weiterhin gültig sind. Zugangsdaten bleiben in der lokalen bzw. Hosting-Umgebung und gehören nicht ins Repository.

```sh
npm run dev
```

Öffnen: **http://127.0.0.1:3000/**. Nach Änderungen an Environment-Variablen den Server neu starten. Ohne Signaturschlüssel lässt sich kein Land gründen; ohne gültigen Modellzugang sind keine freien Folgenanalysen oder Tutorantworten möglich. Anbieterfehler erzeugen eine sichtbare Fehlermeldung und verändern den letzten bestätigten Spielstand nicht.

`npm run dev` installiert die festgeschriebenen Abhängigkeiten bei Bedarf automatisch in einem projektspezifischen lokalen temporären Ordner. `node_modules` und `.next` verweisen dorthin, damit Cloud-Auslagerung im Projektordner keine leeren Paketdateien oder unlesbaren Build-Caches erzeugt. Quellcode und `.env.local` bleiben im Projekt; Zugangsdaten werden nicht kopiert. Bestehende Abhängigkeits- und Cacheordner werden unter `.local-runtime-backups/` gesichert. Nach einer Bereinigung temporärer Dateien legt der nächste Start die Laufzeit neu an. `npm run runtime:prepare` richtet sie ohne Serverstart ein.

Für reine CI-/Produktions-Checkouts weiterhin `npm ci` verwenden. Falls du im lokalen Cloud-Ordner erneut `npm ci` ausführst, danach `npm run runtime:prepare` oder `npm run dev` starten, bevor du Tests oder Builds aufrufst.

Für einen Produktionslauf: `npm run build`, danach `npm start`.

## Pixel-UI im Spiel

Die [Startseite](http://localhost:3000/) verwendet die Pixel-Komponenten aus PR #1 direkt im spielbaren Ablauf: Gründung, freie Entscheidung, Folgenvorschau, Bürgerstimmen, Kennzahlen, Institutionen, Nachrichten, Chronik, Bilanz und Lernkarten. Figuren und Anzeigen reagieren auf den echten bestätigten Weltzustand. Die Vorschau übernimmt Modellfolgen erst nach deiner Bestätigung; politische Entscheidungen bekommen eine neutrale Folgenrückmeldung. Richtig/falsch erscheint nur bei Wissensfragen.

Das Dashboard konzentriert sich auf Entscheidung, Kennzahlen und Bürgerstimmen. Versprechen, Verfassung, Nachrichten und zusätzliche Ideen lassen sich bei Bedarf aufklappen; ausstehende Folgen erscheinen nur, wenn es welche gibt. Die Stimmen stehen direkt beim Beschluss und wechseln erst nach einem Klick auf eine Figur. Erläuterungen zu Modellwerten und Speicherung stehen gesammelt unter „Über das Spiel“; ein nicht eingerichteter Sprachmodus wird im Spiel nicht angezeigt.

Die [UI-Demo](http://localhost:3000/ui-demo/) bleibt als Komponentenübersicht mit Beispieldaten erreichbar. Theme und Schriften werden im jeweiligen Seiteneinstieg geladen; [pixel-game.css](src/components/pixel-game.css) ergänzt die Spielansicht, [world-panels.tsx](src/components/world-panels.tsx) verbindet die Library mit Weltzustand und Modellausgabe. Die Komponenten sind in [src/components/ui/README.md](src/components/ui/README.md) dokumentiert.

Die Auswahlkarten nutzen native Radiofelder samt Pfeiltastensteuerung. Vor dem Ersetzen eines bestehenden Landes schützt ein Bestätigungsdialog; gespeichert wird weiterhin unter demselben LocalStorage-Schlüssel. Der Pixel-Mikrofonknopf verwendet die tatsächliche optionale ElevenLabs-Verbindung.

Pixelify Sans und Nunito sind samt Lizenzen [lokal enthalten](src/components/ui/assets/fonts/README.md); der Build benötigt keinen externen Schriftendownload.

## Intro und Bürgerstimmen

Bei jedem Laden der Spielseite und nach „Neues Land“ läuft das vierteilige Wahlabend-Intro. „Überspringen“, Escape und die Pfeiltasten funktionieren; erst danach wird die Spielansicht oder die Gründung geöffnet. Ein vorhandenes Land bleibt beim Neuladen erhalten.

Finn, Oma Gisela, Bauer Heinz, Lea, Mika, Karen und Konsti sind die sieben Originalfiguren aus PR #2. Namen, Beschreibungen und Sprites bleiben unverändert. Jede Figur erhält einen eigenen Gemma-System-Prompt aus ihrer Beschreibung und reagiert mit einer persönlichen, skeptischen Stimme auf die konkrete Maßnahme. Weltzustand, vorgeschlagene Folgen und ihre eigene letzte Reaktion liefern den Kontext. Die Leiste lädt die Stimmen getrennt zur Vorschau und behält sie nach Bestätigung beim letzten Beschluss. Die Folgen können schon vorher geprüft und bestätigt werden.

Die Anbindung liegt in [character-reactions.ts](src/lib/server/character-reactions.ts), die Personas in [characters.ts](src/lib/simulation/characters.ts). `/api/simulation/analyze` macht nur den Aufruf für die Weltfolgen (bis zu 75 Sekunden). Anschließend lädt der Browser über `/api/simulation/characters` jede Stimme separat, höchstens zwei gleichzeitig. Pro Stimme gelten 45 Sekunden je Versuch; vorübergehende Fehler werden einmal mit kurzer Pause wiederholt. Quoten- und Zugangsfehler werden nicht automatisch wiederholt. Fehlende Stimmen lassen sich gezielt nachladen, ohne bereits erfolgreiche Stimmen oder die Folgenanalyse erneut anzufragen.

Eine Bürgerstimme erhält eine eigene HMAC-Signatur, gebunden an Welt, Vorschau und Zielrevision. Sie kann keine Kennzahlen ändern und gehört nicht zum bestätigungspflichtigen Weltzustand. Der Browser speichert die Stimmen des letzten bestätigten Beschlusses separat unter `koenig-citizen-voices-v1`; verspätete Antworten dürfen weiter eintreffen, solange derselbe Beschluss aktuell ist. Beim nächsten Beschluss wird die eigene vorherige Stimme signiert als Kontext übergeben. Andere Figuren, fremde Welten und nachträglich veränderte Stimmen werden serverseitig zurückgewiesen. Abgebrochene Vorschauen werden beim Neuladen nicht wiederhergestellt. Nach Ablauf der zehnminütigen Vorschau können dafür keine neuen Stimmen angefragt werden.

Die Bestätigung bleibt ohne Modellaufruf möglich, auch wenn noch Stimmen laden oder fehlen. Alte signierte Spielstände mit `characterReactions` bleiben gültig. Fehlende neue Stimmen werden als ausstehend angezeigt und nicht durch erfundene Zitate ersetzt. Die Büro-Sequenz öffnet sich direkt nach der Folgenanalyse mit den bereits bekannten Betroffenen; über „Im Büro ansehen“ lassen sich später auch die inzwischen geladenen festen Figuren ansehen. Die laufende Szene verändert ihre Besucher nicht während des Lesens.

Für Diagnose ohne Prompt- oder Schlüsselprotokollierung kann `GEMMA_LOG_TIMINGS=1` gesetzt werden. Der Stimmen-Endpunkt protokolliert dann nur Figuren-ID und Laufzeit.

## Spielablauf

1. Landesname, Vision, zwei Versprechen und Ausgangsverfassung wählen. Dieser Einstieg verwendet feste Ausgangsbedingungen.
2. Eine eigene Maßnahme eingeben. Gemma interpretiert sie im Kontext der bisherigen Welt und liefert Annahmen, Vorteile, Kosten, Risiken, Akteursreaktionen sowie sofortige und spätere Modellfolgen.
3. Die signierte Vorschau prüfen und ausdrücklich bestätigen. Erst dann ändern sich Kennzahlen, Institutionen und Weltfakten; bereits angekündigte fällige Folgen treten zusätzlich ein.
4. Frei weiterentscheiden oder Zeit verstreichen lassen. Auch der Zeitfortschritt wird vorab von Gemma analysiert und bestätigt.

Es gibt kein festes Rundenlimit, keine Beschlussquote pro Quartal und kein automatisches Spielende. Eine freiwillige Zwischenbilanz prüft Versprechen und Nachfolge, danach kannst du weiterregieren. Lernkarten, Texttutor und ein optionaler ElevenLabs-Sprachdialog begleiten die Simulation.

Kennzahlen und Akteure sind fiktiv. Ein nominaler Preis wie „2 €“ ist ein Beschluss innerhalb der Spielwelt, keine reale Marktprognose. Demokratische Werte und Menschenrechte sind der offengelegte Maßstab der Reflexion; persönliche Macht, Grundrechte und gesellschaftliche Ergebnisse bleiben getrennt sichtbar.

## Modell, Speichern und Grenzen

Der Server prüft die strukturierte Modellausgabe und begrenzt technisch unplausible Einzelsprünge. Eindeutig im falschen Container gelieferte Gruppen- oder Kennzahlenschlüssel werden vor dieser Prüfung richtig zugeordnet, ohne Werte zu verändern. Unbekannte Schlüssel, widersprüchliche Doppelangaben und überhöhte Werte werden weiter abgelehnt. Signierte Vorschauen und Spielstände werden dabei niemals nachträglich umgeschrieben. Die konkreten Folgen stammen aus Gemmas Analyse, nicht aus einem Optionskatalog. Es gibt im aktiven Modus keinen kuratierten Ersatz für ausgefallene Modellaufrufe.

HMAC-Signaturen schützen Weltzustand und Vorschläge vor Veränderungen im Browser. Eine Vorschau gilt zehn Minuten und ist an Welt-ID, Revision und den exakten Ausgangszustand gebunden. Die Bestätigung ruft kein weiteres Modell auf. Diese Integritätsprüfung ersetzt keine Benutzeranmeldung und verwaltet keinen gemeinsamen Mehrspieler-Weltstand.

Spielstand, Lernkartei und Entwurf liegen browsergebunden in LocalStorage unter der Version `koenig-open-world-v3`. Es gibt keine Datenbank und keine Synchronisation zwischen Geräten. Alte Prototyp-Spielstände werden nicht als neue Welt übernommen. Ein neues Land ersetzt den aktiven Weltstand und behält die Lernkartei.

Das Gedächtnis ist begrenzt: Der Zustand hält höchstens 16 Chronikeinträge, 32 Weltfakten, 12 Nachrichten und 18 offene Folgen. Neue Modellaufrufe erhalten einen kompakten Ausschnitt der jüngsten Chronik plus Weltfakten und offene Folgen. Ältere Texte werden nicht vollständig archiviert; unbegrenztes Weiterspielen bedeutet kein unbegrenztes Modellgedächtnis.

## Aufbau und Schnittstellen

Next.js App Router, React, TypeScript, Tailwind und Zod.

| Pfad | Aufgabe |
| --- | --- |
| `src/components/open-world.tsx` | Aktive Oberfläche: Gründung, freie Entscheidung, Vorschau, Chronik und Zwischenbilanz |
| `src/lib/simulation/types.ts` | Verträge für Weltzustand, Analyse und signierte Vorschläge |
| `src/lib/simulation/state.ts` | Strikte Validierung, Ausgangszustand und Übernahme bestätigter Folgen |
| `src/lib/server/simulation-signing.ts` | HMAC-Signaturen, Ablaufprüfung und Bindung an den Ausgangszustand |
| `src/lib/server/world-model.ts` | Individuelle Folgenanalyse und Tutor mit kompaktem Weltkontext |
| `src/lib/server/gemma-client.ts` | Serverseitiger Google-/OpenRouter-Aufruf und sichere Anbieterfehler |
| `src/lib/game/learning.ts`, `src/data/concepts.json` | Sechs kuratierte Lernbegriffe, Quellen und Wiederholungsregeln |

| Endpunkt | Anfrage → Antwort |
| --- | --- |
| `POST /api/simulation/start` | `{ setup }` → `{ state, signature }` |
| `POST /api/simulation/analyze` | `{ snapshot, decision, kind? }` → `{ proposal, signature }`; `kind` ist `decision` oder `advance` |
| `POST /api/simulation/commit` | `{ snapshot, analysis }` → `{ snapshot, appliedConsequences }`; `analysis` ist die vollständige signierte Vorschau |
| `POST /api/simulation/tutor` | `{ snapshot, question, conceptId? }` → `{ answer, conceptIds, source: "gemma" }` |
| `POST /api/voice-session` | Kurzlebiger WebRTC-Gesprächstoken für den Browser |
| `GET /api/health` | Konfigurierte Anbieterfähigkeiten ohne Zugangsdaten |

Die früheren Drei-Szenen- und Kampagnenmodule samt alten APIs bleiben für Vergleiche und Tests im Repository. Die Startseite verwendet `OpenWorld` und die `/api/simulation/*`-Routen.

## Anbieter und Sprache

Die Google-Anbindung nutzt die native Gemini API mit `x-goog-api-key`, Gemma 4 und minimalem Thinking. Alternativ sind OpenRouter oder ein OpenAI-kompatibler Veranstalter-Endpunkt über die Werte in [.env.example](.env.example) konfigurierbar. Ein verfügbares Modell und passende Anbieterberechtigungen sind erforderlich.

Für Figurenstimmen und Sprachfragen `ELEVENLABS_API_KEY` in der ignorierten `.env.local` setzen. Die sieben festen Bürgerfiguren, Professor Igel und Richter-Frosch haben jeweils eine feste Stimme. Andere Besucher erhalten beim ersten Auftreten zufällig eine Stimme aus einem begrenzten Pool; diese Zuordnung bleibt im Browser gespeichert. Die Filmsequenz spricht die angezeigten Sätze, und die ruhige Musik aus `public/audio/music.mp3` läuft nach der ersten Nutzeraktion leise in einer Schleife. „Ton an/aus“ schaltet beides gemeinsam. Mit `ELEVENLABS_AGENT_ID` wird stattdessen der optionale ElevenLabs-Gesprächsagent für Professor Igel aktiviert. Die [Agenten-Anleitung](docs/voice-agent.md) beschreibt dessen Client Tools. Fachliche Tutorantworten kommen von Gemma; ein gesprochener Vorschlag füllt zunächst nur den Entwurf. Analyse und Bestätigung erfolgen sichtbar am Bildschirm.

## Prüfen und bereitstellen

```sh
npm test
npm run typecheck
npm run build
```

Tests prüfen freie Modellausgaben, Signaturen, veränderte und veraltete Vorschläge, verzögerte Folgen, begrenzten Kontext und Anbieterfehler. Anbieterantworten sind dabei gemockt; echte Modell- und Sprachaufrufe werden separat mit gültigen Zugängen geprüft. Die ursprünglichen Regeltests bleiben erhalten.

Manueller Durchlauf: Land gründen → freie Maßnahme analysieren → Vorschau bestätigen → Folgen und Weltfakten ansehen → Zeitfortschritt bestätigen → Lernkarte beantworten → Zwischenbilanz öffnen → weiterregieren → Seite neu laden und fortsetzen.

Als Next.js-Projekt bei Vercel importierbar. Environment-Variablen einschließlich dauerhaftem Signaturschlüssel dort setzen; Sprachzugriff braucht HTTPS oder localhost. Eine öffentliche Bereitstellung und ein Demo-Video sind separate Arbeitsschritte.
