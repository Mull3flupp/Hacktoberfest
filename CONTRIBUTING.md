# Gemeinsam weiterbauen

## Start in wenigen Minuten

```sh
git clone https://github.com/Mull3flupp/Hacktoberfest.git
cd Hacktoberfest
npm ci
npm run dev
```

Öffne **http://localhost:3000/**. Das Repository ist privat; dein GitHub-Konto braucht Zugriff. Für den gesamten Spielablauf sind weder API-Schlüssel noch eine Datenbank nötig. Optional `.env.example` nach `.env.local` kopieren, Anbieterzugänge eintragen und den Server neu starten. Schlüssel bleiben lokal und werden nicht committet.

## Wo Änderungen hingehören

| Aufgabe | Einstieg |
| --- | --- |
| Neue Dossiers, Kosten, Projekte oder Beratertexte | `src/lib/campaign/content.ts` |
| Runden, Krisen, Abschluss, Versprechen und Nachfolge | `src/lib/campaign/engine.ts` |
| Oberfläche und Spielinteraktion | `src/components/cabinet.tsx`, `src/app/globals.css` |
| Lernnotizen, Fragen und Quellen | `src/components/learning-panel.tsx`, `src/data/concepts.json` |
| Gemma-Analyse und eigene Anweisungen | `src/lib/server/campaign-gemma.ts`, `campaign-order.ts` |
| HTTP-Verträge und Validierung | `src/app/api/campaign/` |
| Sprache | `src/components/voice-panel.tsx`, `docs/voice-agent.md` |

Der alte Drei-Szenen-Prototyp bleibt unter `src/components/prototype.tsx`, `src/lib/game/` und den ursprünglichen `/api/turn`-/`api/tutor`-Routen erhalten. Die Startseite verwendet ausschließlich die neue Kabinettssimulation. Gemeinsame Lernkarten und Wiederholungsregeln werden weiterverwendet.

## Wichtige Spielregeln für die Entwicklung

- Kennzahlen werden ausschließlich im Regelmodul verändert. Der Server rekonstruiert den Zustand aus `setup` und `history`; mitgeschickte Kennzahlen sind nicht maßgeblich.
- Eine Entscheidung ist ein kanonischer Befehl mit stabilen Dossier- und Options-IDs. Vorschläge aus Sprache, Freitext oder Tutor setzen nichts um, bevor der User bestätigt.
- Kosten und sofortige Effekte gehören in `effects`; spätere Wirkungen in ein Projekt. Projekte nach Ende des Beobachtungszeitraums sind noch nicht abgeschlossen.
- Neue Szenarien müssen die tatsächlich vorhandenen Institutionen berücksichtigen. Keine automatische Justiz, kein Parlament ohne Verfassungswechsel, keine freie Abwahl bei unterdrückter Opposition.
- Bei Änderungen bestehender Regeln kann sich ein gespeicherter Verlauf im Replay anders auswirken. Für inkompatible Änderungen die Kampagnenversion und den Speicherschlüssel bewusst migrieren; alte Spielstände nicht stillschweigend übernehmen.
- Die fiktiven Gruppenwerte und Indizes sind keine realen Prognosen. Politische Präferenzen sind keine richtigen oder falschen Quizantworten. Grundrechte und Machtkontrolle bleiben getrennt von Zustimmung und wirtschaftlichen Zielen sichtbar.

## Vor dem Push prüfen

```sh
npm test
npm run typecheck
npm run build
```

`typecheck` erzeugt die Next.js-Routentypen selbst und funktioniert damit auch im frischen Checkout. GitHub Actions führt dieselben Prüfungen auf Push und Pull Requests aus. Anbieterantworten werden in Tests gemockt; echte Gemma-/Sprachaufrufe sind separat mit gültigen Zugängen zu prüfen.

Ändert sich der Spielablauf, zusätzlich einen Klickdurchlauf prüfen: Agenda wählen, zwei verschiedene Beschlüsse unterschreiben, Quartal wechseln, Projektfortschritt und Nachrichten lesen, speichern/neuladen und die Abschlussbilanz erreichen. Ein strategischer Test belegt, dass frühe Wohnungs- und Klimapolitik beide Versprechen bis zum Ende einlösen kann.

Für Änderungen einen eigenen Branch anlegen und in einem Pull Request beschreiben, welches Verhalten sich ändert und wie es geprüft wurde. `campaign-plan.md` dokumentiert den aktuellen Spielentwurf; `docs/project-pack.md` bleibt die ursprüngliche Projektspezifikation.
