# Backend API

Express + Mongoose REST API for the Attendance Management System.

## Setup

```bash
cp .env.example .env
# Configure MONGODB_URI (MongoDB Atlas free tier) and JWT_SECRET
npm install
npm run dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with nodemon (auto-reload) |
| `npm start` | Start production server |
| `npm run seed` | Seed demo data (Phase 2+) |
| `npm run lint` | ESLint check |

## Architecture

```
Route → Controller → Service → Model → MongoDB
```

- **Routes** — HTTP endpoint definitions, middleware wiring
- **Controllers** — parse requests, call services, shape responses
- **Services** — business logic, transactions, duplicate handling
- **Models** — Mongoose schemas with indexes and validation
- **Middleware** — JWT auth, role authorization, error handling
- **Validators** — express-validator chains per endpoint

## API Response Format

```json
// Success
{ "success": true, "message": "...", "data": {} }

// Error
{ "success": false, "message": "...", "errorCode": "DUPLICATE_STUDENT" }
```

## Security

- bcrypt password hashing (never stored in plain text)
- JWT authentication with role-based authorization
- Helmet security headers
- CORS allow-list via `CLIENT_URL`
- Rate limiting on `/api`
- Centralized error handler (no stack traces in production)
- MongoDB injection protection via Mongoose + express-validator
