# Python NLP API

Small Python service that parses smart report prompts, connects to PostgreSQL, and returns report data.

## Run

```powershell
cd "D:\Aditya Kumar Dwivedi\Account\python-nlp-api"
python app.py
```

## Endpoints

- `GET /health`
- `GET /companies`
- `POST /parse`
- `POST /report`

## Lightweight AI

- Set `OPENAI_API_KEY` and `OPENAI_MODEL=gpt-4o-mini`
- If no key is set, the service uses local rule-based parsing
- Set `NLP_PORT=8003` if you want a different port

## Example

```json
{
  "prompt": "show voucher detail of abc company",
  "companyName": "abc",
  "from": "2026-04-01",
  "to": "2026-07-01"
}
```
