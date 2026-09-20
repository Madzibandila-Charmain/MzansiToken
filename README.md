# MzansiToken

Subword tokenizers are trained mostly on English. On an African language the
same sentence can cost two or three times as many tokens, which means higher
API bills, shorter usable context windows and worse downstream accuracy for
the people who speak it. That gap is usually asserted. MzansiToken measures
it.

Nine tokenizers, eight languages, one parallel corpus, four metrics and a
leaderboard — with the per-language spread shown rather than averaged away.

CSC3003S Capstone Project, University of Cape Town.
Token Tribe: Mukovhe Ranwashe (RNWMUK001), Madzibandila Charmain,
Ethan Ngwetjana (NGWETH001).

---

## What it measures

| Metric | Definition | Reads better |
|---|---|---|
| Token count | Tokens produced over the corpus | Lower |
| Fertility | Tokens per whitespace-separated word | Lower |
| Compression | UTF-8 bytes per token | Higher |
| Token premium | Tokens for a language ÷ tokens the **same** tokenizer spends on the same text in English | Lower, 1.00 is parity |
| MBI | Precision, recall and F1 of predicted token boundaries against NCHLT gold morpheme segmentations | Higher |

Token premium is the headline number and the reason the corpus has to be
parallel: FLORES sentence 67 in isiZulu is the same sentence as 67 in
English, so a difference in token count is a difference in the tokenizer,
not in what was said.

English is the yardstick, not a subject. It is excluded from every average
on the leaderboard — averaging in a guaranteed premium of 1.00 would flatter
every tokenizer by exactly the same amount and compress the differences the
project exists to show.

## Corpora

**FLORES-200 dev**, 997 parallel sentences in eight languages: English,
Sepedi, Sesotho, siSwati, Setswana, Xitsonga, isiXhosa and isiZulu.

**NCHLT** gold morpheme segmentations for the seven South African languages
above, 134,310 word/segmentation pairs, used for MBI.

South Africa has eleven official languages. Tshivenḓa and isiNdebele are
absent because neither corpus covers them; the app never claims a figure for
a language it has not measured.

## The three pages

**Inspect** — one tokenizer, up to two languages, token by token, with the
metrics underneath. Takes a built-in corpus or a file of your own.

**Compare** — two tokenizers, the same language, the same corpus, side by
side, plus MBI for both.

**Rank** — the leaderboard, scored 0–100, with a grid of every tokenizer
against every language so the board's average can be read back apart.

Both Inspect and Compare accept `.txt`, `.text`, `.md`, `.csv`, `.tsv` and
`.docx`, up to 5 MB. An uploaded file is measured **on its own**: it is not a
translation of FLORES, so no token premium is reported for it rather than a
premium computed against text it has nothing to do with.

## The score

```
overall_score = weighted mean of the four components, each scaled to 0-100

  token premium  30%    3.00 -> 0,   1.00 -> 100
  fertility      25%    6.00 -> 0,   1.00 -> 100
  MBI F1         25%    0.00 -> 0,   1.00 -> 100
  compression    20%    1.00 -> 0,   5.00 -> 100
```

The score is computed server-side on every write; a client cannot supply
one. A missing component is dropped and the remaining weights are
renormalised, so a tokenizer with no morphology data is not silently
penalised for it.

## Running it

### Docker (the normal way)

Everything — backend, frontend, datasets — comes up with one command from
the repo root.

```bash
docker compose up              # build if needed, then run both services
docker compose up -d           # same, in the background
docker compose up --build      # force a rebuild after you change the code
docker compose down            # stop and remove the containers
docker compose down -v         # also drop the volumes
docker compose logs -f backend # follow one service's output
docker compose ps              # what is running
```

Frontend on <http://localhost:5173>, backend on <http://localhost:8000>,
interactive API docs on <http://localhost:8000/docs>.

**`--build` is the one to remember.** `docker compose up` reuses the image
it already built, so a change to a Python file appears to do nothing until
you rebuild.

When a build goes strange — a stale layer, a dependency that will not
update — clear the cache rather than the flags:

```bash
docker compose build --no-cache    # rebuild every layer from scratch
docker compose down --rmi local    # drop the images this project built
docker system prune -a             # reclaim ALL unused Docker data on the
                                   # machine, not just this project's
```

`docker system prune -a` is machine-wide and irreversible, so run it when
you are short of disk, not as a habit.

### Without Docker

Two terminals. Python 3.10 or newer, Node 20 or newer.

**Terminal 1 — the API:**

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
source .venv/bin/activate        # macOS / Linux
pip install -r requirements.txt
uvicorn main:app --reload
```

That serves the API on <http://127.0.0.1:8000>. `--reload` matters: without
it uvicorn keeps serving whatever it imported at startup, so a change to a
service file appears to do nothing while the frontend hot-reloads around it.

**Terminal 2 — the site:**

```bash
cd frontend
npm install
npm run dev
```

<http://localhost:5173>. It expects the API at `http://127.0.0.1:8000`; put
`VITE_API_BASE_URL` in a `.env` file to point it elsewhere.

### Either way, the first run is slow

The first request for a tokenizer downloads it from Hugging Face and then
tokenizes 997 sentences in eight languages. Results are cached in the
running process, so everything after that is immediate — and every restart
pays for it again. Adding a tokenizer to the leaderboard also runs the
morphology comparison over 134,310 NCHLT pairs, which takes minutes.

## Tests

```bash
cd backend && pytest          # 229 tests
cd frontend && npm run test:run
cd frontend && npm run lint
```

The backend suite covers the metric formulas against hand-worked examples,
the scoring bounds, the leaderboard service, and every upload rejection path
— wrong extension, disguised PDF, oversized file, zip bomb, non-UTF-8 bytes,
and a `.docx` whose text hides in a form field.

## Layout

```
backend/
  main.py                     app, CORS, startup corpus load
  db.py                       SQLite schema, connection, backups
  app/routers/                one file per group of endpoints
  app/services/               the measurement code
    flores.py                 parallel corpus loading
    metrics.py                fertility, compression, token premium
    morphology_service.py     boundary vectors, MBI
    scoring.py                the 0-100 formula
    corpus_extract.py         reading and vetting uploads
    leaderboard_service.py    persistence
  tests/
frontend/src/
  pages/                      Home, Inspect, Compare, Rank (+ their CSS)
  components/                 shared UI
  lib/                        pure helpers, no JSX
  api/client.jsx              every call to the backend
  styles/                     tokens, base, layout, components
datasets/
  FLORES/                     eight .dev files, 997 lines each
  NCHLT/                      seven gold segmentation files
```

Styles are split by layer and by page. `main.jsx` loads the four shared
layers in cascade order and each page imports its own file; nothing but
`tokens.css` is imported twice.

## The API

| Method | Path | Returns |
|---|---|---|
| GET | `/options` | languages, tokenizers, upload limits |
| GET | `/status` | backend and corpus health |
| GET | `/tokenizer/{model}` | vocab size, max length, class |
| POST | `/inspect/default` | the built-in corpus, tokenized |
| POST | `/inspect/upload` | an uploaded corpus, tokenized and measured on its own |
| POST | `/tokenize-text` | one block of typed text |
| GET | `/metrics/{model}` | all four metrics, per language |
| GET | `/compare` | the same, for two tokenizers |
| GET | `/mbi/{model}?language=` | precision, recall, F1 for one language |
| GET | `/compare_mbi` | the same, for two tokenizers |
| GET | `/morphology-languages` | the languages with gold segmentations |
| GET | `/example/model/{model}` | one sentence in every language |
| GET | `/leaderboard` | the board, sorted |
| GET | `/leaderboard/scoring` | weights and bounds |
| POST | `/leaderboard` | measure a tokenizer and add it |
| GET | `/leaderboard/saved/{name}` | a previous measurement, active or not |
| POST | `/leaderboard/{name}/restore` | put a saved one back without remeasuring |
| DELETE | `/leaderboard/{id}` | take one off the board, keeping its metrics |

Interactive docs at `/docs` while the backend is running.

## Known limits

- The leaderboard holds ten active tokenizers. Removing one keeps its
  measurements, so restoring it is free.
- A measurement where some NCHLT languages failed is stored as though it
  were complete. The response body reports `failed_languages`, but the
  leaderboard table does not have a column for it.
- Fertility divides by whitespace-separated words. Sepedi, Sesotho and
  Setswana are written disjunctively and the Nguni languages conjunctively,
  so a "word" is not the same unit across the two families. The averages are
  still comparable within a family; across families, read the per-language
  grid on Rank rather than the mean.
- Compression (bytes/token) and fertility (tokens/word) multiply to
  bytes/word, so two of the four weighted components are not independent.
- PDFs are refused, by extension and by magic bytes. Text-layer extraction
  is doable; refusing scanned pages reliably is not, and a scan silently
  measured as an empty document would be worse than no support at all.
