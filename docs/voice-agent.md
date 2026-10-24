# ElevenLabs-Sprachagent einrichten

Die Regierungskampagne spielt ohne Sprachverbindung vollständig per Text und Klick. Du wählst Vision, Versprechen und Verfassung und regierst acht Quartale mit jeweils zwei Beschlüssen. Projekte brauchen Zeit, Gruppen reagieren unterschiedlich und unbehandelte Konflikte können eskalieren. Für echte Sprachgespräche braucht die App einen eingerichteten ElevenLabs-Agenten. Es werden keine Sprachfunktionen simuliert.

## Zugang und Gesprächsmodell

1. In ElevenLabs einen deutschsprachigen ElevenAgents-Agenten anlegen, WebRTC und Authentifizierung aktivieren.
2. Serverumgebung setzen: `ELEVENLABS_API_KEY` und `ELEVENLABS_AGENT_ID`. Beide bleiben auf dem Server. Für fachliche Antworten zusätzlich Gemma konfigurieren, siehe README.
3. Die unten genannten Client Tools exakt mit diesen Namen konfigurieren. Bei allen Tools **Wait for response** aktivieren. Besonders `ask_tutor` muss auf das Gemma-Ergebnis warten.
4. Das zusätzliche, in ElevenLabs gewählte Dialogmodell steuert Gespräch und Werkzeuge. Die fachliche Auswertung kommt aus Gemma über `ask_tutor`. Das Gesprächsmodell im Demo-Video korrekt benennen; es ist nicht automatisch Gemma.
5. Lokal unter `localhost` oder in einer HTTPS-Bereitstellung starten. Sprache beginnt erst nach Betätigen des Startbuttons und Mikrofonfreigabe.

Das Backend ruft `GET https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=…` mit dem serverseitigen `xi-api-key` auf. Der Browser erhält ausschließlich den kurzlebigen `conversationToken`, keine Anbieterschlüssel. Bei fehlender Konfiguration liefert `/api/voice-session` HTTP 503, bei Anbieterfehlern HTTP 502; der Spielstand bleibt erhalten.

## Client Tools

| Name | Parameter | Verhalten |
| --- | --- | --- |
| `get_game_context` | keine | Aktuellen Kampagnenstand mit Agenda, Quartal, verbleibenden Aktionen, Gruppen, Projekten, Nachrichten, Revision und aktuell gültigen Anliegen/Optionen lesen. Vor jeder Entscheidung erneut aufrufen. |
| `ask_tutor` | `question`: String | Die Frage über `/api/campaign/tutor` an Gemma bzw. die als solche benannte regelbasierte Kabinettsnotiz senden. Das Ergebnis abwarten und sinngemäß wiedergeben. Keine Kennzahlen verändern. |
| `propose_decision` | `optionId`: String, `revision`: Integer | Eine aktuell gültige Option mit ihrer vollständigen ID `cardId:suffix` für genau diese Revision sichtbar vorschlagen. Der Beschluss erfolgt erst über den Bestätigungsbutton und `/api/campaign`. |
| `remember_concept` | `conceptId`: String | Eine der sechs erlaubten Begriffskarten in der lokalen Lernkartei speichern. |

Die Anliegen und Optionen wechseln mit Quartal, Verfassung, bisherigen Beschlüssen und Krisen. Es gibt keine feste Reihenfolge von drei Fragen. Option-IDs sind global eindeutig im Format `cardId:suffix`; immer exakt die Werte aus dem aktuellen Kontext verwenden. Einen Vorschlag nicht über eine alte Revision bestätigen. Zeitfortschritt erfolgt ausdrücklich über den Quartalsbutton; der Agent darf ihn nicht als bereits erfolgt darstellen.

Freie politische Aufträge können über `/api/campaign/order` in passende vorhandene Beschlüsse übersetzt werden. Dieser Endpunkt liefert ausschließlich Vorschläge, keine neuen Simulationsregeln. Gemma und der deterministische Themenabgleich dürfen keine frei erfundene Maßnahme als simuliert ausgeben. Passt keine vorhandene Maßnahme, benennt die App die Grenze und zeigt ehrliche Alternativen.

Gültige Begriffs-IDs: `social-contract`, `popular-sovereignty`, `separation-of-powers`, `rule-of-law`, `minority-rights`, `peaceful-transfer`.

## Empfohlener Agenten-Prompt

```text
Du begleitest das deutschsprachige politische Lernspiel „Wenn ich König von Deutschland wäre“.
Lies vor jeder spielbezogenen Aktion get_game_context. Der Browser ist die Quelle des aktuellen Zustands.
Begleite eine laufende Regierungskampagne mit eigener Vision, zwei Versprechen und acht Quartalen.
Berücksichtige Budget, verbleibende Beschlüsse, laufende Projekte und die unterschiedlichen Interessengruppen.
Ein Projektabschluss braucht Zeitfortschritt; ein Beschluss ist nicht automatisch schon ein abgeschlossenes Projekt.
Leite Theoriefragen und fachliche Bewertungen an ask_tutor weiter und warte auf das Ergebnis.
Benenne eine kuratierte Antwort als regelbasierte Kabinettsnotiz, falls Gemma gerade nicht verfügbar ist.
Besprich eigene politische Ideen als Vorschläge. Leite nur auf vorhandene Optionen über und benenne Grenzen offen.
Erfinde keine Kennzahlen, Institutionen, Optionen, Quellen oder historischen Prognosen.
Nutze nur die vollständigen optionId- und conceptId-Werte des aktuellen Kontexts.
Wenn die Person eine Entscheidung treffen möchte, rufe propose_decision mit optionId und aktueller revision auf.
Sage danach: „Der Vorschlag ist markiert. Bitte bestätige ihn mit dem Button.“
Behaupte nie, eine vorgeschlagene Entscheidung sei schon ausgeführt.
Zum Speichern einer Lernkarte verwende remember_concept.
Beachte Aktualisierungen aus sendContextualUpdate und lies bei Unsicherheit den Kontext erneut.
Trenne persönliche Macht, gesellschaftliche Ergebnisse und Grundrechtsschutz.
Demokratische Werte und Menschenrechte sind der offengelegte normative Maßstab dieses Spiels.
Das Nachfolgeszenario ist ein Gedankenexperiment, keine historische Vorhersage.
Sprich kurz und verständlich und stelle höchstens eine Rückfrage auf einmal.
```

## Prüfung

Im Browser eine Kampagne gründen und eine Session starten. Eine eigene Regierungsidee besprechen, nach einem tatsächlichen Zielkonflikt fragen, den passenden Lernbegriff merken, eine gültige Option vorschlagen lassen und per Button bestätigen. Zeit verstreichen lassen und nach Projektfortschritt oder einer veränderten Gruppenreaktion fragen. Während einer Session zusätzlich per Klick spielen und prüfen, ob der Agent den aktualisierten Kontext kennt. Sitzung beenden und ohne Sprache weiterspielen. Ohne echte Zugangsdaten sind nur die Token- und Fehlerpfade mit gemockten Anbieterantworten prüfbar.

## Dokumentation

- [ElevenLabs React SDK](https://elevenlabs.io/docs/eleven-agents/libraries/react)
- [Client Tools und Wait for response](https://elevenlabs.io/docs/eleven-agents/customization/tools/client-tools)
- [WebRTC-Gesprächstoken](https://elevenlabs.io/docs/api-reference/conversations/get-webrtc-token)
- [OpenRouter API und Antwortformat](https://openrouter.ai/docs/api_reference/overview)
