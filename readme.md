Termékleírás

Projekt neve

AI-alapú Tanulófelület (családi használatra)

Cél

Egy olyan zárt, privát tanulási rendszer létrehozása, amely:
	•	a magyar NKP (Nemzeti Köznevelési Portál) tankönyveiből dolgozik
	•	strukturált tananyagot készít
	•	AI segítségével kivonatot és kvízeket generál
	•	szigorú fact-check és quality kontroll mellett működik
	•	gyerekbarát módon segíti a tanulást

Alapelv (kritikus)

Az AI NEM tanít önállóan.
Az AI csak az eredeti tankönyvi tartalom feldolgozását és gyakorlását segíti.

Fő funkciók

1. Tananyag feldolgozás
	•	NKP tankönyvek letöltése (PDF)
	•	szövegkinyerés
	•	lecke szintű bontás
	•	metaadatok (tantárgy, évfolyam, fejezet)

2. AI-alapú feldolgozás
	•	rövid összefoglaló
	•	gyerekbarát magyarázat
	•	kulcsfogalmak
	•	kvízkérdések

3. Interaktív tanulás
	•	lecke nézet
	•	kérdezz-felelek
	•	kvíz
	•	hibák magyarázata

4. Quality & Fact-check rendszer (kritikus)
	•	minden AI tartalom ellenőrzött
	•	forráshoz kötött állítások
	•	pontszám alapú validáció

5. (Később) Vizuális tananyag
	•	AI generált illusztrációk
	•	csak vizuális segítségként
	•	nem tudásforrás

Felhasználó
	•	4 gyerek
	•	szülő kontroll
	•	nincs publikus elérés

Pilot scope
	•	az MVP első körben 1 tantárgyra fókuszál
	•	az adott tantárgyból 5 lecke kerül feldolgozásra
	•	ez validációs pilot, nem végleges tartalmi korlát

Bővíthetőségi elv
	•	a rendszer már az elején több gyerek kezelésére készül
	•	később több tantárgy, több könyv és több évfolyam is támogatható legyen
	•	az adatmodell és az API ne legyen pilot-specifikus

Nem cél
	•	publikus platform
	•	tankönyvek újrapublikálása
	•	AI alapú “szabad tanítás”

⸻


Rendszer architektúra

Stack
	•	Next.js (frontend + API)
	•	Supabase (Postgres + pgvector)
	•	OpenAI (összefoglalás, kvíz, ellenőrzés)
	•	Replicate (opcionális képgenerálás)

Fő komponensek

1. Ingestion pipeline

PDF → text → strukturált lecke

2. AI processing
	•	summary
	•	quiz
	•	explanation

3. Verification layer
	•	AI checker
	•	rule-based validation

4. Storage
	•	children / profiles
	•	books
	•	lessons
	•	chunks
	•	summaries
	•	quiz
	•	progress

5. Frontend
	•	lesson view
	•	quiz UI
	•	ask feature
	•	gyerekprofil választás

⸻

Adatbázis séma

children
	•	id
	•	name
	•	birth_year
	•	active
	•	parent_notes

books
	•	id
	•	title
	•	subject
	•	grade
	•	source_type
	•	source_uri

lessons
	•	id
	•	book_id
	•	title
	•	chapter

lesson_chunks
	•	id
	•	lesson_id
	•	page_from
	•	page_to
	•	raw_text
	•	cleaned_text
	•	embedding

lesson_summaries
	•	id
	•	lesson_id
	•	type
	•	content
	•	grounding_score
	•	factuality_score
	•	approved

quiz_items
	•	id
	•	lesson_id
	•	question
	•	options_json
	•	correct_answer
	•	explanation
	•	source_quote
	•	source_page
	•	grounding_score
	•	factuality_score
	•	approved

lesson_progress
	•	id
	•	child_id
	•	lesson_id
	•	status
	•	score
	•	last_completed_at

⸻

Feldolgozási folyamat

Step 1 – Ingest
	•	PDF letöltés
	•	text extraction

Step 2 – Strukturálás
	•	fejezetek felismerése
	•	leckék szétválasztása

Step 3 – AI generation
	•	summary
	•	quiz

Step 4 – AI verification
	•	fact check
	•	grounding check

Step 5 – Rule validation
	•	source megléte
	•	egyértelműség

Step 6 – Approval
	•	csak approved megy ki

⸻


Promptok

Summary prompt
	•	csak forrásból dolgozhat
	•	nem adhat hozzá új információt

Quiz prompt
	•	minden kérdéshez forrás kell
	•	egyértelmű válasz

Checker prompt
	•	hibák keresése
	•	pontozás
	•	javítás

⸻


Quality & Fact-check

1. Grounding
	•	minden állítás forráshoz kötött

2. AI checker
	•	külön modell
	•	validáció

3. Score system
	•	grounding_score
	•	factuality_score

4. Threshold
	•	csak 90+ megy át

5. Rule checks
	•	nincs bizonytalan szó
	•	nincs külső tudás

⸻


UI

Lecke oldal
	•	rövid összefoglaló
	•	kulcspontok
	•	kvíz

Interakció
	•	“magyarázd el”
	•	“mutasd a forrást”

Jelölések
	•	Tankönyvi tartalom
	•	Magyarázat

⸻


MVP terv

Phase 1
	•	1 tantárgy mint pilot
	•	5 lecke
	•	summary + quiz
	•	olyan architektúrával, ami több gyerekre és több tantárgyra bővíthető

Phase 2
	•	quality system
	•	UI
	•	gyerekprofilok

Phase 3
	•	vizuális anyag
	•	további tantárgyak

Phase 4
	•	progress tracking
	•	személyre szabott fejlődési nézet

⸻


Alapelvek
	•	AI nem talál ki új tudást
	•	minden visszavezethető forrásra
	•	csak ellenőrzött tartalom jelenik meg
	•	egyszerű, gyerekbarát UX
	•	quality first mindset
	•	pilotból skálázható családi rendszer épül
