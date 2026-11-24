# Juan Buddy 🐣

A taskbar / tray **idle pet** for Windows, macOS, and Linux. Your little buddy lives in the corner
of your screen, earns coins while you work, gets hungry, sleeps, and levels up — pop it open whenever
you need a reason to smile mid-workday.

Built with Electron. No build step, no framework — plain HTML/CSS/JS.

## ✨ Features

- **Floating pet window** — a squishy canvas-rendered buddy that breathes, blinks, and reacts to its mood:
  - 🧡 happy (high happiness) · 💚 chill · 💙 sad (low happiness) · 💜 sleeping
  - Click it to give a pat (hearts!) · double-click or right-click to open the dashboard
  - Drag it anywhere on your desktop
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
assets/icons.js         Tray/app icons as base64 data URLs (keeps the repo text-only)
scripts/generate-icons.js  Regenerates PNG assets from the base64 module
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
