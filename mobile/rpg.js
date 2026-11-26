
// ===== RPG layer: battle, explore, path, waste (Gear & Cozy Bag disabled for rework) =====

function rpgUnlockInfo(d, id) {
  return d.rpg.unlocks.find((u) => u.id === id);
}

function pointsFillColor(points) {
  return points > 0 ? ' \u2014 tap a stat!' : '';
}

const monsterCards = {};

function renderBattle(d) {
  const r = d.rpg;
  const lock = $('m-battle-lock');
  const unlock = rpgUnlockInfo(d, 'battle');
  const stats = $('m-battle-stats');
  const pointsRow = $('m-points-row');
  const grid = $('m-monsters');
  const record = $('m-battle-record');
  if (!unlock.unlocked) {
    lock.classList.remove('hidden');
    lock.textContent = `${unlock.icon} ${unlock.name} unlocks after ${unlock.day} days of play \u2014 ${unlock.daysLeft} day${unlock.daysLeft === 1 ? '' : 's'} to go! Keep visiting your buddy daily.`;
    stats.classList.add('hidden');
    pointsRow.classList.add('hidden');
    grid.innerHTML = '';
    record.textContent = '';
    return;
  }
  lock.classList.add('hidden');
  stats.classList.remove('hidden');
  const gb = r.battle.gearBonus;
  stats.textContent = `\u2694\uFE0F ${r.battle.atk}\u00b7\u2191 | \u{1F6E1}\uFE0F ${r.battle.def}\u00b7\u2191 | \u{1F4A8} ${r.battle.spd}\u00b7\u2191` +
    ` | wins ${r.battle.wins} \u00b7 losses ${r.battle.losses}` +
    (gb.atk || gb.def || gb.spd ? ` | gear \u2b50 +${gb.atk}/+${gb.def}/+${gb.spd}` : '');
  pointsRow.classList.remove('hidden');
  $('m-points-label').textContent = `${r.statPoints} stat point${r.statPoints === 1 ? '' : 's'} left (every level up = +2)${pointsFillColor(r.statPoints)}`;
  for (const b of pointsRow.querySelectorAll('.m-stat')) {
    b.disabled = state.dead || r.statPoints <= 0;
    const k = b.dataset.stat;
    b.textContent = `+ ${k.toUpperCase()} (${r.allocated[k] || 0})`;
  }
  const now = Date.now();
  const cd = Math.max(0, r.cooldownMs);
  grid.innerHTML = '';
  for (const mo of r.monsters) {
    let row = monsterCards[mo.id] || document.createElement('div');
    if (!monsterCards[mo.id]) {
      row.className = 'activity-item';
      row.innerHTML = `
        <div>
          <div class="a-name"></div>
          <div class="a-desc"></div>
          <div class="a-rewards"></div>
        </div>
        <button class="btn a-btn"></button>`;
      row.querySelector('.a-btn').addEventListener('click', () => {
        const res = run('battleMonster', { monsterId: mo.id });
        if (window.__jbBgmBattle) try { window.__jbBgmBattle(); } catch (e) {}
        if (res && res.ok !== false && res.win) {
          for (let i = 0; i < 6; i += 1) {
            particles.push({ kind: 'coin', x: 120 + (Math.random() - 0.5) * 90, y: 70, vy: -0.5, life: 1, size: 18, wobble: 0 });
          }
        }
      });
      monsterCards[mo.id] = row;
    }
    row.querySelector('.a-name').textContent = `${mo.icon} ${mo.name} (Lv ${mo.lvl})`;
    row.querySelector('.a-desc').textContent = `HP ${mo.hp} \u00b7 ATK ${mo.atk} \u00b7 DEF ${mo.def}`;
    row.querySelector('.a-rewards').textContent = `\u26a1${mo.energy} \u00b7 \u{1F4B0}${mo.coins} \u00b7 +${mo.xp} XP`;
    row.classList.toggle('locked', !mo.canFight && state.pet.level < mo.lvl);
    const btn = row.querySelector('.a-btn');
    if (state.dead) {
      btn.disabled = true;
      btn.textContent = '...';
    } else if (state.pet.level < mo.lvl) {
      btn.disabled = true;
      btn.textContent = `Lv ${mo.lvl}+`;
    } else if (state.meters.energy < mo.energy) {
      btn.disabled = true;
      btn.textContent = 'Tired';
    } else if (cd > 0) {
      btn.disabled = true;
      btn.textContent = `${Math.ceil(cd / 1000)}s`;
    } else {
      btn.disabled = false;
      btn.textContent = 'Fight';
    }
    grid.appendChild(row);
  }
  record.textContent = `Battle log: ${r.battle.wins} wins, ${r.battle.losses} losses \u2014 20s rest between fights.`;
}

const exploreCards = {};

function renderExplore(d) {
  const list = $('m-explore-list');
  list.innerHTML = '';
  for (const a of d.activities.filter((x) => x.outdoor)) {
    let row = exploreCards[a.id] || document.createElement('div');
    if (!exploreCards[a.id]) {
      row.className = 'activity-item';
      row.innerHTML = `
        <div>
          <div class="a-name"></div>
          <div class="a-desc"></div>
          <div class="a-rewards"></div>
        </div>
        <button class="btn a-btn"></button>
        <div class="activity-progress"><div class="pfill"></div></div>`;
      row.querySelector('.a-btn').addEventListener('click', () => run('startActivity', { activityId: a.id }));
      exploreCards[a.id] = row;
    }
    row.querySelector('.a-name').textContent = `${a.icon} ${a.name}`;
    row.querySelector('.a-desc').textContent = a.desc;
    row.querySelector('.a-rewards').textContent = `\u26a1${a.energy} \u00b7 \u{1F4B0}${a.coins[0]}\u2013${a.coins[1]} \u00b7 +${a.xp} XP \u00b7 ${a.duration}s`;
    const btn = row.querySelector('.a-btn');
    if (a.active) {
      btn.disabled = true;
      btn.textContent = 'Exploring...';
    } else if (a.cooldownRemainingMs > 0) {
      btn.disabled = true;
      btn.textContent = `${Math.ceil(a.cooldownRemainingMs / 1000)}s`;
    } else {
      btn.disabled = state.dead || state.flags.sleeping || state.meters.energy < a.energy;
      btn.textContent = 'Go';
    }
    const prog = row.querySelector('.activity-progress');
    if (a.active) {
      prog.classList.add('on');
      prog.querySelector('.pfill').style.width =
        `${Math.round(Math.max(0, Math.min(100, 100 - ((a.endsAt - Date.now()) / (a.duration * 1000)) * 100)))}%`;
    } else {
      prog.classList.remove('on');
    }
    row.classList.toggle('active', a.active);
    list.appendChild(row);
  }
}

function renderPath(d) {
  const r = d.rpg;
  const lock = $('m-path-lock');
  const unlock = rpgUnlockInfo(d, 'path');
  const stateEl = $('m-path-state');
  const cards = $('m-path-cards');
  if (!unlock.unlocked) {
    lock.classList.remove('hidden');
    lock.textContent = `${unlock.icon} ${unlock.name} unlocks after ${unlock.day} days of play \u2014 ${unlock.daysLeft} day${unlock.daysLeft === 1 ? '' : 's'} to go! Once chosen, it is forever.`;
    stateEl.classList.add('hidden');
    cards.classList.add('hidden');
    return;
  }
  lock.classList.add('hidden');
  if (state.path) {
    const labels = { work: '\u{1F4BC} Work Path \u2014 +50% coin rate forever', battle: '\u2694\uFE0F Battle Path \u2014 +15% ATK & DEF forever' };
    stateEl.classList.remove('hidden');
    stateEl.textContent = `\u2728 Destiny chosen: ${labels[state.path] || state.path}`;
    cards.classList.add('hidden');
    return;
  }
  stateEl.classList.add('hidden');
  cards.classList.remove('hidden');
  if (!cards.childElementCount) {
    cards.innerHTML = `
      <div class="m-path-card work">
        <h4>\u{1F4BC} Work</h4>
        <p>+50% coin rate forever \u00b7 the hustle path</p>
        <button class="btn" data-path="work">Choose Work</button>
      </div>
      <div class="m-path-card fight">
        <h4>\u2694\uFE0F Battle</h4>
        <p>+15% ATK &amp; DEF forever \u00b7 the warrior path</p>
        <button class="btn" data-path="battle">Choose Battle</button>
      </div>`;
  }
}

function renderWasteUi(d) {
  const btn = $('m-waste-clean');
  if (!btn) return;
  if (d.waste && d.waste.length) {
    btn.classList.remove('hidden');
    btn.textContent = `\u{1F9F9} Clean Up Mess (${d.waste.length})`;
    btn.disabled = state.dead;
  } else {
    btn.classList.add('hidden');
  }
}

// ===== RPG handlers =====

for (const b of document.querySelectorAll('.m-stat')) {
  b.addEventListener('click', () => run('allocateStat', { statId: b.dataset.stat }));
}

const wasteBtn = $('m-waste-clean');
if (wasteBtn) wasteBtn.addEventListener('click', () => {
  let n = 0;
  while (state.waste && state.waste.length) {
    const r = engine.cleanWaste(state, 0);
    if (!r || !r.ok) break;
    n += 1;
  }
  if (n) showToast(`\u{1F9F9} Cleaned ${n} mess${n === 1 ? '' : 'es'}! Buddy says salamat!`);
  render(engine.derivedStats(state));
});

const pathCards = $('m-path-cards');
if (pathCards) pathCards.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-path]');
  if (!btn) return;
  if (!window.confirm(`Destiny is permanent \u2014 forever choose the ${btn.dataset.path.toUpperCase()} path?`)) return;
  run('choosePath', { pathId: btn.dataset.path });
});

// Wrap the base render so every tick also refreshes the RPG layers.
const baseRender = render;
render = function wrappedRender(d) {
  baseRender(d);
  try {
    renderWasteUi(d);
    renderBattle(d);
    renderExplore(d);
    renderPath(d);
  } catch (err) {
    /* RPG layer keeps UI alive even if a card fails */
  }
};

render(engine.derivedStats(state));

// ==== Level-up perk modal ====
let perkKeyShownMobile = null;

function perkDescMobile(perk) {
  const b = Math.round(perk.bonus * 100);
  if (perk.type === 'coins') return `+${b}% coins (work & battles)`;
  if (perk.type === 'xp') return `+${b}% XP from everything`;
  if (perk.type === 'energy') return `Energy drains ${b}% slower (longer life!)`;
  return `Sleep recovers +${b}% energy`;
}

const PERK_LABELS = { coins: ['\u{1FA99}', 'Golden Touch'], xp: ['\u2B50', 'Star Spirit'], energy: ['\u{1F50B}', 'Iron Heart'], rest: ['\uD83D\uDE34', 'Deep Dreams'] };

function renderPerkModal(d) {
  const modal = document.getElementById('m-perk-modal');
  if (!modal || !d.perks) return;
  const pending = d.perks.pending;
  if (!pending) {
    if (perkKeyShownMobile) { modal.classList.add('hidden'); perkKeyShownMobile = null; }
    return;
  }
  const key = `${pending.at}:${(pending.choices || []).map((c) => `${c.type}${c.rarity}`).join(',')}`;
  if (perkKeyShownMobile === key && !modal.classList.contains('hidden')) return;
  perkKeyShownMobile = key;
  const wrap = document.getElementById('m-perk-choices');
  if (wrap) {
    wrap.innerHTML = '';
    (pending.choices || []).forEach((c, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `btn wide m-perk-choice ${c.rarity === 'epic' ? 'epic' : ''}`;
      btn.dataset.perkIdx = String(i);
      const info = PERK_LABELS[c.type] || ['\uD83E\uDDF0', c.type];
      btn.innerHTML = '<b class="pk-name"></b><span class="pk-desc"></span>';
      btn.querySelector('.pk-name').textContent = `${info[0]} ${c.rarity === 'epic' ? '\u2728 Epic ' : ''}${info[1]}`;
      btn.querySelector('.pk-desc').textContent = perkDescMobile(c);
      wrap.appendChild(btn);
    });
  }
  modal.classList.remove('hidden');
}

document.addEventListener('click', async (e) => {
  const btn = e.target && e.target.closest ? e.target.closest('button[data-perk-idx]') : null;
  if (!btn) return;
  const res = run('choosePerk', { index: Number(btn.dataset.perkIdx) });
  const modal = document.getElementById('m-perk-modal');
  if (res && res.ok) {
    if (modal) modal.classList.add('hidden');
    perkKeyShownMobile = null;
    if (sfx) sfx.play(res.perk && res.perk.rarity === 'epic' ? 'evolve' : 'levelup');
    showToast((res && res.message) || 'Perk claimed!', 3200);
    render(engine.derivedStats(state));
  }
});

const baseWrapped = render;
render = function renderWithPerks(d) {
  baseWrapped(d);
  try {
    renderPerkModal(d);
  } catch (err) {
    /* keep UI alive */
  }
};

renderPerkModal(engine.derivedStats(state));
