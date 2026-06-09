import { useState } from "react";

// ── Piece glyphs ──────────────────────────────────────────────────────────────
const PIECES = {
  K:"♔",Q:"♕",R:"♖",B:"♗",N:"♘",P:"♙",
  k:"♚",q:"♛",r:"♜",b:"♝",n:"♞",p:"♟",
};
const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const RESULT_LABELS = { "1-0":"White wins","0-1":"Black wins","1/2-1/2":"Draw" };

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseFEN(fen = INITIAL_FEN) {
  return fen.split(" ")[0].split("/").map(row => {
    const line = [];
    for (const ch of row) isNaN(ch) ? line.push(ch) : line.push(...Array(+ch).fill(null));
    return line;
  });
}

function parseMoves(pgn = "") {
  return pgn
    .replace(/\{[^}]*\}/g,"").replace(/\([^)]*\)/g,"")
    .replace(/\d+\./g," ").replace(/1-0|0-1|1\/2-1\/2|\*/g,"")
    .trim().split(/\s+/).filter(Boolean);
}

function timeAgo(ts) {
  const s = Math.floor(Date.now()/1000 - ts);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

function rc(r) {
  return r==="1-0" ? "#4ade80" : r==="0-1" ? "#f87171" : "#facc15";
}

// ── API calls ─────────────────────────────────────────────────────────────────
async function fetchChesscomGames(username) {
  // Calls our own /api/chess serverless function — no CORS issue
  const res = await fetch(`/api/chess?username=${encodeURIComponent(username)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch games");
  return data.games.map(g => ({ ...g, moves: parseMoves(g.pgn) }));
}

async function fetchLichessGame(url) {
  const m = url.match(/lichess\.org\/([a-zA-Z0-9]{8})/);
  if (!m) throw new Error("Invalid Lichess URL — paste a link like lichess.org/abc12345");
  const res = await fetch(`https://lichess.org/api/game/${m[1]}?moves=true&pgnInJson=true`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error("Game not found on Lichess");
  const d = await res.json();
  const moves = parseMoves(d.moves || "");
  return [{
    white: d.players?.white?.user?.name || "White",
    black: d.players?.black?.user?.name || "Black",
    whiteRating: d.players?.white?.rating,
    blackRating: d.players?.black?.rating,
    result: d.winner==="white"?"1-0":d.winner==="black"?"0-1":"1/2-1/2",
    pgn: d.moves||"", moves,
    opening: d.opening?.name||"Unknown Opening",
    platform:"lichess", url:`https://lichess.org/${m[1]}`,
    timeClass: d.speed, endTime: Math.floor(d.lastMoveAt/1000),
  }];
}

async function getAIAnalysis(game) {
  const prompt = `You are a grandmaster chess coach. Analyze this game. Return ONLY valid JSON, no markdown.

White: ${game.white}${game.whiteRating?` (${game.whiteRating})`:""}
Black: ${game.black}${game.blackRating?` (${game.blackRating})`:""}
Result: ${game.result}
Opening: ${game.opening}
Moves: ${game.moves.slice(0,60).join(" ")}${game.moves.length>60?" ...":""}

JSON shape:
{
  "summary": "2-3 sentence overview",
  "opening_comment": "how the opening was handled",
  "key_moments": [
    {"phase":"Opening|Middlegame|Endgame","move":"e.g. 15. Nd5","comment":"why it mattered"},
    {"phase":"Opening|Middlegame|Endgame","move":"e.g. 24. Rxf7","comment":"why it mattered"},
    {"phase":"Opening|Middlegame|Endgame","move":"e.g. 31. Qh6","comment":"why it mattered"}
  ],
  "white_play": "what white did well or poorly",
  "black_play": "what black did well or poorly",
  "decisive_factor": "one sentence on what decided the game",
  "lesson": "the single most important takeaway",
  "white_score": 7,
  "black_score": 5
}`;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({
      model:"claude-sonnet-4-20250514", max_tokens:1000,
      messages:[{role:"user",content:prompt}],
    }),
  });
  const data = await res.json();
  const text = data.content.map(b=>b.text||"").join("");
  return JSON.parse(text.replace(/```json|```/g,"").trim());
}

// ── Components ────────────────────────────────────────────────────────────────
function Board({ flipped }) {
  const board = parseFEN(INITIAL_FEN);
  const ranks = flipped ? board : [...board].reverse();
  const files = flipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];
  const fileLabels = ["a","b","c","d","e","f","g","h"];
  const rankNums = flipped ? ["1","2","3","4","5","6","7","8"] : ["8","7","6","5","4","3","2","1"];
  return (
    <div style={{display:"inline-block",borderRadius:6,overflow:"hidden",boxShadow:"0 12px 40px rgba(0,0,0,0.5)",border:"2px solid #2d2d44"}}>
      {ranks.map((row,ri)=>(
        <div key={ri} style={{display:"flex"}}>
          <div style={{width:18,display:"flex",alignItems:"center",justifyContent:"center",background:"#1e1e30",color:"#555",fontSize:10,fontFamily:"monospace"}}>{rankNums[ri]}</div>
          {files.map(fi=>{
            const p=row[fi]; const light=(ri+fi)%2===(flipped?1:0);
            return (
              <div key={fi} style={{width:56,height:56,background:light?"#f0d9b5":"#b58863",display:"flex",alignItems:"center",justifyContent:"center",fontSize:38,userSelect:"none"}}>
                {p&&<span style={{color:p===p.toUpperCase()?"#fff":"#111",textShadow:p===p.toUpperCase()?"0 1px 4px rgba(0,0,0,0.9),0 0 2px #000":"0 1px 2px rgba(255,255,255,0.6)",lineHeight:1}}>{PIECES[p]}</span>}
              </div>
            );
          })}
        </div>
      ))}
      <div style={{display:"flex",background:"#1e1e30"}}>
        <div style={{width:18}}/>
        {files.map(fi=><div key={fi} style={{width:56,height:18,display:"flex",alignItems:"center",justifyContent:"center",color:"#555",fontSize:10,fontFamily:"monospace"}}>{fileLabels[fi]}</div>)}
      </div>
    </div>
  );
}

function MoveList({ moves, current, onSelect }) {
  const pairs=[];
  for(let i=0;i<moves.length;i+=2) pairs.push([Math.floor(i/2)+1,moves[i],moves[i+1],i]);
  return (
    <div style={{height:200,overflowY:"auto",fontFamily:"monospace",fontSize:12,padding:"4px 0"}}>
      {pairs.map(([num,w,b,i])=>(
        <div key={num} style={{display:"flex",alignItems:"center",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
          <span style={{width:28,color:"#444",paddingLeft:4}}>{num}.</span>
          <span onClick={()=>onSelect(i)} style={{flex:1,padding:"3px 6px",borderRadius:4,cursor:"pointer",background:current===i?"rgba(99,102,241,0.3)":"transparent",color:current===i?"#fff":"#aaa",fontWeight:current===i?700:400}}>{w}</span>
          {b&&<span onClick={()=>onSelect(i+1)} style={{flex:1,padding:"3px 6px",borderRadius:4,cursor:"pointer",background:current===i+1?"rgba(99,102,241,0.3)":"transparent",color:current===i+1?"#fff":"#aaa",fontWeight:current===i+1?700:400}}>{b}</span>}
        </div>
      ))}
    </div>
  );
}

function ScoreBar({ label, score, color }) {
  return (
    <div style={{marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
        <span style={{fontSize:12,color:"#718096"}}>{label}</span>
        <span style={{fontSize:12,fontWeight:700,color}}>{score}/10</span>
      </div>
      <div style={{height:5,background:"rgba(255,255,255,0.08)",borderRadius:3,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${score*10}%`,background:color,borderRadius:3,transition:"width 1.2s ease"}}/>
      </div>
    </div>
  );
}

function GameCard({ game, selected, onClick }) {
  return (
    <div onClick={onClick} style={{padding:"11px 13px",borderRadius:8,cursor:"pointer",marginBottom:5,background:selected?"rgba(99,102,241,0.18)":"rgba(255,255,255,0.03)",border:`1px solid ${selected?"rgba(99,102,241,0.4)":"rgba(255,255,255,0.07)"}`,transition:"all 0.15s"}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
        <span style={{fontSize:10,color:"#555",textTransform:"capitalize"}}>{game.timeClass}{game.endTime?` · ${timeAgo(game.endTime)}`:""}</span>
        <span style={{fontSize:10,fontWeight:700,color:rc(game.result)}}>{RESULT_LABELS[game.result]||game.result}</span>
      </div>
      <div style={{fontSize:12,color:game.result==="1-0"?"#e2e8f0":"#888",fontWeight:game.result==="1-0"?600:400}}>♔ {game.white}{game.whiteRating?` (${game.whiteRating})`:""}</div>
      <div style={{fontSize:12,color:game.result==="0-1"?"#e2e8f0":"#888",fontWeight:game.result==="0-1"?600:400}}>♚ {game.black}{game.blackRating?` (${game.blackRating})`:""}</div>
      <div style={{fontSize:10,color:"#444",marginTop:3}}>{game.opening}</div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [mode, setMode] = useState("chess");
  const [input, setInput] = useState("");
  const [gameList, setGameList] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [currentMove, setCurrentMove] = useState(-1);
  const [flipped, setFlipped] = useState(false);
  const [loadingGames, setLoadingGames] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("board");

  const game = selectedIdx !== null ? gameList[selectedIdx] : null;
  const moves = game?.moves || [];

  async function handleFetch() {
    setError(""); setGameList([]); setSelectedIdx(null); setAnalysis(null);
    if (!input.trim()) return;
    setLoadingGames(true);
    try {
      const games = mode==="chess"
        ? await fetchChesscomGames(input.trim())
        : await fetchLichessGame(input.trim());
      setGameList(games);
      if (games.length) {
        setSelectedIdx(0);
        setCurrentMove(games[0].moves.length-1);
        setLoadingAI(true);
        const ai = await getAIAnalysis(games[0]);
        setAnalysis(ai);
        setLoadingAI(false);
      }
    } catch(e) { setError(e.message); }
    setLoadingGames(false);
  }

  async function handleSelectGame(idx) {
    setSelectedIdx(idx); setAnalysis(null);
    setCurrentMove(gameList[idx].moves.length-1);
    setLoadingAI(true);
    try { setAnalysis(await getAIAnalysis(gameList[idx])); }
    catch(e) { setError("AI analysis failed: "+e.message); }
    setLoadingAI(false);
  }

  return (
    <div style={{minHeight:"100vh",background:"#0e0e1a",color:"#e2e8f0",fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
      {/* Header */}
      <div style={{borderBottom:"1px solid rgba(255,255,255,0.06)",padding:"15px 28px",display:"flex",alignItems:"center",gap:12}}>
        <span style={{fontSize:26}}>♟</span>
        <div>
          <div style={{fontWeight:900,fontSize:20,letterSpacing:"-0.5px",color:"#fff"}}>Chess<span style={{color:"#818cf8"}}>Lens</span></div>
          <div style={{fontSize:11,color:"#444"}}>AI-powered game analysis · Chess.com & Lichess</div>
        </div>
      </div>

      <div style={{maxWidth:1180,margin:"0 auto",padding:"24px 20px",display:"flex",gap:20,flexWrap:"wrap"}}>

        {/* Left panel */}
        <div style={{flex:"0 0 290px",minWidth:250}}>
          {/* Mode toggle */}
          <div style={{display:"flex",background:"rgba(255,255,255,0.05)",borderRadius:8,padding:3,marginBottom:12}}>
            {[["chess","Chess.com"],["lichess","Lichess"]].map(([m,l])=>(
              <button key={m} onClick={()=>{setMode(m);setInput("");setGameList([]);setSelectedIdx(null);setAnalysis(null);setError("");}} style={{flex:1,padding:"7px 0",borderRadius:6,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,background:mode===m?"#818cf8":"transparent",color:mode===m?"#fff":"#666",transition:"all 0.2s"}}>{l}</button>
            ))}
          </div>

          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleFetch()}
            placeholder={mode==="chess"?"Chess.com username":"https://lichess.org/abc12345"}
            style={{width:"100%",boxSizing:"border-box",padding:"11px 14px",borderRadius:8,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",color:"#e2e8f0",fontSize:13,outline:"none",marginBottom:8}}
          />
          <button onClick={handleFetch} disabled={loadingGames||!input.trim()} style={{width:"100%",padding:"10px 0",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,background:loadingGames?"#2d2d44":"linear-gradient(135deg,#818cf8,#6366f1)",color:"#fff",opacity:!input.trim()?0.5:1,marginBottom:12}}>
            {loadingGames?"Loading…":mode==="chess"?"Fetch Recent Games":"Analyze Game"}
          </button>

          {error&&<div style={{padding:"10px 14px",borderRadius:8,background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.25)",color:"#f87171",fontSize:12,marginBottom:12}}>⚠ {error}</div>}

          {gameList.length>0&&(
            <div>
              <div style={{fontSize:10,color:"#555",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:7}}>{gameList.length} recent games</div>
              <div style={{maxHeight:500,overflowY:"auto"}}>
                {gameList.map((g,i)=><GameCard key={i} game={g} selected={selectedIdx===i} onClick={()=>handleSelectGame(i)}/>)}
              </div>
            </div>
          )}

          {!gameList.length&&!loadingGames&&!error&&(
            <div style={{padding:"28px 0",textAlign:"center",color:"#333"}}>
              <div style={{fontSize:38,marginBottom:10}}>♜</div>
              <div style={{fontSize:12,lineHeight:1.6}}>{mode==="chess"?"Enter a Chess.com username\nto load recent games":"Paste a Lichess game URL\nto analyze it"}</div>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div style={{flex:1,minWidth:300}}>
          {game ? (
            <>
              {/* Player header */}
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,padding:"13px 16px",background:"rgba(255,255,255,0.03)",borderRadius:10,border:"1px solid rgba(255,255,255,0.06)"}}>
                <div style={{textAlign:"center",minWidth:80}}>
                  <div style={{fontSize:20}}>♔</div>
                  <div style={{fontSize:13,fontWeight:700,color:game.result==="1-0"?"#4ade80":"#e2e8f0"}}>{game.white}</div>
                  {game.whiteRating&&<div style={{fontSize:11,color:"#555"}}>{game.whiteRating}</div>}
                </div>
                <div style={{flex:1,textAlign:"center"}}>
                  <div style={{fontSize:11,color:"#555",marginBottom:3}}>{game.opening}</div>
                  <div style={{fontSize:22,fontWeight:900,color:rc(game.result)}}>{game.result}</div>
                  <div style={{fontSize:11,color:"#444"}}>{moves.length} moves · {game.timeClass}</div>
                  {game.url&&<a href={game.url} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#818cf8",textDecoration:"none"}}>View on {game.platform} ↗</a>}
                </div>
                <div style={{textAlign:"center",minWidth:80}}>
                  <div style={{fontSize:20}}>♚</div>
                  <div style={{fontSize:13,fontWeight:700,color:game.result==="0-1"?"#4ade80":"#e2e8f0"}}>{game.black}</div>
                  {game.blackRating&&<div style={{fontSize:11,color:"#555"}}>{game.blackRating}</div>}
                </div>
              </div>

              <div style={{display:"flex",gap:18,flexWrap:"wrap"}}>
                {/* Board */}
                <div style={{flex:"0 0 auto"}}>
                  <div style={{display:"flex",gap:5,marginBottom:10,alignItems:"center"}}>
                    {["board","moves"].map(t=>(
                      <button key={t} onClick={()=>setTab(t)} style={{padding:"5px 13px",borderRadius:6,border:"none",cursor:"pointer",fontSize:11,fontWeight:600,background:tab===t?"#818cf8":"rgba(255,255,255,0.06)",color:tab===t?"#fff":"#666"}}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>
                    ))}
                    <button onClick={()=>setFlipped(f=>!f)} style={{marginLeft:"auto",padding:"5px 11px",borderRadius:6,border:"1px solid rgba(255,255,255,0.08)",background:"transparent",color:"#555",fontSize:11,cursor:"pointer"}}>⇅ Flip</button>
                  </div>

                  {tab==="board"
                    ? <Board flipped={flipped}/>
                    : <div style={{width:466,background:"rgba(255,255,255,0.03)",borderRadius:8,padding:"10px 12px",border:"1px solid rgba(255,255,255,0.07)"}}><MoveList moves={moves} current={currentMove} onSelect={setCurrentMove}/></div>
                  }

                  <div style={{display:"flex",justifyContent:"center",gap:5,marginTop:8}}>
                    {[["⏮",-1],["◀",currentMove-1],["▶",currentMove+1],["⏭",moves.length-1]].map(([l,t])=>(
                      <button key={l} onClick={()=>setCurrentMove(Math.max(-1,Math.min(moves.length-1,t)))} style={{width:36,height:32,borderRadius:6,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.04)",color:"#888",fontSize:12,cursor:"pointer"}}>{l}</button>
                    ))}
                  </div>
                  <div style={{textAlign:"center",marginTop:5,fontSize:11,color:"#444"}}>
                    {currentMove===-1?"Start":moves[currentMove]?`Move ${currentMove+1}: ${moves[currentMove]}`:"End"}
                  </div>
                </div>

                {/* AI Panel */}
                <div style={{flex:1,minWidth:240}}>
                  {loadingAI&&(
                    <div style={{padding:32,textAlign:"center",color:"#555"}}>
                      <div style={{fontSize:34,display:"inline-block",animation:"spin 2s linear infinite",marginBottom:10}}>♛</div>
                      <div style={{fontSize:13}}>Claude is analyzing…</div>
                      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
                    </div>
                  )}
                  {analysis&&!loadingAI&&(
                    <div style={{display:"flex",flexDirection:"column",gap:10}}>
                      <div style={{padding:"13px 15px",background:"rgba(129,140,248,0.08)",border:"1px solid rgba(129,140,248,0.2)",borderRadius:10}}>
                        <div style={{fontSize:10,color:"#818cf8",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:5}}>Overview</div>
                        <p style={{margin:0,fontSize:13,lineHeight:1.65,color:"#c8d6e5"}}>{analysis.summary}</p>
                      </div>
                      <div style={{padding:"11px 15px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10}}>
                        <div style={{fontSize:10,color:"#555",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:9}}>Performance</div>
                        <ScoreBar label={`${game.white} (White)`} score={analysis.white_score||5} color="#facc15"/>
                        <ScoreBar label={`${game.black} (Black)`} score={analysis.black_score||5} color="#60a5fa"/>
                      </div>
                      <div style={{padding:"11px 15px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10}}>
                        <div style={{fontSize:10,color:"#555",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:9}}>Key Moments</div>
                        {analysis.key_moments?.map((m,i)=>(
                          <div key={i} style={{marginBottom:9,paddingLeft:9,borderLeft:"2px solid #818cf8"}}>
                            <div style={{display:"flex",gap:6,marginBottom:2}}>
                              <span style={{fontSize:9,color:"#818cf8",fontWeight:700,textTransform:"uppercase"}}>{m.phase}</span>
                              <span style={{fontSize:11,color:"#6366f1",fontFamily:"monospace"}}>{m.move}</span>
                            </div>
                            <div style={{fontSize:12,color:"#9ca3af",lineHeight:1.5}}>{m.comment}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                        {[{l:"White's Play",t:analysis.white_play,c:"#facc15",i:"♔"},{l:"Black's Play",t:analysis.black_play,c:"#60a5fa",i:"♚"}].map(({l,t,c,i})=>(
                          <div key={l} style={{padding:"11px 13px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10}}>
                            <div style={{fontSize:10,color:c,fontWeight:700,marginBottom:5}}>{i} {l}</div>
                            <div style={{fontSize:12,color:"#9ca3af",lineHeight:1.5}}>{t}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{padding:"11px 15px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10}}>
                        <div style={{fontSize:10,color:"#555",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:5}}>⚡ Decisive Factor</div>
                        <div style={{fontSize:13,color:"#c8d6e5"}}>{analysis.decisive_factor}</div>
                      </div>
                      <div style={{padding:"13px 15px",background:"rgba(74,222,128,0.06)",border:"1px solid rgba(74,222,128,0.2)",borderRadius:10}}>
                        <div style={{fontSize:10,color:"#4ade80",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:5}}>💡 Key Lesson</div>
                        <div style={{fontSize:13,color:"#c8d6e5",lineHeight:1.6,fontStyle:"italic"}}>{analysis.lesson}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div style={{padding:"80px 0",textAlign:"center",color:"#333"}}>
              <div style={{fontSize:70,marginBottom:14,opacity:0.25}}>♝</div>
              <div style={{fontSize:15,color:"#555",marginBottom:5}}>Select a game to analyze</div>
              <div style={{fontSize:12,color:"#3a3a4a"}}>Enter a Chess.com username or Lichess URL on the left</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
