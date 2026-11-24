# Juan Buddy 🐣

A taskbar / tray **idle pet** for Windows, macOS, and Linux. Your little buddy lives in the corner
of your screen, earns coins while you work, gets hungry, sleeps, and levels up — pop it open whenever
you need a reason to smile mid-workday.

Built with Electron. No build step, no framework — plain HTML/CSS/JS.

## ✨ Features

- **13 hand-crafted 16-bit pixel pets** from the Juan-Buddy Studio roster — Kala the carabao 🇵🇭, Bantay the aso, Tala, Chai 🇹🇭, Linh 🇻🇳, Bara 🇮🇩, Rimau 🇲🇾, Merli 🇸🇬, **Nila the peacock 🇮🇳**, Mochi 🇯🇵, Bao 🇨🇳, Misha 🇷🇺 and Gino 🇮🇹 — each with IDLE / WALK / HAPPY / EAT / SLEEP animations, drawn live with crisp outlines
- **🍜 32 ASEAN & world delicacies** — Pad Thai, fresh bamboo stalks, Khao Lam, Mango Sticky Rice, Tom Yum, Halo-Halo, Pandesal, Ube Potion, Butter Chicken, Masala Dosa, Samosa, Gulab Jamun, Masala Chai (TEMP EXP boost +25%!) and more — with **region filter chips (🇵🇭 PH / 🇮🇳 India / 🌏 ASEAN / 🌍 World) and instant search**, so your pet's food is always one tap away. Each pet has a **cultural favorite** for a happiness + XP bonus (kala loves Halo-Halo, nila loves Butter Chicken 💛)
- **Floating pet window** — pick any buddy in the dashboard, watch it react:
  - Click it to give a pat (hearts!) · double-click or right-click to open the dashboard
  - Drag it anywhere on your desktop
- **🎯 Activities** — send your buddy on cooldown-based side quests for big coin & XP payouts: Tara Lakwatsa 🚶, Cook Adobo 🍳, Videoke Night 🎤, Study Session 📚 and Fishing Trip 🎣 (with a 15% lucky jackpot!)
- **Idle economy** — send your buddy to **Work** to earn coins every second, even while the
  dashboard is closed. Coins keep trickling while the app runs.
- **Care loop** — Hunger, Energy and Happiness drain in real time. Feed snacks/meals/feasts,
  play with your buddy, or let it sleep to recharge.
- **Offline progress** — close the app, come back later: up to 8 hours of progress is applied on
  launch (working earns at 50% rate offline).
- **Level system** — feeding, playing and working grant XP; every level boosts coin rate by 10%.
- **Shop & upgrades**
  - 🛏 **Cozy Bed** (Lv 5) — energy drains 12% slower per level
  - 🧸 **Toy Box** (Lv 5) — playing gives +25% happiness per level
  - 📈 **Job Promotion** (Lv 10) — +60% coin rate per level
  - 🍽 **Auto-Feeder** — automatically feeds a Snack below 20 hunger
- **Tray integration** — lives in your system tray / menu bar with live status tooltip, quick
  show/hide, and an "open at login" option.
- **Notifications** — get pinged when your buddy is starving or exhausted (with cooldown so it
  doesn't nag).
- **Autosave** — progress saves to your OS user-data folder every 30 seconds and on quit.

## 🚀 Run it

```bash
npm install
npm start
```

- Windows: pet appears near the bottom-right, tray icon in the taskbar corner.
- macOS: tray icon in the menu bar.
- Linux: requires a tray-enabled desktop environment (GNOME needs an AppIndicator extension).

## 📱 Get it on your phone

**Android (APK)** — every push builds a debug APK via GitHub Actions:

1. Open the repo → **Actions** tab → the latest green **Build Installers** run
2. Scroll to **Artifacts** → download **Juan-Buddy-android** → unzip to get `app-debug.apk`
3. Copy it to your phone, open it, and allow "install from this source / unknown apps" if asked

Or build locally with `npm run mobile:sync && cd android && ./gradlew assembleDebug`.

**iPhone (PWA)** — Apple requires a paid developer account to install unsigned IPAs, so the phone
version ships as an installable web app instead:

1. Open the GitHub Pages URL (enabled automatically — repo **Settings → Pages** will show
   `https://juanbungo.github.io/Juan-Buddy/`) in **Safari**
2. Tap **Share → Add to Home Screen** — Juan Buddy runs fullscreen with offline support
   (service worker + localStorage save, up to 8 h catch-up progress)

## 📦 Package into an installer

```bash
npm run dist
```

Outputs installers into `dist/` (NSIS installer on Windows, app bundle on macOS, AppImage on Linux).

## 🧪 Tests

Game logic lives in `src/engine/engine.js` — pure, framework-free, and covered by tests:

```bash
npm test
```

## 🗂 Project layout

```
main.js                 Electron main process: tray, windows, IPC, save/load, ticking
preload.js              Secure IPC bridge (contextIsolation on)
src/engine/engine.js    Pure game logic — stats, actions, economy, upgrades, offline progress
src/pet/                Floating transparent pet window (canvas renderer)
src/dashboard/          Control panel: stats, actions, shop, settings
mobile/                 Phone version: tabs Home / Foods / Quests / Buddies (Capacitor web app + PWA)
                        (sprites.js / engine.js baked here by scripts/prep-mobile.js)
assets/icons.js         Tray/app icons as base64 data URLs (keeps the repo text-only)
scripts/generate-icons.js  Regenerates PNG assets from the base64 module
scripts/prep-mobile.js  Copies engine + sprites into mobile/ and bakes phone icons (npm run mobile:sync)
capacitor.config.json   Capacitor config (webDir: mobile)
android/                Native Android project for the APK build
test/engine.test.js     Engine test suite (plain node, no deps)
```

## 🗺 Ideas for v2

- Pet evolution by level (egg → baby → teen → adult forms)
- Multiple pet skins / themes
- Weather + day-night cycle tinting
- Achievements and daily bonus streaks
- Export / import save codes

## License

MIT
