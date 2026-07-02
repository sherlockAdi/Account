# AccountERP SaaS

Industrial SaaS ERP for accounting, inventory, GST/tax, manufacturing, payroll, banking, reporting, and marketplace add-ons.

## Apps

- `frontend/vite` - React Mantis admin template adapted for ERP modules.
- `backend` - NestJS API template with Swagger at `/api/docs`.

## Local Services

```bash
docker compose up -d
```

## Backend

```bash
cd backend
npm run start:dev
```

API health: `http://localhost:3000/api/v1`

Swagger: `http://localhost:3000/api/docs`

## Frontend

```bash
cd frontend/vite
npm run start
```

Frontend: `http://localhost:5173`

## Smart Reports NLP Service

```bash
cd python-nlp-api
python app.py
```

NLP API: `http://localhost:8003`

The Smart Reports page uses this service first, then falls back to the local parser if the NLP API is unavailable.
