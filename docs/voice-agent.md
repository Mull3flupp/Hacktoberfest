# ElevenLabs-Sprachagent einrichten

Die aktive App ist eine offene Regierungssimulation mit frei formulierten Entscheidungen. Gemma analysiert neue Maßnahmen individuell; die Person prüft und bestätigt die Vorschau. Ein Sprachagent unterstützt diesen Ablauf, führt aber keine Maßnahmen selbstständig aus. Mikrofon und ElevenLabs sind optional; für freie Folgenanalysen und Tutorantworten bleibt ein echter Gemma-Zugang erforderlich.

## Zugang

1. In ElevenLabs einen deutschsprachigen ElevenAgents-Agenten mit WebRTC und Authentifizierung einrichten.
2. Serverseitig `ELEVENLABS_API_KEY` und `ELEVENLABS_AGENT_ID` setzen. Gemma und `SIMULATION_SIGNING_KEY` wie in der [README](../README.md) konfigurieren.
3. Die vier Client Tools unten exakt mit diesen Namen und Parametern anlegen. Bei allen **Wait for response** aktivieren; `ask_tutor` muss auf die echte Gemma-Antwort warten.
4. Die App unter localhost oder HTTPS öffnen. Das Gespräch startet erst nach Betätigen des Buttons und Mikrofonfreigabe.

Das Backend beschafft über `GET https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=…` einen kurzlebigen WebRTC-Zugang. Der Browser erhält den `conversationToken`, keine Anbieterschlüssel. Fehlende ElevenLabs-Konfiguration liefert HTTP 503, Anbieterfehler HTTP 502. Gemma-Fehler werden ebenfalls als Fehler sichtbar, ohne fachliche Ersatzantwort zu erfinden oder den bestätigten Spielstand zu verändern.

Das in ElevenLabs gewählte zusätzliche Dialogmodell steuert Gespräch und Werkzeuge. Die fachliche Analyse stammt über `ask_tutor` von Gemma. Diese beiden Rollen auch in einer Demo korrekt benennen.

## Client Tools

| Name | Parameter | Verhalten |
| --- | --- | --- |
| `get_game_context` | keine | Aktuelle Welt mit Revision, Agenda, Institutionen, Gruppen, Fakten, anstehenden Folgen und gegebenenfalls einer offenen Vorschau lesen. Vor jeder spielbezogenen Aktion erneut aufrufen. |
| `ask_tutor` | `question`: String | Frage über `/api/simulation/tutor` an Gemma senden und die Antwort abwarten. Verändert den Zustand nicht. |
| `propose_decision` | `optionId`: String, `revision`: Integer | `optionId` enthält jetzt den vollständigen frei formulierten Beschlusstext mit 1–1500 Zeichen. Das Werkzeug füllt nur das Entwurfsfeld. Die Person klickt danach „Folgen analysieren“, prüft Gemmas Vorschau und bestätigt sie ausdrücklich. |
| `remember_concept` | `conceptId`: String | Einen der sechs kuratierten Begriffe in der lokalen Lernkartei merken. |

Der Parametername `optionId` bleibt für die bestehende SDK-Schnittstelle erhalten; er bezeichnet im aktiven Modus keine feste Dossieroption. Alternativ kann `suggestion:0` auf den ersten aktuellen Anschlussvorschlag verweisen. Freie eigene Formulierungen sind der normale Weg. Revisionen stammen immer aus dem frisch gelesenen Kontext.

Gültige Begriffs-IDs: `social-contract`, `popular-sovereignty`, `separation-of-powers`, `rule-of-law`, `minority-rights`, `peaceful-transfer`.

## Agenten-Prompt

```text
Du begleitest das deutschsprachige politische Lernspiel „Wenn ich König von Deutschland wäre“.
Lies vor spielbezogenen Aktionen get_game_context. Die Welt ist offen: Entscheidungen sind frei formulierbar, es gibt keinen festen Optionskatalog und kein festes Spielende.
Berücksichtige aktuelle Institutionen, Gruppen, Weltfakten, angekündigte Folgen und die Revision.
Leite fachliche Fragen und Bewertungen an ask_tutor weiter und warte auf die Gemma-Antwort.
Bei einem Werkzeug- oder Anbieterfehler benenne den Fehler. Erfinde keine Gemma-Antwort und keine bereits ausgeführten Maßnahmen.
Möchte die Person etwas beschließen, rufe propose_decision auf. Übergib den vollständigen Beschlusstext als optionId und die aktuelle revision.
Sage danach: „Dein Vorschlag steht im Entwurf. Bitte klicke auf Folgen analysieren, prüfe die Vorschau und bestätige sie am Bildschirm.“
Das Werkzeug füllt nur den Text. Es analysiert, unterschreibt und bestätigt keine Maßnahme.
Zum Merken einer Lernkarte verwende remember_concept mit einer bekannten Begriffs-ID.
Beachte sendContextualUpdate und lies bei Unsicherheit den aktuellen Kontext erneut.
Kennzahlen und nominale Preise sind fiktiv. Gib sie nicht als reale Prognosen aus.
Trenne persönliche Macht, gesellschaftliche Ergebnisse und institutionellen Grundrechtsschutz.
Demokratische Werte und Menschenrechte sind der offengelegte Maßstab der Reflexion.
Eine Zwischenbilanz oder ein Nachfolgetest beendet das Spiel nicht.
Sprich knapp und verständlich und stelle höchstens eine Rückfrage auf einmal.
```

## Prüfung

Land gründen → Sprachgespräch starten → eine eigene Maßnahme vorschlagen lassen → prüfen, dass zunächst nur der Entwurf gefüllt wird → Analyse und Bestätigung am Bildschirm ausführen → nach den tatsächlichen Folgen fragen → passenden Lernbegriff merken. Zusätzlich per Klick weiterspielen und prüfen, ob der Agent den aktualisierten Kontext kennt. Sitzung beenden und ohne Sprache weiterregieren.

Echte Sprachverbindungen müssen mit einem konfigurierten Agenten geprüft werden; gemockte Token-Tests belegen keinen vollständigen Sprachdialog.

## Dokumentation

- [ElevenLabs React SDK](https://elevenlabs.io/docs/eleven-agents/libraries/react)
- [Client Tools und Wait for response](https://elevenlabs.io/docs/eleven-agents/customization/tools/client-tools)
- [WebRTC-Gesprächstoken](https://elevenlabs.io/docs/api-reference/conversations/get-webrtc-token)
- [Google Gemini API: Schlüssel](https://ai.google.dev/gemini-api/docs/api-key)
- [Gemma auf der Gemini API](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api)
