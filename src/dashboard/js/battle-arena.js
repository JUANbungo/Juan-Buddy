/**
 * Juan Buddy — Battle Arena, Animated Monsters, Ghost/Tombstone & Reincarnation Stone System
 * Drop-in module compatible with Mistral AI integration for JUANbungo/Juan-Buddy
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "juanBuddyBattleDeathState_v1";
  const ONE_HOUR_MS = 60 * 60 * 1000;
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  // Exact 8 Battle Arena Monsters matching Juan Buddy UI (rebalanced: higher HP)
  const MONSTERS = [
    { id: "guard_slime",  name: "Guard Slime",  lv: 1,  hp: 65,   atk: 7,  goldMin: 12,  goldMax: 20,  xp: 6,   limitedDrop: { enabled: false, comingSoon: true, chance: 1.5, itemName: "Mystery Limited Item" } },
    { id: "cave_bat",     name: "Cave Bat",     lv: 4,  hp: 115,  atk: 12, goldMin: 22,  goldMax: 34,  xp: 12,  limitedDrop: { enabled: false, comingSoon: true, chance: 2.0, itemName: "Mystery Limited Item" } },
    { id: "wild_boar",    name: "Wild Boar",    lv: 8,  hp: 190,  atk: 19, goldMin: 38,  goldMax: 55,  xp: 20,  limitedDrop: { enabled: false, comingSoon: true, chance: 2.5, itemName: "Mystery Limited Item" } },
    { id: "ridge_wolf",   name: "Ridge Wolf",   lv: 13, hp: 290,  atk: 28, goldMin: 58,  goldMax: 80,  xp: 32,  limitedDrop: { enabled: false, comingSoon: true, chance: 3.0, itemName: "Mystery Limited Item" } },
    { id: "kumiho",       name: "Kumiho",       lv: 18, hp: 420,  atk: 38, goldMin: 80,  goldMax: 115, xp: 48,  limitedDrop: { enabled: false, comingSoon: true, chance: 3.5, itemName: "Mystery Limited Item" } },
    { id: "oni_brute",    name: "Oni Brute",    lv: 24, hp: 600,  atk: 50, goldMin: 115, goldMax: 160, xp: 70,  limitedDrop: { enabled: false, comingSoon: true, chance: 4.0, itemName: "Mystery Limited Item" } },
    { id: "ember_wyvern", name: "Ember Wyvern", lv: 30, hp: 850,  atk: 66, goldMin: 160, goldMax: 230, xp: 100, limitedDrop: { enabled: false, comingSoon: true, chance: 4.5, itemName: "Mystery Limited Item" } },
    { id: "void_titan",   name: "Void Titan",   lv: 40, hp: 1300, atk: 88, goldMin: 240, goldMax: 340, xp: 150, limitedDrop: { enabled: false, comingSoon: true, chance: 5.0, itemName: "Mystery Limited Item" } },
  ];

  /**
   * Reserved hook for the future Limited Item Drop system.
   * Every monster carries a limitedDrop { enabled, comingSoon, chance, itemName }.
   * While enabled is false the roll is skipped and it returns null ("Coming Soon").
   * To turn on: set monster.limitedDrop.enabled = true, then call this after each victory.
   */
  function rollLimitedDrop(monster) {
    const cfg = monster && monster.limitedDrop;
    if (!cfg || !cfg.enabled) return null;
    if (Math.random() * 100 >= cfg.chance) return null;
    return { itemName: cfg.itemName, fromMonster: monster.id };
  }

  // Default state persisted in localStorage
  function loadDeathState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return {
      status: "alive",       // "alive" | "ghost" | "tombstone"
      deathCount: 0,         // 1st death -> 1h & 1,000g | 2nd+ -> 24h & 24,000g
      lockoutUntil: 0,       // epoch ms when ghost lockout ends
      resetAt: 0,            // epoch ms when tombstone resets the game (24h)
      lastDeathAt: 0,
    };
  }

  function saveDeathState(st) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(st));
    } catch (_) {}
  }

  function formatCountdown(ms) {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const h = String(Math.floor(totalSec / 3600)).padStart(2, "0");
    const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
    const s = String(totalSec % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }

  class JuanBuddyBattleArena {
    constructor(options = {}) {
      this.assetBase = options.assetBase || "assets";
      this.stageMount = options.stageMount || null;      // Container for Arena Stage
      this.selectorMount = options.selectorMount || null; // Container for Monster Cards
      this.homeElement = options.homeElement || null;     // Buddy's Home DOM element to hide when entering Arena

      // Game integration callbacks (override when wiring to Juan-Buddy main state)
      this.getPlayer = options.getPlayer || (() => ({
        name: "Buddy",
        level: 5,
        hp: 80,
        maxHp: 80,
        atk: 16,
        def: 8,
        spd: 6,
        gold: 5000,
        spriteUrl: `${this.assetBase}/monsters/guard_slime/idle_sheet.png`,
      }));
      this.setGold = options.setGold || (() => {});
      this.addReward = options.addReward || (() => {});
      this.onResetGame = options.onResetGame || (() => {
        localStorage.removeItem(STORAGE_KEY);
        alert("Your pet was not revived within 24 hours. Game has been reset!");
        window.location.reload();
      });
      this.onStateChange = options.onStateChange || (() => {});

      this.deathState = loadDeathState();
      this.selectedMonster = MONSTERS[0];
      this.inArena = false;
      this.inBattle = false;
      this.battleTimer = null;
      this.tickInterval = null;

      this._startClock();
    }

    /** Dynamic Reincarnation Stone price based on death count */
    getReincarnationStonePrice() {
      // 1st death = 1,000 gold; 2nd+ death = 24,000 gold
      return this.deathState.deathCount <= 1 ? 1000 : 24000;
    }

    /** Special Reincarnation Stone price for Tombstone (Full Death) */
    getSpecialReincarnationStonePrice() {
      return 150000;
    }

    /** Returns true if player is currently locked out (Ghost or Tombstone) */
    isLockedOut() {
      this._refreshDeathTimers();
      return this.deathState.status === "ghost" || this.deathState.status === "tombstone";
    }

    /** Get current pet sprite override when dead (Ghost or Tombstone) */
    getActivePetSpriteOverride(anim = "idle") {
      this._refreshDeathTimers();
      if (this.deathState.status === "ghost") {
        return `${this.assetBase}/death/pet_ghost_${anim === "walk" ? "walk" : "idle"}_sheet.png`;
      }
      if (this.deathState.status === "tombstone") {
        return `${this.assetBase}/death/pet_tombstone_idle_sheet.png`;
      }
      return null;
    }

    /** Open the Battle Arena place (hides Buddy's Home & shows Arena Stage) */
    enterArena() {
      this.inArena = true;
      if (this.homeElement) this.homeElement.classList.add("jb-arena-hidden");
      if (this.stageMount) this.stageMount.classList.remove("jb-arena-hidden");
      this.renderArenaStage();
      this.renderEnemySelector();
      this.onStateChange({ inArena: true, deathState: this.deathState });
    }

    /** Leave Battle Arena and return to Buddy's Home */
    exitArena() {
      this.inArena = false;
      this.inBattle = false;
      clearTimeout(this.battleTimer);
      if (this.stageMount) this.stageMount.classList.add("jb-arena-hidden");
      if (this.homeElement) this.homeElement.classList.remove("jb-arena-hidden");
      this.onStateChange({ inArena: false, deathState: this.deathState });
    }

    /** Select an enemy to preview on the Arena stage */
    selectEnemy(monsterId) {
      if (this.inBattle) return;
      const found = MONSTERS.find((m) => m.id === monsterId);
      if (!found) return;
      this.selectedMonster = found;
      this.renderEnemySelector();
      this.renderArenaStage(true); // animate enemy walking onto the pad!
    }

    /** Trigger a pet death (normal Ghost death OR full Tombstone death) */
    triggerPetDeath(forceFullDeath = false) {
      const now = Date.now();
      this.deathState.deathCount += 1;
      this.deathState.lastDeathAt = now;

      // Full death (Tombstone) occurs if forced OR if pet dies 3+ times without full recovery
      if (forceFullDeath) {
        this.deathState.status = "tombstone";
        this.deathState.resetAt = now + ONE_DAY_MS; // 1 day (24h) before full game reset
        this.deathState.lockoutUntil = 0;
      } else {
        this.deathState.status = "ghost";
        // 1st death -> 1 hour lockout; 2nd+ death -> 24 hours lockout
        const lockoutDuration = this.deathState.deathCount === 1 ? ONE_HOUR_MS : ONE_DAY_MS;
        this.deathState.lockoutUntil = now + lockoutDuration;
        this.deathState.resetAt = 0;
      }

      saveDeathState(this.deathState);
      this.renderArenaStage();
      this.onStateChange({ inArena: this.inArena, deathState: this.deathState });
    }

    /** Buy Reincarnation Stone (1,000g 1st death / 24,000g 2nd+ death) to revive Ghost */
    buyReincarnationStone() {
      if (this.deathState.status !== "ghost") {
        return { ok: false, message: "Your pet is not in Ghost state." };
      }
      const price = this.getReincarnationStonePrice();
      const player = this.getPlayer();
      if (player.gold < price) {
        return { ok: false, message: `Not enough gold! Need ${price.toLocaleString()} gold.` };
      }

      this.setGold(player.gold - price);
      this.deathState.status = "alive";
      this.deathState.lockoutUntil = 0;
      saveDeathState(this.deathState);
      this.renderArenaStage();
      this.onStateChange({ inArena: this.inArena, deathState: this.deathState, revived: true });
      return { ok: true, message: `Revived with Reincarnation Stone (-${price.toLocaleString()} gold)!` };
    }

    /** Buy Special Reincarnation Stone (150,000g) to revive from Tombstone & cancel 1-day reset */
    buySpecialReincarnationStone() {
      if (this.deathState.status !== "tombstone") {
        return { ok: false, message: "Special Reincarnation Stone is only for Tombstone revival." };
      }
      const price = this.getSpecialReincarnationStonePrice();
      const player = this.getPlayer();
      if (player.gold < price) {
        return { ok: false, message: `Not enough gold! Need ${price.toLocaleString()} gold.` };
      }

      this.setGold(player.gold - price);
      this.deathState.status = "alive";
      this.deathState.resetAt = 0;
      this.deathState.lockoutUntil = 0;
      saveDeathState(this.deathState);
      this.renderArenaStage();
      this.onStateChange({ inArena: this.inArena, deathState: this.deathState, revived: true });
      return { ok: true, message: "Miracle! Revived from Tombstone (-150,000 gold). 1-Day Reset cancelled!" };
    }

    /** Start turn-based animated battle against currently selected monster */
    startBattle() {
      if (this.inBattle || this.isLockedOut()) return;

      const player = this.getPlayer();
      const enemy = { ...this.selectedMonster };
      let pHp = player.maxHp || player.hp || 60;
      let eHp = enemy.hp;

      this.inBattle = true;
      this._setLog(`⚔️ Battle started against ${enemy.name} (Lv ${enemy.lv})!`);
      const fightBtn = this.stageMount?.querySelector("#jb-fight-btn");
      if (fightBtn) fightBtn.disabled = true;

      const pEl = this.stageMount?.querySelector(".jb-fighter.player");
      const eEl = this.stageMount?.querySelector(".jb-fighter.enemy");
      const eSprite = eEl?.querySelector(".jb-sprite-box");

      // Switch monster to walk animation during engagement
      if (eSprite) {
        eSprite.style.backgroundImage = `url("${this.assetBase}/monsters/${enemy.id}/walk_sheet.png")`;
      }

      const runRound = () => {
        if (!this.inBattle) return;

        // Player attacks
        const pDmg = Math.max(2, Math.round((player.atk || 10) * (0.85 + Math.random() * 0.35)));
        eHp = Math.max(0, eHp - pDmg);
        pEl?.classList.add("attack-right");
        eEl?.classList.add("hit-flash");
        this._updateHpBars(pHp, player.maxHp || 60, eHp, enemy.hp);
        this._setLog(`💥 ${player.name} hits ${enemy.name} for ${pDmg} DMG!`);

        setTimeout(() => {
          pEl?.classList.remove("attack-right");
          eEl?.classList.remove("hit-flash");

          if (eHp <= 0) {
            // Victory!
            this.inBattle = false;
            const goldGain = Math.floor(enemy.goldMin + Math.random() * (enemy.goldMax - enemy.goldMin + 1));
            this.addReward({ gold: goldGain, xp: enemy.xp, monster: enemy });
            if (eSprite) {
              eSprite.style.backgroundImage = `url("${this.assetBase}/monsters/${enemy.id}/idle_sheet.png")`;
            }
            this._setLog(`🏆 Victory! Earned +${goldGain} Gold & +${enemy.xp} XP!`);
            if (fightBtn) fightBtn.disabled = false;
            return;
          }

          // Enemy counter-attacks
          const rawEnemyDmg = Math.max(2, enemy.atk - Math.floor((player.def || 4) * 0.35));
          const eDmg = Math.max(2, Math.round(rawEnemyDmg * (0.85 + Math.random() * 0.3)));
          pHp = Math.max(0, pHp - eDmg);
          eEl?.classList.add("attack-left");
          pEl?.classList.add("hit-flash");
          this._updateHpBars(pHp, player.maxHp || 60, eHp, enemy.hp);
          this._setLog(`🔥 ${enemy.name} strikes back for ${eDmg} DMG!`);

          setTimeout(() => {
            eEl?.classList.remove("attack-left");
            pEl?.classList.remove("hit-flash");

            if (pHp <= 0) {
              // Defeat -> Pet dies!
              this.inBattle = false;
              // If player already died 2+ times before (this is 3rd+ death) -> Tombstone full death, else Ghost!
              const isFullDeath = this.deathState.deathCount >= 2;
              this.triggerPetDeath(isFullDeath);
              return;
            }

            this.battleTimer = setTimeout(runRound, 650);
          }, 320);
        }, 320);
      };

      this.battleTimer = setTimeout(runRound, 400);
    }

    /** Render the Battle Arena Stage HTML */
    renderArenaStage(walkInEnemy = false) {
      if (!this.stageMount) return;
      this._refreshDeathTimers();

      const player = this.getPlayer();
      const enemy = this.selectedMonster;
      const petSprite = this.getActivePetSpriteOverride("idle") || player.spriteUrl;
      const enemySprite = `${this.assetBase}/monsters/${enemy.id}/${walkInEnemy ? "walk_sheet" : "idle_sheet"}.png`;

      let deathOverlayHtml = "";
      if (this.deathState.status === "ghost") {
        const remain = formatCountdown(this.deathState.lockoutUntil - Date.now());
        const stonePrice = this.getReincarnationStonePrice();
        deathOverlayHtml = `
          <div class="jb-death-overlay">
            <div class="jb-sprite-box" style="background-image:url('${this.assetBase}/death/pet_ghost_idle_sheet.png')"></div>
            <div class="jb-death-title">👻 Your Buddy Passed Away (Ghost)</div>
            <div class="jb-death-timer" id="jb-lockout-clock">${remain}</div>
            <div class="jb-death-desc">
              Death #${this.deathState.deathCount}: You cannot play for <b>${this.deathState.deathCount === 1 ? "1 hour" : "24 hours"}</b>.<br/>
              Buy a <b>Reincarnation Stone</b> (${stonePrice.toLocaleString()} gold) to revive immediately!
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;">
              <button class="jb-arena-btn revive" id="jb-open-revive-shop">💎 Open Revival Shop</button>
            </div>
          </div>
        `;
      } else if (this.deathState.status === "tombstone") {
        const remain = formatCountdown(this.deathState.resetAt - Date.now());
        deathOverlayHtml = `
          <div class="jb-death-overlay tombstone-mode">
            <div class="jb-sprite-box" style="background-image:url('${this.assetBase}/death/pet_tombstone_idle_sheet.png')"></div>
            <div class="jb-death-title">🪦 FULL DEATH — TOMBSTONE</div>
            <div class="jb-death-timer" id="jb-lockout-clock">${remain}</div>
            <div class="jb-death-desc">
              Warning: Your game will <b>RESET in 1 day</b> if you do not revive your pet!<br/>
              Buy the <b>Special Reincarnation Stone</b> (150,000 gold) in the Shop to save your Buddy!
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;">
              <button class="jb-arena-btn special" id="jb-open-revive-shop">✨ Buy Special Stone (150,000g)</button>
            </div>
          </div>
        `;
      }

      this.stageMount.innerHTML = `
        <div class="jb-arena-stage">
          <div class="jb-arena-topbar">
            <button class="jb-arena-btn secondary" id="jb-back-home">← Back to Home</button>
            <div class="jb-arena-badge">⚔️ BATTLE ARENA • ${enemy.name} (Lv ${enemy.lv})</div>
            <button class="jb-arena-btn revive" id="jb-shop-btn">💎 Revive Shop</button>
          </div>

          <div class="jb-fighter player">
            <div class="jb-hp-wrap">
              <div class="jb-hp-label"><span>${player.name}</span><span id="jb-p-hp-txt">${player.maxHp}/${player.maxHp}</span></div>
              <div class="jb-hp-track"><div class="jb-hp-fill" id="jb-p-hp-bar" style="width:100%"></div></div>
            </div>
            <div class="jb-sprite-box" style="background-image:url('${petSprite}')"></div>
          </div>

          <div class="jb-fighter enemy ${walkInEnemy ? "walking-in" : ""}">
            <div class="jb-hp-wrap">
              <div class="jb-hp-label"><span>${enemy.name}</span><span id="jb-e-hp-txt">${enemy.hp}/${enemy.hp}</span></div>
              <div class="jb-hp-track"><div class="jb-hp-fill enemy" id="jb-e-hp-bar" style="width:100%"></div></div>
            </div>
            <div class="jb-sprite-box" style="background-image:url('${enemySprite}')"></div>
          </div>

          <div class="jb-arena-log">
            <span id="jb-log-text">Choose an enemy below and click Fight!</span>
            <button class="jb-arena-btn danger" id="jb-fight-btn" ${this.isLockedOut() ? "disabled" : ""}>⚔️ Fight ${enemy.name}</button>
          </div>

          ${deathOverlayHtml}
        </div>
      `;

      // Animate enemy walking onto the right battle pad, then switch to idle
      if (walkInEnemy) {
        requestAnimationFrame(() => {
          const eEl = this.stageMount.querySelector(".jb-fighter.enemy");
          const eSp = eEl?.querySelector(".jb-sprite-box");
          if (eEl) eEl.classList.remove("walking-in");
          setTimeout(() => {
            if (eSp && !this.inBattle) {
              eSp.style.backgroundImage = `url("${this.assetBase}/monsters/${enemy.id}/idle_sheet.png")`;
            }
          }, 500);
        });
      }

      // Wire buttons
      this.stageMount.querySelector("#jb-back-home")?.addEventListener("click", () => this.exitArena());
      this.stageMount.querySelector("#jb-fight-btn")?.addEventListener("click", () => this.startBattle());
      this.stageMount.querySelector("#jb-shop-btn")?.addEventListener("click", () => this.openReviveShopModal());
      this.stageMount.querySelector("#jb-open-revive-shop")?.addEventListener("click", () => this.openReviveShopModal());
    }

    /** Render the 8 selectable animated monster cards */
    renderEnemySelector() {
      if (!this.selectorMount) return;
      this.selectorMount.innerHTML = `
        <div class="jb-enemy-grid">
          ${MONSTERS.map((m) => `
            <div class="jb-enemy-card ${this.selectedMonster.id === m.id ? "selected" : ""}" data-monster="${m.id}">
              <div class="jb-enemy-card-sprite" style="background-image:url('${this.assetBase}/monsters/${m.id}/idle_sheet.png')"></div>
              <div class="jb-enemy-name">${m.name}</div>
              <div class="jb-enemy-meta">Lv ${m.lv} • HP ${m.hp} • ATK ${m.atk}<br/>🪙 ${m.goldMin}-${m.goldMax}g • +${m.xp}xp<br/><span class="jb-limited-tag">🎁 Limited Drop: ${m.limitedDrop && m.limitedDrop.enabled ? "Active" : "Soon"}</span></div>
              <button class="jb-arena-btn ${this.selectedMonster.id === m.id ? "danger" : "secondary"}" type="button">
                ${this.selectedMonster.id === m.id ? "Selected" : "Choose"}
              </button>
            </div>
          `).join("")}
        </div>
      `;

      this.selectorMount.querySelectorAll(".jb-enemy-card").forEach((card) => {
        card.addEventListener("click", () => this.selectEnemy(card.dataset.monster));
      });
    }

    /** Open Shop Modal for Reincarnation Stone & Special Reincarnation Stone */
    openReviveShopModal() {
      document.getElementById("jb-revive-shop-modal")?.remove();
      const player = this.getPlayer();
      const stonePrice = this.getReincarnationStonePrice();
      const specialPrice = this.getSpecialReincarnationStonePrice();

      const modal = document.createElement("div");
      modal.id = "jb-revive-shop-modal";
      modal.className = "jb-shop-modal";
      modal.innerHTML = `
        <div class="jb-shop-card">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <h3 style="margin:0;">💎 Reincarnation Shop</h3>
            <span style="font-weight:800;color:#b87614;">🪙 ${player.gold.toLocaleString()} Gold</span>
          </div>

          <div class="jb-shop-item">
            <img src="${this.assetBase}/items/reincarnation_stone.png" alt="Reincarnation Stone" />
            <div class="jb-shop-item-info">
              <h4>Reincarnation Stone</h4>
              <p>Instantly revives your <b>Ghost</b> pet and skips the ${this.deathState.deathCount <= 1 ? "1-hour" : "24-hour"} lockout.<br/>
              Price: <b>${stonePrice.toLocaleString()} Gold</b> (1st death: 1,000g • 2nd+: 24,000g)</p>
            </div>
            <button class="jb-arena-btn revive" id="jb-buy-stone-1">Buy</button>
          </div>

          <div class="jb-shop-item">
            <img src="${this.assetBase}/items/special_reincarnation_stone.png" alt="Special Reincarnation Stone" />
            <div class="jb-shop-item-info">
              <h4>Special Reincarnation Stone</h4>
              <p>Revives a fully dead <b>Tombstone</b> pet and cancels the 1-Day Game Reset.<br/>
              Price: <b>${specialPrice.toLocaleString()} Gold</b></p>
            </div>
            <button class="jb-arena-btn special" id="jb-buy-stone-2">Buy</button>
          </div>

          <div id="jb-shop-msg" style="margin-top:10px;font-size:12px;font-weight:700;color:#b83232;"></div>
          <div style="text-align:right;margin-top:12px;">
            <button class="jb-arena-btn secondary" id="jb-close-shop">Close</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      const msgEl = modal.querySelector("#jb-shop-msg");

      modal.querySelector("#jb-close-shop").addEventListener("click", () => modal.remove());
      modal.querySelector("#jb-buy-stone-1").addEventListener("click", () => {
        const res = this.buyReincarnationStone();
        msgEl.style.color = res.ok ? "#1f8a3c" : "#b83232";
        msgEl.textContent = res.message;
        if (res.ok) setTimeout(() => modal.remove(), 900);
      });
      modal.querySelector("#jb-buy-stone-2").addEventListener("click", () => {
        const res = this.buySpecialReincarnationStone();
        msgEl.style.color = res.ok ? "#1f8a3c" : "#b83232";
        msgEl.textContent = res.message;
        if (res.ok) setTimeout(() => modal.remove(), 900);
      });
    }

    _updateHpBars(pHp, pMax, eHp, eMax) {
      const pTxt = this.stageMount?.querySelector("#jb-p-hp-txt");
      const pBar = this.stageMount?.querySelector("#jb-p-hp-bar");
      const eTxt = this.stageMount?.querySelector("#jb-e-hp-txt");
      const eBar = this.stageMount?.querySelector("#jb-e-hp-bar");
      if (pTxt) pTxt.textContent = `${pHp}/${pMax}`;
      if (pBar) pBar.style.width = `${Math.max(0, (pHp / pMax) * 100)}%`;
      if (eTxt) eTxt.textContent = `${eHp}/${eMax}`;
      if (eBar) eBar.style.width = `${Math.max(0, (eHp / eMax) * 100)}%`;
    }

    _setLog(text) {
      const el = this.stageMount?.querySelector("#jb-log-text");
      if (el) el.textContent = text;
    }

    _refreshDeathTimers() {
      const now = Date.now();
      if (this.deathState.status === "ghost" && this.deathState.lockoutUntil > 0 && now >= this.deathState.lockoutUntil) {
        // Lockout expired -> auto revive
        this.deathState.status = "alive";
        this.deathState.lockoutUntil = 0;
        saveDeathState(this.deathState);
        if (this.inArena) this.renderArenaStage();
      } else if (this.deathState.status === "tombstone" && this.deathState.resetAt > 0 && now >= this.deathState.resetAt) {
        // 1-Day Tombstone timer expired -> trigger full game reset!
        this.deathState.resetAt = 0;
        saveDeathState(this.deathState);
        this.onResetGame();
      }
    }

    _startClock() {
      this.tickInterval = setInterval(() => {
        this._refreshDeathTimers();
        const clock = this.stageMount?.querySelector("#jb-lockout-clock");
        if (!clock) return;
        if (this.deathState.status === "ghost") {
          clock.textContent = formatCountdown(this.deathState.lockoutUntil - Date.now());
        } else if (this.deathState.status === "tombstone") {
          clock.textContent = formatCountdown(this.deathState.resetAt - Date.now());
        }
      }, 1000);
    }
  }

  global.JuanBuddyBattleArena = JuanBuddyBattleArena;
  global.JUAN_BUDDY_MONSTERS = MONSTERS;
  global.JB_rollLimitedDrop = rollLimitedDrop;
})(window);
