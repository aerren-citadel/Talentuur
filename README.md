# Talentuur Keuze-app (Netlify + Neon)

Deze app laat leerlingen 4 voorkeuren kiezen voor een talentuur-periode en helpt de talentuurcoördinator met:

- blokkeren van dubbele keuzes als een leerling dat talentuur al heeft gevolgd (uitzondering: sportoriëntatie),
- overzicht van alle keuzes per periode,
- handmatig toewijzen van een definitief talentuur,
- export naar CSV (Excel-openbaar).

## 1. Installatie

```bash
npm install
```

## 2. Neon database

1. Maak een Neon Postgres database.
2. Voer `sql/schema.sql` uit.
3. Zet je connectiestring in `.env` als `DATABASE_URL`.

Voorbeeld:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require
ADMIN_TOKEN=een_lang_geheim_token
```

## 3. Lokaal starten

```bash
npm run dev
```

Pagina's:

- leerlingformulier: `/`
- beheer/coördinator: `/admin.html`

## 4. Deploy op Netlify

- Push project naar GitHub.
- Koppel repo in Netlify.
- Zet environment variables:
  - `DATABASE_URL`
  - `ADMIN_TOKEN`
- Netlify gebruikt `netlify.toml` automatisch.

## 5. Belangrijk voor jouw situatie

- Je kunt per periode zelf bepalen welke talenturen beschikbaar zijn via de admin-pagina.
- Als talenturen in een volgende periode wijzigen, pas je alleen die periode aan.
- Keuzes van leerlingen zijn 1e t/m 4e keuze; je krijgt overzicht in tabel + CSV export.
