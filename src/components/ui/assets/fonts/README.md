# Lokale Schriften

Unveränderte variable Schriften aus dem offiziellen Google-Fonts-Repository, aufgenommen am 24.10.2026:

- [Pixelify Sans](https://github.com/google/fonts/tree/main/ofl/pixelifysans): `PixelifySans-Variable.ttf`, Lizenz `PixelifySans-OFL.txt`.
- [Nunito](https://github.com/google/fonts/tree/main/ofl/nunito): `Nunito-Variable.ttf`, Lizenz `Nunito-OFL.txt`.

Beide mit der jeweils beigefügten SIL Open Font License 1.1. Die Originaldateinamen enthalten `[wght]`; hier wurden nur die Dateinamen vereinfacht. Die Font-Dateien selbst sind unverändert.

`fonts.ts` bindet sie über `next/font/local` ein. Spiel und UI-Demo benötigen dadurch beim Build keinen externen Schriftendownload.
