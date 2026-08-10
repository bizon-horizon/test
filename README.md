# 🥕 Fridge Frenzy 🧊

Online multiplayer 3D FPS in the browser: you are a food, your rifle is a baguette, and the enemies are killer refrigerators.

## Features
- 3D FPS built with Three.js (pointer-lock mouse look, WASD movement)
- Refrigerator enemies that chase and attack you
- Weapons: **Baguette Rifle** (hold left mouse button for continuous fire) and **Butter Knife** — switch with `1` / `2` or `Q`
- Online multiplayer via Supabase Realtime (presence + broadcast) — see other players move in real time
- In-game chat (press `Enter`)
- Server browser: join existing servers or create your own
- Global leaderboard stored in Supabase
- Player save files stored **only** in the online database (Supabase), never locally
- Procedural sound effects (WebAudio) — shooting, hits, fridge destruction, and more

## Setup

1. Create a free project at [supabase.com](https://supabase.com).
2. In the Supabase SQL editor, run `supabase/schema.sql`.
3. Copy `.env.example` to `.env` and fill in your project URL and anon key
   (Project Settings → API).
4. Install and run:

```bash
npm install
npm run dev
```

Open the printed URL, enter a name, pick a food, and join a server.

## Controls
| Input | Action |
|---|---|
| WASD | Move |
| Mouse | Look |
| Hold Left Mouse | Fire rifle continuously / swing knife |
| 1 / 2 | Rifle / Knife |
| Q | Toggle weapon |
| Enter | Open chat / send message |
