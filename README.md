# 🎬 YT Toolkit

> **All-in-one YouTube command center** — Download, Extract Audio, Generate Shorts Scripts, Transcribe & Extract SEO Keywords from any YouTube URL.

![YT Toolkit](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![Deploy](https://img.shields.io/badge/deployed-GitHub%20Pages-black?style=flat-square&logo=github)

---

## ✨ Features

| Feature | Description |
|---|---|
| 🖼️ **Thumbnail Downloader** | Download all 4 quality variants (MAX, HQ, MQ, SD) instantly |
| ⬇️ **Video Download** | Direct 720p / 360p MP4 via Invidious mirror network |
| 🎵 **Audio / MP3** | Extract M4A (128kbps) or Opus audio directly |
| 📱 **Shorts Generator** | AI-powered 60-sec script, hooks, hashtags & clip markers |
| 📝 **Transcribe** | Content summary & chapter outline powered by Claude AI |
| 🔑 **SEO Keywords** | Primary keywords, tags, long-tail phrases & hashtag cloud |

---

## 🚀 Live Demo

👉 **[https://YOUR-USERNAME.github.io/yt-toolkit/](https://YOUR-USERNAME.github.io/yt-toolkit/)**

---

## 🛠️ Tech Stack

- **React 18** + **Vite 5** — fast dev & build
- **Invidious mirror network** — sandbox-safe direct download links (no JS fetch needed)
- **Claude AI (claude-sonnet-4)** — Shorts scripts, transcripts, SEO analysis
- **GitHub Actions** — automated CI/CD to GitHub Pages on every push
- Zero backend, zero database, zero auth — runs 100% in the browser

---

## 📦 Local Development

```bash
# 1. Clone the repo
git clone https://github.com/YOUR-USERNAME/yt-toolkit.git
cd yt-toolkit

# 2. Install dependencies
npm install

# 3. Start dev server
npm run dev

# 4. Open http://localhost:5173/yt-toolkit/
```

---

## 🌐 Deploy to GitHub Pages

This project auto-deploys via **GitHub Actions** on every push to `main`.

### First-time setup:

1. Push this repo to GitHub
2. Go to **Settings → Pages**
3. Set **Source** to **GitHub Actions**
4. Push any commit — the workflow builds & deploys automatically
5. Your site is live at `https://YOUR-USERNAME.github.io/yt-toolkit/`

> If you rename the repo, update `base` in `vite.config.js` to match.

---

## 📁 Project Structure

```
yt-toolkit/
├── .github/
│   └── workflows/
│       └── deploy.yml       # Auto-deploy to GitHub Pages
├── public/
│   └── favicon.svg
├── src/
│   ├── main.jsx             # React entry point
│   └── App.jsx              # Full application
├── index.html               # HTML shell with SEO meta tags
├── vite.config.js           # Vite config (base path)
├── package.json
└── README.md
```

---

## ⚙️ How Downloads Work

The sandbox environment blocks outbound `fetch()` calls. Downloads use a different technique:

- Each quality/format renders as a plain `<a href="...">` link pointing to an **Invidious proxy URL**
- When you click, **your browser** fetches the file directly — completely bypasses sandbox restrictions
- 6 mirror servers per format — if one is slow, click the next

---

## 📝 License

MIT — free to use, modify and distribute.

---

<p align="center">Built with ❤️ using React + Vite + Claude AI</p>
