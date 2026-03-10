import { useState, useCallback } from "react";

// ─── helpers ──────────────────────────────────────────────────────────────────
const getVideoId = (url) => {
  const r = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/;
  const m = url.match(r);
  return m ? m[1] : null;
};

const thumbUrls = (id) => [
  { label: "Max Res · 1280×720", url: `https://img.youtube.com/vi/${id}/maxresdefault.jpg`, tag: "MAX" },
  { label: "High Quality · 480×360", url: `https://img.youtube.com/vi/${id}/hqdefault.jpg`, tag: "HQ"  },
  { label: "Medium · 320×180",   url: `https://img.youtube.com/vi/${id}/mqdefault.jpg`,    tag: "MQ"  },
  { label: "Standard · 640×480", url: `https://img.youtube.com/vi/${id}/sddefault.jpg`,    tag: "SD"  },
];

// ─── Invidious instances — used as LINK HOSTS, not fetched ───────────────────
// These generate direct proxy download URLs via /latest_version endpoint
// The browser (not JS) hits these URLs when user clicks — bypasses sandbox block
const INV_INSTANCES = [
  "https://invidious.nerdvpn.de",
  "https://invidious.kavin.rocks",
  "https://yewtu.be",
  "https://inv.riverside.rocks",
  "https://yt.artemislena.eu",
  "https://invidious.sethforprivacy.com",
];

// ─── YouTube itag → quality info ─────────────────────────────────────────────
// itag 22  = 720p MP4  (video+audio, most compatible)
// itag 18  = 360p MP4  (video+audio, universal)
// itag 137 = 1080p MP4 video only (needs muxing — not ideal for direct DL)
// itag 140 = 128kbps M4A audio only
// itag 251 = 160kbps Opus audio only (WebM)
// itag 250 = 64kbps  Opus audio only
// itag 171 = 128kbps Vorbis audio only

const VIDEO_STREAMS = [
  { itag: 22,  label: "720p",  desc: "HD 720p · MP4 · Video + Audio", ext: "mp4", recommended: true },
  { itag: 18,  label: "360p",  desc: "360p · MP4 · Video + Audio · Smallest file", ext: "mp4" },
];

const AUDIO_STREAMS = [
  { itag: 140, label: "128 kbps M4A", desc: "High quality · M4A · Best compatibility", ext: "m4a", recommended: true },
  { itag: 251, label: "160 kbps Opus", desc: "Highest quality · WebM/Opus",              ext: "webm" },
  { itag: 250, label: "64 kbps Opus",  desc: "Smaller file · WebM/Opus",                 ext: "webm" },
];

// Build a direct Invidious proxy download URL — clicked by browser, not fetched by JS
const buildInvUrl = (instance, videoId, itag) =>
  `${instance}/latest_version?id=${videoId}&itag=${itag}&local=true`;

// ─── Claude AI ────────────────────────────────────────────────────────────────
const callClaude = async (prompt, sys = "") => {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514", max_tokens: 1000,
      system: sys || "You are a helpful YouTube content assistant.",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const d = await res.json();
  return d.content?.[0]?.text || "";
};

// ─── TABS ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "thumbnail",  icon: "🖼️", label: "Thumbnail"  },
  { id: "download",   icon: "⬇️", label: "Download"   },
  { id: "mp3",        icon: "🎵", label: "MP3"         },
  { id: "shorts",     icon: "📱", label: "Shorts"      },
  { id: "transcribe", icon: "📝", label: "Transcribe"  },
  { id: "keywords",   icon: "🔑", label: "Keywords"    },
];

// ─── STYLES ───────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600;700&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :root{
    --bg:#09090b;--s1:#111113;--s2:#17171b;--b1:#1f1f27;--b2:#2d2d3a;
    --red:#ff2d2d;--rdim:rgba(255,45,45,.12);--rglow:rgba(255,45,45,.28);
    --org:#ff6b35;--grn:#22c55e;--gdim:rgba(34,197,94,.12);--ggl:rgba(34,197,94,.3);
    --blu:#60a5fa;--bdim:rgba(96,165,250,.1);--bgl:rgba(96,165,250,.25);
    --pur:#a78bfa;--pdim:rgba(167,139,250,.1);--pgl:rgba(167,139,250,.25);
    --txt:#eeeef4;--mut:#52526a;
    --mono:'DM Mono',monospace;--sans:'DM Sans',sans-serif;--disp:'Bebas Neue',sans-serif;
  }
  body{background:var(--bg);color:var(--txt);font-family:var(--sans);min-height:100vh}
  .app{max-width:920px;margin:0 auto;padding:28px 16px 72px}

  .hdr{text-align:center;margin-bottom:36px;position:relative}
  .hdr::before{content:'';position:absolute;top:50%;left:0;right:0;height:1px;
    background:linear-gradient(90deg,transparent,var(--red) 30%,var(--red) 70%,transparent);opacity:.2}
  .hdr-in{position:relative;z-index:1;display:inline-block;background:var(--bg);padding:0 28px}
  .logo{font-family:var(--disp);font-size:clamp(38px,9vw,68px);letter-spacing:5px;line-height:1;
    background:linear-gradient(135deg,#fff 0%,var(--org) 50%,var(--red) 100%);
    -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
  .tagline{font-family:var(--mono);font-size:10px;color:var(--mut);letter-spacing:3px;text-transform:uppercase;margin-top:6px}

  .url-wrap{display:flex;gap:8px;background:var(--s1);border:1px solid var(--b2);
    border-radius:12px;padding:6px 6px 6px 16px;transition:border-color .2s,box-shadow .2s}
  .url-wrap:focus-within{border-color:var(--red);box-shadow:0 0 0 3px var(--rdim)}
  .url-in{flex:1;background:none;border:none;outline:none;color:var(--txt);font-family:var(--mono);font-size:13px;padding:8px 0}
  .url-in::placeholder{color:var(--mut)}
  .abtn{background:var(--red);color:#fff;border:none;border-radius:8px;padding:10px 22px;
    font-family:var(--sans);font-weight:700;font-size:13px;cursor:pointer;transition:all .15s;white-space:nowrap}
  .abtn:hover{background:#e02020;transform:translateY(-1px)}
  .abtn:disabled{opacity:.5;cursor:not-allowed;transform:none}

  .vcard{display:flex;gap:16px;background:var(--s1);border:1px solid var(--b2);
    border-radius:12px;padding:14px;margin-top:16px;animation:sli .3s ease}
  @keyframes sli{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  .vth{width:128px;min-width:128px;height:72px;border-radius:8px;object-fit:cover;border:1px solid var(--b1)}
  .vmeta{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:7px}
  .vtit{font-weight:600;font-size:14px;word-break:break-all}
  .vbadge{display:flex;align-items:center;gap:7px;font-family:var(--mono);font-size:10px}
  .vid-tag{background:var(--rdim);color:var(--red);border:1px solid var(--rglow);padding:2px 8px;border-radius:4px}
  .ok-tag{background:var(--gdim);color:var(--grn);border:1px solid var(--ggl);padding:2px 8px;border-radius:4px}

  .tabs{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin:22px 0}
  @media(max-width:560px){.tabs{grid-template-columns:repeat(3,1fr)}}
  .tb{background:var(--s1);border:1px solid var(--b1);border-radius:9px;padding:10px 4px;
    cursor:pointer;color:var(--mut);font-family:var(--sans);font-size:11px;font-weight:500;
    transition:all .15s;display:flex;flex-direction:column;align-items:center;gap:5px}
  .tb .ti{font-size:20px}
  .tb:hover{border-color:var(--b2);color:var(--txt)}
  .tb.on{background:var(--rdim);border-color:var(--red);color:var(--red);box-shadow:0 0 14px var(--rdim)}

  .panel{background:var(--s1);border:1px solid var(--b2);border-radius:14px;padding:26px;min-height:340px;animation:fad .2s ease}
  @keyframes fad{from{opacity:0}to{opacity:1}}
  .ptit{font-family:var(--disp);font-size:22px;letter-spacing:2px;margin-bottom:20px;display:flex;align-items:center;gap:10px}
  .slabel{font-family:var(--mono);font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--mut);margin-bottom:10px}

  /* HOW IT WORKS BANNER */
  .how-banner{display:flex;align-items:flex-start;gap:12px;background:var(--bdim);
    border:1px solid var(--bgl);border-radius:10px;padding:14px 16px;margin-bottom:20px}
  .how-icon{font-size:22px;flex-shrink:0;margin-top:1px}
  .how-text{font-family:var(--mono);font-size:11px;color:var(--blu);line-height:1.65}
  .how-text strong{color:#93c5fd}

  /* STREAM SECTION */
  .stream-section{margin-bottom:24px}
  .section-head{display:flex;align-items:center;gap:10px;margin-bottom:12px}
  .section-title{font-weight:700;font-size:14px}
  .section-badge{font-family:var(--mono);font-size:10px;padding:2px 8px;border-radius:4px}
  .sb-vid{background:var(--rdim);color:var(--red);border:1px solid var(--rglow)}
  .sb-aud{background:var(--gdim);color:var(--grn);border:1px solid var(--ggl)}

  /* STREAM CARD */
  .sc{background:var(--s2);border:1px solid var(--b2);border-radius:11px;padding:16px;
    margin-bottom:10px;transition:border-color .2s}
  .sc.recommended{border-color:rgba(34,197,94,.3);background:rgba(34,197,94,.03)}
  .sc-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
  .sc-info{}
  .sc-q{font-weight:700;font-size:16px;margin-bottom:3px;display:flex;align-items:center;gap:8px}
  .rec-badge{background:var(--gdim);color:var(--grn);border:1px solid var(--ggl);
    font-family:var(--mono);font-size:9px;padding:2px 7px;border-radius:4px;font-weight:500}
  .sc-desc{font-family:var(--mono);font-size:11px;color:var(--mut)}

  /* INSTANCE BUTTONS */
  .inst-label{font-family:var(--mono);font-size:10px;color:var(--mut);letter-spacing:1px;margin-bottom:7px;text-transform:uppercase}
  .inst-grid{display:flex;flex-wrap:wrap;gap:7px}
  .inst-btn{display:inline-flex;align-items:center;gap:6px;padding:7px 13px;border-radius:7px;
    font-family:var(--sans);font-weight:600;font-size:12px;text-decoration:none;
    transition:all .15s;border:1px solid transparent;cursor:pointer}
  .inst-btn.video{background:var(--rdim);color:var(--red);border-color:var(--rglow)}
  .inst-btn.video:hover{background:var(--red);color:#fff}
  .inst-btn.audio{background:var(--gdim);color:var(--grn);border-color:var(--ggl)}
  .inst-btn.audio:hover{background:var(--grn);color:#fff}
  .inst-btn.visited{opacity:.5}
  .inst-name{font-family:var(--mono);font-size:10px;opacity:.7}

  /* TIP BOX */
  .tip-box{background:var(--ydim,rgba(251,191,36,.08));border:1px solid rgba(251,191,36,.2);
    border-radius:8px;padding:11px 14px;font-family:var(--mono);font-size:11px;
    color:#fbbf24;line-height:1.65;margin-top:4px}

  /* THUMBNAILS */
  .tgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
  .tcard{position:relative;border:1px solid var(--b1);border-radius:10px;overflow:hidden;
    cursor:pointer;background:#000;transition:border-color .2s,transform .2s}
  .tcard:hover{border-color:var(--red);transform:translateY(-2px)}
  .tcard img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block}
  .ttag{position:absolute;top:8px;right:8px;background:var(--red);color:#fff;
    font-family:var(--mono);font-size:9px;padding:2px 7px;border-radius:4px}
  .tov{position:absolute;bottom:0;left:0;right:0;
    background:linear-gradient(transparent,rgba(0,0,0,.85));padding:20px 10px 10px;
    display:flex;align-items:flex-end;justify-content:space-between;opacity:0;transition:opacity .2s}
  .tcard:hover .tov{opacity:1}
  .tinf{font-size:11px;color:#fff}
  .tsbtn{background:var(--red);color:#fff;border:none;border-radius:5px;padding:5px 10px;
    font-size:11px;font-family:var(--sans);font-weight:600;cursor:pointer}

  /* AI */
  .ai-out{background:var(--s2);border:1px solid var(--b1);border-radius:10px;padding:20px;
    font-family:var(--mono);font-size:12px;line-height:1.75;color:var(--txt);
    white-space:pre-wrap;min-height:160px;max-height:440px;overflow-y:auto}
  .ai-out::-webkit-scrollbar{width:4px}
  .ai-out::-webkit-scrollbar-thumb{background:var(--b2);border-radius:2px}
  .run-btn{display:inline-flex;align-items:center;gap:8px;
    background:linear-gradient(135deg,var(--red),var(--org));color:#fff;border:none;
    border-radius:9px;padding:12px 26px;font-family:var(--sans);font-weight:700;font-size:13px;
    cursor:pointer;transition:all .2s;margin-bottom:16px}
  .run-btn:hover{transform:translateY(-2px);box-shadow:0 8px 24px var(--rglow)}
  .run-btn:disabled{opacity:.5;cursor:not-allowed;transform:none;box-shadow:none}
  .cpbtn{background:none;border:1px solid var(--b2);color:var(--mut);border-radius:6px;
    padding:5px 14px;font-size:11px;font-family:var(--mono);cursor:pointer;transition:all .15s;margin-top:10px}
  .cpbtn:hover{border-color:var(--red);color:var(--red)}
  .kw-cloud{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}
  .kw{background:var(--rdim);border:1px solid var(--rglow);color:var(--red);
    padding:5px 12px;border-radius:20px;font-family:var(--mono);font-size:12px;
    animation:pop .2s ease backwards}
  @keyframes pop{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:scale(1)}}
  .empty{display:flex;flex-direction:column;align-items:center;justify-content:center;
    height:240px;color:var(--mut);gap:12px;text-align:center}
  .ei{font-size:52px;opacity:.35}
  .et{font-family:var(--mono);font-size:11px;line-height:1.7}
  .spin{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.3);
    border-top-color:#fff;border-radius:50%;animation:sp .65s linear infinite}
  @keyframes sp{to{transform:rotate(360deg)}}
  .mrow{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
  .mb{background:var(--s2);border:1px solid var(--b1);color:var(--mut);border-radius:8px;
    padding:8px 16px;font-family:var(--sans);font-size:12px;font-weight:500;cursor:pointer;transition:all .15s}
  .mb.on{background:var(--rdim);border-color:var(--red);color:var(--red)}
  .inote{background:rgba(255,107,53,.08);border:1px solid rgba(255,107,53,.2);border-radius:8px;
    padding:10px 14px;font-family:var(--mono);font-size:11px;color:#ff9060;line-height:1.6;margin-bottom:16px}
  .divider{height:1px;background:var(--b1);margin:16px 0}
  .sg{display:grid;grid-template-columns:140px 1fr;gap:20px;align-items:start;margin-bottom:16px}
  .phone{width:140px;height:248px;background:#000;border:2px solid var(--b2);border-radius:22px;overflow:hidden;position:relative}
  .pimg{width:100%;height:100%;object-fit:cover}
  .pov{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,.1),rgba(0,0,0,.65));
    display:flex;align-items:flex-end;padding:14px 10px}
  .plbl{font-size:9px;font-weight:700;color:#fff;line-height:1.4}
  .sbox{display:flex;align-items:flex-start;gap:10px;border-radius:9px;padding:12px 16px;
    font-family:var(--mono);font-size:12px;margin-bottom:14px;line-height:1.55}
  .sbox.info{background:var(--bdim);border:1px solid var(--bgl);color:var(--blu)}
`;

// ─── EMPTY ────────────────────────────────────────────────────────────────────
const Empty = ({ msg, icon }) => (
  <div className="empty"><div className="ei">{icon}</div><div className="et">{msg}</div></div>
);

// ─── DOWNLOAD PANEL ───────────────────────────────────────────────────────────
// Key insight: <a href="invidious-url" download> is clicked by the BROWSER,
// not fetched by JS — so sandbox network restrictions don't apply at all.
function DownloadPanel({ videoId, audioOnly = false }) {
  const [clicked, setClicked] = useState({});
  if (!videoId) return <Empty msg={audioOnly ? "Paste a YouTube URL to extract audio" : "Paste a YouTube URL to download video"} icon={audioOnly ? "🎵" : "⬇️"} />;

  const streams = audioOnly ? AUDIO_STREAMS : VIDEO_STREAMS;
  const type    = audioOnly ? "audio" : "video";

  const markClicked = (key) => {
    setClicked(s => ({ ...s, [key]: true }));
    setTimeout(() => setClicked(s => ({ ...s, [key]: false })), 8000);
  };

  return (
    <div>
      {/* How it works */}
      <div className="how-banner">
        <div className="how-icon">⚡</div>
        <div className="how-text">
          <strong>How this works:</strong> Each button is a direct browser download link via an Invidious mirror —
          your browser fetches the file directly (not through this sandbox). If one mirror is down, try the next one.
          <br/>No JS fetch, no API call, no popups — just click → file downloads.
        </div>
      </div>

      {streams.map((stream) => (
        <div className={`sc ${stream.recommended ? "recommended" : ""}`} key={stream.itag}>
          <div className="sc-top">
            <div className="sc-info">
              <div className="sc-q">
                {stream.label}
                {stream.recommended && <span className="rec-badge">★ Recommended</span>}
              </div>
              <div className="sc-desc">{stream.desc}</div>
            </div>
          </div>

          <div className="inst-label">Click any mirror to start download</div>
          <div className="inst-grid">
            {INV_INSTANCES.map((inst, i) => {
              const key  = `${stream.itag}-${i}`;
              const href = buildInvUrl(inst, videoId, stream.itag);
              const name = inst.replace("https://", "").split(".")[0];
              return (
                <a
                  key={key}
                  href={href}
                  download={`${type}_${videoId}_${stream.label.replace(/\s/g,"_")}.${stream.ext}`}
                  target="_blank"
                  rel="noreferrer"
                  className={`inst-btn ${type === "audio" ? "audio" : "video"} ${clicked[key] ? "visited" : ""}`}
                  onClick={() => markClicked(key)}
                >
                  ⬇ Mirror {i + 1}
                  <span className="inst-name">{name}</span>
                </a>
              );
            })}
          </div>
        </div>
      ))}

      <div className="tip-box">
        💡 <strong>Tips:</strong> Start with Mirror 1. If it spins for &gt;5 seconds without downloading, close that tab and try Mirror 2 or 3.
        The file goes straight to your browser's <strong>Downloads</strong> folder.
        {audioOnly && " For true MP3, rename the downloaded .m4a file or use VLC to convert."}
      </div>
    </div>
  );
}

// ─── THUMBNAIL ────────────────────────────────────────────────────────────────
function ThumbnailPanel({ videoId }) {
  const [st, setSt] = useState({});
  if (!videoId) return <Empty msg="Paste a YouTube URL above to get thumbnails" icon="🖼️" />;
  const dl = async (url, tag) => {
    setSt(s => ({ ...s, [tag]: "loading" }));
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = `thumb_${tag}_${videoId}.jpg`; a.click();
      setSt(s => ({ ...s, [tag]: "done" }));
      setTimeout(() => setSt(s => ({ ...s, [tag]: null })), 3000);
    } catch { window.open(url, "_blank"); setSt(s => ({ ...s, [tag]: null })); }
  };
  return (
    <div>
      <p className="slabel">Click any thumbnail to download instantly</p>
      <div className="tgrid">
        {thumbUrls(videoId).map(({ label, url, tag }) => (
          <div className="tcard" key={tag} onClick={() => dl(url, tag)}>
            <img src={url} alt={label} onError={e => { e.target.src = thumbUrls(videoId)[1].url; }} />
            <span className="ttag">{tag}</span>
            <div className="tov">
              <span className="tinf">{label}</span>
              <button className="tsbtn">{st[tag]==="loading"?"⏳":st[tag]==="done"?"✓ Saved!":"⬇ Save"}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SHORTS ───────────────────────────────────────────────────────────────────
function ShortsPanel({ videoId }) {
  const [out, setOut] = useState(""); const [load, setLoad] = useState(false); const [cp, setCp] = useState(false);
  if (!videoId) return <Empty msg="Paste a YouTube URL to generate Shorts strategy" icon="📱" />;
  const gen = async () => {
    setLoad(true); setOut("");
    try { setOut(await callClaude(
      `Complete YouTube Shorts strategy for: https://www.youtube.com/watch?v=${videoId}\n1. HOOK (first 3s)\n2. FULL 60-SEC SCRIPT\n3. CLIP MARKERS\n4. THUMBNAIL TEXT (3 options)\n5. CAPTION (150 chars)\n6. HASHTAGS (10)\n7. TITLE (3 options)`,
      "You are a viral YouTube Shorts strategist. Be punchy and scroll-stopping."
    )); } catch { setOut("⚠️ Error. Try again."); }
    setLoad(false);
  };
  return (
    <div>
      <div className="sg">
        <div className="phone">
          <img src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`} alt="" className="pimg"/>
          <div className="pov"><div className="plbl">📱 SHORTS<br/>60s vertical</div></div>
        </div>
        <div>
          <p className="slabel">AI Shorts Generator</p>
          <p style={{fontSize:13,color:"var(--mut)",lineHeight:1.65,marginBottom:16}}>Hook, script, clip markers, captions & hashtags — all in one.</p>
          <button className="run-btn" onClick={gen} disabled={load}>{load?<><span className="spin"/> Generating…</>:"✨ Generate Shorts Script"}</button>
        </div>
      </div>
      {out && <><div className="ai-out">{out}</div><button className="cpbtn" onClick={()=>{navigator.clipboard.writeText(out);setCp(true);setTimeout(()=>setCp(false),2000)}}>{cp?"✓ Copied!":"Copy script"}</button></>}
    </div>
  );
}

// ─── TRANSCRIBE ───────────────────────────────────────────────────────────────
function TranscribePanel({ videoId }) {
  const [out, setOut] = useState(""); const [load, setLoad] = useState(false);
  const [mode, setMode] = useState("summary"); const [cp, setCp] = useState(false);
  if (!videoId) return <Empty msg="Paste a YouTube URL to get a transcript outline" icon="📝" />;
  const gen = async () => {
    setLoad(true); setOut("");
    try {
      const p = mode==="summary"
        ? `Transcript outline for: https://www.youtube.com/watch?v=${videoId}\nIntro hook, main topics with timestamps, key points, notable quotes, conclusion.`
        : `Chapter outline for: https://www.youtube.com/watch?v=${videoId}\nChapters with timestamps, sub-topics, key moments, navigation guide.`;
      setOut(await callClaude(p,"You are an expert content analyst."));
    } catch { setOut("⚠️ Error. Try again."); }
    setLoad(false);
  };
  return (
    <div>
      <div className="inote">💡 For exact captions use YouTube's CC button. Claude generates an intelligent outline.</div>
      <div className="mrow">
        {[{id:"summary",l:"📋 Content Summary"},{id:"outline",l:"📑 Chapter Outline"}].map(m=>(
          <button key={m.id} className={`mb ${mode===m.id?"on":""}`} onClick={()=>setMode(m.id)}>{m.l}</button>
        ))}
      </div>
      <button className="run-btn" onClick={gen} disabled={load}>{load?<><span className="spin"/> Analyzing…</>:"📝 Generate Outline"}</button>
      {out && <><div className="ai-out">{out}</div><button className="cpbtn" onClick={()=>{navigator.clipboard.writeText(out);setCp(true);setTimeout(()=>setCp(false),2000)}}>{cp?"✓ Copied!":"Copy text"}</button></>}
    </div>
  );
}

// ─── KEYWORDS ─────────────────────────────────────────────────────────────────
function KeywordsPanel({ videoId }) {
  const [out, setOut] = useState(""); const [kws, setKws] = useState([]); const [load, setLoad] = useState(false); const [cp, setCp] = useState(false);
  if (!videoId) return <Empty msg="Paste a YouTube URL to extract SEO keywords" icon="🔑" />;
  const gen = async () => {
    setLoad(true); setOut(""); setKws([]);
    try {
      const r = await callClaude(
        `SEO analysis for: https://www.youtube.com/watch?v=${videoId}\n1. PRIMARY_KEYWORDS: 10\n2. LONG_TAIL_KEYWORDS: 8\n3. TAGS: 15\n4. SEO_ANALYSIS: paragraph\n5. TRENDING_HASHTAGS: 8\nStart with PRIMARY_KEYWORDS:`,
        "You are a YouTube SEO expert."
      );
      setOut(r);
      const pk = r.match(/PRIMARY_KEYWORDS:\s*([^\n]+)/);
      const tg = r.match(/TAGS:\s*([^\n]+)/);
      setKws([...new Set([...(pk?pk[1].split(","):[]),...(tg?tg[1].split(","):[])].map(k=>k.trim()).filter(Boolean))].slice(0,22));
    } catch { setOut("⚠️ Error. Try again."); }
    setLoad(false);
  };
  return (
    <div>
      <button className="run-btn" onClick={gen} disabled={load}>{load?<><span className="spin"/> Extracting…</>:"🔑 Extract Keywords & SEO"}</button>
      {kws.length>0&&<><p className="slabel">Keyword cloud</p><div className="kw-cloud">{kws.map((k,i)=><span className="kw" key={i} style={{animationDelay:`${i*.04}s`}}>{k}</span>)}</div><div className="divider"/></>}
      {out&&<><p className="slabel">Full SEO Report</p><div className="ai-out">{out}</div><button className="cpbtn" onClick={()=>{navigator.clipboard.writeText(out);setCp(true);setTimeout(()=>setCp(false),2000)}}>{cp?"✓ Copied!":"Copy report"}</button></>}
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [url, setUrl]         = useState("");
  const [videoId, setVideoId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [activeTab, setActiveTab] = useState("thumbnail");

  const analyze = useCallback(async () => {
    const id = getVideoId(url.trim());
    if (!id) { setError("Invalid YouTube URL. Try youtube.com/watch?v=... or youtu.be/..."); return; }
    setLoading(true); setError(""); setVideoId(null);
    await new Promise(r => setTimeout(r, 300));
    setVideoId(id); setLoading(false);
  }, [url]);

  const videoUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : "";

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <div className="hdr">
          <div className="hdr-in">
            <div className="logo">YT TOOLKIT</div>
            <div className="tagline">Thumbnail · Download · MP3 · Shorts · Transcribe · Keywords</div>
          </div>
        </div>

        <div className="url-wrap">
          <span style={{color:"var(--red)",fontFamily:"var(--mono)",fontSize:14,lineHeight:"40px"}}>▶</span>
          <input className="url-in" value={url} onChange={e=>setUrl(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&analyze()}
            placeholder="Paste YouTube URL…  youtube.com/watch?v=xxx  or  youtu.be/xxx"/>
          <button className="abtn" onClick={analyze} disabled={loading||!url.trim()}>
            {loading?<span className="spin"/>:"Analyze →"}
          </button>
        </div>

        {error && <div style={{background:"rgba(248,113,113,.1)",border:"1px solid rgba(248,113,113,.25)",color:"#f87171",borderRadius:9,padding:"11px 16px",fontFamily:"var(--mono)",fontSize:12,marginTop:8}}>⚠️ {error}</div>}

        {videoId && (
          <div className="vcard">
            <img className="vth" src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`} alt=""/>
            <div className="vmeta">
              <div className="vtit">
                <a href={videoUrl} target="_blank" rel="noreferrer" style={{color:"var(--txt)",textDecoration:"none"}}>
                  youtube.com/watch?v={videoId} ↗
                </a>
              </div>
              <div className="vbadge">
                <span className="vid-tag">ID: {videoId}</span>
                <span className="ok-tag">✓ Ready</span>
              </div>
            </div>
          </div>
        )}

        <div className="tabs">
          {TABS.map(t=>(
            <button key={t.id} className={`tb ${activeTab===t.id?"on":""}`} onClick={()=>setActiveTab(t.id)}>
              <span className="ti">{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        <div className="panel" key={activeTab}>
          <div className="ptit">
            <span>{TABS.find(t=>t.id===activeTab)?.icon}</span>
            {TABS.find(t=>t.id===activeTab)?.label}
          </div>
          {activeTab==="thumbnail"  && <ThumbnailPanel videoId={videoId}/>}
          {activeTab==="download"   && <DownloadPanel  videoId={videoId} audioOnly={false}/>}
          {activeTab==="mp3"        && <DownloadPanel  videoId={videoId} audioOnly={true}/>}
          {activeTab==="shorts"     && <ShortsPanel    videoId={videoId}/>}
          {activeTab==="transcribe" && <TranscribePanel videoId={videoId}/>}
          {activeTab==="keywords"   && <KeywordsPanel  videoId={videoId}/>}
        </div>

        <p style={{textAlign:"center",marginTop:28,fontFamily:"var(--mono)",fontSize:10,color:"var(--mut)",letterSpacing:1}}>
          YT TOOLKIT · Downloads via Invidious mirror network · AI by Claude
        </p>
      </div>
    </>
  );
}
