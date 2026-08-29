# Simple Portfolio Tracker Backend

This backend stores investment and saving data in a local JSON file so CRUD operations persist between requests.

## Run

```bash
node backend/server.js
```

## API

- GET /api/health
- GET /api/investment
- GET /api/saving
- POST /api/investment
- POST /api/saving
- PUT /api/investment/:id
- PUT /api/saving/:id
- DELETE /api/investment/:id
- DELETE /api/saving/:id
