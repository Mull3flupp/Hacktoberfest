# UI-Bausteine (Pixel-Look)

Alle Komponenten liegen hier und werden über `src/components/ui/index.ts` importiert.
Live ansehen: `/ui-demo`.

## Einbinden

Die Demo lädt Theme und Schriften in `src/app/ui-demo/layout.tsx`. Für weitere Oberflächen beide dort im jeweiligen Layout einbinden und den Inhalt mit `fontClasses` umschließen:

```tsx
import { fontClasses } from "@/components/ui/fonts";
import "@/components/ui/theme.css";

<div className={fontClasses}>…</div>
```

Die alten Grundstile in `globals.css` liegen in `@layer base`, damit Tailwind-Utilities die Pixel-Komponenten gestalten können. Das Theme setzt eckige Buttons und Listenabstände nur innerhalb von `.px-root`.

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
