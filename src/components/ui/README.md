# UI-Bausteine (Pixel-Look)

Alle Komponenten liegen hier und werden über `src/components/ui/index.ts` importiert.
Live ansehen: `/ui-demo`.

## Einbinden

Das Spiel lädt Theme und Schriften in `src/app/page.tsx`, die Demo in `src/app/ui-demo/layout.tsx`. Für weitere Oberflächen beide dort im jeweiligen Seiteneinstieg oder Layout einbinden und den Inhalt mit `fontClasses` umschließen:

```tsx
import { fontClasses } from "@/components/ui/fonts";
import "@/components/ui/theme.css";

<div className={fontClasses}>…</div>
```

Die alten Grundstile in `globals.css` liegen in `@layer base`, damit Tailwind-Utilities die Pixel-Komponenten gestalten können. Das Theme setzt eckige Buttons und Listenabstände nur innerhalb von `.px-root`.

## Verwendung im echten Spiel

`OpenWorld` verwendet die Komponenten für den geführten Einstieg und die offene Regierungssimulation. `world-panels.tsx` stellt Kennzahlen, modellgenerierte Folgen, Akteursreaktionen und Institutionen dar. `LearningPanel` und `VoicePanel` aktivieren ihre Pixel-Ansicht über `pixel` und behalten ihre bestehenden Daten- und API-Verträge.

`SceneCard` verwendet echte Radiofelder mit gemeinsamer Gruppe und Pfeiltastensteuerung. `ProgressBar` kann auch anteilige Segmente für Versprechen darstellen. `InstitutionBadge` kennt zusätzlich `nicht gesichert`, damit fehlende Sicherungen nicht als ausgesetzte Institutionen behauptet werden. `cn` kombiniert Klassen mit `clsx` und `tailwind-merge`, sodass individuelle Größen und Varianten zuverlässig überschrieben werden können.

Im Spiel laufen die Figuren ohne dauerhafte Animation. Der Mikrofonknopf zeigt den realen Gesprächszustand; eine fehlende Sprachkonfiguration wird als nicht eingerichtet angezeigt.

Die beiden Schriften liegen samt Lizenzen unter [assets/fonts](assets/fonts/README.md) und werden über `next/font/local` geladen. Beim Build ist kein Google-Fonts-Zugriff nötig.

## Bausteine

| Komponente | Wofür |
| --- | --- |
| `PixelButton` | Dicke Buttons, Varianten: `primary`, `secondary`, `danger`, `info`, `tutor` |
| `PixelCard` | Karte mit hartem Rahmen, `tone` für die Farbe |
| `ProgressBar` | Fortschritt oben, ein Block pro Schritt |
| `SceneCard` | Szene mit Sprechblase und 3 Optionen, Button „Entscheiden“ |
| `FeedbackSheet` | Panel von unten: `consequence` (Entscheidungen), `correct`/`wrong` (nur Wissensfragen) |
| `TradeoffList` | Kosten/Nutzen je Wert (Freiheit, Sicherheit, Gleichheit, Tempo), ohne Summe |
| `ConceptCard` | Lernbegriff mit „Erklären“ und „Merken“ |
| `MoodMeter`, `CitizenVillage` | Zufriedenheit als Blob-Gesicht bzw. Dorf |
| `StatTile`, `InstitutionBadge` | Dashboard-Kennzahlen (fiktive Indexwerte) und Institutionenstatus |
| `MicButton` | Mikrofon-Button, nur Darstellung (`idle`, `recording`, `processing`, `unavailable`) |
| `ProfessorIgel`, `Gruender`, `RichterFrosch`, `CitizenBlob`, `GroupBlob` | Figuren als 16×16-Sprites |
| `PersonSprite` | Die sieben festen Bürgerfiguren (Finn, Oma Gisela, Bauer Heinz, Lea, Mika, Karen, Konsti) |
| `PeopleBar` | Leiste unten im Spiel: die Bürgerfiguren mit Sprechblase und Haltung (+ dafür, − dagegen, ? Bedenken, ~ zwiespältig) |
| `IntroSlides` | Durchklickbare Intro-Show mit animierten Pixel-Szenen, endet mit „Du wurdest gewählt!“ |
| `Cutscene`, `buildVisitors` | Zwischensequenz in Ego-Perspektive: Du sitzt am Schreibtisch, Betroffene und feste Figuren kommen durch die Tür auf dich zu und sagen ihre Meinung. Raum und Tisch in `officeScene.tsx` |
| `VisitorSprite` | Besucherfiguren für die Zwischensequenz: `imbiss`, `studierende`, `handwerk`, `business`, `senioren`, `familie`, `verwaltung`, `buerger` |

## Intro und Bürgerfiguren

- **Intro:** `src/components/intro-gate.tsx` zeigt `IntroSlides` auf der Startseite einmal pro Browser-Tab. Mit `/?intro` läuft es erneut. Die Szenen sind in `introScenes.tsx` aus Rechtecken gezeichnet, ohne Bilddateien.
- **Figuren:** Namen, Rollen und die unveränderten Charakterbeschreibungen stehen in `src/lib/simulation/characters.ts`. `src/lib/server/character-reactions.ts` erzeugt daraus pro Figur einen eigenen System-Prompt und eine separate Gemma-Anfrage. Jede Stimme kennt die vorgeschlagenen Weltfolgen und ihre eigene letzte Reaktion. `characterReactions` wird mit der Vorschau signiert und nach Bestätigung im Weltzustand behalten. Ältere Spielstände ohne diese Reaktionen bleiben gültig; die Leiste zeigt dann die Leerlauf-Sprüche.
- **Intro-Gate:** Solange das Intro läuft, wird die darunterliegende Spielansicht nicht geöffnet oder per Tastatur bedienbar. Nach Ende oder Überspringen wird ein gespeichertes Land wie bisher geladen.
- PeopleBar und IntroSlides bringen ihre eigenen CSS-Dateien (`people.css`, `intro.css`) mit und funktionieren deshalb auch außerhalb von `.px-root`.

## Zwischensequenz

- Startet im Spiel automatisch, sobald nach „Folgen analysieren“ eine Vorschau da ist (`open-world.tsx`, `cutsceneFor`). „Überspringen“ oder Escape führt direkt zur Vorschau.
- `buildVisitors` nimmt zuerst bis zu drei direkt Betroffene aus `analysis.reactions` (Gemma wählt dafür `look` und `count` 1–4) und danach bis zu drei feste Figuren mit möglichst unterschiedlicher Haltung.
- Unbekannte `look`-Werte oder doppelte Figuren aus der KI-Antwort werden aussortiert, statt die ganze Analyse abzulehnen.
- In `/ui-demo` lässt sich die Szene mit Beispielsätzen zum Dönerpreis abspielen.

## Neutralität

Politische Entscheidungen bekommen **nie** grün/rot, sondern `tone="consequence"` (blau).
Richtig/falsch gibt es nur im Nachfolgetest.

## Eigene Figur zeichnen

```tsx
<PixelSprite
  grid={["..kk..", ".kyyk.", "..kk.."]}
  palette={{ k: "var(--px-ink)", y: "var(--px-yellow)" }}
  size={48}
/>
```

Ein Zeichen = ein Pixel, `.` = transparent. Die Umrisslinie entsteht automatisch.
