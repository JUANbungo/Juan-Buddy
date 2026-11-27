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
    { id: "guard_slime",  name: "Guard Slime",  lv: 1,  hp: 65,   atk: 7,  goldMin: 30,  goldMax: 50,  xp: 6,   limitedDrop: { enabled: false, comingSoon: true, chance: 1.5, itemName: "Mystery Limited Item" } },
    { id: "cave_bat",     name: "Cave Bat",     lv: 4,  hp: 115,  atk: 12, goldMin: 55,  goldMax: 85,  xp: 12,  limitedDrop: { enabled: false, comingSoon: true, chance: 2.0, itemName: "Mystery Limited Item" } },
    { id: "wild_boar",    name: "Wild Boar",    lv: 8,  hp: 190,  atk: 19, goldMin: 95,  goldMax: 140,  xp: 20,  limitedDrop: { enabled: false, comingSoon: true, chance: 2.5, itemName: "Mystery Limited Item" } },
    { id: "ridge_wolf",   name: "Ridge Wolf",   lv: 13, hp: 290,  atk: 28, goldMin: 145, goldMax: 200,  xp: 32,  limitedDrop: { enabled: false, comingSoon: true, chance: 3.0, itemName: "Mystery Limited Item" } },
    { id: "kumiho",       name: "Kumiho",       lv: 18, hp: 420,  atk: 38, goldMin: 200, goldMax: 290, xp: 48,  limitedDrop: { enabled: false, comingSoon: true, chance: 3.5, itemName: "Mystery Limited Item" } },
    { id: "oni_brute",    name: "Oni Brute",    lv: 24, hp: 600,  atk: 50, goldMin: 290, goldMax: 400, xp: 70,  limitedDrop: { enabled: false, comingSoon: true, chance: 4.0, itemName: "Mystery Limited Item" } },
    { id: "ember_wyvern", name: "Ember Wyvern", lv: 30, hp: 850,  atk: 66, goldMin: 400, goldMax: 575, xp: 100, limitedDrop: { enabled: false, comingSoon: true, chance: 4.5, itemName: "Mystery Limited Item" } },
    { id: "void_titan",   name: "Void Titan",   lv: 40, hp: 1300, atk: 88, goldMin: 600, goldMax: 850, xp: 150, limitedDrop: { enabled: false, comingSoon: true, chance: 5.0, itemName: "Mystery Limited Item" } },
  ];

  /**
   * Reserved hook for the future Limited Item Drop system.
   * Every monster carries a limitedDrop { enabled, comingSoon, chance, itemName }.
   * While enabled is false the roll is skipped and it returns null ("Coming Soon").
   * To turn on: set monster.limitedDrop.enabled = true, then call this after each victory.
   */
  /**
   * Tries each sprite URL in order; applies the first that loads.
   * Logs every failed URL; if all fail, shows the fallback emoji and logs loudly.
   */
  function probeSprite(el, urls, fallbackEmoji) {
    let i = 0;
    const list = urls.filter(Boolean);
    const tryNext = () => {
      if (i >= list.length) {
        console.error("[BattleArena] sprite FAILED to load:", list.join(" | "));
        if (fallbackEmoji) {
          el.classList.add("jb-sprite-fallback");
          el.dataset.emoji = fallbackEmoji;
        }
        return;
      }
      const url = list[i];
      const img = new Image();
      img.onload = () => {
        el.classList.remove("jb-sprite-fallback");
        delete el.dataset.emoji;
        el.style.backgroundImage = `url('${url}')`;
      };
      img.onerror = () => {
        console.error("[BattleArena] sprite 404:", url);
        i += 1;
        tryNext();
      };
      img.src = url;
    };
    tryNext();
  }

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
      this.bt = null;

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
      this.bt = null;
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
      if (player.level < enemy.lv) {
        this._setLog(`🔒 ${enemy.name} needs Level ${enemy.lv} — you are Lv ${player.level}. Work, explore and fight weaker enemies to level up!`);
        return;
      }
      const kit = player.kit || null;
      const talentValue = (stat) => (kit && kit.talent && kit.talent.stat === stat ? Number(kit.talent.value) || 0 : 0);

      const bt = {
        player, enemy, kit,
        pHp: player.maxHp || player.hp || 60,
        eHp: enemy.hp,
        energy: 30,
        skillCd: 0,
        round: 0,
        pShield: 0,
        pStatuses: {},
        eStatuses: {},
        surviveUsed: false,
        emergencyUsed: false,
        critChance: 0.05 + talentValue("critChancePct"),
        evasionBase: talentValue("evasionPct"),
        healRecv: talentValue("healingReceivedPct"),
        atkBonusPct: talentValue("bonusAtkPct"),
      };
      this.bt = bt;
      this.inBattle = true;
      this._setLog(`\u2694\ufe0f Battle started against ${enemy.name} (Lv ${enemy.lv})!`);
      const fightBtn = this.stageMount?.querySelector("#jb-fight-btn");
      if (fightBtn) fightBtn.disabled = true;

      const pEl = this.stageMount?.querySelector(".jb-fighter.player");
      const eEl = this.stageMount?.querySelector(".jb-fighter.enemy");
      const eSprite = eEl?.querySelector(".jb-sprite-box");

      if (eSprite) {
        eSprite.style.backgroundImage = `url("${this.assetBase}/monsters/${enemy.id}/walk_sheet.png")`;
      }

      const startShieldPct = talentValue("startShieldPct");
      if (startShieldPct > 0) {
        bt.pShield = Math.round((player.maxHp || 60) * startShieldPct);
        this._floatText(pEl, `\uD83D\uDEE1\uFE0F +${bt.pShield} Shield`, "shield");
        this._setLog(`\uD83D\uDEE1\uFE0F ${player.name} starts with a ${bt.pShield} HP shield (${kit.talent.name})!`);
      }

      this._updateSkillBtn();

      const runRound = () => {
        if (!this.inBattle || !this.bt) return;
        bt.round += 1;
        bt.energy = Math.min(100, bt.energy + 7);
        if (bt.skillCd > 0) bt.skillCd -= 1;
        this._updateSkillBtn();

        if (kit && kit.talent && kit.talent.trigger === "every_n_turns" && bt.round % (kit.talent.everyTurns || 3) === 0) {
          const heal = Math.round((player.maxHp || 60) * (Number(kit.talent.value) || 0));
          if (heal > 0 && bt.pHp < (player.maxHp || 60)) {
            bt.pHp = Math.min(player.maxHp || 60, bt.pHp + heal);
            this._floatText(pEl, `\uD83D\uDC9A +${heal}`, "heal");
            this._updateHpBars(bt.pHp, player.maxHp || 60, bt.eHp, enemy.hp);
          }
        }

        const regenPct = talentValue("regenHpPct");
        if (regenPct > 0 && bt.pHp < (player.maxHp || 60)) {
          const regen = Math.max(1, Math.round((player.maxHp || 60) * regenPct));
          bt.pHp = Math.min(player.maxHp || 60, bt.pHp + regen);
          this._floatText(pEl, `\uD83D\uDC9A +${regen}`, "heal");
          this._updateHpBars(bt.pHp, player.maxHp || 60, bt.eHp, enemy.hp);
        }

        let dotTotal = 0;
        for (const st of Object.values(bt.eStatuses)) {
          if (st.tickDamage) dotTotal += st.tickDamage;
        }
        if (dotTotal > 0) {
          bt.eHp = Math.max(0, bt.eHp - dotTotal);
          this._floatText(eEl, `\u2620\uFE0F -${dotTotal}`, "dot");
          this._updateHpBars(bt.pHp, player.maxHp || 60, bt.eHp, enemy.hp);
          if (bt.eHp <= 0) { this._victory(); return; }
        }

        const pAtk = this._playerAttackDamage();
        bt.eHp = Math.max(0, bt.eHp - pAtk.total);
        pEl?.classList.add("attack-right");
        eEl?.classList.add("hit-flash");
        this._updateHpBars(bt.pHp, player.maxHp || 60, bt.eHp, enemy.hp);
        this._floatText(eEl, `-${pAtk.total}`, pAtk.crit ? "crit" : "dmg");
        this._setLog(pAtk.crit
          ? `\uD83D\uDCA5 CRIT! ${player.name} hits ${enemy.name} for ${pAtk.total} DMG!`
          : `\uD83D\uDCA5 ${player.name} hits ${enemy.name} for ${pAtk.total} DMG!`);

        if (pAtk.crit && kit && kit.talent && kit.talent.trigger === "on_crit") {
          const procChance = kit.isEvo && kit.talent.evoProcChance != null ? kit.talent.evoProcChance : (kit.talent.procChance || 0);
          if (Math.random() < procChance && bt.skillCd > 0) {
            bt.skillCd -= 1;
            this._floatText(pEl, "\u23F1\uFE0F CD -1", "buff");
            this._updateSkillBtn();
          }
        }

        setTimeout(() => {
          pEl?.classList.remove("attack-right");
          eEl?.classList.remove("hit-flash");

          if (bt.eHp <= 0) { this._victory(); return; }

          const stunned = "stun" in bt.eStatuses || "freeze_slow" in bt.eStatuses;
          const blind = bt.eStatuses.blind ? bt.eStatuses.blind.value : 0;
          const evasion = (bt.evasionBase || 0) + (bt.pStatuses.self_spd_up ? bt.pStatuses.self_spd_up.value : 0);
          const dodged = !stunned && Math.random() < (evasion || 0);

          if (stunned || dodged || Math.random() < (blind || 0)) {
            if (stunned) this._setLog(`\uD83D\uDCAB ${enemy.name} is stunned and loses the turn!`);
            else if (dodged) this._setLog(`\uD83C\uDF00 ${player.name} dodged ${enemy.name}'s attack!`);
            else this._setLog(`\uD83C\uDF2B\uFE0F ${enemy.name}'s attack missed (blinded)!`);
            this._tickStatusesEnd();
            this.battleTimer = setTimeout(runRound, 650);
            return;
          }

          const rawEnemyDmg = Math.max(2, enemy.atk - Math.floor((player.def || 4) * 0.35));
          const atkDown = bt.eStatuses.atk_down ? bt.eStatuses.atk_down.value : 0;
          const eDmg = Math.max(2, Math.round(rawEnemyDmg * (1 - atkDown) * (0.85 + Math.random() * 0.3)));
          eEl?.classList.add("attack-left");
          pEl?.classList.add("hit-flash");
          this._setLog(`\uD83D\uDD25 ${enemy.name} strikes back for ${eDmg} DMG!`);

          setTimeout(() => {
            eEl?.classList.remove("attack-left");
            pEl?.classList.remove("hit-flash");
            const died = this._playerTakeDamage(eDmg);
            if (died) return;
            this._tickStatusesEnd();
            this.battleTimer = setTimeout(runRound, 650);
          }, 320);
        }, 320);
      };

      this.battleTimer = setTimeout(runRound, 400);
    }

    /** Compute one basic-attack damage roll, applying talents & statuses */
    _playerAttackDamage() {
      const bt = this.bt;
      const player = bt.player;
      const talent = bt.kit && bt.kit.talent;
      let base = player.atk || 10;
      const atkUp = bt.pStatuses.self_atk_up ? bt.pStatuses.self_atk_up.value : 0;
      base *= 1 + atkUp + (bt.atkBonusPct || 0);
      if (talent && talent.trigger === "on_turn_1" && bt.round === 1) base *= 1 + (Number(talent.value) || 0);
      if (talent && talent.trigger === "on_attack" && talent.condition === "enemy_hp_below_50" && bt.eHp < bt.enemy.hp * 0.5) {
        base *= 1 + (Number(talent.value) || 0);
      }
      if (bt.eStatuses.def_down) base *= 1 + bt.eStatuses.def_down.value;
      const crit = Math.random() < (bt.critChance || 0.05);
      if (crit) base *= 1.5;
      let dmg = Math.max(2, Math.round(base * (0.85 + Math.random() * 0.35)));
      if (bt.eStatuses.spd_down || bt.eStatuses.freeze_slow) {
        dmg += Math.max(1, Math.round((player.atk || 10) * 0.5));
      }
      return { total: dmg, crit };
    }

    /** Apply damage to the player (shield absorb, talents, survive-once); returns true if the pet died */
    _playerTakeDamage(raw) {
      const bt = this.bt;
      const player = bt.player;
      let dmg = raw;
      if (bt.kit && bt.kit.talent && bt.kit.talent.trigger === "on_hit_taken" && bt.kit.talent.stat === "damageReductionPct") {
        dmg *= 1 - (Number(bt.kit.talent.value) || 0);
      }
      dmg = Math.max(0, Math.round(dmg));
      if (bt.pShield > 0 && dmg > 0) {
        const absorbed = Math.min(bt.pShield, dmg);
        bt.pShield -= absorbed;
        dmg -= absorbed;
        if (absorbed > 0) this._floatText(this.stageMount?.querySelector(".jb-fighter.player"), `\uD83D\uDEE1\uFE0F -${absorbed}`, "shield");
      }
      bt.pHp = Math.max(0, bt.pHp - dmg);
      if (dmg > 0) this._floatText(this.stageMount?.querySelector(".jb-fighter.player"), `-${dmg}`, "dmg");
      this._updateHpBars(bt.pHp, player.maxHp || 60, bt.eHp, bt.enemy.hp);

      if (!bt.emergencyUsed && bt.kit && bt.kit.talent && bt.kit.talent.stat === "emergencyHealPct"
          && bt.pHp > 0 && bt.pHp < (player.maxHp || 60) * 0.3) {
        bt.emergencyUsed = true;
        const heal = Math.round((player.maxHp || 60) * (Number(bt.kit.talent.value) || 0));
        bt.pHp = Math.min(player.maxHp || 60, bt.pHp + heal);
        this._floatText(this.stageMount?.querySelector(".jb-fighter.player"), `\uD83D\uDC3B +${heal}`, "heal");
        this._updateHpBars(bt.pHp, player.maxHp || 60, bt.eHp, bt.enemy.hp);
      }

      if (bt.pHp <= 0 && !bt.surviveUsed && bt.kit && bt.kit.talent && bt.kit.talent.stat === "surviveOnceHpPct") {
        bt.surviveUsed = true;
        bt.pHp = Math.max(1, Math.round((player.maxHp || 60) * (Number(bt.kit.talent.value) || 0)));
        this._floatText(this.stageMount?.querySelector(".jb-fighter.player"), "\u2728 SURVIVED!", "heal");
        this._setLog(`\uD83D\uDC31 Nine Lives! ${player.name} survives with ${bt.pHp} HP!`);
      }

      if (bt.pHp <= 0) {
        this.inBattle = false;
        this._updateSkillBtn();
        const isFullDeath = this.deathState.deathCount >= 2;
        this.triggerPetDeath(isFullDeath);
        this.bt = null;
        return true;
      }
      return false;
    }

    /** Victory handler shared by basic attacks and Active Skill kills */
    _victory() {
      const bt = this.bt;
      this.inBattle = false;
      const talent = bt.kit && bt.kit.talent;
      const goldBonus = talent && talent.stat === "arenaGoldBonusPct" ? (Number(talent.value) || 0) : 0;
      const baseGold = Math.floor(bt.enemy.goldMin + Math.random() * (bt.enemy.goldMax - bt.enemy.goldMin + 1));
      const goldGain = Math.round(baseGold * (1 + goldBonus));
      const eSprite = this.stageMount?.querySelector(".jb-fighter.enemy .jb-sprite-box");
      if (eSprite) {
        eSprite.style.backgroundImage = `url("${this.assetBase}/monsters/${bt.enemy.id}/idle_sheet.png")`;
      }
      this.addReward({ gold: goldGain, xp: bt.enemy.xp, monster: bt.enemy });
      this._setLog(`\uD83C\uDFC6 Victory! Earned +${goldGain} Gold & +${bt.enemy.xp} XP!${goldBonus > 0 ? ` (${talent.name} +${Math.round(goldBonus * 100)}%)` : ""}`);
      const fightBtn = this.stageMount?.querySelector("#jb-fight-btn");
      if (fightBtn) fightBtn.disabled = false;
      this.bt = null;
      this._updateSkillBtn();
    }

    /** Decrement status durations at the end of a full round */
    _tickStatusesEnd() {
      const bt = this.bt;
      if (!bt) return;
      for (const dict of [bt.eStatuses, bt.pStatuses]) {
        for (const [key, st] of Object.entries(dict)) {
          st.turns -= 1;
          if (st.turns <= 0) delete dict[key];
        }
      }
      this._updateSkillBtn();
    }

    /** Use the Active Skill (energy cost + cooldown + VFX + effects) */
    useSkill() {
      if (!this.inBattle || !this.bt) return;
      const bt = this.bt;
      const kit = bt.kit;
      if (!kit || !kit.skill) return;
      if (bt.skillCd > 0 || bt.energy < (kit.skill.energyCost || 0)) return;

      bt.energy -= kit.skill.energyCost || 0;
      bt.skillCd = kit.skill.cooldown || 1;
      const pEl = this.stageMount?.querySelector(".jb-fighter.player");
      const eEl = this.stageMount?.querySelector(".jb-fighter.enemy");

      if (kit.talent && kit.talent.trigger === "on_skill_use") {
        const refund = Number(kit.talent.value) || 0;
        bt.energy = Math.min(100, bt.energy + refund);
        this._floatText(pEl, `\u26A1 +${refund}`, "buff");
      }

      this._setLog(`\u2728 ${bt.player.name} uses ${kit.skill.name}!`);
      this._updateSkillBtn();

      if (kit.skill.type === "heal") {
        const heal = Math.round((bt.player.maxHp || 60) * (kit.skill.healPct || 0) * (1 + (bt.healRecv || 0)));
        bt.pHp = Math.min(bt.player.maxHp || 60, bt.pHp + heal);
        this._floatText(pEl, `\uD83D\uDC9A +${heal}`, "heal");
        this._updateHpBars(bt.pHp, bt.player.maxHp || 60, bt.eHp, bt.enemy.hp);
        this._playVfx(pEl, kit.skill);
        this._setLog(`\uD83E\uDEB7 ${kit.skill.name} restores ${heal} HP!`);
        return;
      }

      this._playVfx(eEl, kit.skill);
      const hits = Math.max(1, kit.skill.hits || 1);
      let total = 0;
      let anyCrit = false;
      for (let i = 0; i < hits; i++) {
        let dmg = (bt.player.atk || 10) * (kit.skill.multiplier || 1);
        dmg *= 0.9 + Math.random() * 0.25;
        const atkUp = bt.pStatuses.self_atk_up ? bt.pStatuses.self_atk_up.value : 0;
        dmg *= 1 + atkUp + (bt.atkBonusPct || 0);
        if (bt.eStatuses.def_down) dmg *= 1 + bt.eStatuses.def_down.value;
        const critChance = (bt.critChance || 0.05) + (kit.skill.bonusCritChance || 0);
        if (Math.random() < critChance) { dmg *= 1.5; anyCrit = true; }
        total += Math.max(2, Math.round(dmg));
      }
      bt.eHp = Math.max(0, bt.eHp - total);
      eEl?.classList.add("hit-flash");
      this._floatText(eEl, `-${total}${anyCrit ? " \uD83D\uDCA5" : ""}`, "dmg");
      this._updateHpBars(bt.pHp, bt.player.maxHp || 60, bt.eHp, bt.enemy.hp);
      this._setLog(`\u2728 ${kit.skill.name} hits ${bt.enemy.name} for ${total} DMG${hits > 1 ? ` (${hits} hits)` : ""}!`);

      const effect = kit.skill.effect || {};
      const status = effect.status;
      const effValue = kit.isEvo && effect.evoValue != null ? effect.evoValue : effect.value;
      const effChance = kit.isEvo && effect.evoChance != null ? effect.evoChance : effect.chance;

      if (status === "self_atk_up") {
        bt.pStatuses.self_atk_up = { value: effValue || 0, turns: effect.duration || 2 };
        this._floatText(pEl, "\u2B06\uFE0F ATK UP", "buff");
      } else if (status === "self_shield_pct") {
        bt.pShield += Math.round((bt.player.maxHp || 60) * (effValue || 0));
        this._floatText(pEl, "\uD83D\uDEE1\uFE0F SHIELD", "shield");
      } else if (status === "self_spd_up") {
        bt.pStatuses.self_spd_up = { value: effValue || 0, turns: effect.duration || 2 };
        this._floatText(pEl, "\uD83D\uDCA8 SPEED UP", "buff");
      } else if (status && status !== "none" && Math.random() < (effChance != null ? effChance : 1)) {
        const tickDamage = status === "poison"
          ? Math.max(1, Math.round((bt.enemy.hp || 100) * (effect.tickPctMaxHp || 0)))
          : (status === "bleed" || status === "burn")
            ? Math.max(1, Math.round((bt.enemy.atk || 10) * (effect.tickAtkPct || 0)))
            : 0;
        bt.eStatuses[status] = { value: effValue || 0, turns: effect.duration || 2, tickDamage };
        this._floatText(eEl, status.replace(/_/g, " ").toUpperCase(), "debuff");
      }

      if (kit.skill.type === "attack_heal") {
        const selfHeal = kit.isEvo && kit.skill.evoSelfHealPct != null ? kit.skill.evoSelfHealPct : kit.skill.selfHealPct;
        const heal = Math.round((bt.player.maxHp || 60) * (selfHeal || 0) * (1 + (bt.healRecv || 0)));
        bt.pHp = Math.min(bt.player.maxHp || 60, bt.pHp + heal);
        this._floatText(pEl, `\uD83D\uDC9A +${heal}`, "heal");
      }

      this._updateHpBars(bt.pHp, bt.player.maxHp || 60, bt.eHp, bt.enemy.hp);

      setTimeout(() => {
        eEl?.classList.remove("hit-flash");
        if (bt.eHp <= 0) { this._victory(); return; }
        this._updateSkillBtn();
      }, 500);
    }

    /** Play the 8-frame 192px VFX sheet over a fighter */
    _playVfx(targetEl, skill) {
      if (!targetEl || !skill || !skill.vfxUrl) return;
      const vfx = document.createElement("div");
      vfx.className = "jb-vfx-overlay";
      vfx.style.backgroundImage = `url('${skill.vfxUrl}')`;
      const frames = skill.vfxFrames || 8;
      const fps = skill.vfxFps || 12;
      vfx.style.setProperty("--vfx-frames", String(frames));
      vfx.style.animationDuration = `${(frames / fps).toFixed(2)}s`;
      targetEl.appendChild(vfx);
      setTimeout(() => vfx.remove(), (frames / fps) * 1000 + 100);
    }

    /** Floating combat text over a fighter */
    _floatText(fighterEl, text, kind) {
      if (!fighterEl) return;
      const span = document.createElement("span");
      span.className = `jb-float-text ${kind || ""}`.trim();
      span.textContent = text;
      span.style.left = `${25 + Math.random() * 50}%`;
      fighterEl.appendChild(span);
      setTimeout(() => span.remove(), 1000);
    }

    /** Sync the Active Skill button, energy bar and cooldown badge */
    _updateSkillBtn() {
      const btn = this.stageMount?.querySelector("#jb-skill-btn");
      const bar = this.stageMount?.querySelector("#jb-energy-bar");
      const txt = this.stageMount?.querySelector("#jb-energy-txt");
      const cd = this.stageMount?.querySelector("#jb-skill-cd");
      const bt = this.bt;
      const energy = bt ? bt.energy : 0;
      if (bar) bar.style.width = `${Math.max(0, Math.min(100, energy))}%`;
      if (txt) txt.textContent = `\u26A1 ${energy}/100`;
      if (!btn) return;
      if (!bt || !bt.kit || !bt.kit.skill) {
        btn.disabled = true;
        btn.title = "No Active Skill \u2014 hatch a pet with a battle kit!";
        if (cd) cd.classList.add("hidden");
        return;
      }
      const kit = bt.kit;
      const onCd = bt.skillCd > 0;
      const noEnergy = energy < (kit.skill.energyCost || 0);
      btn.disabled = !this.inBattle || onCd || noEnergy;
      if (cd) {
        cd.textContent = String(bt.skillCd);
        cd.classList.toggle("hidden", !onCd);
      }
      btn.title = `${kit.skill.name} \u2014 ${kit.skill.desc}`;
    }

    /** Render the Battle Arena Stage HTML */
    renderArenaStage(walkInEnemy = false) {
      if (!this.stageMount) return;
      this._refreshDeathTimers();

      const player = this.getPlayer();
      const enemy = this.selectedMonster;
      const kit = player.kit || null;
      const petOverride = this.getActivePetSpriteOverride("idle");
      const petSprite = petOverride || player.sheetUrl || player.spriteUrl;
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
            <div class="jb-sprite-box${!petOverride && player.sheetFrames === 8 ? " jb-sprite-8" : ""}" style="background-image:url('${petSprite}')"></div>
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
            <div class="jb-skill-controls">
              <div class="jb-energy-wrap" title="Battle Energy (charges +7 per round)">
                <div class="jb-energy-fill" id="jb-energy-bar" style="width:30%"></div>
                <span id="jb-energy-txt">\u26a1 30/100</span>
              </div>
              <button class="jb-skill-btn" id="jb-skill-btn" type="button" ${kit && kit.skill ? "" : "disabled"}>
                ${kit && kit.skill ? `<img src="${this.assetBase}/battle/${kit.skill.iconUrl}" alt="" />` : "\ud83d\udc3e"}
                <span class="jb-skill-label">${kit && kit.skill ? kit.skill.name : "No Skill"}</span>
                ${kit && kit.skill ? `<span class="jb-skill-cost">\u26a1${kit.skill.energyCost}</span>` : ""}
                <span class="jb-skill-cd hidden" id="jb-skill-cd">0</span>
              </button>
            </div>
            <button class="jb-arena-btn danger" id="jb-fight-btn" ${this.isLockedOut() ? "disabled" : ""}>⚔️ Fight ${enemy.name}</button>
          </div>

          ${deathOverlayHtml}
        </div>
      `;

      const pSpriteEl = this.stageMount.querySelector(".jb-fighter.player .jb-sprite-box");
      if (pSpriteEl) probeSprite(pSpriteEl, [petSprite, player.spriteUrl], "\ud83d\udc3e");

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
      this.stageMount.querySelector("#jb-skill-btn")?.addEventListener("click", () => this.useSkill());
      this._updateSkillBtn();
      this.stageMount.querySelector("#jb-shop-btn")?.addEventListener("click", () => this.openReviveShopModal());
      this.stageMount.querySelector("#jb-open-revive-shop")?.addEventListener("click", () => this.openReviveShopModal());
    }

    /** Render the 8 selectable animated monster cards */
    renderEnemySelector() {
      if (!this.selectorMount) return;
      const playerLevel = (this.getPlayer() || {}).level || 1;
      this.selectorMount.innerHTML = `
        <div class="jb-selector-topbar">
          <button class="jb-arena-btn secondary" id="jb-selector-back" type="button">\u2190 Back to Home</button>
          <span class="jb-selector-title">\u2694\ufe0f Choose your opponent</span>
        </div>
        <div class="jb-enemy-grid">
          ${MONSTERS.map((m) => `
            <div class="jb-enemy-card ${this.selectedMonster.id === m.id ? "selected" : ""}" data-monster="${m.id}">
              <div class="jb-enemy-card-sprite" style="background-image:url('${this.assetBase}/monsters/${m.id}/idle_sheet.png')"></div>
              <div class="jb-enemy-name">${m.name}</div>
              <div class="jb-enemy-meta">${playerLevel >= m.lv ? "Lv " + m.lv : "🔒 Lv " + m.lv} • HP ${m.hp} • ATK ${m.atk}<br/>🪙 ${m.goldMin}-${m.goldMax}g • +${m.xp}xp<br/><span class="jb-limited-tag">🎁 Limited Drop: ${m.limitedDrop && m.limitedDrop.enabled ? "Active" : "Soon"}</span></div>
              <button class="jb-arena-btn ${this.selectedMonster.id === m.id ? "danger" : "secondary"}" type="button">
                ${this.selectedMonster.id === m.id ? "Selected" : "Choose"}
              </button>
            </div>
          `).join("")}
        </div>
      `;

      this.selectorMount.querySelector("#jb-selector-back")?.addEventListener("click", () => this.exitArena());
      this.selectorMount.querySelectorAll(".jb-enemy-card").forEach((card) => {
        card.addEventListener("click", () => {
          const m = MONSTERS.find((mo) => mo.id === card.dataset.monster);
          if (m && playerLevel < m.lv) {
            this._setLog(`🔒 ${m.name} needs Level ${m.lv} — keep grinding! (You are Lv ${playerLevel})`);
            return;
          }
          this.selectEnemy(card.dataset.monster);
        });
        const m = MONSTERS.find((mo) => mo.id === card.dataset.monster);
        if (!m) return;
        const spriteEl = card.querySelector(".jb-enemy-card-sprite");
        if (spriteEl) {
          probeSprite(spriteEl, [
            `${this.assetBase}/monsters/${m.id}/idle_sheet.png`,
            `${this.assetBase}/monsters/${m.id}/walk_sheet.png`,
          ], m.icon || "\ud83d\udc3e");
        }
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
