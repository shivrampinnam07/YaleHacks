# WeaveWise

WeaveWise is a clothing sustainability tracker that reads garment tags, extracts structured clothing data, and estimates environmental impact for a single item or an entire wardrobe.

The product flow is:

1. User uploads a garment tag image
2. OCR extracts text from the tag
3. An LLM parses materials, percentages, country of origin, and care hints
4. The backend looks up sustainability context and impact factors
5. The app returns an impact summary, comparisons, and wardrobe-level insights

## Problem

Clothing sustainability data is fragmented. Unlike food, there is no single public API that tells you the climate impact of a garment from a simple label. Most useful data is spread across lifecycle assessment reports, textile benchmark systems, and research PDFs.

This project solves that by combining:

- OCR for clothing tags
- LLM-based parsing for messy real-world label text
- MongoDB Atlas for structured persistence
- sustainability lookup and summarization logic
- a React frontend for item and wardrobe reports

## What The App Extracts From A Clothing Tag

A clothing tag often contains:

- material composition
  - for example: `60% Cotton, 35% Polyester, 5% Elastane`
- country of manufacture
  - for example: `Made in Bangladesh`
- care instructions
  - for example: wash temperature, tumble dry, dry clean
- brand or product description

These fields matter because:

- material composition drives manufacturing emissions
- country of origin affects transport and production energy context
- care instructions influence the use-phase footprint over the garment lifetime

## Core Concept

The application estimates clothing impact using a layered pipeline:

- OCR extracts raw text from a garment tag image
- parsing logic converts that raw text into structured garment data
- search and enrichment gather supporting sustainability context
- MongoDB stores sessions and can be expanded to store material lookup tables
- impact logic produces garment-level and wardrobe-level outputs

## Tech Stack

### Frontend

- React
- Vite
- TypeScript

### Backend

- Python 3.11+
- FastAPI
- Uvicorn

### Database

- MongoDB Atlas
- `pymongo`

### AI / Search / Orchestration

- Groq API
- LangGraph
- Bright Data search

### Utilities

- Pillow
- BeautifulSoup
- python-dotenv

## Current Repository Structure

```text
YaleHacks/
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── api.ts
│   │   ├── BackgroundClothes.tsx
│   │   ├── WardrobeReport.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── src/
│   └── yalehacks/
│       ├── api.py
│       ├── brightdata_client.py
│       ├── cli.py
│       ├── config.py
│       ├── db.py
│       ├── graph.py
│       ├── query_build.py
│       ├── tag_read.py
│       └── wardrobe_impact.py
├── pyproject.toml
└── .env
```

## Environment Variables

Create a local `.env` file in the repo root.

Required:

```env
MONGODB_URI=your_mongodb_atlas_connection_string
MONGODB_DB_NAME=yalehacks
BRIGHTDATA_API_KEY=your_brightdata_key
BRIGHTDATA_ZONE=search_api
GROQ_API_KEY=your_groq_key
GROQ_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
GROQ_SUMMARY_MODEL=openai/gpt-oss-20b
CORS_ORIGINS=*
```

Notes:

- `MONGODB_URI` connects the app to MongoDB Atlas
- `BRIGHTDATA_API_KEY` powers web search enrichment
- `GROQ_API_KEY` powers the LLM steps
- `.env` should never be committed

## Local Setup

### 1. Install Python

This project requires Python 3.11 or newer.

If needed on macOS:

```bash
brew install python@3.11
```

### 2. Create a virtual environment

```bash
cd "/Users/osamahgilani/Documents/New project/YaleHacks"
/opt/homebrew/bin/python3.11 -m venv .venv
```

### 3. Install backend dependencies

```bash
cd "/Users/osamahgilani/Documents/New project/YaleHacks"
.venv/bin/pip install .
```

### 4. Install frontend dependencies

```bash
cd "/Users/osamahgilani/Documents/New project/YaleHacks/frontend"
npm install
```

## Running The App

### Backend

```bash
cd "/Users/osamahgilani/Documents/New project/YaleHacks"
.venv/bin/uvicorn yalehacks.api:app --host 127.0.0.1 --port 8000
```

### Frontend

```bash
cd "/Users/osamahgilani/Documents/New project/YaleHacks/frontend"
npm run dev -- --host 127.0.0.1 --port 5173
```

### Local URLs

- frontend: `http://127.0.0.1:5173`
- backend health: `http://127.0.0.1:8000/health`

If port `5173` is already in use, Vite may move the frontend to `5174`.

## Current API Endpoints

### Health

`GET /health`

Returns:

```json
{ "status": "ok" }
```

### OCR

`POST /api/ocr`

Accepts:

- image file upload
- optional `session_id`
- optional `description`

Returns:

```json
{
  "session_id": "uuid",
  "ocr_text": "raw text from garment tag"
}
```

### Graph

`POST /api/graph`

Accepts either:

- `session_id`
- or raw `ocr_text`

Returns:

```json
{
  "session_id": "uuid",
  "summary": "impact summary",
  "search_query": "generated sustainability query"
}
```

### Search

`POST /api/search`

Builds or uses a query and performs search enrichment.

### Wardrobe Impact

`POST /api/wardrobe/impact`

Accepts a list of wardrobe items with summaries and returns a combined wardrobe-level impact report.

### Session Fetch

`GET /api/sessions/{session_id}`

Returns the stored session document.

## Database Design Direction

MongoDB Atlas should evolve to include these collections:

- `materials`
- `countries`
- `care_instructions`
- `scans`
- `users`

### Example `materials` document

```json
{
  "material_name": "polyester",
  "aliases": ["polyester", "poly", "PES"],
  "co2_per_kg": 5.5,
  "water_per_kg": 17,
  "energy_mj_per_kg": 104,
  "is_recyclable": true,
  "recycled_variant_co2": 2.1,
  "biodegradable": false,
  "category": "synthetic",
  "source": "Higg MSI"
}
```

### Example `countries` document

```json
{
  "country": "Bangladesh",
  "iso_code": "BD",
  "avg_shipping_co2_per_kg": 0.8,
  "factory_energy_mix": "mostly_fossil",
  "energy_co2_factor": 1.2
}
```

### Example `care_instructions` document

```json
{
  "instruction": "machine_wash_40",
  "co2_per_wash_kg": 0.3,
  "water_per_wash_liters": 50,
  "estimated_washes_per_year": 52
}
```

### Example `scans` document

```json
{
  "user_id": "user_123",
  "raw_ocr_text": "60% Cotton 40% Polyester Made in China",
  "parsed_data": {
    "materials": [
      { "name": "cotton", "percentage": 60 },
      { "name": "polyester", "percentage": 40 }
    ],
    "country": "China",
    "care": ["machine_wash_30", "do_not_tumble_dry"]
  },
  "carbon_score": {
    "material_co2": 4.2,
    "transport_co2": 0.6,
    "use_phase_co2": 12.1,
    "total_co2": 16.9,
    "rating": "C"
  }
}
```

## Data Sources For Sustainability Factors

Recommended sources for building the material-impact lookup layer:

- Higg Materials Sustainability Index
- OECOTEXTILES research data
- European Commission Product Environmental Footprint datasets
- Made-By Environmental Benchmark for Fibers
- Quantis World Apparel LCA
- Textile Exchange Preferred Fiber & Materials reports
- Carbon Trust research on fashion lifecycle emissions

Because there is no single open API for clothing impact, the intended approach is to normalize these sources into your own MongoDB collections.

## Carbon Calculation Direction

The intended scoring model is:

```text
Total CO2 = Material CO2 + Transport CO2 + Use-Phase CO2

Material CO2 = sum(material_co2_per_kg × percentage × garment_weight_kg)
Transport CO2 = country_shipping_co2_per_kg × garment_weight_kg
Use-Phase CO2 = co2_per_wash × washes_per_year × garment_lifespan_years
```

Suggested rating scale:

- A: under 5 kg CO2
- B: 5-10 kg
- C: 10-20 kg
- D: 20-35 kg
- F: above 35 kg

Because clothing tags do not include weight, garment-type defaults can be used:

- t-shirt: ~0.2 kg
- jeans: ~0.8 kg
- jacket: ~1.2 kg

## Product Roadmap

### Phase 1

- finalize MongoDB schema
- seed materials and country data
- validate OCR on real garment tags

### Phase 2

- improve parsing reliability for mixed-fiber labels
- add care-instruction normalization
- save and inspect scan history

### Phase 3

- add full carbon breakdown per garment
- add alternatives and lower-impact suggestions
- support better wardrobe-level comparison

### Phase 4

- polish frontend UX
- deploy backend and frontend
- add production-grade image storage

## Deployment Direction

- frontend: Vercel
- backend: Railway or Render
- database: MongoDB Atlas

## Current Notes

- The app boots locally with the backend and frontend commands above
- The full pipeline depends on valid `.env` secrets
- MongoDB support already exists in the current codebase
- `node_modules/` should remain ignored and local only

## Future Improvements

- swap OCR provider depending on accuracy and cost
- add manual correction UI after OCR
- add multilingual label support
- estimate confidence scores per parsed field
- add visual charts for material and wardrobe comparisons
- support material substitutions and greener alternatives

## License

No license file is currently included in this branch. Add one before public distribution if needed.
