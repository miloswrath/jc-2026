# Local Network Live Q&A Presentation Tool

## Goals
- Lightweight, locally hosted presentation tool.
- Participants join via a local link, enter their name in a friendly UI, answer a fixed set of prewritten questions, submit, and optionally edit responses.
- Presenter runs the presentation view on their machine; participants respond on their own devices.
- Fixed question list defined by the admin (no auth).
- Support up to 15 concurrent participants on a local network.
- No database; use Node with TypeScript.
- Use Tailwind for styling; React is acceptable if it helps deliver strong aesthetics.
- Responses are attributed to participant names.
- Live updates on the presentation screen; animations and readability are key.

## Questions (Starter Set)
- One repetitive task they hate
- One document they always search for
- One decision they make weekly

## Admin Configuration
- Questions are defined via a config file (admin-edited).

## Questions Config
The server loads questions from `questions.json` at the repo root by default.
Use `questions.example.json` as a template, or point to a custom file:
```sh
QUESTIONS_PATH=./my-questions.json pnpm dev:server
```

Format: JSON array of `{ "id": "...", "text": "..." }`.
```json
[
  { "id": "task-you-hate", "text": "One repetitive task they hate" },
  { "id": "always-search", "text": "One document they always search for" },
  { "id": "weekly-decision", "text": "One decision they make weekly" }
]
```

## Data Persistence
- In-memory only; data resets on server shutdown.

## MVP Feature List
- Local server hosts participant UI and presentation screen.
- Config-driven fixed question list (no runtime editing UI).
- Participant flow: join link, enter name, answer questions, submit, optionally edit.
- Presenter view shows attributed responses in real time.
- Basic animations and readability-first layout.
- Supports up to 15 concurrent participants on a local network.

## UX Flow
- Presenter starts server on their machine.
- Participants open the local URL, enter their name, and see the question list.
- Participants answer and submit; UI confirms submission and allows edits.
- Presenter screen updates live as responses arrive or change.

## Local Development
Install dependencies:
```sh
pnpm install
```

Run server and client on your machine:
```sh
pnpm dev:server
pnpm dev:client
```

Presenter view:
```sh
open http://localhost:5173/presenter
```

## Local Network Access
Run both server and client on all interfaces and point the client WebSocket to
your LAN IP address.

```sh
HOST=0.0.0.0 PORT=8088 pnpm dev:server
VITE_WS_URL=ws://<YOUR-LAN-IP>:8088 pnpm --filter client dev -- --host 0.0.0.0
```

Presenter view (from another device):
```sh
http://<YOUR-LAN-IP>:5173/presenter
```

## Troubleshooting (Local Network)
- Confirm the server is bound to `0.0.0.0` and running on the expected port.
- Make sure `VITE_WS_URL` uses your LAN IP and matches the server port.
- Ensure the presenter device and participants are on the same network.
- Check OS firewall rules if devices cannot connect.
