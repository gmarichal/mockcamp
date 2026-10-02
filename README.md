# MockCamp

Mock server for QA teams. Configure HTTP endpoints via an admin panel and expose them as real APIs.

## Requirements

- Node.js 20+
- PostgreSQL 14+

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp packages/server/.env.example packages/server/.env
# Edit packages/server/.env — set DATABASE_URL

# 3. Run database migrations
npm run db:migrate

# 4. Seed initial admin user (admin@mockcamp.local / admin123)
npm run db:seed

# 5. Start development server
npm run dev
```

Open http://localhost:3000/_admin

## Structure

```
mockcamp/
├── packages/
│   ├── server/          # Fastify + Prisma (port 3000)
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── app.ts
│   │   │   ├── lib/
│   │   │   └── routes/
│   │   └── prisma/
│   │       └── schema.prisma
│   └── client/          # React + Vite (proxied via server in prod)
│       └── src/
└── package.json         # npm workspaces root
```

## Routes

- `/_admin/*` — Admin panel (React SPA)
- `/_admin/api/*` — Admin REST API
- `/{project-slug}/*` — Mock engine (active after Phase 5)

## Default credentials

After seeding: `admin@mockcamp.local` / `admin123`  
Password change required on first login.
