# AB Prompt Studio

Turn a raw idea into a structured project: feasibility analysis, system architecture and model-specific prompts for Claude, Claude Code, ChatGPT, Codex, Gemini, OpenRouter or any OpenAI-compatible model.

- **Stack:** Next.js 15 · React 19 · TypeScript · Tailwind CSS 4 · Dexie (IndexedDB) · Zod · Vitest
- **Works offline-first:** the core engines are local and deterministic; external AI is optional and server-only.
- **Tests:** 48 (engines, data/backup, AI route, auth)

## Features

| Page | What it does |
|---|---|
| New Project | 7-phase flow: Input → Interpretation → Clarification → Validation → Architecture → Prompt → Review, autosaved per phase |
| Idea Analyzer | 8 dimensions scored 0–100, each tagged as evidence / assumption / unknown; risks with mitigation, time, resources, alternatives |
| Prompt Architect | 10-section prompt adapted to the target model (XML for Claude, PTCF for Gemini, AGENTS.md for Codex, …) |
| System Architect | Layers, interactive dependency diagram, entities, APIs, auth, security, folder layout, phases |
| Prompt Evaluator | 7 criteria, suggestions, improved version and score comparison |
| Prompt Library | Search, filters, collections, favourites, versions with diff and restore, export TXT/MD |
| Settings | Preferences, custom model, provider status, validated JSON backup/import |

## Architecture

```
src/lib/engines/   local deterministic engines (work without any API)
src/lib/data/      Repository interface + IndexedDbRepository (Dexie) + Zod schemas
src/lib/ai/        AI provider layer — server-only
src/app/api/ai/    /status (no keys exposed) and /generate (validation, rate limit, same-origin)
src/components/    reusable UI and domain views
```

To move to a cloud database, implement the `Repository` interface (e.g. REST/Supabase) and return it from `getRepository()`. Pages don't change.

## Run locally

```bash
npm install
cp .env.example .env.local   # optional: add one AI provider key
npm run dev                  # http://localhost:3000
npm test
npm run build && npm start   # production (PWA enabled only in production)
```

On Windows, `iniciar-ab-studio.ps1` starts the app on the local network (open `http://<PC-IP>:3100` on a phone on the same Wi-Fi). The other `.ps1` helpers read API keys from the clipboard into `.env.local` and deploy to Vercel.

## Security

- API keys live only on the server and never reach the browser; no AI call happens without a click.
- Optional password (`APP_PASSWORD`): signed httpOnly session cookie, login rate limit (8 attempts / 10 min per IP). On Vercel or with `REQUIRE_AUTH=1`, a missing password **fails closed**.
- User input is cleaned of invisible/control characters and checked for prompt-injection patterns; the original text only goes inside `<user_data>` and is treated as data.
- Provider errors are reduced to generic messages (no raw bodies or keys).
- Headers: `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.

## Known limitations

- Scores and interpretation are **rule-based heuristics**, not semantic understanding; external AI gives a second opinion.
- Data lives in this browser's IndexedDB — use backup in Settings.
- PWA icons are SVG (Chrome/Edge accept them; iOS prefers PNG).

## License

MIT — see [LICENSE](LICENSE).
