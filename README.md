# Snarøya Curlinghall – energi

Energirapport for Snarøya Curlinghall, publisert på https://snaroyacurling-energi.netlify.app

## Sider

- `/` – energirapporten (forbruk 2014–2026, høsten 2026, utviklingen siden 2015)
- `/priser/` – strømpriser for NO1: i dag og i morgen (hentes automatisk), og hvilke timer som er dyrest gjennom året
- `/api/priser?dato=ÅÅÅÅ-MM-DD&omrade=NO1` – spotpriser time for time som JSON (øre/kWh eks. mva.), fra hvakosterstrommen.no. Kan også brukes av Ignition.

## Innhold

- `site/` – den ferdige siden Netlify publiserer (`index.html` er selvstendig, med data og grafbibliotek innebygd).
- `rapport/` – kilden til rapporten:
  - `template.html` – tekst og oppsett
  - `app.js` – grafene (d3)
  - `data/*.json` – månedstall, oktober–mai, ukeforbruk, vær m.m. (utledet fra eksportene fra energioppfølgingen og Open-Meteo)
  - `build.py` – setter sammen `site/index.html`
  - `vendor/d3.min.js` – d3 v7 (ISC-lisens, se `vendor/d3-LICENSE`)

- `priser/` – kilden til strømprissiden (`template.html`, `app.js`, `build.py`, `data/timeprofil.json` med timesnitt per måned siste år)
- `netlify/functions/priser.mts` – henter dagens og morgendagens priser og mellomlagrer dem

## Oppdatere rapporten

1. Oppdater filene i `rapport/data/` med nye tall.
2. Kjør `python3 rapport/build.py` og `python3 priser/build.py` fra repo-roten.
3. Commit og push – Netlify publiserer automatisk. Hver publisering til `main` koster 15 kreditter på gratisplanen, så jobb på en egen gren og slå sammen når alt er klart.

Siden ber søkemotorer om ikke å indeksere den, men alle som har lenken kan åpne den.
