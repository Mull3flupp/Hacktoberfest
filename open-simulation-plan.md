# Offene Gemma-Simulation

Die neue Anforderung ersetzt das begrenzte, deterministische Kampagnenziel: Nach einem geführten Verfassungseinstieg sind frei formulierte Entscheidungen und beliebig viele Runden möglich. Das Modell analysiert jede neue Maßnahme individuell; sie wird nicht auf einen vorbereiteten Optionskatalog reduziert.

## Ablauf

Land und Ausgangsverfassung → eigene Anweisung → Gemma analysiert Weltzustand, bisherigen Kurs, Akteursreaktionen, Annahmen, Vor-/Nachteile und numerische Modellfolgen → Vorschau bestätigen → Werte, Weltwissen und Folgeereignisse übernehmen → nächste freie Entscheidung. Zeit kann ebenfalls modellgestützt verstreichen. Eine Zwischenbilanz ist freiwillig und beendet das Spiel nicht.

## Verlässlicher Zustand

Der Server prüft die strukturierte Modellausgabe und begrenzt technisch unsinnige Einzelsprünge. Die konkreten Folgen stammen aus der aktuellen Modellanalyse. HMAC-signierte Zustände und kurzlebige, an die aktuelle Revision gebundene Analysen verhindern, dass der Browser Kennzahlen oder Vorschläge eigenmächtig verändert. Der Signaturschlüssel bleibt ausschließlich in der Serverumgebung.

Ohne funktionierende Modellverbindung werden keine erfundenen KI-Ergebnisse angezeigt. Ein Anbieterfehler verändert den Spielstand nicht. Der alte Kampagnenmodus und seine Tests bleiben als separater Prototyp erhalten.

## Langfristiges Spiel

Es gibt kein fixes Rundenlimit oder automatisches Ende bei bestimmten Kennzahlen. Ein begrenzter Ausschnitt der Chronik und kompakte, vom Modell fortgeschriebene Weltfakten halten den Kontext handhabbar. Bereits angekündigte, signierte Folgen treten zu ihrem geplanten Zeitpunkt ein. Nominale Preise wie „2 € für einen Döner“ sind fiktive Beschlüsse; Kennzahleneffekte sind Modellannahmen, keine realen Prognosen.
