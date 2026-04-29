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
    case "oceanic":  return paintOceanic(ctx, w, h, t);
    case "forge":    return paintForge(ctx, w, h, t);
  }
}

// Sun beam from top + warm haze (Ember Cosmos)
function paintEmber(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const { h: ph } = readPrimaryHsl();
  // Core beam
  ctx.save();
  ctx.translate(w * 0.5, 0);
  ctx.rotate(Math.sin(t * 0.1) * 0.08);
  const beam = ctx.createLinearGradient(0, 0, 0, h);
  beam.addColorStop(0, `hsla(${ph}, 100%, 60%, 0.15)`);
  beam.addColorStop(0.5, `hsla(${ph + 10}, 90%, 55%, 0.05)`);
  beam.addColorStop(1, "hsla(0,0%,0%,0)");
  ctx.fillStyle = beam;
  ctx.fillRect(-w * 0.6, 0, w * 1.2, h);
  ctx.restore();

  // Floating warm cosmic dust clouds
  for (let i = 0; i < 3; i++) {
    const cx = w * (0.3 + i * 0.2 + Math.sin(t * 0.15 + i) * 0.1);
    const cy = h * (0.3 + Math.cos(t * 0.12 + i) * 0.1);
    const r = w * (0.3 + i * 0.05);
    const cloud = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    cloud.addColorStop(0, `hsla(${ph + i * 15}, 90%, 60%, 0.08)`);
    cloud.addColorStop(1, "hsla(0,0%,0%,0)");
    ctx.fillStyle = cloud;
    ctx.fillRect(0, 0, w, h);
  }
}

// Borealis ribbons (Aurora)
function paintAurora(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const ribbons = [
    { hue: 165, y: h * 0.3, amp: h * 0.15, speed: 0.4, alpha: 0.15, phase: 0 },
    { hue: 190, y: h * 0.5, amp: h * 0.2, speed: 0.3, alpha: 0.12, phase: 2 },
    { hue: 280, y: h * 0.7, amp: h * 0.18, speed: 0.5, alpha: 0.1, phase: 4 },
  ];
  
  ctx.globalCompositeOperation = "screen";
  for (const r of ribbons) {
    ctx.beginPath();
    ctx.moveTo(-100, h + 100);
    ctx.lineTo(-100, r.y);
    
    for (let x = 0; x <= w + 100; x += 50) {
      const y = r.y 
        + Math.sin((x * 0.003) + t * r.speed + r.phase) * r.amp
        + Math.cos((x * 0.005) + t * r.speed * 0.6) * (r.amp * 0.5);
      ctx.lineTo(x, y);
    }
    
    ctx.lineTo(w + 100, h + 100);
    ctx.closePath();
    
    const grad = ctx.createLinearGradient(0, r.y - r.amp, 0, h);
    grad.addColorStop(0, `hsla(${r.hue}, 90%, 65%, ${r.alpha})`);
    grad.addColorStop(0.4, `hsla(${r.hue + 15}, 80%, 55%, ${r.alpha * 0.5})`);
    grad.addColorStop(1, "hsla(0,0%,0%,0)");
    
    ctx.fillStyle = grad;
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
}

// Carbon — minimal sleek geometric highlights
function paintCarbon(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const { h: ph } = readPrimaryHsl();
  
  // Slow panning spotlight
  const cx = w * (0.5 + Math.sin(t * 0.1) * 0.3);
  const cy = h * (0.5 + Math.cos(t * 0.15) * 0.2);
  const spot = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.5);
  spot.addColorStop(0, `hsla(${ph}, 80%, 50%, 0.08)`);
  spot.addColorStop(1, "hsla(0,0%,0%,0)");
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, w, h);

  // Subtle moving diagonal sheen
  const offset = (t * 50) % (w * 2);
  const sheen = ctx.createLinearGradient(offset - w, 0, offset, h);
  sheen.addColorStop(0, "hsla(0,0%,100%,0)");
  sheen.addColorStop(0.5, "hsla(0,0%,100%,0.015)");
  sheen.addColorStop(1, "hsla(0,0%,100%,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, w, h);
}

// Solar — Majestic pulsing corona
function paintSolar(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const { h: ph } = readPrimaryHsl();
  const cx = w * 0.5;
  const cy = h * 0.4;
  
  // Core sun glow
  const pulse = 0.5 + Math.sin(t * 1.2) * 0.5;
  const coreR = Math.max(w, h) * (0.35 + pulse * 0.05);
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
  core.addColorStop(0, `hsla(${ph + 15}, 100%, 70%, ${0.2 + pulse * 0.1})`);
  core.addColorStop(0.5, `hsla(${ph}, 95%, 55%, ${0.1 + pulse * 0.05})`);
  core.addColorStop(1, "hsla(0,0%,0%,0)");
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, w, h);

  // Rotating solar flares
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.05);
  for (let i = 0; i < 4; i++) {
    ctx.rotate((Math.PI * 2) / 4);
    const flare = ctx.createLinearGradient(0, 0, 0, Math.max(w, h) * 0.8);
    flare.addColorStop(0, `hsla(${ph + 20}, 100%, 65%, 0.1)`);
    flare.addColorStop(1, "hsla(0,0%,0%,0)");
    ctx.fillStyle = flare;
    ctx.beginPath();
    ctx.moveTo(-50, 0);
    ctx.lineTo(0, Math.max(w, h) * 0.8);
    ctx.lineTo(50, 0);
    ctx.fill();
  }
  ctx.restore();
}

// Daylight — highly refined pastel glassmorphism blobs
function paintDaylight(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const { h: ph } = readPrimaryHsl();
  const blobs = [
    { x: 0.2, y: 0.2, r: 0.45, h: ph, a: 0.15, s: 0.1 },
    { x: 0.8, y: 0.3, r: 0.35, h: ph + 20, a: 0.12, s: 0.15 },
    { x: 0.5, y: 0.8, r: 0.5, h: ph - 15, a: 0.1, s: 0.08 }
  ];

  for (const b of blobs) {
    const cx = w * (b.x + Math.sin(t * b.s) * 0.1);
    const cy = h * (b.y + Math.cos(t * b.s * 1.2) * 0.1);
    const r = Math.max(w, h) * b.r;
    
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, `hsla(${b.h}, 90%, 75%, ${b.a})`);
    grad.addColorStop(0.5, `hsla(${b.h}, 85%, 70%, ${b.a * 0.4})`);
    grad.addColorStop(1, "hsla(0,0%,0%,0)");
    
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
}

// Oceanic — smooth underwater light rays and deep bioluminescence
function paintOceanic(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const { h: ph } = readPrimaryHsl();
  
  // Gentle underwater light rays
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < 5; i++) {
    const xOffset = w * (0.2 * i) + Math.sin(t * 0.2 + i) * (w * 0.1);
    const grad = ctx.createLinearGradient(xOffset, 0, xOffset + w * 0.3, h);
    grad.addColorStop(0, `hsla(${ph + 10}, 90%, 60%, 0.1)`);
    grad.addColorStop(1, "hsla(0,0%,0%,0)");
    
    ctx.beginPath();
    ctx.moveTo(xOffset - 100, -50);
    ctx.lineTo(xOffset + 200, -50);
    ctx.lineTo(xOffset + w * 0.5, h + 50);
    ctx.lineTo(xOffset - w * 0.2, h + 50);
    ctx.fillStyle = grad;
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";

  // Deep abyssal glow
  const cx = w * 0.5;
  const cy = h * 0.9;
  const orb = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.6);
  orb.addColorStop(0, `hsla(${ph - 15}, 100%, 45%, 0.15)`);
  orb.addColorStop(1, "hsla(0,0%,0%,0)");
  ctx.fillStyle = orb;
  ctx.fillRect(0, 0, w, h);
}

// Forge — Elegant, immersive deep heat and metallic ambiance
function paintForge(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const { h: ph } = readPrimaryHsl();
  
  // Intense but smooth bottom furnace glow
  const pulse = Math.sin(t * 1.2) * 0.5 + 0.5;
  const cx = w * 0.5;
  const cy = h * 1.0;
  const r = Math.max(w, h) * (0.6 + pulse * 0.05);
  
  const furnace = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  furnace.addColorStop(0, `hsla(${ph}, 95%, 55%, 0.35)`);
  furnace.addColorStop(0.3, `hsla(${ph - 15}, 100%, 45%, 0.15)`);
  furnace.addColorStop(0.7, `hsla(${ph - 25}, 90%, 25%, 0.05)`);
  furnace.addColorStop(1, "hsla(0,0%,0%,0)");
  
  ctx.fillStyle = furnace;
  ctx.fillRect(0, 0, w, h);

  // Subtle ambient heat clouds (soot/smoke)
  for (let i = 0; i < 2; i++) {
    const sx = w * (i === 0 ? 0.2 : 0.8) + Math.sin(t * 0.2 + i) * (w * 0.1);
    const sy = h * (0.4 + i * 0.3) + Math.cos(t * 0.25 + i) * (h * 0.1);
    const smoke = ctx.createRadialGradient(sx, sy, 0, sx, sy, w * 0.5);
    smoke.addColorStop(0, `hsla(${ph - 20}, 60%, 15%, 0.3)`);
    smoke.addColorStop(1, "hsla(0,0%,0%,0)");
    
    ctx.fillStyle = smoke;
    ctx.fillRect(0, 0, w, h);
  }
}
