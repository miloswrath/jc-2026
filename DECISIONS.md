# Decisions

## Phase 0
- Questions config format: JSON array of objects with `id` and `text`.
- Project structure: `server/` and `client/` directories at repo root.

## Phase 1
- Package manager: pnpm workspace with `server` and `client` packages.
- Server tooling: TypeScript with `ws`, `tsx` for dev, `vitest` for tests.
- Client tooling: Vite + React + Tailwind, `vitest` + Testing Library for tests.

## Phase 2
- Questions config location: `questions.json` at repo root.
- WebSocket protocol: participant joins receive `participant:joined` with questions; presenter requests `presenter:state` snapshots.

## Phase 3
- Participant client connects to WebSocket at `VITE_WS_URL` or `ws(s)://<hostname>:8080`.
- Participant UI flow: join name, answer questions, submit with edit mode.
- Styling direction: dark ink background with warm sand accents and glow panels.

## Phase 4
- Presenter view route: `/presenter` or `?presenter=true` on the client.

## Phase 5
- Visual polish: remove card borders; add slow float motion to participant and presenter cards.
