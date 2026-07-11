# CoShield AI

> **Enterprise AI-Powered Compliance Intelligence Platform**

CoShield AI enables organizations to query their entire policy and compliance document library using natural language. It synthesizes accurate, source-cited answers from ingested PDFs using a hybrid RAG (Retrieval-Augmented Generation) pipeline — combining semantic vector search with full-text search, fused via Reciprocal Rank Fusion (RRF) and synthesized by Gemini 1.5 Flash.

Built with a production-grade multi-tenant architecture, RBAC enforcement, background job processing, and Redis caching.

---

## Live Demo

> **Frontend:** [coshield-ai.vercel.app](https://coshield-ai.vercel.app)  
> **API:** [coshield-ai-w8xq.onrender.com/api/v1](https://coshield-ai-w8xq.onrender.com/api/v1)  
> **Health Check:** [coshield-ai-w8xq.onrender.com/health](https://coshield-ai-w8xq.onrender.com/health)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React + Vite)              │
│  AuthContext → ProtectedRoute → App (Sidebar + Outlet)      │
│  Pages: Auth · Dashboard · Documents · Compliance Query     │
└──────────────────────────┬──────────────────────────────────┘
                           │ Axios (JWT Bearer)
┌──────────────────────────▼──────────────────────────────────┐
│                      Backend (Express v5)                   │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  Auth API   │  │ Documents API│  │  Compliance API   │  │
│  │  /api/v1/   │  │  /api/v1/   │  │  /api/v1/         │  │
│  │  auth       │  │  documents  │  │  compliance/query │  │
│  └──────┬──────┘  └──────┬───────┘  └────────┬──────────┘  │
│         │                │                   │             │
│  ┌──────▼────────────────▼───────────────────▼──────────┐  │
│  │             Prisma ORM + PostgreSQL (NeonDB)          │  │
│  │             pgvector extension for embeddings         │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────┐   ┌──────────────────────────┐    │
│  │   BullMQ Workers    │   │     Redis (ioredis)       │    │
│  │   PDF Ingestion     │◄──│  Queue + Response Cache   │    │
│  │   Text Chunking     │   │  TTL: 1 hour per query    │    │
│  │   Gemini Embeddings │   └──────────────────────────┘    │
│  └─────────────────────┘                                   │
└─────────────────────────────────────────────────────────────┘
```

---

### 🤖 Hybrid RAG Pipeline
- **Vector Search** — Google Gemini `text-embedding-004` embeddings stored in `pgvector`
- **Full-Text Search** — PostgreSQL native FTS with `ts_vector` indexing
- **RRF Fusion** — Reciprocal Rank Fusion combines both result sets for superior relevance
- **Gemini Synthesis** — Context-aware answers generated with inline source attribution

### 🏢 Multi-Tenant Architecture
- Organizations are fully isolated at the database level via `tenantId` scoping on every query
- Each tenant manages its own users, documents, departments, and vector chunks
- New tenants are provisioned automatically on registration

### 🔐 Authentication & Authorization
- **JWT Stateless Auth** — Passport.js local strategy; tokens stored in `localStorage`
- **Google OAuth 2.0** — One-click sign-in via passport-google-oauth20
- **RBAC** — Three roles: `USER`, `COMPLIANCE_OFFICER`, `ADMIN`
  - Document upload restricted to `COMPLIANCE_OFFICER`+
  - Role-based document access enforced at query time
- **Rate Limiting** — Auth routes: 15 req / 15 min · API routes: 100 req / min

### ⚡ Background Job Processing
- PDF uploads are queued via **BullMQ** backed by Redis
- Workers handle: PDF text extraction → chunking → embedding generation → vector storage
- Cache invalidation triggered on successful ingestion

### 🗄️ Response Caching
- Compliance query responses cached in Redis with tenant-scoped keys
- Cache key format: `coshield:compliance:{tenantId}:{hashedQuestion}`
- TTL: 1 hour; invalidated automatically when new documents are ingested
- Responses include a `cached: true` flag visible in the UI (⚡ indicator)

---

## Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Runtime | Node.js (ES Modules) |
| Framework | Express v5 |
| ORM | Prisma 7 |
| Database | PostgreSQL (NeonDB serverless) + `pgvector` |
| Queue | BullMQ |
| Cache | Redis (ioredis) |
| Auth | Passport.js (Local + Google OAuth) · JWT |
| Validation | express-validator |
| Rate Limiting | express-rate-limit |
| File Upload | Multer |
| AI | Google Gemini API (embeddings + Gemini 1.5 Flash) |


### Frontend
| Layer | Technology |
|---|---|
| Framework | React 19 + Vite |
| Routing | React Router v7 (Data API — `createBrowserRouter`) |
| HTTP Client | Axios (interceptors for JWT injection) |
| State | React Context API (`AuthContext`, `ToastContext`) |
| Styling | Vanilla CSS (design tokens, glassmorphism, dark theme) |

---

## Project Structure

```
coshield-ai/
├── backend/
│   ├── app.js                  # Express app config, middleware, routers
│   ├── server.js               # HTTP listener + worker bootstrap
│   ├── passport.js             # Passport strategies (local + Google)
│   ├── controllers/
│   │   ├── auth.js             # register, login, googleCallback
│   │   ├── documents.js        # upload, list, status
│   │   └── compliance.js       # Hybrid RAG query controller
│   ├── routes/
│   │   ├── auth.js             # /api/v1/auth
│   │   ├── documents.js        # /api/v1/documents
│   │   └── compliance.js       # /api/v1/compliance
│   ├── middleware/
│   │   ├── auth.js             # authenticateJWT, requireRole
│   │   └── validate.js         # express-validator schemas
│   ├── services/
│   │   ├── gemini.js           # Embedding generation + Gemini 1.5 Flash synthesis
│   │   ├── queue.js            # BullMQ DocumentQueue definition
│   │   ├── worker.js           # PDF ingestion worker + cache invalidation
│   │   └── cache.js            # Redis cache read/write/invalidate helpers
│   └── prisma/
│       ├── schema.prisma       # DB schema (Tenant, User, Document, Chunk)
│       └── prisma.js           # Prisma client singleton
│
└── frontend/
    └── src/
        ├── api/
        │   └── axiosConfig.js  # Axios instance with JWT interceptor
        ├── context/
        │   ├── AuthContext.jsx # currentUser state + /auth/status check
        │   └── ToastContext.jsx# Global slide-in notification system
        ├── components/
        │   ├── Sidebar.jsx     # Nav, user card, logout
        │   └── ProtectedRoute.jsx # Route guard
        ├── pages/
        │   ├── AuthPage.jsx    # Split-screen login/register with hero panel
        │   ├── Dashboard.jsx   # Stats cards + activity feed
        │   ├── DocumentsPage.jsx # Drag-and-drop upload drawer + documents table
        │   └── ComplianceQueryPage.jsx # Chat UI + citations panel
        ├── App.jsx             # Layout shell (Sidebar + Outlet)
        └── main.jsx            # Router config + provider tree
```

---

## Getting Started

### Prerequisites

- Node.js >= 20
- PostgreSQL with `pgvector` extension (or a [NeonDB](https://neon.tech) account)
- Redis (local or [Upstash](https://upstash.com))
- Google Gemini API key (Free)

### 1. Clone the repository

```bash
git clone https://github.com/your-username/coshield-ai.git
cd coshield-ai
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create your environment file:

```bash
cp .env.example .env
```

Fill in `.env`:

```env
DATABASE_URL="postgresql://..."
JWT_SECRET="your-super-secret-key-change-in-production"
REDIS_URL="redis://127.0.0.1:6379"
GEMINI_API_KEY="AIzaSy..."
PORT=5000
NODE_ENV="development"
CORS_ORIGIN="http://localhost:5173"

# Optional — Google OAuth
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_CALLBACK_URL="http://localhost:5000/api/v1/auth/google/callback"
```

Run database migrations:

```bash
npx prisma generate
npx prisma db push
```

Start the backend:

```bash
npm run dev       # node --watch server.js
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

Create `.env` (For local development, set this to localhost. In production, configure this on Vercel to point to your Render backend):

```env
# Local Development
VITE_API_URL=http://localhost:5000/api/v1

# Production (Set in Vercel Dashboard Environment Variables)
# VITE_API_URL=https://coshield-ai-w8xq.onrender.com/api/v1
```

Start the frontend:

```bash
npm run dev
```

Frontend runs at **http://localhost:5173**

### 4. Start Redis (WSL / Linux)

```bash
sudo service redis-server start
```

---

## API Reference

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/v1/auth/register` | — | Register new user + tenant; accepts optional `role` field (`USER` \| `COMPLIANCE_OFFICER` \| `ADMIN`) |
| `POST` | `/api/v1/auth/login` | — | Login, returns JWT |
| `GET` | `/api/v1/auth/status` | JWT | Validate token, return current user |
| `POST` | `/api/v1/auth/logout` | JWT | Logout (client-side token removal) |
| `GET` | `/api/v1/auth/google` | — | Initiate Google OAuth flow |

### Documents
| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| `GET` | `/api/v1/documents` | JWT | Any | List tenant's documents |
| `POST` | `/api/v1/documents/upload` | JWT | CO / Admin | Upload PDF, enqueue ingestion |
| `GET` | `/api/v1/documents/:id/status` | JWT | Any | Poll ingestion status |

### Compliance
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/v1/compliance/query` | JWT | Hybrid RAG query against tenant documents |

---

## Database Schema

```
Tenant ──< User
       ──< Department ──< UserDepartment >── User
       ──< Document ──< DocumentChunk (vector embedding)
```

Key design decisions:
- All tables carry `tenantId` — enforced at the application layer, not via PostgreSQL row-level security, for Prisma compatibility
- `DocumentChunk.embedding` uses `pgvector`'s `vector` type for ANN queries
- `roleRequired` on both `Document` and `DocumentChunk` enables fine-grained per-document access control at query time

---

## How the RAG Pipeline Works

```
User Question
      │
      ▼
1. Cache Check (Redis)
      │ miss
      ▼
2. Generate Question Embedding (Google Gemini text-embedding-004)
      │
      ▼
3. Vector Search  +  Full-Text Search  (run in parallel via raw SQL)
      │                    │
      └────────┬───────────┘
               ▼
4. Reciprocal Rank Fusion (RRF)
   score = Σ 1 / (k + rank_i), k=60
               │
               ▼
5. Top-N chunks retrieved (filtered by tenantId + roleRequired)
               │
               ▼
6. Gemini 1.5 Flash Synthesis
   System: "You are a compliance officer AI..."
   Context: [top chunks with page numbers + document titles]
               │
               ▼
7. Response + Citations returned
               │
               ▼
8. Cache result in Redis (TTL: 1hr, key: tenant:question_hash)
```

---

## Roles & Permissions

| Action | USER | COMPLIANCE_OFFICER | ADMIN |
|--------|------|--------------------|-------|
| Login / Register | ✅ | ✅ | ✅ |
| Query compliance documents | ✅ | ✅ | ✅ |
| View documents list | ✅ | ✅ | ✅ |
| Upload documents | ❌ | ✅ | ✅ |
| Access admin-only documents | ❌ | ❌ | ✅ |

> **For recruiters:** On the **Register** page, use the **"Register as"** toggle to select your role before signing up:
>
> | Selection | What you can do |
> |---|---|
> | User | Query compliance documents |
> | Compliance Officer | Upload PDFs + query documents |
> | **Admin** | **Full access — recommended for demo** |

---

## Security Measures

- **JWT Stateless** — No server-side session storage required
- **bcrypt** password hashing (cost factor 12)
- **Input validation** on all auth routes via `express-validator`
- **Rate limiting** — Dedicated stricter limits on auth endpoints
- **Tenant isolation** — All DB queries scoped to `tenantId` extracted from JWT
- **Role whitelisting** — Role field is validated against an allowed list (`USER`, `COMPLIANCE_OFFICER`, `ADMIN`) on the backend; arbitrary values are rejected and fall back to `USER`
- **CORS** — Configurable allowed origins via environment variable
- **Stack traces** — Only exposed in `development` mode

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Secret key for signing JWTs |
| `REDIS_URL` | ✅ | Redis connection string |
| `GEMINI_API_KEY` | — | Google Gemini API key (recommended for free tier RAG queries) |
| `PORT` | — | Server port (default: `5000`) |
| `NODE_ENV` | — | `development` or `production` |
| `CORS_ORIGIN` | — | Allowed frontend origin |
| `GOOGLE_CLIENT_ID` | — | Google OAuth (optional) |
| `GOOGLE_CLIENT_SECRET` | — | Google OAuth (optional) |
| `GOOGLE_CALLBACK_URL` | — | Google OAuth callback URL |

---

## License

MIT