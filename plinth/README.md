# Plinth — Prove Your Foundation

A real-time multiplayer trivia game with AI-generated questions. Players join rooms from any device, answer simultaneously, and faster correct answers earn more points.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│   Browser    │────▶│   Supabase   │◀────│   Browser     │
│  (Player 1)  │     │  Realtime DB │     │  (Player 2)   │
└──────┬───────┘     └──────────────┘     └───────────────┘
       │
       ▼
┌──────────────┐
│  Anthropic   │
│  Claude API  │
└──────────────┘
```

- **Supabase** — Realtime PostgreSQL for room state + player sync
- **Anthropic API** — AI-generated trivia questions in any topic/language
- **Vite + React** — Fast frontend, deploy anywhere

## Quick Start

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free project
2. Go to **SQL Editor** and run the contents of `schema.sql`
3. Go to **Settings → API** and copy your **Project URL** and **anon public key**

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials and Anthropic API key:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Enable Realtime in Supabase

1. Go to **Database → Replication**
2. Under "supabase_realtime", make sure both `rooms` and `players` tables are enabled
3. If they don't appear, the `schema.sql` ALTER PUBLICATION commands should have added them

### 4. Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173` — create a room, share the code, and play!

### 5. Deploy

```bash
npm run build
```

Deploy the `dist/` folder to any static host:

- **Vercel**: `npx vercel --prod`
- **Netlify**: drag `dist/` to netlify.com/drop
- **Cloudflare Pages**: connect your repo

## How It Works

### Game Flow

1. **Host creates a room** → gets a 6-character room code
2. **Players join** → enter the code on their own devices
3. **Host starts** → AI generates questions via Claude API
4. **Everyone plays simultaneously** → questions sync in real-time
5. **Speed matters** → faster correct answers earn more points (300–1000)
6. **Auto-advance** → once all players answer, next question loads
7. **Results** → final scoreboard with rankings

### Scoring

- Correct + instant (full time left) = **1000 points**
- Correct + half time left = **650 points**
- Correct + last second = **300 points**
- Wrong or timeout = **0 points**

### Features

- **Any topic**: Type any topic — "Iranian Architecture", "90s Hip Hop", "Quantum Physics"
- **Any language**: Questions generated in any language — Persian, Japanese, Arabic, etc.
- **Real-time sync**: All players see the same question at the same time
- **4 difficulty levels**: Easy → Expert
- **Configurable**: 5-20 questions, 10-30 second timer

## Production Notes

### Anthropic API Key Security

The current setup calls the Anthropic API directly from the browser (using `anthropic-dangerous-direct-browser-access`). For production:

1. Create a small API proxy (Vercel Edge Function, Cloudflare Worker, etc.)
2. Move your Anthropic key to the server
3. Update `src/questions.js` to call your proxy at `/api/generate`

Example Vercel Edge Function (`api/generate.js`):

```javascript
export default async function handler(req) {
  const { topic, count, level, language } = await req.json()
  
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: `Generate ${count} trivia questions...` }],
    }),
  })
  
  const data = await res.json()
  const text = data.content?.[0]?.text || ''
  return new Response(text.replace(/```json|```/g, '').trim())
}
```

### Supabase RLS

The schema uses permissive RLS policies (anyone can read/write). For production, consider:
- Adding player authentication (Supabase Auth)
- Restricting room updates to the host
- Auto-deleting rooms older than 24 hours (pg_cron)

## Stack

- React 19 + Vite 6
- Supabase (PostgreSQL + Realtime)
- Anthropic Claude Sonnet (question generation)
- DM Mono + Instrument Serif (typography)
- Zero dependencies beyond React and Supabase client

## License

MIT
