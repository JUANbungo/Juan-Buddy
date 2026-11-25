/* ==========================================================================
   JUAN-BUDDY ECO PARTICLES & THEME CONTROLLER
   Include at the bottom of src/dashboard/index.html:
   <script src="js/eco-particles.js"></script>
   ========================================================================== */

(function () {
  const THEMES = ["bamboo-grove", "rice-terraces", "terracotta-clay", "night-fireflies"];
  let currentTheme = localStorage.getItem("juanBuddyEcoTheme") || "bamboo-grove";
  let mode = "day"; // "day" (falling leaves) | "night" (glowing fireflies)
  let particles = [];
  let burstParticles = [];
  let canvas, ctx, animId;

  function applyTheme(themeName) {
    if (!THEMES.includes(themeName)) themeName = "bamboo-grove";
    currentTheme = themeName;
    document.body.classList.add("eco-polished");
    document.documentElement.setAttribute("data-eco-theme", themeName);
    localStorage.setItem("juanBuddyEcoTheme", themeName);
    mode = themeName === "night-fireflies" ? "night" : "day";
  }

  function initCanvas() {
    if (document.getElementById("eco-particle-canvas")) return;
    canvas = document.createElement("canvas");
    canvas.id = "eco-particle-canvas";
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d");
    resize();
    window.addEventListener("resize", resize);

    // Seed ambient particles
    particles = Array.from({ length: 18 }, () => spawnAmbient(true));
    loop();
  }

  function resize() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function spawnAmbient(randomY) {
    const isNight = mode === "night";
    return {
      x: Math.random() * window.innerWidth,
      y: randomY ? Math.random() * window.innerHeight : -12,
      vx: isNight ? (Math.random() - 0.5) * 0.5 : 0.35 + Math.random() * 0.45,
      vy: isNight ? (Math.random() - 0.5) * 0.4 : 0.5 + Math.random() * 0.65,
      size: isNight ? 3 + Math.random() * 3 : 6 + Math.random() * 4,
      phase: Math.random() * Math.PI * 2,
      color: isNight
        ? "#FCE291"
        : ["#88B04B", "#5F8D62", "#B6D77A", "#E8B959"][Math.floor(Math.random() * 4)],
    };
  }

  function spawnBurst(x, y, type = "compost") {
    const colors =
      type === "compost"
        ? ["#B6D77A", "#88B04B", "#FCE291", "#FFFDF7"]
        : type === "water"
        ? ["#7CB9C7", "#FFFDF7", "#4E8698"]
        : ["#E8B959", "#FCE291", "#E57E73", "#B6D77A"];

    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12 + (Math.random() - 0.5) * 0.4;
      const speed = 1.2 + Math.random() * 2.4;
      burstParticles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.8,
        life: 1.0,
        size: 4 + Math.random() * 3,
        color: colors[i % colors.length],
      });
    }
  }

  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw ambient leaves or fireflies
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.phase += 0.03;
      if (mode === "night") {
        p.x += p.vx + Math.sin(p.phase) * 0.35;
        p.y += p.vy + Math.cos(p.phase) * 0.25;
        const alpha = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(p.phase * 1.8));
        ctx.fillStyle = `rgba(252, 226, 145, ${alpha.toFixed(2)})`;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), Math.round(p.size), Math.round(p.size));
        if (p.x < -10 || p.x > canvas.width + 10 || p.y < -10 || p.y > canvas.height + 10) {
          particles[i] = spawnAmbient(true);
        }
      } else {
        p.x += p.vx + Math.sin(p.phase) * 0.6;
        p.y += p.vy;
        ctx.save();
        ctx.translate(Math.round(p.x), Math.round(p.y));
        ctx.rotate(Math.sin(p.phase) * 0.6);
        ctx.fillStyle = p.color;
        // Crisp pixel leaf silhouette
        ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.65);
        ctx.restore();
        if (p.y > canvas.height + 16 || p.x > canvas.width + 16) {
          particles[i] = spawnAmbient(false);
        }
      }
    }

    // Draw click/clean burst particles
    for (let i = burstParticles.length - 1; i >= 0; i--) {
      const b = burstParticles[i];
      b.x += b.vx;
      b.y += b.vy;
      b.vy += 0.06;
      b.life -= 0.03;
      if (b.life <= 0) {
        burstParticles.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = Math.max(0, b.life);
      ctx.fillStyle = b.color;
      ctx.fillRect(Math.round(b.x), Math.round(b.y), Math.round(b.size), Math.round(b.size));
      ctx.globalAlpha = 1;
    }

    animId = requestAnimationFrame(loop);
  }

  // Expose API globally for Juan-Buddy Options & Game Events
  window.JuanBuddyEco = {
    themes: THEMES,
    setTheme: applyTheme,
    setTimeOfDay: (t) => {
      mode = t === "night" ? "night" : "day";
    },
    burst: spawnBurst,
    getTheme: () => currentTheme,
  };

  window.addEventListener("DOMContentLoaded", () => {
    applyTheme(currentTheme);
    initCanvas();
  });
})();
