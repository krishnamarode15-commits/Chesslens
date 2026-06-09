// api/chess.js — Vercel serverless function
// Proxies Chess.com API requests server-side (no CORS issues)

export default async function handler(req, res) {
  // Allow all origins
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { username } = req.query;
  if (!username) return res.status(400).json({ error: "username is required" });

  try {
    // 1. Fetch archive list
    const archRes = await fetch(
      `https://api.chess.com/pub/player/${username.toLowerCase()}/games/archives`,
      { headers: { "User-Agent": "ChessLens/1.0" } }
    );
    if (!archRes.ok) {
      return res.status(404).json({ error: `Player "${username}" not found on Chess.com` });
    }
    const { archives } = await archRes.json();
    if (!archives?.length) {
      return res.status(404).json({ error: "No games found for this player" });
    }

    // 2. Fetch most recent month
    const latestUrl = archives[archives.length - 1];
    const gamesRes = await fetch(latestUrl, {
      headers: { "User-Agent": "ChessLens/1.0" },
    });
    if (!gamesRes.ok) {
      return res.status(500).json({ error: "Could not fetch games" });
    }
    const { games } = await gamesRes.json();

    // 3. Return last 20 finished standard chess games
    const filtered = games
      .filter((g) => g.pgn && g.rules === "chess")
      .slice(-20)
      .reverse()
      .map((g) => ({
        white: g.white.username,
        black: g.black.username,
        whiteRating: g.white.rating,
        blackRating: g.black.rating,
        result:
          g.white.result === "win"
            ? "1-0"
            : g.black.result === "win"
            ? "0-1"
            : "1/2-1/2",
        pgn: g.pgn,
        opening:
          g.pgn
            .match(/\[ECOUrl "[^"]*\/([^"/]+)"\]/)?.[1]
            ?.replace(/-/g, " ") || "Unknown Opening",
        platform: "chess.com",
        url: g.url,
        timeClass: g.time_class,
        endTime: g.end_time,
      }));

    return res.status(200).json({ games: filtered });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
}
