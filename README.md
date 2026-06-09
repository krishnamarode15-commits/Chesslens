# ♟ ChessLens — AI Chess Game Analyzer

Analyze Chess.com and Lichess games with AI commentary.

## Deploy to Vercel (free, 5 minutes)

### Step 1 — Push to GitHub
1. Create a free account at github.com
2. Create a new repository called `chesslens`
3. Upload all these files to it

### Step 2 — Deploy on Vercel
1. Go to vercel.com and sign up free (use your GitHub account)
2. Click **"Add New Project"**
3. Import your `chesslens` GitHub repository
4. Vercel auto-detects Vite — click **Deploy**
5. Done! You get a free URL like `chesslens.vercel.app`

## How it works

- **Chess.com**: Enter any username → the `/api/chess` serverless function fetches their recent games server-side (no CORS issues) → pick a game → AI analyzes it
- **Lichess**: Paste any game URL → fetched directly (Lichess allows browser requests)
- **AI Analysis**: Powered by Claude — gives overview, key moments, performance scores, decisive factor, and lesson

## Local development

```bash
npm install
npx vercel dev   # runs both frontend + serverless functions locally
```

Then open http://localhost:3000

## Free hosting details

- **Vercel**: 100GB bandwidth/month free, serverless functions included
- **Domain**: You get `yourproject.vercel.app` free, or connect your own domain
- **No database needed** — everything is fetched live from Chess.com / Lichess APIs
