# Snarøya Curlinghall – energi

Energirapport for Snarøya Curlinghall, publisert på https://snaroyacurling-energi.netlify.app

## Innhold

- `site/` – den ferdige siden Netlify publiserer (`index.html` er selvstendig, med data og grafbibliotek innebygd).
- `rapport/` – kilden til rapporten:
  - `template.html` – tekst og oppsett
  - `app.js` – grafene (d3)
  - `data/*.json` – månedstall, oktober–mai, ukeforbruk, vær m.m. (utledet fra eksportene fra energioppfølgingen og Open-Meteo)
  - `build.py` – setter sammen `site/index.html`
  - `vendor/d3.min.js` – d3 v7 (ISC-lisens, se `vendor/d3-LICENSE`)

## Oppdatere rapporten

1. Oppdater filene i `rapport/data/` med nye tall.
2. Kjør `python3 rapport/build.py` fra repo-roten.
3. Commit og push – Netlify publiserer automatisk.

Siden ber søkemotorer om ikke å indeksere den, men alle som har lenken kan åpne den.
