# Erster Prototyp: Wenn ich König von Deutschland wäre

Grundlage: Project Pack vom 24.10.2026. Die Oberfläche bleibt bewusst schlicht und austauschbar.

## Aufbau

- Next.js mit React, TypeScript und Tailwind, ohne Datenbank oder Benutzerkonten.
- Gemeinsames deterministisches Regelmodul: drei Szenen, jeweils drei Optionen, institutionenabhängige Texte, sofortige und verzögerte Folgen, Nachfolgetest.
- Lokale JSON-Inhalte: sechs Lernbegriffe mit Quellen, Verständnis- und Transferfragen.
- Serverseitige APIs für Spielzüge, Gemma-Tutor und kurzlebigen ElevenLabs-Zugang. Das Backend rekonstruiert den Zustand aus dem Verlauf; Modellantworten verändern keine Spielwerte.
- LocalStorage für Spiel und Lernkarten. Revision und eine Sperre verhindern doppelte bzw. veraltete Rundenwechsel.
- Ohne API-Schlüssel sind alle drei Szenen, kuratierte Erklärungen, Lernkarten und der Nachfolgetest nutzbar. Echte Integrationen werden als solche ausgewiesen und separat konfiguriert.

## Abnahme des ersten Prototyps

Durchgehender lokaler Klick-/Textablauf, Neustart und Fortsetzen, zwei unterschiedliche institutionelle Wege, wiederkehrende Lernkarte, nachvollziehbare Abschlussauswertung. Regeltests, API-Prüfung, Typecheck und Produktionsbuild. Eine öffentliche Bereitstellung und echte Sprach-/Gemma-Aufrufe benötigen konfigurierte Anbieterzugänge.
