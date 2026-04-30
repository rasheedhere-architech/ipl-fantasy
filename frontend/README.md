# Frontend README

This is the React + Vite + TypeScript frontend for the IPL Fantasy 2026 platform.

## Stack

- **React 18** with functional components and hooks
- **Vite** for build tooling and dev server
- **TypeScript** in strict mode
- **Tailwind CSS v4** with custom IPL design tokens
- **Zustand** for auth/user state
- **TanStack Query v5** for all server state
- **React Router v6** for navigation
- **Axios** for API calls
- **Lucide React** for icons

## Dev

```bash
npm install
npm run dev       # starts dev server at http://localhost:5173
npm run build     # TypeScript check + production bundle
```

## Environment

Set `VITE_API_URL` in `.env` (defaults to `http://localhost:8000`):

```env
VITE_API_URL=http://localhost:8000
```

## Key Conventions

- **Team colors**: all team styling goes through `src/utils/teamColors.ts`. Use `getTeamColor(name)` and `getTeamShortName(name)` — both accept `any` type safely.
- **tossTime**: the API returns `tossTime` (ISO string) on all match responses. Use this field for lock calculations and countdown timers — never `start_time` directly.
- **Dynamic answers**: never hardcode question IDs in the UI. Iterate over `pred.answers` keys and look up metadata via the `questionMap` from the match detail response.
- **Layout width**: the main Layout wrapper caps at `max-w-[1280px]`. Individual page containers should use `w-full max-w-full` to fill the available space.

## Deployment

```bash
npm run build
# dist/ → deploy to Vercel
```

Vercel config (`vercel.json`):
```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```
