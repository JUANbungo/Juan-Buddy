'use strict';

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.JBSprites = api;
})(typeof self !== 'undefined' ? self : this, function () {
    class PixelGrid {
      constructor(w = 32, h = 32) {
        this.w = w;
        this.h = h;
        this.grid = Array.from({ length: h }, () => Array(w).fill(null));
      }
      px(x, y, c) {
        const ix = Math.round(x), iy = Math.round(y);
        if (ix >= 0 && ix < this.w && iy >= 0 && iy < this.h) this.grid[iy][ix] = c;
      }
      get(x, y) {
        if (x < 0 || x >= this.w || y < 0 || y >= this.h) return null;
        return this.grid[y][x];
      }
      rect(x, y, w, h, c) {
        for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) this.px(x + dx, y + dy, c);
      }
      oval(cx, cy, rx, ry, c) {
        for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
          for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
            const nx = (x - cx) / rx, ny = (y - cy) / ry;
            if (nx * nx + ny * ny <= 1.0) this.px(x, y, c);
          }
        }
      }
      line(x0, y0, x1, y1, c) {
        let ix0 = Math.round(x0), iy0 = Math.round(y0);
        const ix1 = Math.round(x1), iy1 = Math.round(y1);
        const dx = Math.abs(ix1 - ix0), sx = ix0 < ix1 ? 1 : -1;
        const dy = -Math.abs(iy1 - iy0), sy = iy0 < iy1 ? 1 : -1;
        let err = dx + dy;
        while (true) {
          this.px(ix0, iy0, c);
          if (ix0 === ix1 && iy0 === iy1) break;
          const e2 = 2 * err;
          if (e2 >= dy) { err += dy; ix0 += sx; }
          if (e2 <= dx) { err += dx; iy0 += sy; }
        }
      }
      applyOutline(color = '#201b29') {
        const pts = [];
        const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
        for (let y = 0; y < this.h; y++) {
          for (let x = 0; x < this.w; x++) {
            if (!this.grid[y][x]) {
              for (const [dx, dy] of dirs) {
                if (this.get(x + dx, y + dy)) { pts.push([x, y]); break; }
              }
            }
          }
        }
        for (const [x, y] of pts) this.grid[y][x] = color;
      }
      toCanvas() {
        const c = document.createElement('canvas');
        c.width = this.w;
        c.height = this.h;
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, this.w, this.h);
        for (let y = 0; y < this.h; y++) {
          for (let x = 0; x < this.w; x++) {
            if (this.grid[y][x]) {
              ctx.fillStyle = this.grid[y][x];
              ctx.fillRect(x, y, 1, 1);
            }
          }
        }
        return c;
      }
    }

    function drawCuteFace(g, lx, rx, y, state, f, eyeColor = '#1c1824', blushColor = '#f48fb1') {
      if (state === 'SLEEP') {
        g.rect(lx, y + 1, 2, 1, eyeColor);
        g.rect(rx, y + 1, 2, 1, eyeColor);
        g.px(lx - 1, y + 2, blushColor);
        g.px(rx + 2, y + 2, blushColor);
      } else if (state === 'HAPPY' || (state === 'EAT' && f % 2 === 1)) {
        g.px(lx, y + 1, eyeColor); g.px(lx + 1, y, eyeColor);
        g.px(rx, y, eyeColor); g.px(rx + 1, y + 1, eyeColor);
        g.px(lx - 1, y + 2, blushColor); g.px(rx + 2, y + 2, blushColor);
      } else if (state === 'IDLE' && f === 3) {
        g.rect(lx, y + 1, 2, 1, eyeColor);
        g.rect(rx, y + 1, 2, 1, eyeColor);
      } else {
        g.rect(lx, y, 2, 2, eyeColor);
        g.rect(rx, y, 2, 2, eyeColor);
        g.px(lx, y, '#ffffff');
        g.px(rx, y, '#ffffff');
        g.px(lx - 1, y + 2, blushColor);
        g.px(rx + 2, y + 2, blushColor);
      }
    }

    // ==========================================================================
    // 3. 3-SLOT DYNAMIC WARDROBE DEFINITIONS & OVERLAY RENDERER
    // ==========================================================================
    const WARDROBE_CATALOG = {
      head: [
        { id: 'none', name: 'None', icon: '🚫', bonus: {} },
        { id: 'mini_witch', name: 'Mini Witch Hat', icon: '🧙', bonus: { MAG: 3, LUK: 1 } },
        { id: 'flower_crown', name: 'Sampaguita Crown', icon: '🌼', bonus: { LUK: 3, DEF: 1 } },
        { id: 'gold_crown', name: 'Golden Crown', icon: '👑', bonus: { STR: 2, MAG: 2 } },
        { id: 'sakura_pin', name: 'Sakura Hairpin', icon: '🌸', bonus: { AGI: 3 } },
        { id: 'beanie', name: 'Cozy Beanie', icon: '🧶', bonus: { DEF: 3 } },
        { id: 'halo', name: 'Star Halo', icon: '😇', bonus: { MAG: 2, LUK: 2 } },
        { id: 'shades', name: 'Cool Shades', icon: '🕶️', bonus: { AGI: 2, STR: 2 } }
      ],
      neck: [
        { id: 'none', name: 'None', icon: '🚫', bonus: {} },
        { id: 'red_scarf', name: 'Red Scarf', icon: '🧣', bonus: { DEF: 2, STR: 1 } },
        { id: 'gold_bell', name: 'Gold Bell Collar', icon: '🔔', bonus: { LUK: 3 } },
        { id: 'bowtie', name: 'Dapper Bowtie', icon: '🎀', bonus: { AGI: 2, LUK: 1 } },
        { id: 'wizard_cape', name: 'Mystic Cape', icon: '🧥', bonus: { MAG: 3, DEF: 1 } }
      ],
      back: [
        { id: 'none', name: 'None', icon: '🚫', bonus: {} },
        { id: 'angel_wings', name: 'Angel Wings', icon: '🪽', bonus: { AGI: 3, DEF: 1 } },
        { id: 'lantern', name: 'Floating Lantern', icon: '🏮', bonus: { MAG: 2, LUK: 2 } },
        { id: 'stars', name: 'Sparkling Stars', icon: '✨', bonus: { LUK: 4 } },
        { id: 'hearts', name: 'Heart Aura', icon: '💖', bonus: { STR: 1, DEF: 2, LUK: 1 } }
      ]
    };

    function drawWardrobeBack(g, backId, bodyY, f) {
      const fl = (f % 2 === 0) ? 0 : -1;
      if (backId === 'angel_wings') {
        g.rect(5, bodyY - 2 + fl, 4, 5, '#f8fafc');
        g.rect(6, bodyY - 3 + fl, 3, 2, '#e2e8f0');
        g.rect(23, bodyY - 2 + fl, 4, 5, '#f8fafc');
        g.rect(23, bodyY - 3 + fl, 3, 2, '#e2e8f0');
      } else if (backId === 'lantern') {
        const ly = 6 + (f % 2 === 0 ? 0 : 1);
        g.rect(25, ly, 4, 5, '#ef4444');
        g.rect(26, ly + 1, 2, 3, '#fde047');
        g.rect(26, ly - 1, 2, 1, '#f59e0b');
        g.px(27, ly + 5, '#f59e0b');
      }
    }

    function drawWardrobeFront(g, wardrobe, headY, bodyY, f) {
      // Neck/Body item
      const n = wardrobe.neck;
      if (n === 'red_scarf') {
        g.rect(11, headY + 6, 10, 2, '#ef4444');
        g.rect(18, headY + 8, 3, 4, '#dc2626');
        g.px(13, headY + 7, '#fca5a5');
      } else if (n === 'gold_bell') {
        g.rect(12, headY + 6, 8, 1, '#dc2626');
        g.rect(15, headY + 7, 2, 2, '#fbbf24');
        g.px(15, headY + 7, '#fef08a');
      } else if (n === 'bowtie') {
        g.rect(13, headY + 6, 2, 2, '#ec4899');
        g.rect(17, headY + 6, 2, 2, '#ec4899');
        g.rect(15, headY + 6, 2, 2, '#be185d');
      } else if (n === 'wizard_cape') {
        g.rect(10, headY + 6, 12, 2, '#7c3aed');
        g.rect(19, headY + 8, 4, 6, '#5b21b6');
        g.px(15, headY + 7, '#fbbf24');
      }

      // Headgear
      const h = wardrobe.head;
      if (h === 'mini_witch') {
        const hy = headY - 4;
        g.rect(10, hy + 2, 11, 1, '#4c1d95');
        g.rect(12, hy, 7, 2, '#6d28d9');
        g.rect(13, hy - 2, 5, 2, '#7c3aed');
        g.rect(15, hy - 4, 2, 2, '#5b21b6');
        g.rect(12, hy + 1, 7, 1, '#f59e0b');
      } else if (h === 'flower_crown') {
        const hy = headY - 3;
        g.rect(10, hy, 11, 2, '#22c55e');
        g.rect(11, hy - 1, 2, 2, '#ffffff');
        g.px(12, hy, '#facc15');
        g.rect(15, hy - 1, 2, 2, '#f472b6');
        g.rect(19, hy - 1, 2, 2, '#ffffff');
      } else if (h === 'gold_crown') {
        const hy = headY - 5;
        g.rect(12, hy + 2, 7, 2, '#f59e0b');
        g.px(12, hy + 1, '#fbbf24');
        g.px(15, hy, '#fde047');
        g.px(18, hy + 1, '#fbbf24');
        g.px(15, hy + 2, '#ef4444');
      } else if (h === 'sakura_pin') {
        g.rect(18, headY - 2, 3, 3, '#f9a8d4');
        g.px(19, headY - 1, '#fef08a');
      } else if (h === 'beanie') {
        const hy = headY - 4;
        g.rect(11, hy + 1, 9, 2, '#ef4444');
        g.rect(12, hy - 1, 7, 2, '#dc2626');
        g.rect(14, hy - 2, 3, 1, '#f8fafc');
      } else if (h === 'halo') {
        const hy = headY - 6 + (f % 2 === 0 ? 0 : -1);
        g.rect(12, hy, 7, 1, '#fde047');
        g.px(11, hy + 1, '#facc15');
        g.px(19, hy + 1, '#facc15');
      } else if (h === 'shades') {
        g.rect(10, headY + 1, 4, 2, '#0f172a');
        g.rect(14, headY + 1, 3, 1, '#334155');
        g.rect(17, headY + 1, 4, 2, '#0f172a');
        g.px(11, headY + 1, '#38bdf8');
        g.px(18, headY + 1, '#38bdf8');
      }

      // Back/Aura foreground sparkles
      const b = wardrobe.back;
      if (b === 'stars') {
        const s1 = (f % 2 === 0) ? 0 : 1;
        g.px(5, 7 + s1, '#fde047');
        g.px(26, 10 - s1, '#fef08a');
        g.px(7, 20 - s1, '#38bdf8');
        g.px(25, 22 + s1, '#fde047');
      } else if (b === 'hearts') {
        const s1 = (f % 2 === 0) ? 0 : -1;
        g.px(5, 9 + s1, '#fb7185'); g.px(6, 10 + s1, '#f43f5e'); g.px(7, 9 + s1, '#fb7185');
        g.px(24, 12 - s1, '#f472b6'); g.px(25, 13 - s1, '#ec4899'); g.px(26, 12 - s1, '#f472b6');
      }
    }

    // ==========================================================================
    // 4. 13 ANIMATED 16-BIT PET DEFINITIONS (WITH INDIA PEACOCK NILA!)
    // ==========================================================================
    const STATES = ['IDLE', 'WALK', 'HAPPY', 'EAT', 'SLEEP'];
    const FRAMES_PER_STATE = 4;

    const PET_ROSTER = [
      {
        id: 'kala', name: 'Kala', country: 'Philippines', region: 'Philippines', flag: '🇵🇭',
        species: 'Carabao (Kalabaw)', favoriteFood: 'halo_halo', greeting: 'Mabuhay!',
        skillName: 'Salakot Charge', skillEmoji: '🌾', speed: 34,
        dialogues: ['Mabuhay!', 'Sarap ng Halo-Halo!', 'Kaya natin \'to!', 'Tara pahinga!'],
        drawFrame(g, state, f, wardrobe) {
          const isSleep = state === 'SLEEP', isHappy = state === 'HAPPY', isEat = state === 'EAT';
          const bob = isSleep ? (f >= 2 ? 1 : 0) : (isHappy ? (f % 2 === 1 ? -3 : -1) : (state === 'WALK' ? (f % 2 === 1 ? -1 : 0) : (f === 1 || f === 2 ? 1 : 0)));
          const headY = (isSleep ? 16 : (isEat ? 15 : 12)) + bob;
          const bodyY = (isSleep ? 21 : 19) + (isSleep ? 0 : Math.floor(bob * 0.6));
          drawWardrobeBack(g, wardrobe.back, bodyY, f);
          g.line(23, bodyY + 1, 26, bodyY + 3 + (f % 2), '#5a6373');
          g.rect(26, bodyY + 3 + (f % 2), 2, 2, '#3a414d');
          if (!isSleep) {
            const s1 = state === 'WALK' ? (f === 1 ? -2 : f === 3 ? 1 : 0) : 0;
            const s2 = state === 'WALK' ? (f === 3 ? -2 : f === 1 ? 1 : 0) : 0;
            g.rect(11, bodyY + 6 + s1, 3, 4, '#6b7587'); g.rect(11, bodyY + 9 + s1, 3, 1, '#313640');
            g.rect(19, bodyY + 6 + s2, 3, 4, '#5a6373'); g.rect(19, bodyY + 9 + s2, 3, 1, '#313640');
          } else { g.rect(10, 27, 4, 2, '#3a414d'); g.rect(19, 27, 4, 2, '#3a414d'); }
          g.oval(16.5, bodyY + 3, 7, 4.8, '#6b7587');
          g.oval(15.5, bodyY + 1.5, 5.5, 2.5, '#8590a3');
          g.line(9, headY - 1, 6, headY - 3, '#3b404c'); g.line(6, headY - 3, 7, headY - 6, '#505766');
          g.line(22, headY - 1, 25, headY - 3, '#3b404c'); g.line(25, headY - 3, 24, headY - 6, '#505766');
          g.rect(8, headY + 1, 3, 2, '#6b7587'); g.rect(20, headY + 1, 3, 2, '#6b7587');
          g.oval(15.5, headY + 2, 6, 4.8, '#778296');
          g.oval(15.5, headY + 4.8, 4.6, 2.4, '#a6b1c4');
          g.px(13, headY + 4.5, '#3a414d'); g.px(18, headY + 4.5, '#3a414d');
          g.rect(11, headY + 7, 9, 2, '#dc2626'); g.rect(13, headY + 9, 5, 2, '#b91c1c');
          const hatY = headY - 4;
          g.rect(8, hatY + 2, 15, 2, '#d97706'); g.rect(9, hatY + 1, 13, 1, '#f59e0b');
          g.rect(11, hatY, 9, 1, '#fbbf24'); g.rect(13, hatY - 1, 5, 1, '#fde68a'); g.rect(15, hatY - 3, 1, 2, '#b45309');
          drawWardrobeFront(g, wardrobe, headY, bodyY, f);
          g.applyOutline('#221f2b');
          drawCuteFace(g, 11, 18, headY + 1, state, f);
        }
      },
      {
        id: 'bantay', name: 'Bantay', country: 'Philippines', region: 'Philippines', flag: '🇵🇭',
        species: 'Aspin (Native Dog)', favoriteFood: 'pandesal', greeting: 'Tara, lakbay!',
        skillName: 'Barong Bark', skillEmoji: '🐾', speed: 44,
        dialogues: ['Tara, lakbay!', 'Arf! Mainit ang Pandesal!', 'Loyal buddy ready!', 'Magandang araw!'],
        drawFrame(g, state, f, wardrobe) {
          const isSleep = state === 'SLEEP', isHappy = state === 'HAPPY', isEat = state === 'EAT';
          const bob = isSleep ? (f >= 2 ? 1 : 0) : (isHappy ? (f % 2 === 1 ? -3 : -1) : (state === 'WALK' ? (f % 2 === 1 ? -1 : 0) : (f === 2 ? 1 : 0)));
          const headY = (isSleep ? 16 : (isEat ? 15 : 11)) + bob;
          const bodyY = (isSleep ? 21 : 18) + (isSleep ? 0 : Math.floor(bob * 0.5));
          drawWardrobeBack(g, wardrobe.back, bodyY, f);
          const wag = (f % 2 === 0) ? -1 : 1;
          g.line(22, bodyY + 2, 25, bodyY - 1 + wag, '#c27834'); g.line(25, bodyY - 1 + wag, 24, bodyY - 3 + wag, '#e6a760');
          if (!isSleep) {
            const s1 = state === 'WALK' ? (f === 1 ? -2 : f === 3 ? 1 : 0) : 0;
            const s2 = state === 'WALK' ? (f === 3 ? -2 : f === 1 ? 1 : 0) : 0;
            g.rect(11, bodyY + 6 + s1, 3, 4, '#c27834'); g.rect(11, bodyY + 9 + s1, 3, 1, '#f7e6c9');
            g.rect(19, bodyY + 6 + s2, 3, 4, '#a66024'); g.rect(19, bodyY + 9 + s2, 3, 1, '#f7e6c9');
          } else { g.rect(10, 27, 4, 2, '#f7e6c9'); g.rect(19, 27, 4, 2, '#f7e6c9'); }
          g.oval(16.5, bodyY + 3, 6.2, 4.4, '#d48a42');
          g.oval(15.5, bodyY + 4.5, 4.2, 2.2, '#f7e6c9');
          g.rect(8, headY + 1, 3, 6, '#9c561e'); g.rect(20, headY + 1, 3, 6, '#9c561e');
          g.oval(15.5, headY + 2, 5.5, 4.8, '#dc944a');
          g.oval(15.5, headY + 4.5, 3.4, 2.1, '#fbf0db');
          g.rect(15, headY + 3, 2, 2, '#231c26');
          if (isHappy || (isEat && f % 2 === 0)) g.rect(15, headY + 6, 2, 2, '#f472b6');
          g.rect(11, headY + 7, 9, 2, '#fef9ef'); g.rect(12, headY + 9, 7, 2, '#f3e5c8');
          g.px(13, headY + 8, '#d97706'); g.px(15, headY + 8, '#d97706'); g.px(17, headY + 8, '#d97706');
          drawWardrobeFront(g, wardrobe, headY, bodyY, f);
          g.applyOutline('#281c18');
          drawCuteFace(g, 11, 18, headY + 1, state, f);
        }
      },
      {
        id: 'tala', name: 'Tala', country: 'Philippines', region: 'Philippines', flag: '🇵🇭',
        species: 'Filipino Witchdog', favoriteFood: 'ube_potion', greeting: 'Abraka-Bantay!',
        skillName: 'Ube Star Hex', skillEmoji: '🔮', speed: 46,
        dialogues: ['Abraka-Bantay!', 'Ube Potion brewed!', 'Sampaguita magic!', 'Stars guide you!'],
        drawFrame(g, state, f, wardrobe) {
          const isSleep = state === 'SLEEP', isHappy = state === 'HAPPY', isEat = state === 'EAT';
          const bob = isSleep ? (f >= 2 ? 1 : 0) : (isHappy ? (f % 2 === 1 ? -3 : -1) : (state === 'WALK' ? (f % 2 === 1 ? -1 : 0) : (f === 2 ? 1 : 0)));
          const headY = (isSleep ? 16 : (isEat ? 15 : 12)) + bob;
          const bodyY = (isSleep ? 21 : 19) + (isSleep ? 0 : Math.floor(bob * 0.5));
          drawWardrobeBack(g, wardrobe.back, bodyY, f);
          // Mystical purple cape & starry tail
          g.rect(17, bodyY, 6, 6, '#5b21b6'); g.rect(18, bodyY + 1, 4, 4, '#7c3aed');
          g.line(22, bodyY + 2, 26, bodyY - 1 + (f % 2), '#312e45');
          if (!isSleep) {
            const s1 = state === 'WALK' ? (f === 1 ? -2 : f === 3 ? 1 : 0) : 0;
            const s2 = state === 'WALK' ? (f === 3 ? -2 : f === 1 ? 1 : 0) : 0;
            g.rect(11, bodyY + 6 + s1, 3, 4, '#272438'); g.rect(19, bodyY + 6 + s2, 3, 4, '#1e1b2e');
          } else { g.rect(10, 27, 4, 2, '#272438'); g.rect(19, 27, 4, 2, '#272438'); }
          g.oval(16, bodyY + 3, 6, 4.3, '#2f2b42');
          g.oval(15, bodyY + 4, 3.8, 2, '#4c4566');
          // Pointed mystical dog ears
          g.rect(9, headY - 2, 3, 4, '#272438'); g.rect(19, headY - 2, 3, 4, '#272438');
          g.oval(15.5, headY + 2, 5.5, 4.6, '#35304a');
          g.oval(15.5, headY + 4.5, 3.2, 1.8, '#534c70');
          g.px(15, headY + 4, '#14121f');
          // Purple Witch Hat with Sampaguita Star
          const hy = headY - 4;
          g.rect(8, hy + 2, 15, 2, '#4c1d95');
          g.rect(10, hy, 11, 2, '#6d28d9');
          g.rect(12, hy - 2, 7, 2, '#7c3aed');
          g.rect(14, hy - 4, 4, 2, '#5b21b6');
          g.px(17, hy - 5, '#4c1d95');
          g.rect(10, hy + 1, 11, 1, '#f59e0b');
          g.px(13, hy + 1, '#ffffff'); // sampaguita accent
          drawWardrobeFront(g, wardrobe, headY, bodyY, f);
          g.applyOutline('#151221');
          // Glowing amber witch eyes
          drawCuteFace(g, 11, 18, headY + 1, state, f, '#fbbf24', '#c084fc');
          // Floating magic sparkles
          g.px(5, headY + (f % 2), '#fde047');
          g.px(26, headY - 2 + ((f + 1) % 2), '#c084fc');
        }
      },
      {
        id: 'chai', name: 'Chai', country: 'Thailand', region: 'Thailand', flag: '🇹🇭',
        species: 'Baby Elephant', favoriteFood: 'pad_thai', greeting: 'Sawasdee!',
        skillName: 'Golden Lotus Stomp', skillEmoji: '🪷', speed: 30,
        dialogues: ['Sawasdee!', 'Pad Thai aroi mak!', 'Sabai sabai~', 'Mango Sticky Rice!'],
        drawFrame(g, state, f, wardrobe) {
          const isSleep = state === 'SLEEP', isHappy = state === 'HAPPY', isEat = state === 'EAT';
          const bob = isSleep ? (f >= 2 ? 1 : 0) : (isHappy ? (f % 2 === 1 ? -2 : 0) : (state === 'WALK' ? (f % 2 === 1 ? -1 : 0) : (f === 1 || f === 2 ? 1 : 0)));
          const headY = (isSleep ? 15 : 12) + bob;
          const bodyY = (isSleep ? 21 : 19) + (isSleep ? 0 : Math.floor(bob * 0.5));
          drawWardrobeBack(g, wardrobe.back, bodyY, f);
          g.line(23, bodyY + 2, 25, bodyY + 5, '#9ea8b8');
          if (!isSleep) {
            const s1 = state === 'WALK' ? (f === 1 ? -2 : f === 3 ? 1 : 0) : 0;
            const s2 = state === 'WALK' ? (f === 3 ? -2 : f === 1 ? 1 : 0) : 0;
            g.rect(10, bodyY + 5 + s1, 4, 5, '#aeb8c7'); g.rect(19, bodyY + 5 + s2, 4, 5, '#97a2b3');
          } else { g.rect(10, 27, 4, 2, '#97a2b3'); g.rect(19, 27, 4, 2, '#97a2b3'); }
          g.oval(16.5, bodyY + 3, 7.2, 5, '#b8c2d1');
          g.rect(13, bodyY - 1, 8, 5, '#be123c'); g.rect(13, bodyY + 4, 8, 1, '#fbbf24');
          const flap = isHappy && f % 2 === 1 ? 1 : 0;
          g.oval(8 - flap, headY + 2, 3.2, 4.2, '#b8c2d1'); g.oval(8 - flap, headY + 2.5, 1.8, 2.6, '#f4b6c2');
          g.oval(22 + flap, headY + 2, 3.2, 4.2, '#a5b0c2'); g.oval(22 + flap, headY + 2.5, 1.8, 2.6, '#e8a2b0');
          g.oval(15, headY + 2, 5.6, 4.8, '#c2ccd9');
          if (isHappy) { g.rect(14, headY + 4, 2, 3, '#aeb8c7'); g.rect(12, headY + 4, 2, 2, '#c2ccd9'); }
          else { g.rect(14, headY + 4, 2, 4, '#aeb8c7'); g.rect(13, headY + 7, 2, 2, '#c2ccd9'); }
          g.rect(12, headY - 3, 6, 2, '#f59e0b'); g.rect(13, headY - 5, 4, 2, '#fbbf24'); g.rect(14, headY - 7, 2, 2, '#fde047');
          drawWardrobeFront(g, wardrobe, headY, bodyY, f);
          g.applyOutline('#252230');
          drawCuteFace(g, 11, 17, headY + 1, state, f);
        }
      },
      {
        id: 'linh', name: 'Linh', country: 'Vietnam', region: 'ASEAN', flag: '🇻🇳',
        species: 'Lotus Cat', favoriteFood: 'pho_bowl', greeting: 'Xin chào!',
        skillName: 'Lotus Silk Slash', skillEmoji: '🌸', speed: 40,
        dialogues: ['Xin chào!', 'Meow~ Hot Phở!', 'Bánh Mì crunch!', 'Purrfect focus!'],
        drawFrame(g, state, f, wardrobe) {
          const isSleep = state === 'SLEEP', isHappy = state === 'HAPPY', isEat = state === 'EAT';
          const bob = isSleep ? (f >= 2 ? 1 : 0) : (isHappy ? (f % 2 === 1 ? -3 : -1) : (state === 'WALK' ? (f % 2 === 1 ? -1 : 0) : (f === 2 ? 1 : 0)));
          const headY = (isSleep ? 16 : (isEat ? 15 : 12)) + bob;
          const bodyY = (isSleep ? 21 : 19) + (isSleep ? 0 : Math.floor(bob * 0.5));
          drawWardrobeBack(g, wardrobe.back, bodyY, f);
          g.line(21, bodyY + 3, 25, bodyY + (f % 2 ? -1 : 1), '#f3dfc1');
          g.line(25, bodyY + (f % 2 ? -1 : 1), 26, bodyY - 2, '#e07a38');
          if (!isSleep) {
            const s1 = state === 'WALK' ? (f === 1 ? -2 : f === 3 ? 1 : 0) : 0;
            const s2 = state === 'WALK' ? (f === 3 ? -2 : f === 1 ? 1 : 0) : 0;
            g.rect(12, bodyY + 6 + s1, 2, 4, '#fff7eb'); g.rect(19, bodyY + 6 + s2, 2, 4, '#f3dfc1');
          } else { g.rect(11, 27, 3, 2, '#fff7eb'); g.rect(18, 27, 3, 2, '#fff7eb'); }
          g.oval(16.5, bodyY + 3, 5.5, 4.2, '#fff5e4');
          g.rect(12, headY + 7, 8, 2, '#dc2626'); g.rect(13, headY + 9, 6, 3, '#b91c1c'); g.rect(15, headY + 8, 2, 1, '#fbbf24');
          g.oval(15.5, headY + 2, 5.4, 4.4, '#fff5e4'); g.oval(13, headY + 1, 2, 1.5, '#e68442');
          g.px(15, headY + 4, '#f472b6');
          const hatY = headY - 4;
          g.rect(6, hatY + 3, 20, 1, '#d4a359'); g.rect(8, hatY + 2, 16, 1, '#e8c17d');
          g.rect(10, hatY + 1, 12, 1, '#f3d69c'); g.rect(12, hatY, 8, 1, '#fae5b8'); g.rect(14, hatY - 1, 4, 1, '#fff3d6');
          drawWardrobeFront(g, wardrobe, headY, bodyY, f);
          g.applyOutline('#2b1e1e');
          drawCuteFace(g, 12, 18, headY + 1, state, f);
        }
      },
      {
        id: 'bara', name: 'Bara', country: 'Indonesia', region: 'ASEAN', flag: '🇮🇩',
        species: 'Baby Komodo', favoriteFood: 'satay', greeting: 'Halo!',
        skillName: 'Batik Flame Tail', skillEmoji: '🔥', speed: 38,
        dialogues: ['Halo!', 'Enak banget Satay!', 'Semangat terus!', 'Nasi Goreng time!'],
        drawFrame(g, state, f, wardrobe) {
          const isSleep = state === 'SLEEP', isHappy = state === 'HAPPY', isEat = state === 'EAT';
          const bob = isSleep ? (f >= 2 ? 1 : 0) : (isHappy ? (f % 2 === 1 ? -3 : -1) : (state === 'WALK' ? (f % 2 === 1 ? -1 : 0) : (f === 1 || f === 2 ? 1 : 0)));
          const headY = (isSleep ? 16 : (isEat ? 15 : 12)) + bob;
          const bodyY = (isSleep ? 21 : 19) + (isSleep ? 0 : Math.floor(bob * 0.5));
          drawWardrobeBack(g, wardrobe.back, bodyY, f);
          g.rect(21, bodyY + 3, 4, 3, '#3b8c52'); g.rect(25, bodyY + 4, 3, 2, '#2d7041');
          if (!isSleep) {
            const s1 = state === 'WALK' ? (f === 1 ? -2 : f === 3 ? 1 : 0) : 0;
            const s2 = state === 'WALK' ? (f === 3 ? -2 : f === 1 ? 1 : 0) : 0;
            g.rect(10, bodyY + 6 + s1, 3, 4, '#2d7041'); g.rect(18, bodyY + 6 + s2, 3, 4, '#235933');
          } else { g.rect(10, 27, 4, 2, '#2d7041'); g.rect(18, 27, 4, 2, '#2d7041'); }
          g.oval(16, bodyY + 3, 6.2, 4.3, '#3b8c52'); g.oval(15, bodyY + 4.5, 4.4, 2.2, '#a3d977');
          g.oval(14.5, headY + 2, 6, 4.4, '#459e5e'); g.oval(11.5, headY + 3.5, 3, 2, '#52ad6b');
          g.px(15, headY - 3, '#fbbf24'); g.px(17, headY - 2, '#fbbf24');
          g.rect(10, headY + 6, 10, 3, '#6b3e1e'); g.rect(17, headY + 8, 3, 4, '#522e14');
          g.px(11, headY + 7, '#fbbf24'); g.px(14, headY + 7, '#fbbf24'); g.px(17, headY + 7, '#fbbf24');
          drawWardrobeFront(g, wardrobe, headY, bodyY, f);
          g.applyOutline('#1a261e');
          drawCuteFace(g, 11, 16, headY + 1, state, f);
        }
      },
      {
        id: 'rimau', name: 'Rimau', country: 'Malaysia', region: 'ASEAN', flag: '🇲🇾',
        species: 'Malayan Tiger Cub', favoriteFood: 'nasi_lemak', greeting: 'Apa khabar!',
        skillName: 'Harimau Roar', skillEmoji: '🐯', speed: 46,
        dialogues: ['Apa khabar!', 'Sedap Nasi Lemak!', 'Rawr! Ready!', 'Jom lepak!'],
        drawFrame(g, state, f, wardrobe) {
          const isSleep = state === 'SLEEP', isHappy = state === 'HAPPY', isEat = state === 'EAT';
          const bob = isSleep ? (f >= 2 ? 1 : 0) : (isHappy ? (f % 2 === 1 ? -3 : -1) : (state === 'WALK' ? (f % 2 === 1 ? -1 : 0) : (f === 2 ? 1 : 0)));
          const headY = (isSleep ? 16 : (isEat ? 15 : 12)) + bob;
          const bodyY = (isSleep ? 21 : 19) + (isSleep ? 0 : Math.floor(bob * 0.5));
          drawWardrobeBack(g, wardrobe.back, bodyY, f);
          g.line(22, bodyY + 3, 26, bodyY + 1 + (f % 2 ? -1 : 0), '#f97316');
          if (!isSleep) {
            const s1 = state === 'WALK' ? (f === 1 ? -2 : f === 3 ? 1 : 0) : 0;
            const s2 = state === 'WALK' ? (f === 3 ? -2 : f === 1 ? 1 : 0) : 0;
            g.rect(11, bodyY + 6 + s1, 3, 4, '#ea580c'); g.rect(19, bodyY + 6 + s2, 3, 4, '#c2410c');
          } else { g.rect(10, 27, 4, 2, '#fff7ed'); g.rect(19, 27, 4, 2, '#fff7ed'); }
          g.oval(16.5, bodyY + 3, 6.2, 4.4, '#f97316'); g.oval(15.5, bodyY + 4.5, 4.4, 2.2, '#fff7ed');
          g.rect(17, bodyY, 1, 3, '#292121'); g.rect(20, bodyY + 1, 1, 3, '#292121');
          g.rect(9, headY - 2, 3, 3, '#f97316'); g.rect(19, headY - 2, 3, 3, '#f97316');
          g.oval(15.5, headY + 2, 5.8, 4.8, '#fb923c'); g.oval(15.5, headY + 4.6, 3.8, 2.2, '#fff7ed');
          g.px(15, headY + 3, '#f43f5e');
          g.rect(11, headY - 5, 9, 4, '#1e1b24'); g.rect(11, headY - 2, 9, 1, '#eab308');
          drawWardrobeFront(g, wardrobe, headY, bodyY, f);
          g.applyOutline('#241814');
          drawCuteFace(g, 11, 18, headY + 1, state, f);
        }
      },
      {
        id: 'merli', name: 'Merli', country: 'Singapore', region: 'ASEAN', flag: '🇸🇬',
        species: 'Mini Merlion', favoriteFood: 'kaya_toast', greeting: 'Shiok!',
        skillName: 'Marina Hydro Spout', skillEmoji: '🌊', speed: 36,
        dialogues: ['Shiok!', 'Kaya toast & kopi!', 'Chicken Rice lah!', 'Stay hydrated!'],
        drawFrame(g, state, f, wardrobe) {
          const isSleep = state === 'SLEEP', isHappy = state === 'HAPPY', isEat = state === 'EAT';
          const bob = isSleep ? (f >= 2 ? 1 : 0) : (isHappy ? (f % 2 === 1 ? -3 : -1) : (state === 'WALK' ? (f % 2 === 1 ? -2 : 0) : (f === 1 || f === 2 ? 1 : 0)));
          const headY = (isSleep ? 15 : (isEat ? 14 : 11)) + bob;
          const bodyY = (isSleep ? 21 : 19) + (isSleep ? 0 : Math.floor(bob * 0.6));
          drawWardrobeBack(g, wardrobe.back, bodyY, f);
          const finFlip = (f % 2 === 0) ? 0 : -1;
          g.oval(18, bodyY + 4, 6, 3.8, '#14b8a6');
          g.rect(24, bodyY + 1 + finFlip, 3, 2, '#5eead4'); g.rect(25, bodyY + 4 + finFlip, 3, 2, '#2dd4bf');
          g.oval(14, bodyY + 2, 4.8, 4.2, '#f8fafc');
          g.oval(14.5, headY + 2.5, 6.4, 5.8, '#e2e8f0'); g.oval(14.5, headY + 1.5, 5.8, 5, '#f8fafc');
          g.oval(14, headY + 2.5, 4.5, 3.8, '#ffffff'); g.px(13, headY + 4, '#64748b');
          drawWardrobeFront(g, wardrobe, headY, bodyY, f);
          g.applyOutline('#1b2a34');
          drawCuteFace(g, 11, 16, headY + 1, state, f, '#172530', '#67e8f9');
          if ((state === 'IDLE' && (f === 1 || f === 2)) || state === 'HAPPY') {
            const spX = 8, spY = headY + 4;
            g.px(spX + 2, spY, '#38bdf8'); g.px(spX + 1, spY - 1, '#7dd3fc');
            g.px(spX, spY - 1, '#38bdf8'); g.px(spX - 2, spY + 2, '#7dd3fc');
          }
        }
      },
      // NEW PET #9: NILA — ROYAL INDIAN PEACOCK!
      {
        id: 'nila', name: 'Nila', country: 'India', region: 'India', flag: '🇮🇳',
        species: 'Royal Indian Peacock', favoriteFood: 'butter_chicken', greeting: 'Namaste!',
        skillName: 'Peacock Feather Storm', skillEmoji: '🦚', speed: 40,
        dialogues: ['Namaste!', 'Masala Chai time!', 'Watch my royal plume!', 'Bahut badhiya!'],
        drawFrame(g, state, f, wardrobe) {
          const isSleep = state === 'SLEEP', isHappy = state === 'HAPPY', isEat = state === 'EAT';
          const bob = isSleep ? (f >= 2 ? 1 : 0) : (isHappy ? (f % 2 === 1 ? -3 : -1) : (state === 'WALK' ? (f % 2 === 1 ? -1 : 0) : (f === 1 || f === 2 ? 1 : 0)));
          const headY = (isSleep ? 15 : (isEat ? 14 : 10)) + bob;
          const bodyY = (isSleep ? 21 : 19) + (isSleep ? 0 : Math.floor(bob * 0.5));
          drawWardrobeBack(g, wardrobe.back, bodyY, f);

          // ANIMATED FANNING PEACOCK TAIL FEATHERS (Full royal fan during HAPPY / EAT!)
          const fanOpen = (isHappy || isEat) || (state === 'IDLE' && f === 2);
          if (fanOpen) {
            const pulse = f % 2 === 0 ? 0 : 1;
            g.oval(16, bodyY - 2, 12, 9 + pulse, '#0f766e');
            g.oval(16, bodyY - 1, 10, 7 + pulse, '#14b8a6');
            // Iridescent golden-cobalt eye-spots on the fan!
            const spots = [[8, bodyY - 6], [12, bodyY - 9], [16, bodyY - 10], [20, bodyY - 9], [24, bodyY - 6], [7, bodyY - 1], [25, bodyY - 1]];
            for (const [sx, sy] of spots) {
              g.rect(sx - 1, sy - 1, 3, 3, '#f59e0b');
              g.px(sx, sy, '#1d4ed8');
              g.px(sx, sy - 1, '#38bdf8');
            }
          } else {
            // Sweeping closed emerald tail train behind body
            g.oval(22, bodyY + 4, 6, 3.2, '#0f766e');
            g.oval(23, bodyY + 4, 4, 2, '#14b8a6');
            g.rect(24, bodyY + 3, 2, 2, '#fbbf24');
            g.px(25, bodyY + 4, '#1d4ed8');
          }

          // Peacock Legs
          if (!isSleep) {
            const s1 = state === 'WALK' ? (f === 1 ? -2 : f === 3 ? 1 : 0) : 0;
            const s2 = state === 'WALK' ? (f === 3 ? -2 : f === 1 ? 1 : 0) : 0;
            g.rect(13, bodyY + 6 + s1, 2, 4, '#d97706');
            g.rect(17, bodyY + 6 + s2, 2, 4, '#b45309');
          } else {
            g.rect(12, 27, 3, 2, '#d97706'); g.rect(17, 27, 3, 2, '#d97706');
          }

          // Iridescent Royal Blue-Teal Body & Wing
          g.oval(15.5, bodyY + 3, 5.5, 4.4, '#0369a1');
          g.oval(14.5, bodyY + 2, 3.8, 3, '#0284c7');
          g.oval(17.5, bodyY + 3, 3.2, 2.5, '#0d9488'); // teal wing highlight

          // Marigold Garland Necklace (Festive Indian Touch)
          g.rect(11, headY + 6, 9, 2, '#f97316');
          g.px(12, headY + 7, '#facc15'); g.px(15, headY + 7, '#facc15'); g.px(18, headY + 7, '#facc15');

          // Peacock Head & Golden Crown Crest Feathers
          g.oval(15, headY + 2, 4.8, 4.2, '#0284c7');
          g.oval(15, headY + 1, 3.6, 2.4, '#0ea5e9');
          // Golden crest plumes
          g.line(13, headY - 2, 12, headY - 6, '#14b8a6'); g.px(12, headY - 6, '#fbbf24');
          g.line(15, headY - 2, 15, headY - 7, '#14b8a6'); g.px(15, headY - 7, '#fde047');
          g.line(17, headY - 2, 18, headY - 6, '#14b8a6'); g.px(18, headY - 6, '#fbbf24');
          // Cute golden beak & tiny red bindi!
          g.rect(14, headY + 3, 2, 2, '#fbbf24');
          g.px(15, headY, '#ef4444'); // tiny red bindi

          drawWardrobeFront(g, wardrobe, headY, bodyY, f);
          g.applyOutline('#132030');
          drawCuteFace(g, 11, 17, headY + 1, state, f, '#0f172a', '#fb923c');
        }
      },
      {
        id: 'raja', name: 'Raja', country: 'India', region: 'India', flag: '🇮🇳',
        species: 'Royal Indian Elephant', favoriteFood: 'samosa', greeting: 'Namaste!',
        skillName: 'Golden Tusk Charge', skillEmoji: '🐘', speed: 38,
        dialogues: ['Namaste!', 'Samosa time!', 'Vanakkam!', 'Elephants never forget a snack!'],
        drawFrame(g, state, f, wardrobe) {
          const isSleep = state === 'SLEEP', isHappy = state === 'HAPPY', isEat = state === 'EAT';
          const bob = isSleep ? (f >= 2 ? 1 : 0) : (isHappy ? (f % 2 === 1 ? -3 : -1) : (state === 'WALK' ? (f % 2 === 1 ? -1 : 0) : (f === 1 || f === 2 ? 1 : 0)));
          const headY = (isSleep ? 14 : (isEat ? 15 : 11)) + bob;
          const bodyY = (isSleep ? 21 : 19) + (isSleep ? 0 : Math.floor(bob * 0.5));
          drawWardrobeBack(g, wardrobe.back, bodyY, f);

          if (!isSleep) {
            const s1 = state === 'WALK' ? (f === 1 ? -2 : f === 3 ? 1 : 0) : 0;
            const s2 = state === 'WALK' ? (f === 3 ? -2 : f === 1 ? 1 : 0) : 0;
            g.rect(11, bodyY + 6 + s1, 3, 5, '#4b5563');
            g.rect(18, bodyY + 6 + s2, 3, 5, '#374151');
          } else {
            g.rect(10, 27, 4, 2, '#4b5563'); g.rect(18, 27, 4, 2, '#374151');
          }

          g.oval(15.5, bodyY + 3, 7, 5.2, '#6b7280');
          g.oval(14, bodyY + 2, 4.6, 3.4, '#9ca3af');
          g.rect(11, bodyY + 3, 9, 4, '#dc2626');
          g.rect(11, bodyY + 3, 9, 1, '#fbbf24');
          g.px(13, bodyY + 5, '#fbbf24'); g.px(17, bodyY + 5, '#fbbf24');

          g.oval(8, headY + 3, 2.6, 3.2, '#4b5563');
          g.oval(23, headY + 3, 2.6, 3.2, '#4b5563');

          g.oval(15.5, headY + 2, 5.2, 4.4, '#6b7280');
          g.oval(15.5, headY + 1, 3.8, 2.6, '#9ca3af');
          g.rect(11, headY - 3, 9, 2, '#fbbf24');
          g.rect(13, headY - 5, 2, 2, '#fbbf24');
          g.rect(17, headY - 5, 2, 2, '#fbbf24');
          g.px(15, headY - 6, '#ef4444');
          g.rect(9, headY + 5, 2, 2, '#fffbeb');
          g.rect(21, headY + 5, 2, 2, '#fffbeb');

          if (isEat) {
            if (f % 2 === 0) { g.rect(14, headY + 4, 3, 5, '#4b5563'); g.rect(12, headY + 8, 3, 2, '#4b5563'); }
            else { g.rect(14, headY + 4, 3, 6, '#4b5563'); g.rect(11, headY + 8, 4, 2, '#4b5563'); }
          } else if (isSleep) {
            g.rect(14, headY + 5, 3, 7, '#4b5563');
          } else {
            const swing = state === 'WALK' && (f === 1 || f === 3) ? 1 : 0;
            g.rect(14, headY + 4, 3, 6, '#4b5563');
            g.rect(15 + swing, headY + 9, 3, 2, '#4b5563');
          }

          drawWardrobeFront(g, wardrobe, headY, bodyY, f);
          g.applyOutline('#132030');
          drawCuteFace(g, 12, 17, headY + 1, state, f, '#0f172a', '#fb923c');
        }
      },
      {
        id: 'mochi', name: 'Mochi', country: 'Japan', region: 'East Asia', flag: '🇯🇵',
        species: 'Shiba Inu', favoriteFood: 'dango', greeting: 'Konnichiwa!',
        skillName: 'Sakura Dash', skillEmoji: '🍡', speed: 45,
        dialogues: ['Konnichiwa!', 'Oishii Dango!', 'Ramen time!', 'Ganbatte!'],
        drawFrame(g, state, f, wardrobe) {
          const isSleep = state === 'SLEEP', isHappy = state === 'HAPPY', isEat = state === 'EAT';
          const bob = isSleep ? (f >= 2 ? 1 : 0) : (isHappy ? (f % 2 === 1 ? -3 : -1) : (state === 'WALK' ? (f % 2 === 1 ? -1 : 0) : (f === 2 ? 1 : 0)));
          const headY = (isSleep ? 16 : (isEat ? 15 : 11)) + bob;
          const bodyY = (isSleep ? 21 : 18) + (isSleep ? 0 : Math.floor(bob * 0.5));
          drawWardrobeBack(g, wardrobe.back, bodyY, f);
          // Curled Shiba tail
          g.oval(23, bodyY, 2.5, 2.5, '#e08b3e'); g.px(23, bodyY, '#fff7ed');
          if (!isSleep) {
            const s1 = state === 'WALK' ? (f === 1 ? -2 : f === 3 ? 1 : 0) : 0;
            const s2 = state === 'WALK' ? (f === 3 ? -2 : f === 1 ? 1 : 0) : 0;
            g.rect(11, bodyY + 6 + s1, 3, 4, '#fff7ed'); g.rect(19, bodyY + 6 + s2, 3, 4, '#fde8cd');
          } else { g.rect(10, 27, 4, 2, '#fff7ed'); g.rect(19, 27, 4, 2, '#fff7ed'); }
          g.oval(16.5, bodyY + 3, 6, 4.4, '#e08b3e'); g.oval(15.5, bodyY + 4.5, 4.5, 2.4, '#fff7ed');
          // Perky Shiba ears
          g.rect(9, headY - 3, 3, 4, '#d97728'); g.rect(19, headY - 3, 3, 4, '#d97728');
          g.oval(15.5, headY + 2, 5.8, 4.8, '#e8984c');
          g.oval(15.5, headY + 4.2, 4.6, 2.6, '#fff7ed');
          g.px(15, headY + 3, '#1e1b24');
          // Red & White Shrine Bandana
          g.rect(11, headY + 6, 9, 2, '#dc2626'); g.px(13, headY + 7, '#ffffff'); g.px(17, headY + 7, '#ffffff');
          drawWardrobeFront(g, wardrobe, headY, bodyY, f);
          g.applyOutline('#2b1e16');
          drawCuteFace(g, 11, 18, headY + 1, state, f);
        }
      },
      {
        id: 'bao', name: 'Bao', country: 'China', region: 'East Asia', flag: '🇨🇳',
        species: 'Giant Panda Cub', favoriteFood: 'bamboo_stalks', greeting: 'Nǐ hǎo!',
        skillName: 'Bamboo Kung-Fu', skillEmoji: '🎋', speed: 32,
        dialogues: ['Nǐ hǎo!', 'Crunchy Bamboo!', 'Hot Steamed Baozi!', 'Zen vibes~'],
        drawFrame(g, state, f, wardrobe) {
          const isSleep = state === 'SLEEP', isHappy = state === 'HAPPY', isEat = state === 'EAT';
          const bob = isSleep ? (f >= 2 ? 1 : 0) : (isHappy ? (f % 2 === 1 ? -3 : -1) : (state === 'WALK' ? (f % 2 === 1 ? -1 : 0) : (f === 1 || f === 2 ? 1 : 0)));
          const headY = (isSleep ? 16 : (isEat ? 15 : 11)) + bob;
          const bodyY = (isSleep ? 21 : 19) + (isSleep ? 0 : Math.floor(bob * 0.5));
          drawWardrobeBack(g, wardrobe.back, bodyY, f);
          if (!isSleep) {
            const s1 = state === 'WALK' ? (f === 1 ? -2 : f === 3 ? 1 : 0) : 0;
            const s2 = state === 'WALK' ? (f === 3 ? -2 : f === 1 ? 1 : 0) : 0;
            g.rect(11, bodyY + 6 + s1, 3, 4, '#1e1b24'); g.rect(19, bodyY + 6 + s2, 3, 4, '#1e1b24');
          } else { g.rect(10, 27, 4, 2, '#1e1b24'); g.rect(19, 27, 4, 2, '#1e1b24'); }
          g.oval(16, bodyY + 3, 6.4, 4.6, '#f8fafc');
          // Red Tangzhuang Silk Vest with gold frog buttons
          g.rect(11, bodyY, 10, 5, '#dc2626'); g.rect(15, bodyY + 1, 2, 1, '#fbbf24'); g.rect(15, bodyY + 3, 2, 1, '#fbbf24');
          // Round black panda ears
          g.oval(10, headY - 2, 2.2, 2.2, '#1e1b24'); g.oval(21, headY - 2, 2.2, 2.2, '#1e1b24');
          g.oval(15.5, headY + 2, 5.8, 4.8, '#ffffff');
          // Cute panda eye patches
          g.oval(12, headY + 2, 2.2, 2.2, '#1e1b24'); g.oval(19, headY + 2, 2.2, 2.2, '#1e1b24');
          g.px(15, headY + 4, '#1e1b24');
          drawWardrobeFront(g, wardrobe, headY, bodyY, f);
          g.applyOutline('#1a1822');
          // White eye glints inside dark patches
          if (state !== 'SLEEP') { g.px(12, headY + 1, '#ffffff'); g.px(19, headY + 1, '#ffffff'); }
          g.px(10, headY + 4, '#f48fb1'); g.px(21, headY + 4, '#f48fb1');
        }
      },
      {
        id: 'misha', name: 'Misha', country: 'Russia', region: 'Europe', flag: '🇷🇺',
        species: 'Bear Cub', favoriteFood: 'honey_blini', greeting: 'Privet!',
        skillName: 'Frost Bear Hug', skillEmoji: '❄️', speed: 34,
        dialogues: ['Privet!', 'Sweet Honey & Blini!', 'Cozy Ushanka!', 'Spasibo!'],
        drawFrame(g, state, f, wardrobe) {
          const isSleep = state === 'SLEEP', isHappy = state === 'HAPPY', isEat = state === 'EAT';
          const bob = isSleep ? (f >= 2 ? 1 : 0) : (isHappy ? (f % 2 === 1 ? -2 : 0) : (state === 'WALK' ? (f % 2 === 1 ? -1 : 0) : (f === 1 || f === 2 ? 1 : 0)));
          const headY = (isSleep ? 16 : (isEat ? 15 : 11)) + bob;
          const bodyY = (isSleep ? 21 : 19) + (isSleep ? 0 : Math.floor(bob * 0.5));
          drawWardrobeBack(g, wardrobe.back, bodyY, f);
          if (!isSleep) {
            const s1 = state === 'WALK' ? (f === 1 ? -2 : f === 3 ? 1 : 0) : 0;
            const s2 = state === 'WALK' ? (f === 3 ? -2 : f === 1 ? 1 : 0) : 0;
            g.rect(10, bodyY + 6 + s1, 4, 4, '#7c4a2d'); g.rect(18, bodyY + 6 + s2, 4, 4, '#633820');
          } else { g.rect(10, 27, 4, 2, '#7c4a2d'); g.rect(18, 27, 4, 2, '#7c4a2d'); }
          g.oval(16, bodyY + 3, 6.8, 4.8, '#8c5535'); g.oval(15.5, bodyY + 4, 4.2, 2.6, '#c99772');
          g.oval(15.5, headY + 2, 5.8, 4.8, '#945b3a'); g.oval(15.5, headY + 4.4, 3.6, 2.2, '#e2be9e');
          g.rect(15, headY + 3, 2, 1, '#261812');
          // Fur Ushanka Hat with earflaps & gold star badge
          g.rect(9, headY - 4, 13, 4, '#475569');
          g.rect(11, headY - 3, 9, 2, '#cbd5e1');
          g.rect(8, headY, 3, 5, '#64748b'); g.rect(20, headY, 3, 5, '#64748b');
          g.px(15, headY - 2, '#ef4444');
          drawWardrobeFront(g, wardrobe, headY, bodyY, f);
          g.applyOutline('#241814');
          drawCuteFace(g, 11, 18, headY + 1, state, f);
        }
      },
      {
        id: 'gino', name: 'Gino', country: 'Italy', region: 'Europe', flag: '🇮🇹',
        species: 'Venetian Spotted Pup', favoriteFood: 'pizza', greeting: 'Ciao!',
        skillName: 'Gondola Whirl', skillEmoji: '🍕', speed: 44,
        dialogues: ['Ciao bella!', 'Mamma mia, Pizza!', 'Gelato time!', 'Bravo!'],
        drawFrame(g, state, f, wardrobe) {
          const isSleep = state === 'SLEEP', isHappy = state === 'HAPPY', isEat = state === 'EAT';
          const bob = isSleep ? (f >= 2 ? 1 : 0) : (isHappy ? (f % 2 === 1 ? -3 : -1) : (state === 'WALK' ? (f % 2 === 1 ? -1 : 0) : (f === 2 ? 1 : 0)));
          const headY = (isSleep ? 16 : (isEat ? 15 : 11)) + bob;
          const bodyY = (isSleep ? 21 : 18) + (isSleep ? 0 : Math.floor(bob * 0.5));
          drawWardrobeBack(g, wardrobe.back, bodyY, f);
          g.line(22, bodyY + 2, 25, bodyY + (f % 2 ? -1 : 1), '#f8fafc');
          if (!isSleep) {
            const s1 = state === 'WALK' ? (f === 1 ? -2 : f === 3 ? 1 : 0) : 0;
            const s2 = state === 'WALK' ? (f === 3 ? -2 : f === 1 ? 1 : 0) : 0;
            g.rect(11, bodyY + 6 + s1, 3, 4, '#f8fafc'); g.rect(19, bodyY + 6 + s2, 3, 4, '#e2e8f0');
          } else { g.rect(10, 27, 4, 2, '#f8fafc'); g.rect(19, 27, 4, 2, '#f8fafc'); }
          g.oval(16.5, bodyY + 3, 6.2, 4.4, '#ffffff');
          g.rect(18, bodyY + 2, 2, 2, '#1e293b'); g.px(14, bodyY + 3, '#1e293b');
          g.rect(8, headY + 1, 3, 5, '#1e293b'); g.rect(20, headY + 1, 3, 5, '#1e293b');
          g.oval(15.5, headY + 2, 5.5, 4.8, '#ffffff'); g.px(15, headY + 4, '#1e293b');
          // Red Gondolier Neckerchief + Beret
          g.rect(11, headY + 6, 9, 2, '#dc2626');
          g.rect(10, headY - 4, 11, 2, '#1d4ed8'); g.rect(12, headY - 5, 7, 1, '#3b82f6');
          drawWardrobeFront(g, wardrobe, headY, bodyY, f);
          g.applyOutline('#1e2430');
          drawCuteFace(g, 11, 18, headY + 1, state, f);
        }
      },
      {
        id: 'muning', name: 'Muning', country: 'Asia', region: 'Asia', flag: '\ud83c\udf0f',
        species: 'Cozy Asia Cat', favoriteFood: 'pad_thai', greeting: 'Meow!',
        skillName: 'Purr of Luck', skillEmoji: '\ud83d\udc9e', speed: 38,
        dialogues: ['Meow! Kain tayo!', 'Purr... cozy day!', 'Ang ganda ng buwan!', 'Laro tayo!'],
        pngAnim: { dir: 'pusa/pusa', frames: 8 },
      },
      {
        id: 'banog', name: 'Banog', country: 'Philippines', region: 'Philippines', flag: '\ud83c\uddf5\ud83c\udded',
        species: 'Philippine Eagle', favoriteFood: 'satay', greeting: 'Swoosh!',
        skillName: 'Storm Dive', skillEmoji: '\ud83c\udf2a', speed: 46,
        dialogues: ['Swoosh! Lipad tayo!', 'Kitang-kita lahat!', 'Sky\'s the limit!', 'Uwing agila, hehe!'],
        pngAnim: { dir: 'pusa/agila', frames: 8 },
      },
      {
        id: 'gagak', name: 'Gagak', country: 'Indonesia', region: 'Indonesia', flag: '\ud83c\udde9\ud83c\uddea',
        species: 'Clever Crow', favoriteFood: 'satay', greeting: 'Caw!',
        skillName: 'Shiny Snatch', skillEmoji: '\ud83d\udc8e', speed: 40,
        dialogues: ['Caw! Ada apa?', 'Barter? Shiny things!', 'Caw caw! Pintar!', 'Suka comrade? Caw!'],
        pngAnim: { dir: 'pusa/uwak', frames: 8 },
      },
      {
        id: 'ran', name: 'Ran', country: 'Vietnam', region: 'Vietnam', flag: '\ud83c\uddfb\ud83c\uddf3',
        species: 'Garden Guardian Snake', favoriteFood: 'pho', greeting: 'Ssss!',
        skillName: 'Coiled Charm', skillEmoji: '\ud83c\udf34', speed: 32,
        dialogues: ['Xin ch\u00e0o! Ssss!', 'C\u1ee9 chill th\u00f4i, ssss!', 'Ssssarap ng pho!', 'Coil and relax!'],
        pngAnim: { dir: 'pusa/ahas', frames: 8 },
      },
      {
        id: 'dragon', name: 'Dragon', country: 'Philippines', region: 'Philippines', flag: '\ud83d\udc09',
        species: 'Flame Dragon (Bakunawa Kin)', favoriteFood: 'ube_potion', greeting: 'Rawr!',
        skillName: 'Bakunawa Flame', skillEmoji: '\ud83d\udd25', speed: 42, shopOnly: true,
        dialogues: ['Rawr! Ako ang apoy!', 'Bakunawa mode!', 'Lilipad tayo!', 'Ang ganda ng apoy ko!'],
        pngAnim: { dir: 'pusa/dragon_flame', frames: 12 },
      }
    ];

    const DRAWFRAME_FALLBACKS = { muning: 'linh', banog: 'nila', gagak: 'nila', ran: 'kala', dragon: 'bara' };
    for (const p of PET_ROSTER) {
      if (typeof p.drawFrame === 'function') continue;
      const donor = PET_ROSTER.find((x) => x.id === DRAWFRAME_FALLBACKS[p.id]) || PET_ROSTER[0];
      p.drawFrame = function (g, state, f, wardrobe) { donor.drawFrame(g, state, f, wardrobe); };
    }

    // ==========================================================================
    // 5. 30 PROCEDURAL 16-BIT CULTURAL DELICACIES (ASEAN, INDIA & WORLD)
    // ==========================================================================
    const DELICACIES = [
      // Featured & Thailand
      { id: 'pad_thai', name: 'Pad Thai', country: 'Thailand', region: 'Thailand', flag: '🇹🇭', cost: 20, hunger: 32, happy: 20, energy: 15, buff: { stat: 'AGI', val: 3, label: '+3 AGI' },
        draw(g) {
          g.oval(8, 11, 6.2, 3.2, '#f8fafc'); // ceramic plate
          g.oval(8, 9.5, 5, 2.6, '#d97706'); // stir-fried tamarind noodles
          g.rect(5, 8, 6, 2, '#f59e0b');
          g.rect(9, 7, 3, 2, '#fb7185'); g.px(11, 8, '#f43f5e'); // pink shrimp!
          g.rect(4, 9, 2, 2, '#4ade80'); // lime wedge
          g.px(6, 7, '#fde047'); g.px(8, 10, '#fde047'); // crushed peanuts
          g.px(7, 8, '#22c55e'); // chives
        }
      },
      { id: 'bamboo_stalks', name: 'Fresh Bamboo Stalks', country: 'China', region: 'East Asia', flag: '🇨🇳', cost: 15, hunger: 28, happy: 18, energy: 15, buff: { stat: 'DEF', val: 3, label: '+3 DEF' },
        draw(g) {
          g.rect(5, 3, 3, 11, '#22c55e'); g.rect(9, 4, 3, 10, '#16a34a');
          g.rect(5, 7, 3, 1, '#86efac'); g.rect(5, 11, 3, 1, '#86efac'); // bamboo nodes
          g.rect(9, 8, 3, 1, '#86efac'); g.rect(9, 12, 3, 1, '#86efac');
          g.rect(3, 5, 2, 2, '#4ade80'); g.rect(12, 3, 2, 2, '#4ade80'); // fresh leaves
        }
      },
      { id: 'khao_lam', name: 'Khao Lam (Bamboo Rice)', country: 'Thailand', region: 'ASEAN', flag: '🇹🇭', cost: 15, hunger: 26, happy: 22, energy: 20, buff: { stat: 'EXP', val: 25, label: '+25% EXP' },
        draw(g) {
          g.line(4, 13, 10, 5, '#854d0e'); g.line(5, 13, 11, 5, '#a16207'); // roasted bamboo tube
          g.line(6, 13, 12, 5, '#ca8a04');
          g.oval(11, 5, 2.2, 2.2, '#fef9c3'); // sweet coconut sticky rice top
          g.px(11, 5, '#7c2d12'); // red bean
        }
      },
      { id: 'mango_sticky_rice', name: 'Mango Sticky Rice', country: 'Thailand', region: 'Thailand', flag: '🇹🇭', cost: 15, hunger: 24, happy: 26, energy: 14, buff: { stat: 'LUK', val: 3, label: '+3 LUK' },
        draw(g) {
          g.oval(8, 11, 6, 2.8, '#e2e8f0'); g.oval(6, 9, 3, 2.2, '#ffffff');
          g.rect(8, 7, 4, 4, '#fbbf24'); g.rect(9, 7, 2, 3, '#fde047'); g.rect(4, 10, 2, 2, '#22c55e');
        }
      },
      { id: 'tom_yum', name: 'Tom Yum Soup', country: 'Thailand', region: 'Thailand', flag: '🇹🇭', cost: 25, hunger: 30, happy: 22, energy: 18, buff: { stat: 'MAG', val: 3, label: '+3 MAG' },
        draw(g) {
          g.oval(8, 11, 5.5, 3.2, '#1e293b'); g.oval(8, 8.8, 4.8, 2, '#ea580c');
          g.rect(6, 8, 2, 2, '#fb7185'); g.px(10, 8, '#4ade80'); g.px(8, 5, '#e2e8f0');
        }
      },

      // Philippines (6)
      { id: 'halo_halo', name: 'Halo-Halo', country: 'Philippines', region: 'Philippines', flag: '🇵🇭', cost: 15, hunger: 24, happy: 30, energy: 16, buff: { stat: 'LUK', val: 3, label: '+3 LUK' },
        draw(g) {
          g.rect(5, 6, 6, 8, '#e0f2fe'); g.rect(6, 11, 4, 2, '#f472b6');
          g.rect(6, 9, 4, 2, '#4ade80'); g.rect(6, 7, 4, 2, '#fde047');
          g.oval(8, 5, 3.2, 2.2, '#9333ea'); g.line(10, 2, 9, 6, '#cbd5e1');
        }
      },
      { id: 'pandesal', name: 'Warm Pandesal', country: 'Philippines', region: 'Philippines', flag: '🇵🇭', cost: 15, hunger: 24, happy: 15, energy: 14, buff: { stat: 'DEF', val: 2, label: '+2 DEF' },
        draw(g) {
          g.oval(6, 10, 3.2, 2.5, '#d97706'); g.oval(10, 10, 3.2, 2.5, '#b45309');
          g.oval(8, 7, 3.2, 2.5, '#f59e0b'); g.px(7, 6, '#fde68a');
        }
      },
      { id: 'ube_potion', name: 'Ube Magic Potion', country: 'Philippines', region: 'Philippines', flag: '🇵🇭', cost: 20, hunger: 18, happy: 28, energy: 25, buff: { stat: 'MAG', val: 4, label: '+4 MAG' },
        draw(g) {
          g.oval(8, 10, 4.2, 3.8, '#9333ea'); g.rect(7, 4, 2, 3, '#c084fc');
          g.rect(6, 3, 4, 1, '#a16207'); g.px(6, 9, '#e9d5ff'); g.px(11, 5, '#fde047');
        }
      },
      { id: 'adobo', name: 'Pork Adobo & Rice', country: 'Philippines', region: 'Philippines', flag: '🇵🇭', cost: 20, hunger: 36, happy: 22, energy: 20, buff: { stat: 'STR', val: 3, label: '+3 STR' },
        draw(g) {
          g.oval(8, 11, 6, 3, '#f8fafc'); g.oval(6, 9.5, 2.8, 2, '#ffffff');
          g.oval(10, 9.5, 3, 2, '#78350f'); g.px(10, 8, '#fde047'); g.px(9, 10, '#22c55e');
        }
      },
      { id: 'lumpia', name: 'Lumpia Shanghai', country: 'Philippines', region: 'Philippines', flag: '🇵🇭', cost: 15, hunger: 25, happy: 24, energy: 14, buff: { stat: 'AGI', val: 3, label: '+3 AGI' },
        draw(g) {
          g.oval(8, 11, 5.5, 2.5, '#e2e8f0');
          g.rect(4, 8, 8, 2, '#d97706'); g.rect(5, 6, 7, 2, '#f59e0b');
          g.rect(10, 10, 3, 2, '#ef4444'); // sweet chili dip
        }
      },
      { id: 'kwek_kwek', name: 'Kwek-Kwek Skewers', country: 'Philippines', region: 'Philippines', flag: '🇵🇭', cost: 10, hunger: 22, happy: 24, energy: 12, buff: { stat: 'LUK', val: 2, label: '+2 LUK' },
        draw(g) {
          g.line(4, 13, 12, 3, '#d6b482');
          g.oval(6, 10, 2, 2, '#f97316'); g.oval(8.5, 7.5, 2, 2, '#fb923c'); g.oval(11, 5, 2, 2, '#f97316');
        }
      },

      // Vietnam, Indonesia, Malaysia, Singapore, Cambodia, Myanmar (ASEAN)
      { id: 'pho_bowl', name: 'Mini Phở Bowl', country: 'Vietnam', region: 'ASEAN', flag: '🇻🇳', cost: 15, hunger: 32, happy: 22, energy: 18, buff: { stat: 'DEF', val: 3, label: '+3 DEF' },
        draw(g) {
          g.oval(8, 11, 5.2, 3.4, '#dc2626'); g.rect(4, 8, 8, 2, '#fef08a');
          g.px(6, 8, '#22c55e'); g.px(10, 8, '#b45309'); g.px(7, 5, '#e2e8f0');
        }
      },
      { id: 'banh_mi', name: 'Crispy Bánh Mì', country: 'Vietnam', region: 'ASEAN', flag: '🇻🇳', cost: 10, hunger: 28, happy: 20, energy: 15, buff: { stat: 'AGI', val: 2, label: '+2 AGI' },
        draw(g) {
          g.oval(8, 9, 6, 2.8, '#d97706'); g.rect(4, 8, 8, 2, '#fbbf24');
          g.rect(4, 9, 8, 1, '#22c55e'); g.px(6, 9, '#f97316'); g.px(10, 9, '#ef4444');
        }
      },
      { id: 'satay', name: 'Satay Skewers', country: 'Indonesia', region: 'ASEAN', flag: '🇮🇩', cost: 15, hunger: 28, happy: 22, energy: 16, buff: { stat: 'STR', val: 3, label: '+3 STR' },
        draw(g) {
          g.line(3, 13, 11, 5, '#d6b482'); g.line(5, 13, 13, 5, '#d6b482');
          g.rect(6, 8, 3, 3, '#92400e'); g.rect(9, 5, 3, 3, '#b45309'); g.px(7, 9, '#f59e0b');
        }
      },
      { id: 'nasi_goreng', name: 'Nasi Goreng', country: 'Indonesia', region: 'ASEAN', flag: '🇮🇩', cost: 20, hunger: 34, happy: 22, energy: 18, buff: { stat: 'STR', val: 3, label: '+3 STR' },
        draw(g) {
          g.oval(8, 11, 6, 3, '#f8fafc'); g.oval(8, 9, 4.5, 2.5, '#b45309');
          g.oval(8, 8, 2.4, 1.8, '#ffffff'); g.px(8, 8, '#facc15'); // fried egg on top!
        }
      },
      { id: 'nasi_lemak', name: 'Nasi Lemak', country: 'Malaysia', region: 'ASEAN', flag: '🇲🇾', cost: 15, hunger: 32, happy: 22, energy: 18, buff: { stat: 'EXP', val: 25, label: '+25% EXP' },
        draw(g) {
          g.oval(8, 11, 5.8, 3, '#15803d'); g.oval(8, 8, 3.4, 2.6, '#ffffff');
          g.rect(9, 9, 3, 2, '#dc2626'); g.rect(4, 10, 2, 2, '#fde047');
        }
      },
      { id: 'roti_canai', name: 'Roti Canai & Curry', country: 'Malaysia', region: 'ASEAN', flag: '🇲🇾', cost: 10, hunger: 26, happy: 20, energy: 16, buff: { stat: 'DEF', val: 2, label: '+2 DEF' },
        draw(g) {
          g.oval(6, 10, 4.2, 2.6, '#f59e0b'); g.oval(6, 9.5, 3, 1.5, '#fde68a');
          g.oval(12, 10, 2.5, 2, '#ea580c'); // curry dip
        }
      },
      { id: 'kaya_toast', name: 'Kaya Toast', country: 'Singapore', region: 'ASEAN', flag: '🇸🇬', cost: 0, hunger: 22, happy: 20, energy: 16, buff: { stat: 'AGI', val: 2, label: '+2 AGI' },
        draw(g) {
          g.rect(4, 6, 8, 6, '#d97706'); g.rect(5, 7, 6, 4, '#f59e0b');
          g.rect(5, 9, 6, 2, '#65a30d'); g.rect(7, 9, 2, 2, '#fef08a');
        }
      },
      { id: 'chicken_rice', name: 'Hainanese Chicken Rice', country: 'Singapore', region: 'ASEAN', flag: '🇸🇬', cost: 20, hunger: 34, happy: 24, energy: 18, buff: { stat: 'STR', val: 3, label: '+3 STR' },
        draw(g) {
          g.oval(8, 11, 6, 3, '#f8fafc'); g.oval(6, 9, 2.6, 2, '#fef3c7');
          g.rect(8, 8, 4, 3, '#fed7aa'); g.rect(4, 10, 2, 1, '#22c55e'); g.px(12, 10, '#ef4444');
        }
      },
      { id: 'fish_amok', name: 'Fish Amok', country: 'Cambodia', region: 'ASEAN', flag: '🇰🇭', cost: 20, hunger: 30, happy: 24, energy: 18, buff: { stat: 'MAG', val: 3, label: '+3 MAG' },
        draw(g) {
          g.oval(8, 10, 5.2, 3.2, '#15803d'); // banana leaf cup
          g.oval(8, 8.8, 3.8, 2, '#f59e0b'); // golden curry mousse
          g.px(8, 8, '#ffffff'); g.px(9, 9, '#ef4444');
        }
      },
      { id: 'mohinga', name: 'Mohinga Noodle Soup', country: 'Myanmar', region: 'ASEAN', flag: '🇲🇲', cost: 15, hunger: 30, happy: 22, energy: 18, buff: { stat: 'DEF', val: 3, label: '+3 DEF' },
        draw(g) {
          g.oval(8, 11, 5.2, 3.2, '#0284c7'); g.oval(8, 8.8, 4.4, 2, '#d97706');
          g.px(6, 8, '#fef08a'); g.px(9, 8, '#22c55e'); g.px(10, 9, '#ffffff');
        }
      },

      // INDIA (5)
      { id: 'butter_chicken', name: 'Butter Chicken & Naan', country: 'India', region: 'India', flag: '🇮🇳', cost: 25, hunger: 38, happy: 26, energy: 20, buff: { stat: 'STR', val: 4, label: '+4 STR' },
        draw(g) {
          g.oval(5, 10, 3.2, 2.6, '#fde68a'); g.px(5, 9, '#b45309'); // warm naan
          g.oval(11, 10, 3.8, 2.8, '#92400e'); g.oval(11, 9, 3, 2, '#ea580c'); // copper bowl + rich curry
          g.px(11, 9, '#fef3c7'); g.px(10, 9, '#22c55e');
        }
      },
      { id: 'masala_dosa', name: 'Crispy Masala Dosa', country: 'India', region: 'India', flag: '🇮🇳', cost: 15, hunger: 30, happy: 22, energy: 18, buff: { stat: 'AGI', val: 3, label: '+3 AGI' },
        draw(g) {
          g.oval(8, 11, 6.2, 2.6, '#15803d'); // banana leaf
          g.line(3, 10, 12, 7, '#d97706'); g.line(3, 11, 12, 8, '#f59e0b'); g.line(4, 11, 12, 9, '#fbbf24');
          g.rect(11, 10, 2, 2, '#ffffff'); // coconut chutney
        }
      },
      { id: 'samosa', name: 'Crispy Samosa', country: 'India', region: 'India', flag: '🇮🇳', cost: 0, hunger: 24, happy: 20, energy: 14, buff: { stat: 'LUK', val: 2, label: '+2 LUK' },
        draw(g) {
          g.rect(5, 10, 6, 3, '#d97706'); g.rect(6, 8, 4, 2, '#f59e0b'); g.rect(7, 6, 2, 2, '#fbbf24');
          g.rect(11, 11, 2, 2, '#22c55e'); // mint chutney
        }
      },
      { id: 'gulab_jamun', name: 'Gulab Jamun', country: 'India', region: 'India', flag: '🇮🇳', cost: 15, hunger: 20, happy: 32, energy: 18, buff: { stat: 'MAG', val: 3, label: '+3 MAG' },
        draw(g) {
          g.oval(8, 11, 5.2, 2.6, '#e2e8f0');
          g.oval(6, 9, 2.1, 2.1, '#92400e'); g.oval(10, 9, 2.1, 2.1, '#78350f');
          g.px(6, 8, '#fbbf24'); g.px(10, 8, '#4ade80'); // pistachio garnish
        }
      },
      { id: 'masala_chai', name: 'Masala Chai', country: 'India', region: 'India', flag: '🇮🇳', cost: 10, hunger: 16, happy: 24, energy: 30, buff: { stat: 'EXP', val: 25, label: '+25% EXP' },
        draw(g) {
          g.rect(5, 7, 6, 6, '#c25e34'); // clay kulhad cup
          g.rect(6, 7, 4, 2, '#d97706'); g.px(7, 4, '#f8fafc'); g.px(9, 5, '#cbd5e1'); // warm spice steam
        }
      },

      // East Asia & Europe (6)
      { id: 'dango', name: 'Tri-Color Dango', country: 'Japan', region: 'East Asia', flag: '🇯🇵', cost: 10, hunger: 22, happy: 28, energy: 14, buff: { stat: 'LUK', val: 3, label: '+3 LUK' },
        draw(g) {
          g.line(4, 13, 12, 3, '#d6b482');
          g.oval(6, 10, 2, 2, '#4ade80'); g.oval(8.5, 7.5, 2, 2, '#ffffff'); g.oval(11, 5, 2, 2, '#f9a8d4');
        }
      },
      { id: 'ramen', name: 'Tonkotsu Ramen', country: 'Japan', region: 'East Asia', flag: '🇯🇵', cost: 25, hunger: 36, happy: 24, energy: 20, buff: { stat: 'STR', val: 3, label: '+3 STR' },
        draw(g) {
          g.oval(8, 11, 5.5, 3.4, '#1e293b'); g.oval(8, 8.5, 4.6, 2, '#fef08a');
          g.rect(5, 8, 2, 2, '#f472b6'); g.rect(9, 8, 2, 2, '#ffffff'); g.px(10, 8, '#f59e0b');
        }
      },
      { id: 'baozi', name: 'Steamed Baozi', country: 'China', region: 'East Asia', flag: '🇨🇳', cost: 10, hunger: 26, happy: 22, energy: 16, buff: { stat: 'DEF', val: 2, label: '+2 DEF' },
        draw(g) {
          g.oval(8, 11, 5.5, 2.4, '#b45309'); // bamboo steamer
          g.oval(8, 8.5, 4.2, 3, '#ffffff'); g.px(8, 6, '#e2e8f0');
        }
      },
      { id: 'honey_blini', name: 'Honey & Blini', country: 'Russia', region: 'Europe', flag: '🇷🇺', cost: 15, hunger: 28, happy: 24, energy: 20, buff: { stat: 'DEF', val: 3, label: '+3 DEF' },
        draw(g) {
          g.oval(8, 11, 5.6, 2.5, '#e2e8f0');
          g.oval(8, 9.5, 4.4, 2, '#d97706'); g.oval(8, 8, 4.2, 1.8, '#f59e0b');
          g.oval(8, 7, 2.2, 1.2, '#fde047'); // golden honey
        }
      },
      { id: 'pizza', name: 'Margherita Pizza', country: 'Italy', region: 'Europe', flag: '🇮🇹', cost: 20, hunger: 34, happy: 26, energy: 18, buff: { stat: 'STR', val: 3, label: '+3 STR' },
        draw(g) {
          g.oval(8, 9, 5.5, 4.5, '#d97706'); g.oval(8, 9, 4.4, 3.5, '#ef4444');
          g.oval(8, 9, 3.6, 2.8, '#fde047'); g.px(7, 8, '#22c55e'); g.px(9, 10, '#ffffff');
        }
      },
      { id: 'gelato', name: 'Italian Gelato Cone', country: 'Italy', region: 'Europe', flag: '🇮🇹', cost: 15, hunger: 18, happy: 32, energy: 16, buff: { stat: 'AGI', val: 3, label: '+3 AGI' },
        draw(g) {
          g.rect(7, 9, 2, 5, '#d97706'); g.rect(6, 9, 4, 2, '#f59e0b');
          g.oval(7, 7, 2.4, 2.2, '#f472b6'); g.oval(9.5, 7, 2.2, 2.2, '#86efac');
        }
      }
    ];

    // ==========================================================================
    // 6. 10 SCENIC 16-BIT PLACES & PET HOME FURNITURE
    // ==========================================================================
    const PLACES = [
      { id: 'cozy_home', name: 'Cozy Pet Home', icon: '🏡' },
      { id: 'bahay_kubo', name: 'Bahay Kubo Sunset', icon: '🇵🇭' },
      { id: 'thai_temple', name: 'Thai Golden Temple', icon: '🇹🇭' },
      { id: 'india_taj', name: 'India Taj Courtyard', icon: '🇮🇳' },
      { id: 'kyoto_shrine', name: 'Kyoto Sakura Shrine', icon: '🇯🇵' },
      { id: 'bamboo_court', name: 'Bamboo Lantern Court', icon: '🇨🇳' },
      { id: 'snowy_birch', name: 'Snowy Birch Village', icon: '🇷🇺' },
      { id: 'venice_canal', name: 'Venice Canal Piazza', icon: '🇮🇹' },
      { id: 'grid', name: 'Transparent Grid', icon: '🏁' },
      { id: 'dark', name: 'Dark Mode Studio', icon: '🌙' }
    ];

    const HOME_FURNITURE = [
      { id: 'parol', name: 'Filipino Parol ⭐' },
      { id: 'fairy_lights', name: 'Fairy Lights ✨' },
      { id: 'plant', name: 'Monstera Plant 🪴' },
      { id: 'banig', name: 'ASEAN Banig Rug 🧶' },
      { id: 'pet_bed', name: 'Plush Pet Bed 🛏️' },
      { id: 'bookshelf', name: 'Mini Bookshelf 📚' },
      { id: 'tea_table', name: 'Low Tea Table 🍵' }
    ];

    // ==========================================================================
    // 7. MONSTERS, MYTHICAL BOSSES, CAREERS, INVESTMENTS & RANDOM EVENTS
    // ==========================================================================

const GameState = {
  selectedPetId: null,
  wardrobe: { head: 'none', neck: 'none', back: 'none' },
};

function getPetById(id) {
  const nid = normalizeSpeciesId(id);
  return PET_ROSTER.find((p) => p.id === id)
    || PET_ROSTER.find((p) => p.id === nid)
    || PET_ROSTER[0];
}

const SpriteBank = { pets: {}, foods: {} };

function bakePetSprites(petId) {
  const pet = getPetById(petId);
  const frames = {};
  for (const st of STATES) {
    frames[st] = [];
    for (let f = 0; f < FRAMES_PER_STATE; f++) {
      const g = new PixelGrid(32, 32);
      pet.drawFrame(g, st, f, GameState.wardrobe);
      frames[st].push(g.toCanvas());
    }
  }
  SpriteBank.pets[petId] = frames;
}

function bakeFoodSprite(del) {
  const g = new PixelGrid(16, 16);
  del.draw(g);
  g.applyOutline('#201b29');
  return g.toCanvas();
}

function ensurePetSprites(petId) {
  if (!SpriteBank.pets[petId]) bakePetSprites(petId);
  return SpriteBank.pets[petId];
}

function ensureFoodSprite(delId) {
  const del = DELICACIES.find((d) => d.id === delId);
  if (!del) return null;
  if (!SpriteBank.foods[delId]) SpriteBank.foods[delId] = bakeFoodSprite(del);
  return SpriteBank.foods[delId];
}

    const PET_SHEET_ANIMS = JSON.parse(
      '{"banog":{"flying":{"fps":10,"fr":8},"idle":{"fps":8,"fr":8},"sleeping":{"fps":6,"fr":8},"working":{"fps":10,"fr":8}},"banog_evo":{"flying":{"fps":10,"fr":8},"idle":{"fps":8,"fr":8},"sleeping":{"fps":6,"fr":8},"working":{"fps":10,"fr":8}},"bantay":{"idle":{"fps":8,"fr":8},"sleeping":{"fps":6,"fr":8},"walking":{"fps":10,"fr":8},"working":{"fps":10,"fr":8}},"bantay_evo":{"idle":{"fps":8,"fr":8},"sleeping":{"fps":6,"fr":8},"walking":{"fps":10,"fr":8},"working":{"fps":10,"fr":8}},"bao":{"idle":{"fps":8,"fr":8},"sleeping":{"fps":6,"fr":8},"walking":{"fps":10,"fr":8},"working":{"fps":10,"fr":8}},"bao_evo":{"idle":{"fps":8,"fr":8},"sleeping":{"fps":6,"fr":8},"walking":{"fps":10,"fr":8},"working":{"fps":10,"fr":8}},"bara":{"idle":{"fps":8,"fr":8},"sleeping":{"fps":6,"fr":8},"walking":{"fps":10,"fr":8},"working":{"fps":10,"fr":8}},"bara_evo":{"idle":{"fps":8,"fr":8},"sleeping":{"fps":6,"fr":8},"walking":{"fps":10,"fr":8},"working":{"fps":10,"fr":8}},"chai":{"idle":{"fps":8,"fr":8},"sleeping":{"fps":6,"fr":8},"walking":{"fps":10,"fr":8},"working":{"fps":10,"fr":8}},"chai_evo":{"idle":{"fps":8,"fr":8},"sleeping":{"fps":6,"fr":8},"walking":{"fps":10,"fr":8},"working":{"fps":10,"fr":8}},"dragon":{"fire_breath":{"fps":10,"fr":8},"flying":{"fps":10,"fr":8},"idle":{"fps":8,"fr":8},"sleeping":{"fps":6,"fr":8},"working":{"fps":10,"fr":8}},"egg":{"crack":{"fps":8,"fr":8},"idle":{"fps":8,"fr":8},"shaking":{"fps":12,"fr":8}},"gagak":{"flying":{"fps":10,"fr":8},"idle":{"fps":8,"fr":8},"sleeping":{"fps":6,"fr":8},"working":{"fps":10,"fr":8}},"gagak_evo":{"flying":{"fps":10,"fr":8},"idle":{"fps":8,"fr":8},"sleeping":{"fps":6,"fr":8},"working":{"fps":10,"fr":8}},"gino":{"idle":{"fps":8,"fr":8},"sleeping":{"fps":6,"fr":8},"walking":{"fps":10,"fr":8},"working":{"fps":10,"fr":8}},"gino_evo":{"idle":{"fps":8,"fr":8},"sleeping":{"fps":6,"fr":8},"walking":{"fps":10,"fr":8},"working":{"fps":10,"fr":8}},"kala":{"idle":{"fps":8,"fr":8},"sleeping":{"fps":6,"fr":8},"walking":{"fps":10,"fr":8},"working":{"fps":10,"fr":8}},"kala_evo":{"idle":{"fps":8,"fr":8},"sleeping":{"fps":6,"fr":8},"walking":{"fps":10,"fr":8},"working":{"fps":10,"fr":8}},"linh":{"idle":{"fps":8,"fr":8},"sleeping":{"fps":6,"fr":8},"walking":{"fps":10,"fr":8},"working":{"fps":10,"fr":8}},"linh_evo":{"idle":{"fps":8,"fr":8},"sleeping":{"fps":6,"fr":8},"walking":{"fps":10,"fr":8},"working":{"fps":10,"fr":8}},"merli":{"idle":{"fps":8,"fr":8},"sleeping":{"fps":6,"fr":8},"walking":{"fps":10,"fr":8},"working":{"fps":10,"fr":8}},"merli_evo":{"idle":{"fps":8,"fr":8},"sleeping":{"fps":6,"fr":8},"walking":{"fps":10,"fr":8},"working":{"fps":10,"fr":8}},"misha":{"idle":{"fps":8,"fr":8},"sleeping":{"fps":6,"fr":8},"walking":{"fps":10,"fr":8},"working":{"fps":10,"fr":8}},"misha_evo":{"idle":{"fps":8,"fr":8},"sleeping":{"fps":6,"fr":8},"walking":{"fps":10,"fr":8},"working":{"fps":10,"fr":8}},"mochi":{"idle":{"fps":8,"fr":8},"sleeping":{"fps":6,"fr":8},"walking":{"fps":10,"fr":8},"working":{"fps":10,"fr":8}},"mochi_evo":{"idle":{"fps":8,"fr":8},"sleeping":{"fps":6,"fr":8},"walking":{"fps":10,"fr":8},"working":{"fps":10,"fr":8}},"moti_evo":{"idle":{"fps":8,"fr":8},"sleeping":{"fps":6,"fr":8},"walking":{"fps":10,"fr":8},"working":{"fps":10,"fr":8}},"muning":{"idle":{"fps":8,"fr":8},"sleeping":{"fps":6,"fr":8},"walking":{"fps":10,"fr":8},"working":{"fps":10,"fr":8}},"muning_evo":{"idle":{"fps":8,"fr":8},"sleeping":{"fps":6,"fr":8},"walking":{"fps":10,"fr":8},"working":{"fps":10,"fr":8}},"raja":{"idle":{"fps":8,"fr":8},"sleeping":{"fps":6,"fr":8},"walking":{"fps":10,"fr":8},"working":{"fps":10,"fr":8}},"raja_evo":{"idle":{"fps":8,"fr":8},"sleeping":{"fps":6,"fr":8},"walking":{"fps":10,"fr":8},"working":{"fps":10,"fr":8}},"ran":{"idle":{"fps":8,"fr":8},"sleeping":{"fps":6,"fr":8},"slither":{"fps":10,"fr":8},"working":{"fps":10,"fr":8}},"ran_evo":{"idle":{"fps":8,"fr":8},"sleeping":{"fps":6,"fr":8},"slither":{"fps":10,"fr":8},"working":{"fps":10,"fr":8}},"rimau":{"idle":{"fps":8,"fr":8},"sleeping":{"fps":6,"fr":8},"walking":{"fps":10,"fr":8},"working":{"fps":10,"fr":8}},"rimau_evo":{"idle":{"fps":8,"fr":8},"sleeping":{"fps":6,"fr":8},"walking":{"fps":10,"fr":8},"working":{"fps":10,"fr":8}},"tala":{"idle":{"fps":8,"fr":8},"sleeping":{"fps":6,"fr":8},"walking":{"fps":10,"fr":8},"working":{"fps":10,"fr":8}},"tala_evo":{"idle":{"fps":8,"fr":8},"sleeping":{"fps":6,"fr":8},"walking":{"fps":10,"fr":8},"working":{"fps":10,"fr":8}}}'
    );

    const SPECIES_ALIASES = { pusa: 'muning', agila: 'banog', uwak: 'gagak', ahas: 'ran' };

    function normalizeSpeciesId(id) {
      if (typeof id !== 'string' || !id) return id;
      return SPECIES_ALIASES[id] || id;
    }

    const SPRITE_SHEET_ROOTS = ['../../assets/pets/', 'assets/pets/', 'pets/'];

    function setSheetRoots(list) {
      if (Array.isArray(list) && list.length) SPRITE_SHEET_ROOTS.splice(0, SPRITE_SHEET_ROOTS.length, ...list);
    }

    const V2_MOVE_ANIM = {
      banog: 'flying', banog_evo: 'flying', gagak: 'flying', gagak_evo: 'flying', dragon: 'flying',
      ran: 'slither', ran_evo: 'slither',
    };
    const V2_STATE_ANIMS = { IDLE: 'idle', HAPPY: 'idle', EAT: 'working', SLEEP: 'sleeping' };

    function petSheetInfo(petId, anim) {
      const pid = normalizeSpeciesId(petId);
      const p = PET_SHEET_ANIMS[pid];
      if (!p) return null;
      const a = anim ? String(anim) : '';
      if (p[a]) return { petId: pid, anim: a, fps: p[a].fps, frames: p[a].fr || 8 };
      return null;
    }

    function petSheetAnim(state, petId) {
      const pid = normalizeSpeciesId(petId);
      const p = PET_SHEET_ANIMS[pid];
      if (!p) return null;
      const st = state ? String(state).toUpperCase() : 'IDLE';
      const lower = st.toLowerCase();
      if (p[lower]) return lower;
      const anim = st === 'WALK' ? (V2_MOVE_ANIM[pid] || 'walking') : (V2_STATE_ANIMS[st] || 'idle');
      return p[anim] ? anim : (p.idle ? 'idle' : (Object.keys(p)[0] || null));
    }

    function petSheetFps(petId, anim) {
      const info = petSheetInfo(petId, anim);
      return info ? info.fps : 8;
    }

    const sheetBank = {};

    function sliceSheet(img) {
      const wFrame = 192;
      const hFrame = 192;
      const total = Math.max(1, Math.floor(img.naturalWidth / wFrame));
      const frames = [];
      for (let i = 0; i < total; i += 1) {
        const c = document.createElement('canvas');
        c.width = wFrame;
        c.height = hFrame;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, i * wFrame, 0, wFrame, hFrame, 0, 0, wFrame, hFrame);
        frames.push(c);
      }
      return frames;
    }

    function petSheetFrames(petId, anim) {
      const info = petSheetInfo(petId, anim);
      if (!info || typeof document === 'undefined' || typeof Image === 'undefined') return null;
      const key = `${info.petId}@${info.anim}`;
      let slot = sheetBank[key];
      if (!slot) {
        slot = { frames: null, roots: SPRITE_SHEET_ROOTS.slice(), trying: false };
        sheetBank[key] = slot;
      }
      if (slot.frames) return slot.frames;
      if (slot.trying) return null;
      slot.trying = true;
      if (!slot.roots.length) slot.roots = SPRITE_SHEET_ROOTS.slice();
      const root = slot.roots.shift();
      if (root === undefined) { slot.trying = false; return null; }
      const img = new Image();
      img.onload = () => {
        slot.trying = false;
        if (img.naturalWidth >= 192) slot.frames = sliceSheet(img);
      };
      img.onerror = () => { slot.trying = false; };
      img.src = `${root}sprites/${info.petId}/${info.petId}_${info.anim}_sheet.png`;
      return null;
    }

    function petSheetGif(petId, anim) {
      const info = petSheetInfo(petId, anim || 'idle');
      return info ? `${SPRITE_SHEET_ROOTS[0]}sprites/${info.petId}/${info.petId}_${info.anim}.gif` : null;
    }

    function petSheetUrl(petId, anim) {
      const info = petSheetInfo(petId, anim || 'idle');
      return info ? `${SPRITE_SHEET_ROOTS[0]}sprites/${info.petId}/${info.petId}_${info.anim}_sheet.png` : null;
    }

    function prewarmPetSheets(petId) {
      const pid = normalizeSpeciesId(petId);
      const p = PET_SHEET_ANIMS[pid];
      if (!p || typeof document === 'undefined' || typeof Image === 'undefined') return;
      for (const anim of Object.keys(p)) petSheetFrames(pid, anim);
      const evoId = `${pid}_evo`;
      if (PET_SHEET_ANIMS[evoId]) for (const anim of Object.keys(PET_SHEET_ANIMS[evoId])) petSheetFrames(evoId, anim);
    }

    function isPetSheetEvo(petId) {
      return typeof petId === 'string' && petId.endsWith('_evo') && !!PET_SHEET_ANIMS[petId];
    }

const EVO_DEFS = [
  { id: 'bantay', evolvedName: "Datu Bantay", country: 'Philippines' },
  { id: 'kala', evolvedName: "Bathala Kala", country: 'Philippines' },
  { id: 'tala', evolvedName: "Archmage Tala", country: 'Philippines' },
  { id: 'chai', evolvedName: "Maharaja Chai", country: 'Thailand' },
  { id: 'linh', evolvedName: "Empress Linh", country: 'Vietnam' },
  { id: 'bara', evolvedName: "Raja Naga Bara", country: 'Indonesia' },
  { id: 'rimau', evolvedName: "Sultan Rimau", country: 'Malaysia' },
  { id: 'merli', evolvedName: "Poseidon Merli", country: 'Singapore' },
  { id: 'raja', evolvedName: "Samrat Raja", country: 'India' },
  { id: 'moti', evolvedName: "Gajendra Moti", country: 'India' },
  { id: 'mochi', evolvedName: "Shogun Mochi", country: 'Japan' },
  { id: 'bao', evolvedName: "Emperor Bao", country: 'China' },
  { id: 'misha', evolvedName: "Tsar Misha", country: 'Russia' },
  { id: 'gino', evolvedName: "Doge Gino", country: 'Italy' },
  { id: 'muning', evolvedName: "Datu Muning", country: 'Asia' },
  { id: 'banog', evolvedName: "Mandirigma Banog", country: 'Philippines' },
  { id: 'gagak', evolvedName: "Diwata Gagak", country: 'Indonesia' },
  { id: 'ran', evolvedName: "Naga Ran", country: 'Vietnam' },
];

    for (const evoId of Object.keys(PET_SHEET_ANIMS)) {
      if (evoId === 'egg' || !evoId.endsWith('_evo')) continue;
      if (PET_ROSTER.some((p) => p.id === evoId)) continue;
      const baseId = evoId.slice(0, -4);
      const base = PET_ROSTER.find((p) => p.id === baseId) || PET_ROSTER[0];
      PET_ROSTER.push({
        id: evoId,
        name: (() => { const def = EVO_DEFS.find((e) => e.id === baseId); return def ? def.evolvedName : `${base.name} Evo`; })(),
        country: base.country, region: base.region, flag: base.flag,
        species: base.species ? `${base.species} (Evolved)` : evoId,
        favoriteFood: base.favoriteFood, greeting: base.greeting,
        skillName: base.skillName, skillEmoji: base.skillEmoji,
        speed: base.speed, evoOf: baseId, shopOnly: true,
        dialogues: base.dialogues,
        drawFrame(g, state, f, wardrobe) { base.drawFrame(g, state, f, wardrobe); },
      });
    }

return {
  PET_ROSTER,
  PET_SHEET_ANIMS,
  EVO_DEFS,
  DELICACIES,
  STATES,
  FRAMES_PER_STATE,
  SpriteBank,
  PixelGrid,
  SPECIES_ALIASES,
  normalizeSpeciesId,
  getPetById,
  ensurePetSprites,
  ensureFoodSprite,
  setSheetRoots,
  petSheetInfo,
  petSheetAnim,
  petSheetFps,
  petSheetFrames,
  petSheetGif,
  petSheetUrl,
  prewarmPetSheets,
  isPetSheetEvo,
};
});
