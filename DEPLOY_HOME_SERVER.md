# Home Server Deploy

Ez a projekt egyszeru `Next.js` appkent futhat home serveren, mert az adatbazis es az AI kulso szolgaltatas:

- `Supabase`
- `OpenAI`

## 1. Production env

Masold le a mintat:

```bash
cp .env.production.example .env.production
```

Toltsd ki:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`

## 2. Inditas Docker Compose-szal

```bash
docker compose up -d --build
```

Alapertelmezetten a kontener a host `3010` portjara van kiteve.

Local URL:

```text
http://<homeserver-ip>:3010
```

## 3. Frissites

```bash
git pull
docker compose up -d --build
```

## 4. Reverse proxy

Ha ugyanugy domain moge teszed, mint az `arbiter` projektet, a reverse proxy a `3010` portra mutasson.

## Megjegyzes

Ez a csomag az app kiszolgalasara eleg. Ha kesobb kulon worker, scheduler vagy media pipeline kell, azt kulon service-kent erdemes hozzaadni a compose fajlhoz.
