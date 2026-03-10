# Impostor_Game
Impostor Game - Group of friends can play together and have fun
=======
ï»¿# Imposter Game (Lead Impostor Variant)

Realtime party game web app built with Next.js + Supabase.

## Features Implemented

- Host creates game with impostor count and voting timer duration.
- Join by code or QR link.
- Role assignment on game start with one lead impostor.
- Private role reveal screen for each player.
- Round actions:
  - Everyone can submit a vote.
  - Lead impostor can submit a kill target.
- Voting timer and auto-close:
  - Countdown shown during voting.
  - Host browser auto-resolves round when timer expires.
- Round resolution rules:
  - Vote tie ignores lead vote first.
  - Lead vote only breaks tie if it points to one tied candidate.
  - If lead is vote-eliminated, no kill happens.
  - Vote + kill eliminations can both happen in same round.
  - Remaining impostor count is stored in round event payload.
  - If lead is removed, leadership transfers next round.
- Host voting progress panel:
  - Shows who has voted and live completion count.

## Security/Permissions

- Session-based permission hardening:
  - Cookie session token (`ig_session`) created at join/create.
  - Host-only guard for start and resolve endpoints.
  - Player session guard for vote/kill endpoints.
  - Lead-only guard for kill endpoint.

## Tech Stack

- Frontend: Next.js App Router, React 19, TypeScript, Tailwind
- Backend: Supabase Postgres + SQL functions + Realtime-ready schema
- Connector: @supabase/supabase-js
- QR code: qrcode.react
- Hosting: Vercel + Supabase Free

## Local Setup

1. Install dependencies.

```bash
npm install
```

2. Copy env file.

```bash
cp .env.example .env.local
```

3. Fill these values from your Supabase project:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_ORIGIN` (usually `http://localhost:3000` in local)

4. Apply SQL migrations in order:
- `supabase/migrations/20260309_init.sql`
- `supabase/migrations/20260309_phase2_sessions.sql`
- `supabase/migrations/20260309_phase3_timer_and_role.sql`n- `supabase/migrations/20260309_phase4_discussion_word_and_lead_vote_rule.sql`n- `supabase/migrations/20260310_phase5_rotation_order.sql``

5. Run dev server.

```bash
npm run dev
```

6. Open `http://localhost:3000`.

## Deploy

1. Push repo to GitHub.
2. Import into Vercel.
3. Set same env vars in Vercel project settings.
4. Ensure migrations are applied in Supabase prod project.
5. Deploy.

## Important Notes

- Current RLS policies are broad (`using true`) to speed MVP work.
- Before production, tighten RLS with auth-backed player identity.
- Add server-side rate limiting on vote/kill/resolve endpoints for abuse resistance.
- Auto-resolve at timeout currently depends on host browser being open.
>>>>>>> f9795a5 (Initial imposter game)
