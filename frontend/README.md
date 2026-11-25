# Ikibondo web app (Next.js 16)

Dashboards for admins, supervisors, nurses, CHWs and parents, plus the public site. Installable
as a PWA; CHW visit capture keeps working offline.

## Run

```bash
npm ci
echo "NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1" > .env.local
npm run dev            # http://localhost:3000
```

The backend must be running (see the root README).

## Check before pushing

```bash
npx tsc --noEmit
npm run lint
npm run build
```

CI runs the same steps (`.github/workflows/ci.yml`).

## End-to-end tests (Playwright)

Uses the Chrome already installed on the machine.

```bash
E2E_CHW_EMAIL=… E2E_CHW_PASSWORD=… PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e
```

`e2e/offline.spec.ts` logs a visit with the network switched off and checks it uploads when the
connection returns. It needs a CHW with at least one assigned family.

## Offline behaviour

- `src/lib/offline/queue.ts` — writes that fail for lack of connection are queued (with a UUID) and
  replayed through `POST /api/v1/sync/batch/` on reconnect, on focus and every minute.
- Queued items are tagged with their author and only uploaded by that person's session.
- `public/sw.js` — caches hashed assets and the field-workflow pages only; it never stores API
  responses. Sign-out clears its caches and per-person local data.

## Design

Tokens live in `src/app/globals.css` ("growth-chart paper": chart-paper grey, ballpoint navy,
raspberry accent, MUAC-tape risk colours). One typeface: Atkinson Hyperlegible Next.
