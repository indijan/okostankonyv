## Ingest Notes

- A mostani `queueBookIngest()` mock implementacio, de mar a kesobbi szerzodest adja vissza.
- A `POST /api/ingest/books` route jelenleg a pilot konyvet queue-olja.
- A kovetkezo fazisban a route mar request body-bol fogad majd forrasparametereket.
- A repository reteg kesobb Supabase mentesre es job allapot-frissitesre cserelheto.
- NKP forrasnal a rendszer eloszor megprobal katalogusoldalbol vagy direkt NKP URL-bol PDF linket feloldani.
