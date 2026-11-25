# Juan Buddy 🥚

**A cozy 16-bit idle pet RPG / life sim** for Windows, macOS, and Linux — hatch a mystery pet
from an egg, raise it from baby to adult, feed it delicacies from all over Asia, and take good
care of it… because if you neglect your buddy for too long, **it can really pass away** and you'll
have to start over, just like real life.

Start the game, get cozy in your buddy's pixel room (fairy lights, parol, banig mat and all),
and come back now and then to feed, play, and pet. It's the friend that makes opening your PC
a little happier.

Built with Electron. No build step, no framework — plain HTML/CSS/JS.

## ✨ Features

- **🥚 Start as an Egg → random hatch → evolve** — your game begins with a mystery egg. Care for
  it and it cracks open into a **random buddy** from the roster, then grows through **4 stages**
  (Egg → Baby → Teen → Adult) with bigger sprites as it levels up.
- **💔 The permadeath twist** — go too long without feeding or resting your buddy while the app
  is open and it can **die** (30 minutes of neglect). You'll get a grave, a lesson… and a fresh
  egg. Your achievements and daily streak survive; your buddy doesn't. Real life, lite.
- **14 hand-crafted 16-bit pixel pets** — Kala the carabao 🇵🇭, Bantay the aso, Tala the witchdog,
  Chai 🇹🇭, Linh 🇻🇳, Bara 🇮🇩, Rimau 🇲🇾, Merli 🇸🇬, **Nila the peacock 🇮🇳 and Raja 🇮🇳**, Mochi 🇯🇵,
  Bao 🇨🇳, Misha 🇷🇺, Gino 🇮🇹 — with IDLE / WALK / HAPPY / EAT / SLEEP animations and crisply
  pixelated rendering in a cozy pixel-art home room.
- **🗑️ The RPG dashboard** — two-column studio layout: pet playground with live room scene on the
  left, tabbed panels (Food / Quests / Shop / Life / Buddies) on the right, sticky HUD with level,
  XP bar and coin pills, chunky 3D buttons.
- **🍔 32 world delicacies** — Pad Thai, fresh bamboo stalks, Khao Lam, Mango Sticky Rice,
  Halo-Halo, Pandesal, Ube Potion, Butter Chicken, Masala Dosa, Samosa and more — with region
  filter chips (🇵🇭 PH / 🇮🇳 India / 🌏 SE Asia / 🌍 World) and instant search. Each pet has a
  **cultural favorite** for bonus happiness + XP.
- **🎯 Activities** — cooldown-based side quests for big coin & XP payouts: Tara Lakwatsa 🚶,
  Cook Adobo 🍳, Videoke Night 🎤, Study Session 📚, Fishing Trip 🎣 (with a 15% lucky jackpot!).
- **☀️ Weather + day-night cycle** — the sky in your buddy's window follows the real clock (dawn /
  day / dusk / night with sun, moon and twinkling stars) and the daily-rolled weather brings rain,
  storms, snow and drifting clouds.
- **🎁 Daily bonus streaks** — claim once a day for growing rewards (+45 at a 7-day streak).
- **🏆 12 achievements** — from first feed to raising an adult, tracked in the Life tab.
- **🎨 Pet skins** — Classic, Golden, Sakura and Midnight tints you can buy with coins and equip
  anytime.
- **🎰 Gacha Wish Machine** — spend coins to summon: ★ Common (55%), ★★ Rare (30%), ★★★ Epic (14%),
  ★★★★ Legendary (0.9999%, unlocks the Golden Shine skin)… and the **★★★★★ Mythic — 0.0001%**,
  the rarest pull in the game: a jackpot coin shower plus the exclusive **Cosmic Mythic skin**
  that cannot be bought anywhere else. Spin animation, rarity-colored reveals and confetti included.
- **🔊 Sound effects** — synthesized retro SFX for everything: clicks, coin chimes, nom-nom
  feeding, pats, hatching cracks, evolution fanfares, achievement bells, and a dramatic rising
  shimmer when a high-rarity gacha pull lands. Toggle with one click in the footer.
- **🔐 Save codes** — export your whole game as a `JB2.…` code (copied to clipboard) and import
  it anywhere — great for backups or moving between devices.
- **💼 Idle economy** — send your buddy to **Work** to earn coins every second, even while the
  dashboard is closed (offline progress up to 8 hours, working earns at 50% offline).
- **❤️ Care loop** — Hunger, Energy and Happiness drain in real time. Feed, play, pat your buddy
  or let it nap. Danger banners warn you before things get serious.
- **🛒 Upgrades** — 🛏 Cozy Bed (slower energy drain), 🧸 Toy Box (+happiness), 📈 Job Promotion
  (+coin rate), 🍽 Auto-Feeder (auto-snacks below 20 hunger).
- **🔔 Notifications** — get pinged when your buddy is starving, exhausted, or reaches a
  milestone (hatch, evolution, achievements, and yes… when it passes away).
- **Tray integration** — lives in your system tray / menu bar with live status tooltip,
  open-at-login option, and quick access.

## 🚀 Run it

```bash
npm install
npm start
```

- Windows: dashboard opens with your buddy's room front and center; tray icon in the taskbar corner.
- macOS: tray icon in the menu bar.
- Linux: requires a tray-enabled desktop environment (GNOME needs an AppIndicator extension).

## ✨ AI Motivation (optional)

Every ~15 minutes (or via the **✨ Cheer Me Up** button) your buddy pops a motivational speech
bubble **in their own language** — Tagalog, Thai, Vietnamese, Bahasa, Singlish, Hindi, Japanese,
Mandarin, Russian or Italian — with romanization + English translation, plus bonus coins.

- Set the `MISTRAL_API_KEY` environment variable to enable live generation with
  `mistral-small-latest` (JSON mode). **Never hardcode or commit the key.**
- No key? No problem — built-in per-country offline quotes are used as fallback.

## 📱 Get it on your phone

**Android (APK)** — every push builds a debug APK via GitHub Actions:

1. Open the repo → **Actions** tab → the latest green **Build Installers** run
2. Scroll to **Artifacts** → download **Juan-Buddy-android** → unzip to get `app-debug.apk`
3. Copy it to your phone, open it, and allow "install from this source / unknown apps" if asked

Or build locally with `npm run mobile:sync && cd android && ./gradlew assembleDebug`.

**iPhone (PWA)** — Apple requires a paid developer account to install unsigned IPAs, so the phone
version ships as an installable web app instead:

1. Open the GitHub Pages URL in **Safari**: `https://juanbungo.github.io/Juan-Buddy/`
2. Tap **Share → Add to Home Screen** — Juan Buddy runs fullscreen with offline support
   (service worker + localStorage save, up to 8 h catch-up progress), plus minimalist
   battery-friendly notifications when your buddy gets hungry or finishes a quest

**One-time setup:** repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
The `mobile-pwa` workflow deploys the phone app automatically on every push (errors on that job
are non-blocking until Pages is enabled).

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
src/engine/engine.js    Pure game logic — stats, actions, economy, stages, death, achievements
src/dashboard/          The RPG studio: pet room, care controls, tabbed panels
src/pet/sprites.js      Pet roster, delicacies, baked sprite fallbacks
src/pet/motivation.js   AI motivational events (Mistral API + offline fallback quotes)
assets/sprites/         16-bit pet frame PNGs + food icons
mobile/                 Phone version: tabs Home / Foods / Quests / Buddies (Capacitor web app + PWA)
                        (sprites.js / engine.js baked here by scripts/prep-mobile.js)
assets/icons.js         Tray/app icons as base64 data URLs
scripts/slice-sheets.js Slices sprite-sheet PNGs into per-frame animations
scripts/prep-mobile.js  Copies engine + sprites into mobile/ and bakes phone icons (npm run mobile:sync)
capacitor.config.json   Capacitor config (webDir: mobile)
android/                Native Android project for the APK build
test/                   Engine, UI, feature and smoke test suites (plain node, no deps)
```

## 🧭 The lesson

Juan Buddy isn't just about collecting coins. Your buddy depends on you — feed it when it's
hungry, let it sleep when it's tired, play with it when it's sad. If you ignore it for too long,
it's gone for real. Take care of the things that take care of you. 🕊️
