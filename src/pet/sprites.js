'use strict';

/* Pixel-art sprite system adapted from Juan-Buddy Studio (12 pets, 16-bit). */
    class PixelGrid {
      constructor(width = 32, height = 32) {
        this.w = width;
        this.h = height;
        this.grid = Array.from({ length: height }, () => Array(width).fill(null));
      }

      px(x, y, color) {
        const ix = Math.round(x);
        const iy = Math.round(y);
        if (ix >= 0 && ix < this.w && iy >= 0 && iy < this.h) {
          this.grid[iy][ix] = color;
        }
      }

      get(x, y) {
        if (x < 0 || x >= this.w || y < 0 || y >= this.h) return null;
        return this.grid[y][x];
      }

      rect(x, y, w, h, color) {
        for (let dy = 0; dy < h; dy++) {
          for (let dx = 0; dx < w; dx++) {
            this.px(x + dx, y + dy, color);
          }
        }
      }

      oval(cx, cy, rx, ry, color) {
        for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
          for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
            const nx = (x - cx) / rx;
            const ny = (y - cy) / ry;
            if (nx * nx + ny * ny <= 1.0) this.px(x, y, color);
          }
        }
      }

      line(x0, y0, x1, y1, color) {
        let ix0 = Math.round(x0), iy0 = Math.round(y0);
        const ix1 = Math.round(x1), iy1 = Math.round(y1);
        const dx = Math.abs(ix1 - ix0), sx = ix0 < ix1 ? 1 : -1;
        const dy = -Math.abs(iy1 - iy0), sy = iy0 < iy1 ? 1 : -1;
        let err = dx + dy;
        while (true) {
          this.px(ix0, iy0, color);
          if (ix0 === ix1 && iy0 === iy1) break;
          const e2 = 2 * err;
          if (e2 >= dy) { err += dy; ix0 += sx; }
          if (e2 <= dx) { err += dx; iy0 += sy; }
        }
      }

      /**
       * Adds a crisp 1px dark 16-bit outline around all opaque pixels.
       */
      applyOutline(outlineColor = '#211c2b') {
        const toOutline = [];
        const dirs = [[1,0], [-1,0], [0,1], [0,-1]];
        for (let y = 0; y < this.h; y++) {
          for (let x = 0; x < this.w; x++) {
            if (!this.grid[y][x]) {
              for (const [dx, dy] of dirs) {
                if (this.get(x + dx, y + dy)) {
                  toOutline.push([x, y]);
                  break;
                }
              }
            }
          }
        }
        for (const [x, y] of toOutline) this.grid[y][x] = outlineColor;
      }

      toCanvas() {
        const canvas = document.createElement('canvas');
        canvas.width = this.w;
        canvas.height = this.h;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, this.w, this.h);
        for (let y = 0; y < this.h; y++) {
          for (let x = 0; x < this.w; x++) {
            const c = this.grid[y][x];
            if (c) {
              ctx.fillStyle = c;
              ctx.fillRect(x, y, 1, 1);
            }
          }
        }
        return canvas;
      }
    }

    function drawCuteFace(g, lx, rx, y, state, frame, eyeColor = '#1c1824', blushColor = '#f48fb1', glintColor = '#ffffff') {
      if (state === 'SLEEP') {
        g.rect(lx, y + 1, 2, 1, eyeColor);
        g.rect(rx, y + 1, 2, 1, eyeColor);
        g.px(lx - 1, y + 2, blushColor);
        g.px(rx + 2, y + 2, blushColor);
      } else if (state === 'HAPPY' || (state === 'EAT' && frame % 2 === 1)) {
        g.px(lx, y + 1, eyeColor);
        g.px(lx + 1, y, eyeColor);
        g.px(rx, y, eyeColor);
        g.px(rx + 1, y + 1, eyeColor);
        g.px(lx - 1, y + 2, blushColor);
        g.px(rx + 2, y + 2, blushColor);
      } else if (state === 'IDLE' && frame === 3) {
        g.rect(lx, y + 1, 2, 1, eyeColor);
        g.rect(rx, y + 1, 2, 1, eyeColor);
      } else {
        g.rect(lx, y, 2, 2, eyeColor);
        g.rect(rx, y, 2, 2, eyeColor);
        g.px(lx, y, glintColor);
        g.px(rx, y, glintColor);
        g.px(lx - 1, y + 2, blushColor);
        g.px(rx + 2, y + 2, blushColor);
      }
    }

    // ==========================================================================
    // 3. EQUIPABLE CUTE WARDROBE ITEMS (DYNAMICALLY TRACKING PET ANCHORS)
    // ==========================================================================
    const WARDROBE_CATALOG = {
      headgear: [
        { id: 'none', name: 'None', icon: '🚫' },
        { id: 'witch_hat', name: 'Mini Witch Hat', icon: '🧙' },
        { id: 'flower_crown', name: 'Flower Crown', icon: '🌸' },
        { id: 'golden_crown', name: 'Golden Crown', icon: '👑' },
        { id: 'sakura_pin', name: 'Sakura Hairpin', icon: '🌺' },
        { id: 'beanie', name: 'Cozy Beanie', icon: '🧶' },
        { id: 'star_halo', name: 'Star Halo', icon: '😇' },
        { id: 'shades', name: 'Cool Shades', icon: '🕶️' }
      ],
      neck: [
        { id: 'none', name: 'None', icon: '🚫' },
        { id: 'red_scarf', name: 'Red Scarf', icon: '🧣' },
        { id: 'bell_collar', name: 'Gold Bell Collar', icon: '🔔' },
        { id: 'bowtie', name: 'Cute Bowtie', icon: '🎀' },
        { id: 'wizard_cape', name: 'Wizard Cape', icon: '🪄' }
      ],
      aura: [
        { id: 'none', name: 'None', icon: '🚫' },
        { id: 'angel_wings', name: 'Angel Wings', icon: '🪽' },
        { id: 'lantern', name: 'Floating Lantern', icon: '🏮' },
        { id: 'sparkles', name: 'Sparkling Stars', icon: '✨' },
        { id: 'heart_aura', name: 'Heart Aura', icon: '💖' }
      ]
    };

    // Per-pet equipped state
    const EquippedWardrobe = {};

    function getPetOutfit(petId) {
      if (!EquippedWardrobe[petId]) {
        EquippedWardrobe[petId] = { headgear: 'none', neck: 'none', aura: 'none' };
      }
      return EquippedWardrobe[petId];
    }

    /**
     * Draws back-layer items (Angel Wings, Wizard Cape back) BEFORE the pet body.
     */
    function drawWardrobeBack(g, anchors, outfit, state, f) {
      const { bodyX, bodyY, neckX, neckY } = anchors;
      const flap = (f % 2 === 0) ? 0 : -1;

      if (outfit.aura === 'angel_wings') {
        // Left & Right tiny feathered wings
        g.rect(bodyX - 9, bodyY - 2 + flap, 4, 3, '#f8fafc');
        g.rect(bodyX - 10, bodyY - 3 + flap, 3, 2, '#e0f2fe');
        g.px(bodyX - 8, bodyY + 1 + flap, '#cbd5e1');

        g.rect(bodyX + 5, bodyY - 2 + flap, 4, 3, '#f8fafc');
        g.rect(bodyX + 7, bodyY - 3 + flap, 3, 2, '#e0f2fe');
        g.px(bodyX + 7, bodyY + 1 + flap, '#cbd5e1');
      }

      if (outfit.neck === 'wizard_cape') {
        const flutter = (state === 'WALK' || state === 'HAPPY') ? (f % 2 === 0 ? 1 : 0) : 0;
        g.rect(neckX - 6, neckY + 1, 13, 6 + flutter, '#4c1d95');
        g.rect(neckX - 5, neckY + 2, 11, 4 + flutter, '#6d28d9');
        g.rect(neckX - 6, neckY + 6 + flutter, 13, 1, '#fbbf24'); // gold hem
      }
    }

    /**
     * Draws front-layer items (Headgear, Neckwear) BEFORE the final outline pass
     * so they blend seamlessly with the 16-bit outline.
     */
    function drawWardrobeFront(g, anchors, outfit, state, f) {
      const { headX, headY, neckX, neckY } = anchors;
      const topY = headY - 4;

      // ---- NECK / BODY ITEMS ----
      if (outfit.neck === 'red_scarf') {
        g.rect(neckX - 5, neckY, 10, 2, '#dc2626');
        g.rect(neckX - 4, neckY, 8, 1, '#f87171');
        const sway = (f % 2 === 0) ? 0 : 1;
        g.rect(neckX + 2 + sway, neckY + 2, 3, 4, '#b91c1c');
        g.rect(neckX + 2 + sway, neckY + 5, 3, 1, '#fef08a');
      } else if (outfit.neck === 'bell_collar') {
        g.rect(neckX - 4, neckY, 9, 2, '#e11d48');
        g.rect(neckX - 1, neckY + 1, 3, 3, '#f59e0b');
        g.px(neckX, neckY + 1, '#fef08a');
        g.px(neckX, neckY + 3, '#78350f');
      } else if (outfit.neck === 'bowtie') {
        g.rect(neckX - 3, neckY, 2, 3, '#ec4899');
        g.rect(neckX + 2, neckY, 2, 3, '#ec4899');
        g.rect(neckX - 1, neckY + 1, 3, 2, '#f472b6');
        g.px(neckX, neckY + 1, '#fbcfe8');
      } else if (outfit.neck === 'wizard_cape') {
        // Front clasp
        g.rect(neckX - 4, neckY, 9, 2, '#5b21b6');
        g.rect(neckX - 1, neckY, 3, 2, '#fbbf24');
      }

      // ---- HEADGEAR ITEMS ----
      if (outfit.headgear === 'witch_hat') {
        g.rect(headX - 6, topY + 2, 13, 2, '#4c1d95');
        g.rect(headX - 4, topY, 9, 2, '#6d28d9');
        g.rect(headX - 2, topY - 2, 5, 2, '#7c3aed');
        g.rect(headX - 1, topY - 4, 3, 2, '#6d28d9');
        g.px(headX + 1, topY - 5, '#4c1d95');
        g.rect(headX - 4, topY + 1, 9, 1, '#fbbf24'); // gold band
        g.px(headX, topY, '#fef08a');                 // star gem
      } else if (outfit.headgear === 'flower_crown') {
        g.rect(headX - 5, topY + 2, 11, 2, '#16a34a');
        g.rect(headX - 5, topY + 1, 2, 2, '#f472b6');
        g.rect(headX - 1, topY + 1, 2, 2, '#fef08a');
        g.rect(headX + 3, topY + 1, 2, 2, '#fb7185');
        g.px(headX - 2, topY + 2, '#ffffff');
        g.px(headX + 2, topY + 2, '#c084fc');
      } else if (outfit.headgear === 'golden_crown') {
        g.rect(headX - 4, topY + 1, 9, 2, '#eab308');
        g.rect(headX - 4, topY - 1, 2, 2, '#facc15');
        g.rect(headX - 1, topY - 2, 3, 3, '#fde047');
        g.rect(headX + 3, topY - 1, 2, 2, '#facc15');
        g.px(headX, topY + 1, '#e11d48');   // ruby
        g.px(headX - 3, topY + 1, '#38bdf8');
        g.px(headX + 3, topY + 1, '#38bdf8');
      } else if (outfit.headgear === 'sakura_pin') {
        g.rect(headX + 2, topY + 1, 3, 3, '#f9a8d4');
        g.px(headX + 3, topY, '#fbcfe8');
        g.px(headX + 5, topY + 2, '#fbcfe8');
        g.px(headX + 3, topY + 2, '#fde047');
      } else if (outfit.headgear === 'beanie') {
        g.rect(headX - 5, topY + 1, 11, 2, '#b91c1c');
        g.rect(headX - 4, topY - 1, 9, 2, '#dc2626');
        g.rect(headX - 3, topY - 2, 7, 1, '#ef4444');
        g.rect(headX - 1, topY - 4, 3, 2, '#fef2f2'); // pom-pom
        g.px(headX - 3, topY + 1, '#fca5a5');
        g.px(headX + 1, topY + 1, '#fca5a5');
      }
    }

    /**
     * Draws overlay effects (Shades, Floating Halo, Lantern, Sparkles, Hearts)
     * AFTER the outline pass so glowing auras & sunglasses look razor-sharp.
     */
    function drawWardrobeOverlay(g, anchors, outfit, state, f) {
      const { headX, headY } = anchors;
      const floatY = (f % 2 === 0) ? 0 : -1;

      if (outfit.headgear === 'shades' && state !== 'SLEEP') {
        g.rect(headX - 5, headY + 1, 4, 2, '#111827');
        g.rect(headX + 2, headY + 1, 4, 2, '#111827');
        g.rect(headX - 1, headY + 1, 3, 1, '#111827');
        g.px(headX - 4, headY + 1, '#38bdf8'); // cool glint
        g.px(headX + 3, headY + 1, '#38bdf8');
      }

      if (outfit.headgear === 'star_halo') {
        const hy = headY - 8 + floatY;
        g.rect(headX - 3, hy, 7, 1, '#fde047');
        g.px(headX - 4, hy + 1, '#facc15');
        g.px(headX + 4, hy + 1, '#facc15');
        g.rect(headX - 3, hy + 2, 7, 1, '#fef08a');
      }

      if (outfit.aura === 'lantern') {
        const lx = 26;
        const ly = 7 + floatY;
        g.rect(lx, ly - 1, 3, 1, '#fbbf24');
        g.rect(lx - 1, ly, 5, 4, '#dc2626');
        g.rect(lx, ly + 1, 3, 2, '#fde047'); // warm glow
        g.rect(lx, ly + 4, 3, 1, '#fbbf24');
        g.px(lx + 1, ly + 5, '#ef4444');
      } else if (outfit.aura === 'sparkles') {
        const pts = f % 2 === 0
          ? [[4, 8, '#fde047'], [27, 6, '#38bdf8'], [26, 20, '#f472b6']]
          : [[5, 13, '#38bdf8'], [25, 9, '#fde047'], [6, 5, '#c084fc']];
        for (const [sx, sy, col] of pts) {
          g.px(sx, sy, '#ffffff');
          g.px(sx - 1, sy, col);
          g.px(sx + 1, sy, col);
          g.px(sx, sy - 1, col);
          g.px(sx, sy + 1, col);
        }
      } else if (outfit.aura === 'heart_aura') {
        const hx = f % 2 === 0 ? 4 : 25;
        const hy = f % 2 === 0 ? 7 : 8;
        g.px(hx, hy, '#f43f5e');
        g.px(hx + 2, hy, '#f43f5e');
        g.rect(hx, hy + 1, 3, 1, '#fb7185');
        g.px(hx + 1, hy + 2, '#f43f5e');
      }
    }

    // ==========================================================================
    // 4. 12 ANIMATED 16-BIT PET CHARACTERS (8 ASEAN + 4 WORLD)
    // ==========================================================================
    const STATES = ['IDLE', 'WALK', 'HAPPY', 'EAT', 'SLEEP'];
    const FRAMES_PER_STATE = 4;

    const PET_ROSTER = [
      // ---------------- PHILIPPINES ----------------
      {
        id: 'kala',
        name: 'Kala',
        country: 'Philippines',
        region: 'asean',
        isPH: true,
        flag: '🇵🇭',
        species: 'Carabao Calf (Kalabaw)',
        snackName: 'Halo-Halo',
        snackEmoji: '🍧',
        greeting: 'Mabuhay!',
        dialogues: ['Mabuhay!', 'Tara, pahinga muna!', 'Sarap ng Halo-Halo!', 'Kaya natin \'to!'],
        description: 'Gentle gray-slate Filipino water buffalo wearing a woven golden Salakot hat and red neckerchief.',
        speed: 34,
        outlineColor: '#221f2b',
        drawBase(g, state, f) {
          const isSleep = state === 'SLEEP', isHappy = state === 'HAPPY', isEat = state === 'EAT';
          const bob = isSleep ? (f >= 2 ? 1 : 0) : (isHappy ? (f % 2 === 1 ? -3 : -1) : (state === 'WALK' ? (f % 2 === 1 ? -1 : 0) : (f === 1 || f === 2 ? 1 : 0)));
          const headY = (isSleep ? 16 : (isEat ? 15 : 12)) + bob;
          const bodyY = (isSleep ? 21 : 19) + (isSleep ? 0 : Math.floor(bob * 0.6));

          const tailWag = (f % 2 === 0) ? 0 : 1;
          g.line(23, bodyY + 1, 26, bodyY + 3 + tailWag, '#5a6373');
          g.rect(26, bodyY + 3 + tailWag, 2, 2, '#3a414d');

          if (!isSleep) {
            const sL = state === 'WALK' ? (f === 1 ? -2 : f === 3 ? 1 : 0) : 0;
            const sR = state === 'WALK' ? (f === 3 ? -2 : f === 1 ? 1 : 0) : 0;
            g.rect(11, bodyY + 6 + sL, 3, 4, '#6b7587'); g.rect(11, bodyY + 9 + sL, 3, 1, '#313640');
            g.rect(19, bodyY + 6 + sR, 3, 4, '#5a6373'); g.rect(19, bodyY + 9 + sR, 3, 1, '#313640');
            g.rect(14, bodyY + 6 + sR, 2, 3, '#525a69'); g.rect(17, bodyY + 6 + sL, 2, 3, '#525a69');
          } else {
            g.rect(10, 27, 4, 2, '#3a414d'); g.rect(19, 27, 4, 2, '#3a414d');
          }

          g.oval(16.5, bodyY + 3, 7, 4.8, '#6b7587');
          g.oval(15.5, bodyY + 1.5, 5.5, 2.5, '#8590a3');
          g.oval(16.5, bodyY + 5.5, 5.5, 2, '#545d6d');

          // Curved Carabao Horns
          g.line(9, headY - 1, 6, headY - 3, '#3b404c'); g.line(6, headY - 3, 7, headY - 6, '#505766');
          g.line(22, headY - 1, 25, headY - 3, '#3b404c'); g.line(25, headY - 3, 24, headY - 6, '#505766');
          g.rect(8, headY + 1, 3, 2, '#6b7587'); g.rect(20, headY + 1, 3, 2, '#6b7587');

          g.oval(15.5, headY + 2, 6, 4.8, '#778296');
          g.oval(15.5, headY + 0.5, 4.5, 2, '#919db3');
          g.oval(15.5, headY + 4.8, 4.6, 2.4, '#a6b1c4');
          g.px(13, headY + 4.5, '#3a414d'); g.px(18, headY + 4.5, '#3a414d');
          if (isEat && f % 2 === 0) g.rect(14, headY + 6, 3, 2, '#d95b7a');

          // Red neckerchief
          g.rect(11, headY + 7, 9, 2, '#dc2626');
          g.rect(13, headY + 9, 5, 2, '#b91c1c');
          g.px(15, headY + 11, '#991b1b');

          // Golden Salakot Hat
          const hatY = headY - 4;
          g.rect(8, hatY + 2, 15, 2, '#d97706');
          g.rect(9, hatY + 1, 13, 1, '#f59e0b');
          g.rect(11, hatY, 9, 1, '#fbbf24');
          g.rect(13, hatY - 1, 5, 1, '#fde68a');
          g.rect(15, hatY - 3, 1, 2, '#b45309');
          g.px(15, hatY - 3, '#fef08a');

          return { headX: 15, headY, neckX: 15, neckY: headY + 7, bodyX: 16, bodyY: bodyY + 2, faceArgs: [11, 18, headY + 1] };
        }
      },

      {
        id: 'bantay',
        name: 'Bantay',
        country: 'Philippines',
        region: 'asean',
        isPH: true,
        flag: '🇵🇭',
        species: 'Aspin (Native Dog)',
        snackName: 'Pandesal',
        snackEmoji: '🥖',
        greeting: 'Tara, lakbay!',
        dialogues: ['Tara, lakbay!', 'Arf! Mainit pa ang Pandesal!', 'Loyal buddy ready!', 'Magandang araw!'],
        description: 'Friendly golden-brown Filipino native dog with floppy ears and a Barong-embroidered bandana.',
        speed: 44,
        outlineColor: '#281c18',
        drawBase(g, state, f) {
          const isSleep = state === 'SLEEP', isHappy = state === 'HAPPY', isEat = state === 'EAT';
          const bob = isSleep ? (f >= 2 ? 1 : 0) : (isHappy ? (f % 2 === 1 ? -3 : -1) : (state === 'WALK' ? (f % 2 === 1 ? -1 : 0) : (f === 2 ? 1 : 0)));
          const headY = (isSleep ? 16 : (isEat ? 15 : 11)) + bob;
          const bodyY = (isSleep ? 21 : 18) + (isSleep ? 0 : Math.floor(bob * 0.5));

          const wag = (isHappy || state === 'WALK') ? (f % 2 === 0 ? -1 : 1) : (f === 1 ? 1 : 0);
          g.line(22, bodyY + 2, 25, bodyY - 1 + wag, '#c27834');
          g.line(25, bodyY - 1 + wag, 24, bodyY - 3 + wag, '#e6a760');

          if (!isSleep) {
            const s1 = state === 'WALK' ? (f === 1 ? -2 : f === 3 ? 1 : 0) : 0;
            const s2 = state === 'WALK' ? (f === 3 ? -2 : f === 1 ? 1 : 0) : 0;
            g.rect(11, bodyY + 6 + s1, 3, 4, '#c27834'); g.rect(11, bodyY + 9 + s1, 3, 1, '#f7e6c9');
            g.rect(19, bodyY + 6 + s2, 3, 4, '#a66024'); g.rect(19, bodyY + 9 + s2, 3, 1, '#f7e6c9');
          } else {
            g.rect(10, 27, 4, 2, '#f7e6c9'); g.rect(19, 27, 4, 2, '#f7e6c9');
          }

          g.oval(16.5, bodyY + 3, 6.2, 4.4, '#d48a42');
          g.oval(15.5, bodyY + 4.5, 4.2, 2.2, '#f7e6c9');
          g.oval(17, bodyY + 1, 4.5, 1.8, '#e8a85f');

          const earB = isHappy && f % 2 === 1 ? -1 : 0;
          g.rect(8, headY + 1 + earB, 3, 6, '#9c561e');
          g.rect(20, headY + 1 + earB, 3, 6, '#9c561e');

          g.oval(15.5, headY + 2, 5.5, 4.8, '#dc944a');
          g.oval(15.5, headY, 4, 2, '#f0b673');
          g.oval(15.5, headY + 4.5, 3.4, 2.1, '#fbf0db');
          g.rect(15, headY + 3, 2, 2, '#231c26');
          if (isHappy || (isEat && f % 2 === 0)) g.rect(15, headY + 6, 2, 2, '#f472b6');

          // Barong Bandana
          g.rect(11, headY + 7, 9, 2, '#fef9ef');
          g.rect(12, headY + 9, 7, 2, '#f3e5c8');
          g.px(13, headY + 8, '#d97706'); g.px(15, headY + 8, '#d97706'); g.px(17, headY + 8, '#d97706');

          return { headX: 15, headY, neckX: 15, neckY: headY + 7, bodyX: 16, bodyY: bodyY + 2, faceArgs: [11, 18, headY + 1] };
        }
      },

      {
        id: 'tala',
        name: 'Tala',
        country: 'Philippines',
        region: 'asean',
        isPH: true,
        flag: '🇵🇭',
        species: 'Witchdog (Mystical Aspin)',
        snackName: 'Ube Potion',
        snackEmoji: '🔮',
        greeting: 'Abrakadabra!',
        dialogues: ['Abrakadabra! ✨', 'Ube magic for you!', 'Bituin ng gabi~', 'Arf! Spell of good luck!'],
        description: 'Adorable mystical dark-indigo Filipino Witchdog with glowing amber eyes, purple witch hat, sampaguita star, and magic cape.',
        speed: 42,
        outlineColor: '#140f24',
        drawBase(g, state, f) {
          const isSleep = state === 'SLEEP', isHappy = state === 'HAPPY', isEat = state === 'EAT';
          const bob = isSleep ? (f >= 2 ? 1 : 0) : (isHappy ? (f % 2 === 1 ? -3 : -1) : (state === 'WALK' ? (f % 2 === 1 ? -1 : 0) : (f === 1 || f === 2 ? 1 : 0)));
          const headY = (isSleep ? 16 : (isEat ? 15 : 12)) + bob;
          const bodyY = (isSleep ? 21 : 19) + (isSleep ? 0 : Math.floor(bob * 0.5));

          // Mystical violet cape behind body
          const flutter = (f % 2 === 0) ? 0 : 1;
          g.rect(11, bodyY, 12, 5 + flutter, '#4c1d95');
          g.rect(12, bodyY + 1, 10, 3 + flutter, '#6d28d9');
          g.rect(11, bodyY + 5 + flutter, 12, 1, '#fbbf24');

          // Wagging dark-indigo tail
          const wag = (f % 2 === 0) ? 0 : -1;
          g.line(22, bodyY + 2, 26, bodyY + wag, '#312e59');
          g.px(26, bodyY - 1 + wag, '#c084fc'); // magical star tip

          // Paws
          if (!isSleep) {
            const s1 = state === 'WALK' ? (f === 1 ? -2 : f === 3 ? 1 : 0) : 0;
            const s2 = state === 'WALK' ? (f === 3 ? -2 : f === 1 ? 1 : 0) : 0;
            g.rect(11, bodyY + 6 + s1, 3, 4, '#2b2547'); g.rect(11, bodyY + 9 + s1, 3, 1, '#7c6fa8');
            g.rect(19, bodyY + 6 + s2, 3, 4, '#231d3b'); g.rect(19, bodyY + 9 + s2, 3, 1, '#7c6fa8');
          } else {
            g.rect(10, 27, 4, 2, '#7c6fa8'); g.rect(19, 27, 4, 2, '#7c6fa8');
          }

          // Dark-indigo / chocolate Aspin body
          g.oval(16.5, bodyY + 3, 6, 4.3, '#312a52');
          g.oval(15.5, bodyY + 4.5, 3.8, 2, '#4c4278');

          // Pointed Witchdog Ears
          g.rect(9, headY - 1, 3, 5, '#251e40');
          g.rect(19, headY - 1, 3, 5, '#251e40');

          // Head
          g.oval(15.5, headY + 2, 5.5, 4.6, '#38305e');
          g.oval(15.5, headY + 4.5, 3.4, 2, '#574b87');
          g.rect(15, headY + 3, 2, 1, '#140f24');
          if (isHappy || (isEat && f % 2 === 0)) g.rect(15, headY + 5, 2, 2, '#f472b6');

          // Cape gold clasp
          g.rect(11, headY + 7, 9, 2, '#5b21b6');
          g.rect(14, headY + 7, 3, 2, '#fbbf24');

          // Iconic Purple Pointy Witch Hat with Gold Star & Sampaguita accent
          const hatY = headY - 4;
          g.rect(7, hatY + 2, 17, 2, '#3b0764');  // wide brim
          g.rect(10, hatY, 11, 2, '#581c87');     // mid cone
          g.rect(12, hatY - 2, 7, 2, '#7e22ce');  // upper cone
          g.rect(14, hatY - 4, 4, 2, '#6b21a8');
          g.rect(16, hatY - 5, 3, 1, '#581c87');  // crooked witch tip!
          g.rect(10, hatY + 1, 11, 1, '#fbbf24'); // gold ribbon
          g.px(13, hatY + 1, '#ffffff');          // tiny white sampaguita flower
          g.px(16, hatY - 1, '#fde047');          // gold star accent

          return {
            headX: 15, headY, neckX: 15, neckY: headY + 7, bodyX: 16, bodyY: bodyY + 2,
            faceArgs: [11, 18, headY + 1, '#f59e0b', '#c084fc', '#fef08a'], // glowing amber eyes!
            extraOverlay: (grid, st, fr) => {
              // Subtle floating magical sparkles around Tala
              const s1x = fr % 2 === 0 ? 5 : 6;
              const s1y = fr % 2 === 0 ? 9 : 11;
              grid.px(s1x, s1y, '#fde047');
              grid.px(26, fr % 2 === 0 ? 12 : 10, '#c084fc');
              grid.px(27, fr % 2 === 0 ? 12 : 10, '#ffffff');
            }
          };
        }
      },

      // ---------------- THAILAND ----------------
      {
        id: 'chai',
        name: 'Chai',
        country: 'Thailand',
        region: 'asean',
        flag: '🇹🇭',
        species: 'Baby Elephant (Chang)',
        snackName: 'Mango Sticky Rice',
        snackEmoji: '🥭',
        greeting: 'Sawasdee!',
        dialogues: ['Sawasdee!', 'Aroi mak! So sweet!', 'Sabai sabai~', 'Let\'s relax together!'],
        description: 'Pearl-gray Thai baby elephant wearing a golden Chada headpiece and crimson-gold silk saddlecloth.',
        speed: 30,
        outlineColor: '#252230',
        drawBase(g, state, f) {
          const isSleep = state === 'SLEEP', isHappy = state === 'HAPPY', isEat = state === 'EAT';
          const bob = isSleep ? (f >= 2 ? 1 : 0) : (isHappy ? (f % 2 === 1 ? -2 : 0) : (state === 'WALK' ? (f % 2 === 1 ? -1 : 0) : (f === 1 || f === 2 ? 1 : 0)));
          const headY = (isSleep ? 15 : 12) + bob;
          const bodyY = (isSleep ? 21 : 19) + (isSleep ? 0 : Math.floor(bob * 0.5));

          g.line(23, bodyY + 2, 25, bodyY + 5, '#9ea8b8');
          if (!isSleep) {
            const s1 = state === 'WALK' ? (f === 1 ? -2 : f === 3 ? 1 : 0) : 0;
            const s2 = state === 'WALK' ? (f === 3 ? -2 : f === 1 ? 1 : 0) : 0;
            g.rect(10, bodyY + 5 + s1, 4, 5, '#aeb8c7'); g.rect(19, bodyY + 5 + s2, 4, 5, '#97a2b3');
          } else {
            g.rect(10, 27, 4, 2, '#97a2b3'); g.rect(19, 27, 4, 2, '#97a2b3');
          }

          g.oval(16.5, bodyY + 3, 7.2, 5, '#b8c2d1');
          g.oval(16, bodyY + 1, 5.5, 2.5, '#d2dae6');
          // Crimson-Gold Thai Silk Saddlecloth
          g.rect(13, bodyY - 1, 8, 5, '#be123c');
          g.rect(13, bodyY + 4, 8, 1, '#fbbf24');
          g.px(16, bodyY + 2, '#fbbf24'); g.px(18, bodyY + 2, '#fbbf24');

          const flap = isHappy && f % 2 === 1 ? 1 : 0;
          g.oval(8 - flap, headY + 2, 3.2, 4.2, '#b8c2d1'); g.oval(8 - flap, headY + 2.5, 1.8, 2.6, '#f4b6c2');
          g.oval(22 + flap, headY + 2, 3.2, 4.2, '#a5b0c2'); g.oval(22 + flap, headY + 2.5, 1.8, 2.6, '#e8a2b0');

          g.oval(15, headY + 2, 5.6, 4.8, '#c2ccd9');
          g.oval(15, headY, 4.2, 2.2, '#dce3ed');

          if (isHappy) {
            g.rect(14, headY + 4, 2, 3, '#aeb8c7'); g.rect(12, headY + 4, 2, 2, '#c2ccd9'); g.px(11, headY + 3, '#dce3ed');
          } else if (isEat) {
            g.rect(14, headY + 4, 2, 5, '#aeb8c7'); g.rect(12, headY + 8, 2, 2, '#c2ccd9');
          } else {
            g.rect(14, headY + 4, 2, 4, '#aeb8c7'); g.rect(13, headY + 7, 2, 2, '#c2ccd9');
          }

          // Gold Chada Headpiece
          g.rect(12, headY - 3, 6, 2, '#f59e0b');
          g.rect(13, headY - 5, 4, 2, '#fbbf24');
          g.rect(14, headY - 7, 2, 2, '#fde047');
          g.px(14, headY - 3, '#e11d48');

          return { headX: 15, headY, neckX: 15, neckY: headY + 7, bodyX: 16, bodyY: bodyY + 2, faceArgs: [11, 17, headY + 1] };
        }
      },

      // ---------------- VIETNAM ----------------
      {
        id: 'linh',
        name: 'Linh',
        country: 'Vietnam',
        region: 'asean',
        flag: '🇻🇳',
        species: 'Lotus Cat',
        snackName: 'Mini Phở',
        snackEmoji: '🍜',
        greeting: 'Xin chào!',
        dialogues: ['Xin chào!', 'Meow~ Cozy Phở time!', 'Chúc một ngày tốt lành!', 'Purrfect focus!'],
        description: 'Cream-and-ginger cat wearing a classic conical woven Nón lá hat and red Áo dài collar.',
        speed: 40,
        outlineColor: '#2b1e1e',
        drawBase(g, state, f) {
          const isSleep = state === 'SLEEP', isHappy = state === 'HAPPY', isEat = state === 'EAT';
          const bob = isSleep ? (f >= 2 ? 1 : 0) : (isHappy ? (f % 2 === 1 ? -3 : -1) : (state === 'WALK' ? (f % 2 === 1 ? -1 : 0) : (f === 2 ? 1 : 0)));
          const headY = (isSleep ? 16 : (isEat ? 15 : 12)) + bob;
          const bodyY = (isSleep ? 21 : 19) + (isSleep ? 0 : Math.floor(bob * 0.5));

          const swish = (f === 1 || f === 2) ? -1 : 1;
          g.line(21, bodyY + 3, 25, bodyY + swish, '#f3dfc1');
          g.line(25, bodyY + swish, 26, bodyY - 2 + swish, '#e07a38');

          if (!isSleep) {
            const s1 = state === 'WALK' ? (f === 1 ? -2 : f === 3 ? 1 : 0) : 0;
            const s2 = state === 'WALK' ? (f === 3 ? -2 : f === 1 ? 1 : 0) : 0;
            g.rect(12, bodyY + 6 + s1, 2, 4, '#fff7eb'); g.rect(19, bodyY + 6 + s2, 2, 4, '#f3dfc1');
          } else {
            g.rect(11, 27, 3, 2, '#fff7eb'); g.rect(18, 27, 3, 2, '#fff7eb');
          }

          g.oval(16.5, bodyY + 3, 5.5, 4.2, '#fff5e4');
          g.oval(19, bodyY + 2, 2.5, 2.2, '#e68442');

          // Red Áo Dài Collar
          g.rect(12, headY + 7, 8, 2, '#dc2626');
          g.rect(13, headY + 9, 6, 3, '#b91c1c');
          g.rect(15, headY + 8, 2, 1, '#fbbf24');

          g.oval(15.5, headY + 2, 5.4, 4.4, '#fff5e4');
          g.oval(13, headY + 1, 2, 1.5, '#e68442');
          g.px(15, headY + 4, '#f472b6');

          // Conical Nón Lá Hat
          const hatY = headY - 4;
          g.rect(6, hatY + 3, 20, 1, '#d4a359');
          g.rect(8, hatY + 2, 16, 1, '#e8c17d');
          g.rect(10, hatY + 1, 12, 1, '#f3d69c');
          g.rect(12, hatY, 8, 1, '#fae5b8');
          g.rect(14, hatY - 1, 4, 1, '#fff3d6');
          g.px(11, headY + 4, '#dc2626'); g.px(20, headY + 4, '#dc2626');

          return { headX: 15, headY, neckX: 15, neckY: headY + 7, bodyX: 16, bodyY: bodyY + 2, faceArgs: [12, 18, headY + 1] };
        }
      },

      // ---------------- INDONESIA ----------------
      {
        id: 'bara',
        name: 'Bara',
        country: 'Indonesia',
        region: 'asean',
        flag: '🇮🇩',
        species: 'Baby Komodo',
        snackName: 'Satay Skewers',
        snackEmoji: '🍢',
        greeting: 'Halo!',
        dialogues: ['Halo!', 'Enak banget! Satay time!', 'Semangat terus ya!', 'Santai aja~'],
        description: 'Friendly emerald-olive baby Komodo dragon wearing a brown-and-gold Javanese Batik scarf.',
        speed: 38,
        outlineColor: '#1a261e',
        drawBase(g, state, f) {
          const isSleep = state === 'SLEEP', isHappy = state === 'HAPPY', isEat = state === 'EAT';
          const bob = isSleep ? (f >= 2 ? 1 : 0) : (isHappy ? (f % 2 === 1 ? -3 : -1) : (state === 'WALK' ? (f % 2 === 1 ? -1 : 0) : (f === 1 || f === 2 ? 1 : 0)));
          const headY = (isSleep ? 16 : (isEat ? 15 : 12)) + bob;
          const bodyY = (isSleep ? 21 : 19) + (isSleep ? 0 : Math.floor(bob * 0.5));

          const tailY = bodyY + 3 + (f % 2 === 0 ? 0 : -1);
          g.rect(21, tailY, 4, 3, '#3b8c52'); g.rect(25, tailY + 1, 3, 2, '#2d7041');
          g.px(22, tailY - 1, '#fbbf24');

          if (!isSleep) {
            const s1 = state === 'WALK' ? (f === 1 ? -2 : f === 3 ? 1 : 0) : 0;
            const s2 = state === 'WALK' ? (f === 3 ? -2 : f === 1 ? 1 : 0) : 0;
            g.rect(10, bodyY + 6 + s1, 3, 4, '#2d7041'); g.rect(18, bodyY + 6 + s2, 3, 4, '#235933');
          } else {
            g.rect(10, 27, 4, 2, '#2d7041'); g.rect(18, 27, 4, 2, '#2d7041');
          }

          g.oval(16, bodyY + 3, 6.2, 4.3, '#3b8c52');
          g.oval(15, bodyY + 4.5, 4.4, 2.2, '#a3d977');
          g.oval(14.5, headY + 2, 6, 4.4, '#459e5e');
          g.oval(11.5, headY + 3.5, 3, 2, '#52ad6b');
          g.px(15, headY - 3, '#fbbf24'); g.px(17, headY - 2, '#fbbf24');
          if (isHappy || (isEat && f % 2 === 0)) g.rect(10, headY + 5, 3, 1, '#f43f5e');

          // Javanese Batik Scarf
          g.rect(10, headY + 6, 10, 3, '#6b3e1e');
          g.rect(17, headY + 8, 3, 4, '#522e14');
          g.px(11, headY + 7, '#fbbf24'); g.px(14, headY + 7, '#fbbf24'); g.px(17, headY + 7, '#fbbf24');

          return { headX: 14, headY, neckX: 15, neckY: headY + 6, bodyX: 16, bodyY: bodyY + 2, faceArgs: [11, 16, headY + 1] };
        }
      },

      // ---------------- MALAYSIA ----------------
      {
        id: 'rimau',
        name: 'Rimau',
        country: 'Malaysia',
        region: 'asean',
        flag: '🇲🇾',
        species: 'Malayan Tiger Cub',
        snackName: 'Nasi Lemak',
        snackEmoji: '🍛',
        greeting: 'Apa khabar!',
        dialogues: ['Apa khabar!', 'Sedapnya Nasi Lemak!', 'Rawr! Ready to help!', 'Jom lepak!'],
        description: 'Vibrant orange-striped Malayan tiger cub sporting a sleek black velvet Songkok cap with gold trim.',
        speed: 46,
        outlineColor: '#241814',
        drawBase(g, state, f) {
          const isSleep = state === 'SLEEP', isHappy = state === 'HAPPY', isEat = state === 'EAT';
          const bob = isSleep ? (f >= 2 ? 1 : 0) : (isHappy ? (f % 2 === 1 ? -3 : -1) : (state === 'WALK' ? (f % 2 === 1 ? -1 : 0) : (f === 2 ? 1 : 0)));
          const headY = (isSleep ? 16 : (isEat ? 15 : 12)) + bob;
          const bodyY = (isSleep ? 21 : 19) + (isSleep ? 0 : Math.floor(bob * 0.5));

          const wag = (f % 2 === 0) ? 0 : -1;
          g.line(22, bodyY + 3, 26, bodyY + 1 + wag, '#f97316');
          g.px(24, bodyY + 2 + wag, '#292121'); g.px(26, bodyY + 1 + wag, '#292121');

          if (!isSleep) {
            const s1 = state === 'WALK' ? (f === 1 ? -2 : f === 3 ? 1 : 0) : 0;
            const s2 = state === 'WALK' ? (f === 3 ? -2 : f === 1 ? 1 : 0) : 0;
            g.rect(11, bodyY + 6 + s1, 3, 4, '#ea580c'); g.rect(11, bodyY + 9 + s1, 3, 1, '#fff7ed');
            g.rect(19, bodyY + 6 + s2, 3, 4, '#c2410c'); g.rect(19, bodyY + 9 + s2, 3, 1, '#fff7ed');
          } else {
            g.rect(10, 27, 4, 2, '#fff7ed'); g.rect(19, 27, 4, 2, '#fff7ed');
          }

          g.oval(16.5, bodyY + 3, 6.2, 4.4, '#f97316');
          g.oval(15.5, bodyY + 4.5, 4.4, 2.2, '#fff7ed');
          g.rect(17, bodyY, 1, 3, '#292121'); g.rect(20, bodyY + 1, 1, 3, '#292121');

          g.rect(9, headY - 2, 3, 3, '#f97316'); g.rect(19, headY - 2, 3, 3, '#f97316');
          g.oval(15.5, headY + 2, 5.8, 4.8, '#fb923c');
          g.oval(15.5, headY + 4.6, 3.8, 2.2, '#fff7ed');
          g.px(15, headY + 3, '#f43f5e');
          g.rect(10, headY + 2, 2, 1, '#292121'); g.rect(19, headY + 2, 2, 1, '#292121');

          // Velvet Songkok Cap
          const capY = headY - 5;
          g.rect(11, capY, 9, 4, '#1e1b24');
          g.rect(12, capY + 1, 7, 1, '#363242');
          g.rect(11, capY + 3, 9, 1, '#eab308');

          return { headX: 15, headY, neckX: 15, neckY: headY + 7, bodyX: 16, bodyY: bodyY + 2, faceArgs: [11, 18, headY + 1] };
        }
      },

      // ---------------- SINGAPORE ----------------
      {
        id: 'merli',
        name: 'Merli',
        country: 'Singapore',
        region: 'asean',
        flag: '🇸🇬',
        species: 'Mini Merlion',
        snackName: 'Kaya Toast',
        snackEmoji: '🥪',
        greeting: 'Shiok!',
        dialogues: ['Shiok!', 'Kaya toast & kopi lah!', 'Stay hydrated!', 'Steady pom pi pi!'],
        description: 'White-and-aqua lion-fish hybrid with shimmering teal tail scales and animated water spout.',
        speed: 36,
        outlineColor: '#1b2a34',
        drawBase(g, state, f) {
          const isSleep = state === 'SLEEP', isHappy = state === 'HAPPY', isEat = state === 'EAT';
          const bob = isSleep ? (f >= 2 ? 1 : 0) : (isHappy ? (f % 2 === 1 ? -3 : -1) : (state === 'WALK' ? (f % 2 === 1 ? -2 : 0) : (f === 1 || f === 2 ? 1 : 0)));
          const headY = (isSleep ? 15 : (isEat ? 14 : 11)) + bob;
          const bodyY = (isSleep ? 21 : 19) + (isSleep ? 0 : Math.floor(bob * 0.6));

          const finFlip = (f % 2 === 0) ? 0 : -1;
          g.oval(18, bodyY + 4, 6, 3.8, '#14b8a6');
          g.oval(22, bodyY + 4, 3.2, 2.4, '#0d9488');
          g.rect(24, bodyY + 1 + finFlip, 3, 2, '#5eead4');
          g.rect(25, bodyY + 4 + finFlip, 3, 2, '#2dd4bf');
          g.px(16, bodyY + 3, '#99f6e4'); g.px(19, bodyY + 2, '#99f6e4');

          g.oval(14, bodyY + 2, 4.8, 4.2, '#f8fafc');
          g.oval(14.5, headY + 2.5, 6.4, 5.8, '#e2e8f0');
          g.oval(14.5, headY + 1.5, 5.8, 5, '#f8fafc');
          g.oval(14, headY + 2.5, 4.5, 3.8, '#ffffff');
          g.px(13, headY + 4, '#64748b');

          return {
            headX: 14, headY, neckX: 14, neckY: headY + 7, bodyX: 16, bodyY: bodyY + 2,
            faceArgs: [11, 16, headY + 1, '#172530', '#67e8f9'],
            extraOverlay: (grid, st, fr) => {
              if ((st === 'IDLE' && (fr === 1 || fr === 2)) || st === 'HAPPY') {
                const spX = 8, spY = headY + 4;
                grid.px(spX + 2, spY, '#38bdf8'); grid.px(spX + 1, spY - 1, '#7dd3fc');
                grid.px(spX, spY - 1, '#38bdf8'); grid.px(spX - 1, spY, '#bae6fd');
                grid.px(spX - 2, spY + (fr % 2 === 1 ? 2 : 1), '#38bdf8');
              }
            }
          };
        }
      },

      // ---------------- JAPAN (WORLD) ----------------
      {
        id: 'mochi',
        name: 'Mochi',
        country: 'Japan',
        region: 'world',
        flag: '🇯🇵',
        species: 'Shiba Inu',
        snackName: 'Tri-Color Dango',
        snackEmoji: '🍡',
        greeting: 'Konnichiwa!',
        dialogues: ['Konnichiwa!', 'Oishii! Dango time!', 'Wan wan! Ganbatte!', 'Sakura breeze~'],
        description: 'Fluffy cinnamon-and-cream Shiba Inu wearing a red shrine bandana with a golden kitsune charm.',
        speed: 44,
        outlineColor: '#2a1c16',
        drawBase(g, state, f) {
          const isSleep = state === 'SLEEP', isHappy = state === 'HAPPY', isEat = state === 'EAT';
          const bob = isSleep ? (f >= 2 ? 1 : 0) : (isHappy ? (f % 2 === 1 ? -3 : -1) : (state === 'WALK' ? (f % 2 === 1 ? -1 : 0) : (f === 2 ? 1 : 0)));
          const headY = (isSleep ? 16 : (isEat ? 15 : 11)) + bob;
          const bodyY = (isSleep ? 21 : 18) + (isSleep ? 0 : Math.floor(bob * 0.5));

          // Fluffy Curled Shiba Tail
          const wag = (f % 2 === 0) ? 0 : -1;
          g.oval(23, bodyY + 1 + wag, 2.5, 2.5, '#e89848');
          g.oval(23.5, bodyY + 0.5 + wag, 1.3, 1.3, '#fff7eb');

          if (!isSleep) {
            const s1 = state === 'WALK' ? (f === 1 ? -2 : f === 3 ? 1 : 0) : 0;
            const s2 = state === 'WALK' ? (f === 3 ? -2 : f === 1 ? 1 : 0) : 0;
            g.rect(11, bodyY + 6 + s1, 3, 4, '#e08b3c'); g.rect(11, bodyY + 9 + s1, 3, 1, '#fffaf0');
            g.rect(19, bodyY + 6 + s2, 3, 4, '#c7752c'); g.rect(19, bodyY + 9 + s2, 3, 1, '#fffaf0');
          } else {
            g.rect(10, 27, 4, 2, '#fffaf0'); g.rect(19, 27, 4, 2, '#fffaf0');
          }

          g.oval(16.5, bodyY + 3, 6.2, 4.5, '#e89848');
          g.oval(15.5, bodyY + 4.5, 4.5, 2.4, '#fffaf0');

          // Perky Triangular Shiba Ears
          g.rect(9, headY - 3, 3, 4, '#e08b3c'); g.px(10, headY - 1, '#f9d5c0');
          g.rect(19, headY - 3, 3, 4, '#e08b3c'); g.px(20, headY - 1, '#f9d5c0');

          // Round Fluffy Shiba Head + Cream Cheeks & Eyebrow dots
          g.oval(15.5, headY + 2, 6, 4.8, '#eb9f50');
          g.oval(15.5, headY + 4.2, 4.8, 2.6, '#fffaf0');
          g.px(12, headY - 1, '#fffaf0'); g.px(18, headY - 1, '#fffaf0'); // iconic shiba eyebrows
          g.rect(15, headY + 3, 2, 1, '#261b18');
          if (isHappy || (isEat && f % 2 === 0)) g.rect(15, headY + 5, 2, 2, '#f472b6');

          // Red Shrine Bandana + Gold Kitsune Charm
          g.rect(11, headY + 7, 9, 2, '#dc2626');
          g.rect(13, headY + 9, 5, 2, '#b91c1c');
          g.rect(15, headY + 8, 2, 2, '#fbbf24');

          return { headX: 15, headY, neckX: 15, neckY: headY + 7, bodyX: 16, bodyY: bodyY + 2, faceArgs: [11, 18, headY + 1] };
        }
      },

      // ---------------- CHINA (WORLD) ----------------
      {
        id: 'bao',
        name: 'Bao',
        country: 'China',
        region: 'world',
        flag: '🇨🇳',
        species: 'Giant Panda Cub',
        snackName: 'Steamed Baozi',
        snackEmoji: '🥟',
        greeting: 'Nǐ hǎo!',
        dialogues: ['Nǐ hǎo!', 'Hǎo chī! Warm Baozi!', 'Bamboo & naps~', 'Jiā yóu!'],
        description: 'Chubby Giant Panda cub wearing a festive crimson-and-gold Tangzhuang silk vest.',
        speed: 30,
        outlineColor: '#1b1a22',
        drawBase(g, state, f) {
          const isSleep = state === 'SLEEP', isHappy = state === 'HAPPY', isEat = state === 'EAT';
          const bob = isSleep ? (f >= 2 ? 1 : 0) : (isHappy ? (f % 2 === 1 ? -2 : 0) : (state === 'WALK' ? (f % 2 === 1 ? -1 : 0) : (f === 1 || f === 2 ? 1 : 0)));
          const headY = (isSleep ? 16 : (isEat ? 15 : 12)) + bob;
          const bodyY = (isSleep ? 21 : 19) + (isSleep ? 0 : Math.floor(bob * 0.5));

          // Tiny round tail
          g.rect(22, bodyY + 4, 2, 2, '#27272a');

          if (!isSleep) {
            const s1 = state === 'WALK' ? (f === 1 ? -2 : f === 3 ? 1 : 0) : 0;
            const s2 = state === 'WALK' ? (f === 3 ? -2 : f === 1 ? 1 : 0) : 0;
            g.rect(10, bodyY + 5 + s1, 4, 5, '#27272a');
            g.rect(19, bodyY + 5 + s2, 4, 5, '#27272a');
          } else {
            g.rect(10, 27, 4, 2, '#27272a'); g.rect(19, 27, 4, 2, '#27272a');
          }

          // Chubby Panda Body + Crimson Tangzhuang Silk Vest
          g.oval(16.5, bodyY + 3, 6.8, 4.8, '#f8fafc');
          g.rect(11, bodyY, 11, 5, '#dc2626');       // crimson silk vest
          g.rect(15, bodyY, 2, 5, '#b91c1c');        // center placket
          g.px(15, bodyY + 1, '#fbbf24');            // gold frog buttons
          g.px(16, bodyY + 1, '#fbbf24');
          g.px(15, bodyY + 3, '#fbbf24');
          g.px(16, bodyY + 3, '#fbbf24');
          g.rect(11, bodyY + 5, 11, 1, '#fbbf24');   // gold hem trim

          // Round Black Panda Ears
          g.oval(10, headY - 2, 2.2, 2.2, '#27272a');
          g.oval(21, headY - 2, 2.2, 2.2, '#27272a');

          // Plump White Panda Head
          g.oval(15.5, headY + 2, 6.2, 5, '#ffffff');
          g.oval(15.5, headY + 5, 5, 2, '#e2e8f0');

          // Iconic Black Eye Patches
          g.oval(12, headY + 2, 2.2, 2.2, '#27272a');
          g.oval(19, headY + 2, 2.2, 2.2, '#27272a');
          g.rect(15, headY + 4, 2, 1, '#27272a'); // nose

          return {
            headX: 15, headY, neckX: 15, neckY: headY + 7, bodyX: 16, bodyY: bodyY + 2,
            faceArgs: [11, 18, headY + 1, '#ffffff', '#f472b6', '#38bdf8'] // bright eyes inside dark patches
          };
        }
      },

      // ---------------- RUSSIA (WORLD) ----------------
      {
        id: 'misha',
        name: 'Misha',
        country: 'Russia',
        region: 'world',
        flag: '🇷🇺',
        species: 'Cozy Bear Cub',
        snackName: 'Honey & Blini',
        snackEmoji: '🍯',
        greeting: 'Privet!',
        dialogues: ['Privet!', 'Sweet honey & blini!', 'Warm hugs for winter!', 'Spasibo, friend!'],
        description: 'Cozy chestnut-brown bear cub wearing a plush grey fur Ushanka hat with a little star badge and red scarf.',
        speed: 32,
        outlineColor: '#241815',
        drawBase(g, state, f) {
          const isSleep = state === 'SLEEP', isHappy = state === 'HAPPY', isEat = state === 'EAT';
          const bob = isSleep ? (f >= 2 ? 1 : 0) : (isHappy ? (f % 2 === 1 ? -2 : 0) : (state === 'WALK' ? (f % 2 === 1 ? -1 : 0) : (f === 1 || f === 2 ? 1 : 0)));
          const headY = (isSleep ? 16 : (isEat ? 15 : 12)) + bob;
          const bodyY = (isSleep ? 21 : 19) + (isSleep ? 0 : Math.floor(bob * 0.5));

          if (!isSleep) {
            const s1 = state === 'WALK' ? (f === 1 ? -2 : f === 3 ? 1 : 0) : 0;
            const s2 = state === 'WALK' ? (f === 3 ? -2 : f === 1 ? 1 : 0) : 0;
            g.rect(10, bodyY + 5 + s1, 4, 5, '#7c4a2b');
            g.rect(19, bodyY + 5 + s2, 4, 5, '#663b20');
          } else {
            g.rect(10, 27, 4, 2, '#663b20'); g.rect(19, 27, 4, 2, '#663b20');
          }

          // Cozy Bear Body
          g.oval(16.5, bodyY + 3, 6.8, 4.8, '#8a5230');
          g.oval(15.5, bodyY + 4, 4.2, 2.8, '#c78c5e');

          // Bear Head
          g.oval(15.5, headY + 2, 6, 4.8, '#965a36');
          g.oval(15.5, headY + 4.4, 3.6, 2.2, '#e3b386');
          g.rect(15, headY + 3, 2, 1, '#261812');

          // Warm Red Winter Scarf
          g.rect(10, headY + 7, 11, 2, '#dc2626');
          g.rect(17, headY + 9, 3, 4, '#b91c1c');
          g.px(12, headY + 8, '#fef08a'); g.px(15, headY + 8, '#fef08a');

          // Grey Fur Ushanka Hat with Earflaps & Little Star Badge!
          const hatY = headY - 5;
          g.rect(9, hatY + 1, 13, 4, '#94a3b8');   // main fur crown
          g.rect(10, hatY, 11, 1, '#cbd5e1');      // top snow-grey highlight
          g.rect(8, hatY + 3, 3, 5, '#64748b');    // left earflap
          g.rect(20, hatY + 3, 3, 5, '#64748b');   // right earflap
          g.rect(11, hatY + 2, 9, 2, '#cbd5e1');   // front fur cuff
          g.px(15, hatY + 2, '#ef4444');           // red star badge
          g.px(16, hatY + 2, '#fbbf24');           // gold accent

          return { headX: 15, headY, neckX: 15, neckY: headY + 7, bodyX: 16, bodyY: bodyY + 2, faceArgs: [11, 18, headY + 1] };
        }
      },

      // ---------------- ITALY (WORLD) ----------------
      {
        id: 'gino',
        name: 'Gino',
        country: 'Italy',
        region: 'world',
        flag: '🇮🇹',
        species: 'Venetian Spotted Pup',
        snackName: 'Margherita Pizza',
        snackEmoji: '🍕',
        greeting: 'Ciao!',
        dialogues: ['Ciao, amico!', 'Mamma mia! Pizza!', 'Bellissimo!', 'Andiamo a Venezia!'],
        description: 'Cute spotted Italian pup sporting a Venetian striped gondolier neckerchief and a charming little chef beret.',
        speed: 42,
        outlineColor: '#231f28',
        drawBase(g, state, f) {
          const isSleep = state === 'SLEEP', isHappy = state === 'HAPPY', isEat = state === 'EAT';
          const bob = isSleep ? (f >= 2 ? 1 : 0) : (isHappy ? (f % 2 === 1 ? -3 : -1) : (state === 'WALK' ? (f % 2 === 1 ? -1 : 0) : (f === 2 ? 1 : 0)));
          const headY = (isSleep ? 16 : (isEat ? 15 : 12)) + bob;
          const bodyY = (isSleep ? 21 : 19) + (isSleep ? 0 : Math.floor(bob * 0.5));

          const wag = (f % 2 === 0) ? 0 : -1;
          g.line(22, bodyY + 2, 25, bodyY + wag, '#f8fafc');
          g.px(25, bodyY + wag, '#334155');

          if (!isSleep) {
            const s1 = state === 'WALK' ? (f === 1 ? -2 : f === 3 ? 1 : 0) : 0;
            const s2 = state === 'WALK' ? (f === 3 ? -2 : f === 1 ? 1 : 0) : 0;
            g.rect(11, bodyY + 6 + s1, 3, 4, '#f8fafc');
            g.rect(19, bodyY + 6 + s2, 3, 4, '#e2e8f0');
          } else {
            g.rect(10, 27, 4, 2, '#f8fafc'); g.rect(19, 27, 4, 2, '#f8fafc');
          }

          // Spotted Body
          g.oval(16.5, bodyY + 3, 6.2, 4.4, '#f8fafc');
          g.rect(18, bodyY + 2, 2, 2, '#334155'); // cute Dalmatian/Italian spots
          g.px(14, bodyY + 4, '#334155');

          // Floppy Spotted Ears
          g.rect(8, headY + 1, 3, 5, '#334155');
          g.rect(20, headY + 1, 3, 5, '#e2e8f0');
          g.px(21, headY + 3, '#334155');

          // Head
          g.oval(15.5, headY + 2, 5.5, 4.6, '#ffffff');
          g.rect(15, headY + 3, 2, 1, '#1e293b');
          if (isHappy || (isEat && f % 2 === 0)) g.rect(15, headY + 5, 2, 2, '#f472b6');

          // Venetian Striped Gondolier Neckerchief (Red & White + Navy)
          g.rect(11, headY + 7, 9, 2, '#dc2626');
          g.px(12, headY + 7, '#ffffff'); g.px(14, headY + 7, '#ffffff'); g.px(16, headY + 7, '#ffffff'); g.px(18, headY + 7, '#ffffff');
          g.rect(13, headY + 9, 5, 2, '#1d4ed8');

          // Charming Little Chef / Beret Hat with Italian Flag Ribbon
          const hatY = headY - 5;
          g.oval(15.5, hatY + 1, 5.2, 2.4, '#ffffff');
          g.rect(11, hatY + 2, 9, 2, '#f1f5f9');
          g.rect(12, hatY + 3, 2, 1, '#16a34a'); // green
          g.rect(14, hatY + 3, 3, 1, '#ffffff'); // white
          g.rect(17, hatY + 3, 2, 1, '#dc2626'); // red

          return { headX: 15, headY, neckX: 15, neckY: headY + 7, bodyX: 16, bodyY: bodyY + 2, faceArgs: [11, 18, headY + 1] };
        }
      }
    ];

    // ==========================================================================
    // 5. 16x16 CULTURAL SNACK PIXEL ART RENDERERS (ALL 12 PETS)
    // ==========================================================================
    function buildSnackCanvas(petId) {
      const g = new PixelGrid(16, 16);
      switch (petId) {
        case 'kala': // Halo-Halo
          g.rect(5, 6, 6, 8, '#e0f2fe'); g.rect(6, 11, 4, 2, '#f472b6');
          g.rect(6, 9, 4, 2, '#4ade80'); g.rect(6, 7, 4, 2, '#fde047');
          g.oval(8, 5, 3.2, 2.2, '#9333ea'); g.line(10, 2, 9, 6, '#cbd5e1');
          break;
        case 'bantay': // Pandesal
          g.oval(6, 10, 3.2, 2.6, '#d97706'); g.oval(10, 10, 3.2, 2.6, '#b45309');
          g.oval(8, 7, 3.2, 2.6, '#f59e0b'); g.px(7, 6, '#fde68a');
          break;
        case 'tala': // Ube Magic Potion
          g.oval(8, 10, 4.2, 4, '#7e22ce'); g.oval(8, 10, 3, 2.6, '#a855f7');
          g.px(7, 9, '#e9d5ff'); g.rect(6, 4, 4, 3, '#cbd5e1');
          g.rect(7, 3, 2, 2, '#b45309'); g.px(4, 5, '#fde047'); g.px(12, 6, '#fde047');
          break;
        case 'chai': // Mango Sticky Rice
          g.oval(8, 11, 6, 2.8, '#e2e8f0'); g.oval(6, 9, 3, 2.2, '#ffffff');
          g.rect(8, 7, 4, 4, '#fbbf24'); g.rect(9, 7, 2, 3, '#fde047');
          g.rect(4, 10, 2, 2, '#22c55e');
          break;
        case 'linh': // Mini Phở Bowl
          g.oval(8, 11, 5.2, 3.4, '#dc2626'); g.rect(4, 8, 8, 2, '#fef08a');
          g.px(5, 8, '#22c55e'); g.px(8, 8, '#16a34a'); g.px(6, 5, '#e2e8f0');
          break;
        case 'bara': // Satay Skewers
          g.line(3, 13, 11, 5, '#d6b482'); g.line(5, 13, 13, 5, '#d6b482');
          g.rect(6, 8, 3, 3, '#92400e'); g.rect(9, 5, 3, 3, '#b45309'); g.px(10, 6, '#fbbf24');
          break;
        case 'rimau': // Nasi Lemak
          g.oval(8, 11, 5.8, 3, '#15803d'); g.oval(8, 8, 3.4, 2.6, '#ffffff');
          g.rect(9, 9, 3, 2, '#dc2626'); g.rect(4, 10, 2, 2, '#fde047');
          break;
        case 'merli': // Kaya Toast
          g.rect(4, 6, 8, 6, '#d97706'); g.rect(5, 7, 6, 4, '#f59e0b');
          g.rect(5, 9, 6, 2, '#65a30d'); g.rect(7, 9, 2, 2, '#fef08a');
          break;
        case 'mochi': // Tri-Color Dango
          g.line(4, 13, 12, 4, '#d6b482');
          g.oval(6, 11, 2.3, 2.3, '#4ade80'); // green
          g.oval(8, 8, 2.3, 2.3, '#ffffff');  // white
          g.oval(10, 5, 2.3, 2.3, '#f9a8d4'); // pink
          break;
        case 'bao': // Steamed Baozi
          g.oval(8, 12, 5.5, 2.2, '#b45309'); // bamboo steamer
          g.oval(8, 9, 4.4, 3.4, '#ffffff');  // fluffy bun
          g.px(8, 6, '#e2e8f0'); g.px(7, 7, '#cbd5e1'); g.px(9, 7, '#cbd5e1');
          break;
        case 'misha': // Honey Jar & Blini
          g.rect(5, 6, 6, 7, '#f59e0b'); g.rect(6, 7, 4, 5, '#fbbf24');
          g.rect(6, 4, 4, 2, '#dc2626'); g.px(7, 8, '#fef08a');
          break;
        case 'gino': // Margherita Pizza Slice
          g.line(8, 3, 3, 12, '#f59e0b'); g.line(8, 3, 13, 12, '#f59e0b');
          g.rect(4, 11, 8, 2, '#d97706'); // crust
          g.rect(5, 9, 6, 2, '#fde047'); g.rect(6, 7, 4, 2, '#fde047'); g.rect(7, 5, 2, 2, '#fde047');
          g.px(6, 10, '#dc2626'); g.px(9, 9, '#dc2626'); g.px(8, 7, '#16a34a'); // basil
          break;
      }
      g.applyOutline('#211c2b');
      return g.toCanvas();
    }

    // ==========================================================================
    // 6. SPRITE BANK & LIVE WARDROBE-INTEGRATED SPRITE SHEET GENERATOR
    // ==========================================================================
    const SpriteBank = {};

    function bakePetSprites(pet) {
      const outfit = getPetOutfit(pet.id);
      const frames = {};

      for (const st of STATES) {
        frames[st] = [];
        for (let f = 0; f < FRAMES_PER_STATE; f++) {
          const grid = new PixelGrid(32, 32);

          // 1. Compute base anchors via a dry pass or draw back items using standard anchor offsets
          // We draw onto a temporary base grid first to get exact anchors, then composite layers cleanly!
          const baseGrid = new PixelGrid(32, 32);
          const anchors = pet.drawBase(baseGrid, st, f);

          // 2. Back Wardrobe Layer (Wings, Cape back)
          drawWardrobeBack(grid, anchors, outfit, st, f);

          // 3. Copy Pet Base Layer
          for (let y = 0; y < 32; y++) {
            for (let x = 0; x < 32; x++) {
              if (baseGrid.grid[y][x]) grid.grid[y][x] = baseGrid.grid[y][x];
            }
          }

          // 4. Front Wardrobe Layer (Hats, Scarves, Bowties)
          drawWardrobeFront(grid, anchors, outfit, st, f);

          // 5. Crisp 16-bit Dark Outline Pass
          grid.applyOutline(pet.outlineColor || '#211c2b');

          // 6. Cute Face (Eyes & Blush) on top
          drawCuteFace(grid, ...anchors.faceArgs.slice(0, 3), st, f, ...anchors.faceArgs.slice(3));

          // 7. Pet Special Overlay (Merli water spout, Tala sparkles) + Wardrobe Overlay (Shades, Halo, Lantern, Aura)
          if (anchors.extraOverlay) anchors.extraOverlay(grid, st, f);
          drawWardrobeOverlay(grid, anchors, outfit, st, f);

          frames[st].push(grid.toCanvas());
        }
      }

      SpriteBank[pet.id] = {
        frames,
        snack: SpriteBank[pet.id]?.snack || buildSnackCanvas(pet.id),
        sheet1x: buildSpriteSheetCanvas(frames, 1)
      };
    }


const petById = (id) => PET_ROSTER.find((p) => p.id === id) || null;

function ensurePetSprites(petId) {
  if (!SpriteBank[petId]) {
    const pet = petById(petId);
    if (!pet) return null;
    bakePetSprites(pet);
  }
  return SpriteBank[petId];
}

module.exports = {
  PET_ROSTER,
  STATES,
  FRAMES_PER_STATE,
  SpriteBank,
  PixelGrid,
  petById,
  ensurePetSprites,
};
