import { useEffect, useRef } from "react";
import { useThemeEngine } from "./ThemeProvider";
import type { AnimationKind, ThemeConfig } from "@/lib/themes.config";

/**
 * Theme-driven animated background. One canvas, multiple painters.
 *
 *  - "ember"    → drifting warm embers + sun beam from top
 *  - "aurora"   → flowing borealis ribbons
 *  - "carbon"   → minimal noise + occasional sparks
 *  - "solar"    → pulsing radial heat with heat-shimmer particles
 *  - "daylight" → calm pastel orb drift
 *
 * Pure GPU-friendly canvas painting; respects prefers-reduced-motion.
 * The painter switches when the theme changes — no remount needed.
 */
export const AnimatedBackground = () => {
  const { config } = useThemeEngine();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cfgRef = useRef<ThemeConfig>(config);

  // Keep painter reading the latest theme without re-mounting the loop
  useEffect(() => { cfgRef.current = config; }, [config]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let width = 0;
    let height = 0;
    const resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    // Particle pool — re-seeded on resize and theme change
    type P = { x: number; y: number; vx: number; vy: number; r: number; hue: number; life: number; max: number };
    let particles: P[] = [];

    const seed = () => {
      const cfg = cfgRef.current;
      const count = cfg.particles.enabled ? cfg.particles.count : 0;
      particles = new Array(count).fill(0).map(() => spawn(cfg));
    };

    const spawn = (cfg: ThemeConfig): P => {
      const [hMin, hMax] = cfg.particles.hueRange;
      const [sMin, sMax] = cfg.particles.size;
      const speed = cfg.particles.speed;
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * speed * 0.04,
        vy: -Math.random() * speed * 0.06 - 0.05,
        r: sMin + Math.random() * (sMax - sMin),
        hue: hMin + Math.random() * (hMax - hMin),
        life: 0,
        max: 6 + Math.random() * 8, // seconds
      };
    };

    resize();
    window.addEventListener("resize", resize);

    let last = performance.now();
    let raf = 0;
    let t = 0;

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); // clamp to 50ms
      last = now;
      t += dt;

      const cfg = cfgRef.current;
      ctx.clearRect(0, 0, width, height);

      // 1) Ambient base wash — uses primary token at low alpha
      paintAmbient(ctx, width, height, t, cfg);

      // 2) Animation-specific layer
      paintAnimation(ctx, width, height, t, cfg.animation, cfg);

      // 3) Particles
      if (cfg.particles.enabled) {
        for (const p of particles) {
          p.life += dt;
          p.x += p.vx;
          p.y += p.vy;
          // gentle horizontal sway
          p.x += Math.sin((t + p.hue) * 0.6) * 0.15;

          if (p.life > p.max || p.y < -10 || p.x < -10 || p.x > width + 10) {
            Object.assign(p, spawn(cfg), { y: height + 10 });
          }

          const fade = 1 - p.life / p.max;
          const alpha = Math.max(0, fade) * 0.75;
          ctx.beginPath();
          ctx.fillStyle = `hsla(${p.hue}, ${cfg.particles.saturation}%, ${cfg.particles.lightness}%, ${alpha})`;
          ctx.shadowColor = `hsla(${p.hue}, ${cfg.particles.saturation}%, ${cfg.particles.lightness}%, ${alpha})`;
          ctx.shadowBlur = cfg.particles.glow;
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;
      }

      raf = reduced ? 0 : requestAnimationFrame(draw);
    };

    if (reduced) {
      // Render one static frame so the theme still feels alive
      draw(performance.now());
    } else {
      raf = requestAnimationFrame(draw);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Base gradient — driven by theme tokens, instantly re-paints on switch */}
      <div
        className="absolute inset-0 transition-[background] duration-700 ease-out"
        style={{
          background: "hsl(var(--background))",
          backgroundImage: "var(--gradient-mesh)",
        }}
      />
      {/* Canvas painter for animations + particles */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ mixBlendMode: "screen" }}
      />
    </div>
  );
};

// ─────────────── painters ───────────────

function readPrimaryHsl(): { h: number; s: number; l: number } {
  const root = document.documentElement;
  const raw = getComputedStyle(root).getPropertyValue("--primary").trim();
  // raw looks like "38 100% 56%"
  const [h, s, l] = raw.split(/\s+/).map((x) => parseFloat(x));
  return { h: h || 38, s: s || 100, l: l || 56 };
}

function paintAmbient(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, cfg: ThemeConfig) {
  const { h: ph } = readPrimaryHsl();

  // soft moving horizon orb — its hue + intensity flexes with the theme mood
  const moodIntensity =
    cfg.lighting.mood === "sharp" ? 0.18 :
    cfg.lighting.mood === "soft" ? 0.32 :
    cfg.lighting.mood === "diffuse" ? 0.22 :
    /* warm */ 0.40;

  const cx = w * (0.7 + Math.sin(t * 0.18) * 0.04);
  const cy = h * (0.85 + Math.cos(t * 0.13) * 0.04);
  const r  = Math.max(w, h) * 0.55;

  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, `hsla(${ph}, 95%, 55%, ${moodIntensity})`);
  g.addColorStop(0.5, `hsla(${ph + 10}, 90%, 45%, ${moodIntensity * 0.4})`);
  g.addColorStop(1, "hsla(0,0%,0%,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function paintAnimation(
  ctx: CanvasRenderingContext2D, w: number, h: number, t: number,
  kind: AnimationKind, cfg: ThemeConfig,
) {
  switch (kind) {
    case "ember":    return paintEmber(ctx, w, h, t);
    case "aurora":   return paintAurora(ctx, w, h, t);
    case "carbon":   return paintCarbon(ctx, w, h, t);
    case "solar":    return paintSolar(ctx, w, h, t);
    case "daylight": return paintDaylight(ctx, w, h, t);
  }
}

// Sun beam from top + warm haze (Ember Cosmos)
function paintEmber(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const { h: ph } = readPrimaryHsl();
  // beam
  ctx.save();
  ctx.translate(w * 0.5, 0);
  ctx.rotate(Math.sin(t * 0.15) * 0.05);
  const beam = ctx.createLinearGradient(0, 0, 0, h * 0.7);
  beam.addColorStop(0, `hsla(${ph}, 100%, 65%, 0.22)`);
  beam.addColorStop(1, "hsla(0,0%,0%,0)");
  ctx.fillStyle = beam;
  ctx.fillRect(-w * 0.4, 0, w * 0.8, h * 0.7);
  ctx.restore();

  // floating warm halo
  const cx = w * (0.2 + Math.sin(t * 0.22) * 0.05);
  const cy = h * (0.25 + Math.cos(t * 0.18) * 0.04);
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.35);
  halo.addColorStop(0, `hsla(${ph + 8}, 100%, 60%, 0.18)`);
  halo.addColorStop(1, "hsla(0,0%,0%,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h);
}

// Borealis ribbons (Aurora)
function paintAurora(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const ribbons = [
    { hue: 165, y: h * 0.25, amp: 80, speed: 0.7, alpha: 0.22 },
    { hue: 200, y: h * 0.45, amp: 110, speed: 0.5, alpha: 0.18 },
    { hue: 280, y: h * 0.65, amp: 90, speed: 0.6, alpha: 0.16 },
  ];
  for (const r of ribbons) {
    ctx.beginPath();
    ctx.moveTo(-50, r.y);
    const seg = 40;
    for (let x = -50; x <= w + 50; x += seg) {
      const y = r.y
        + Math.sin((x * 0.005) + t * r.speed) * r.amp
        + Math.cos((x * 0.011) + t * r.speed * 0.7) * (r.amp * 0.4);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w + 50, r.y + 200);
    ctx.lineTo(-50, r.y + 200);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, r.y - 100, 0, r.y + 200);
    grad.addColorStop(0, `hsla(${r.hue}, 90%, 60%, ${r.alpha})`);
    grad.addColorStop(0.5, `hsla(${r.hue + 20}, 85%, 55%, ${r.alpha * 0.6})`);
    grad.addColorStop(1, "hsla(0,0%,0%,0)");
    ctx.fillStyle = grad;
    ctx.filter = "blur(28px)";
    ctx.fill();
    ctx.filter = "none";
  }
}

// Carbon — almost nothing. Slow noise band + rare spark glow.
function paintCarbon(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const { h: ph } = readPrimaryHsl();
  // slow horizontal sweep
  const x = (Math.sin(t * 0.1) * 0.5 + 0.5) * w;
  const grad = ctx.createRadialGradient(x, h * 0.5, 0, x, h * 0.5, w * 0.4);
  grad.addColorStop(0, `hsla(${ph}, 80%, 50%, 0.05)`);
  grad.addColorStop(1, "hsla(0,0%,0%,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

// Solar — pulsing central radial heat
function paintSolar(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const { h: ph } = readPrimaryHsl();
  const pulse = 0.5 + Math.sin(t * 1.2) * 0.5;
  const r = Math.max(w, h) * (0.4 + pulse * 0.15);
  const cx = w * 0.5;
  const cy = h * 0.45;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, `hsla(${ph + 18}, 100%, 65%, ${0.25 + pulse * 0.18})`);
  g.addColorStop(0.4, `hsla(${ph + 5}, 95%, 55%, ${0.12 + pulse * 0.06})`);
  g.addColorStop(1, "hsla(0,0%,0%,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // heat shimmer band
  ctx.fillStyle = `hsla(${ph + 25}, 100%, 70%, 0.05)`;
  for (let i = 0; i < 6; i++) {
    const yy = h * 0.6 + Math.sin(t * 2 + i) * 12;
    ctx.fillRect(0, yy + i * 8, w, 1);
  }
}

// Daylight — calm pastel drift
function paintDaylight(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const { h: ph } = readPrimaryHsl();
  for (let i = 0; i < 3; i++) {
    const cx = w * (0.25 + i * 0.3 + Math.sin(t * 0.15 + i) * 0.05);
    const cy = h * (0.35 + Math.cos(t * 0.12 + i) * 0.08);
    const r  = w * 0.32;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `hsla(${ph + i * 12}, 90%, 70%, 0.18)`);
    g.addColorStop(1, "hsla(0,0%,0%,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}
