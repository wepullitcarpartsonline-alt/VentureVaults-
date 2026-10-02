import { useEffect, useRef } from "react";
import { worlds } from "./worlds";

/**
 * Deep-space backdrop:
 *  - screen-space nebula + three parallax star layers (twinkle)
 *  - world-space accretion vortex (spiral arms, differential rotation) around a black hole at world (0,0)
 * The map's pan/zoom is read from `viewRef` every frame so the vortex stays locked to the world.
 */

export const TILT = 0.6; // vertical squash of the orbital plane (fake 3D tilt)
const HOLE_R = 58;

type View = { x: number; y: number; k: number };

interface Particle {
  r: number;
  a: number;
  w: number; // angular speed (rad/s)
  size: number;
  hue: number;
  light: number;
  alpha: number;
  drift: number;
}

interface Star {
  x: number;
  y: number;
  s: number;
  tw: number;
  sp: number;
  c: string;
  layer: number;
}

const STAR_COLORS = ["#ffffff", "#e9ddff", "#f5d0fe", "#c7d2fe", "#fbcfe8"];

function makeParticle(outer: number, fresh = false): Particle {
  // 65% in two spiral arms, rest scattered in the disk
  const inArm = Math.random() < 0.65;
  const r = fresh ? 90 + Math.pow(Math.random(), 0.7) * (outer - 90) : outer * (0.85 + Math.random() * 0.15);
  let a: number;
  if (inArm) {
    const arm = Math.random() < 0.5 ? 0 : Math.PI;
    a = arm + Math.log(r / 80) * 2.1 + (Math.random() - 0.5) * 0.55;
  } else {
    a = Math.random() * Math.PI * 2;
  }
  const t = Math.min(1, (r - 70) / (outer - 70));
  // hot pink-white near the core → magenta → violet → indigo at the rim
  const hue = 300 - t * 45 + (Math.random() - 0.5) * 18;
  const light = 88 - t * 38;
  return {
    r,
    a,
    w: 0.55 * Math.pow(110 / r, 0.9) + 0.02,
    size: (inArm ? 1.1 : 0.8) + Math.random() * (1.9 - t * 0.9),
    hue,
    light,
    alpha: (inArm ? 0.75 : 0.45) * (1 - t * 0.55),
    drift: 2 + Math.random() * 6,
  };
}

export function SpaceCanvas({ viewRef, reducedMotion }: { viewRef: React.MutableRefObject<View>; reducedMotion: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    let W = 0;
    let H = 0;
    let nebula: HTMLCanvasElement | null = null;

    const OUTER = 860;
    const particles: Particle[] = Array.from({ length: 1500 }, () => makeParticle(OUTER, true));
    const stars: Star[] = Array.from({ length: 520 }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      s: Math.random() < 0.06 ? 1.6 + Math.random() * 1.2 : 0.4 + Math.random() * 1.0,
      tw: Math.random() * Math.PI * 2,
      sp: 0.6 + Math.random() * 2.2,
      c: STAR_COLORS[i % STAR_COLORS.length],
      layer: i % 3,
    }));

    const buildNebula = () => {
      const n = document.createElement("canvas");
      n.width = Math.ceil(W * 1.3);
      n.height = Math.ceil(H * 1.3);
      const g = n.getContext("2d")!;
      g.fillStyle = "#04020a";
      g.fillRect(0, 0, n.width, n.height);
      g.globalCompositeOperation = "lighter";
      const blobs = [
        { x: 0.18, y: 0.25, r: 0.45, c: "rgba(88, 28, 135, 0.42)" },
        { x: 0.82, y: 0.2, r: 0.4, c: "rgba(126, 34, 206, 0.30)" },
        { x: 0.72, y: 0.82, r: 0.5, c: "rgba(157, 23, 77, 0.26)" },
        { x: 0.2, y: 0.85, r: 0.45, c: "rgba(49, 46, 129, 0.40)" },
        { x: 0.5, y: 0.5, r: 0.55, c: "rgba(76, 29, 149, 0.30)" },
        { x: 0.95, y: 0.55, r: 0.3, c: "rgba(192, 38, 211, 0.16)" },
        { x: 0.05, y: 0.55, r: 0.3, c: "rgba(30, 64, 175, 0.18)" },
      ];
      for (const b of blobs) {
        const R = b.r * Math.max(n.width, n.height);
        const grad = g.createRadialGradient(b.x * n.width, b.y * n.height, 0, b.x * n.width, b.y * n.height, R);
        grad.addColorStop(0, b.c);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = grad;
        g.fillRect(0, 0, n.width, n.height);
      }
      // dusty filaments
      g.globalCompositeOperation = "source-over";
      for (let i = 0; i < 2200; i++) {
        const x = Math.random() * n.width;
        const y = Math.random() * n.height;
        g.fillStyle = `rgba(${180 + Math.random() * 60}, ${120 + Math.random() * 60}, 255, ${Math.random() * 0.05})`;
        g.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
      }
      nebula = n;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      buildNebula();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let last = performance.now();
    let raf = 0;
    let time = 0;

    const drawDisk = (front: boolean, v: View) => {
      ctx.save();
      ctx.translate(v.x, v.y);
      ctx.scale(v.k, v.k);
      ctx.globalCompositeOperation = "lighter";
      for (const p of particles) {
        const s = Math.sin(p.a);
        if (front ? s < 0 : s >= 0) continue;
        const x = Math.cos(p.a) * p.r;
        const y = s * p.r * TILT;
        // lensing: particles just behind the hole get pushed up & brightened
        ctx.fillStyle = `hsla(${p.hue}, 95%, ${p.light}%, ${p.alpha})`;
        const sz = p.size * (front ? 1.12 : 0.9);
        ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
      }
      ctx.restore();
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      time += dt;
      const v = viewRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // 1. nebula (very slow parallax)
      if (nebula) {
        const ox = ((v.x * 0.03) % (W * 0.15)) - W * 0.15;
        const oy = ((v.y * 0.03) % (H * 0.15)) - H * 0.15;
        ctx.globalCompositeOperation = "source-over";
        ctx.drawImage(nebula, ox, oy, W * 1.3, H * 1.3);
      }

      // 2. stars
      ctx.globalCompositeOperation = "lighter";
      for (const st of stars) {
        const f = [0.015, 0.04, 0.08][st.layer];
        let x = (st.x * W + v.x * f) % W;
        let y = (st.y * H + v.y * f) % H;
        if (x < 0) x += W;
        if (y < 0) y += H;
        const tw = reducedMotion ? 0.8 : 0.55 + 0.45 * Math.sin(st.tw + time * st.sp);
        ctx.globalAlpha = tw * (0.35 + st.layer * 0.25);
        ctx.fillStyle = st.c;
        if (st.s > 1.5) {
          ctx.beginPath();
          ctx.arc(x, y, st.s * 0.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha *= 0.35;
          ctx.fillRect(x - st.s * 2.2, y - 0.3, st.s * 4.4, 0.6);
          ctx.fillRect(x - 0.3, y - st.s * 2.2, 0.6, st.s * 4.4);
        } else {
          ctx.fillRect(x, y, st.s, st.s);
        }
      }
      ctx.globalAlpha = 1;

      // update particles
      if (!reducedMotion) {
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          p.a += p.w * dt * 0.35;
          p.r -= p.drift * dt * (130 / p.r);
          if (p.r < HOLE_R + 6) particles[i] = makeParticle(OUTER);
        }
      }

      const camera = v;
      for (const world of worlds) {
      const v = { ...camera, x: camera.x + world.x * camera.k, y: camera.y + world.y * camera.k };
      // 3. vortex glow
      ctx.save();
      ctx.translate(v.x, v.y);
      ctx.scale(v.k, v.k * TILT);
      const glow = ctx.createRadialGradient(0, 0, HOLE_R * 0.8, 0, 0, OUTER * 1.05);
      glow.addColorStop(0, "rgba(244, 114, 182, 0.55)");
      glow.addColorStop(0.12, "rgba(217, 70, 239, 0.32)");
      glow.addColorStop(0.35, "rgba(147, 51, 234, 0.16)");
      glow.addColorStop(0.7, "rgba(76, 29, 149, 0.07)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, OUTER * 1.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 4. back half of the disk
      drawDisk(false, v);

      // 5. black hole
      ctx.save();
      ctx.translate(v.x, v.y);
      ctx.scale(v.k, v.k);
      ctx.globalCompositeOperation = "source-over";
      // lensed halo (the far side of the disk bent over the top)
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const pulse = reducedMotion ? 1 : 0.85 + 0.15 * Math.sin(time * 1.3);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(0, 0, HOLE_R + 12 + i * 5, HOLE_R + 9 + i * 4, 0, Math.PI, Math.PI * 2);
        ctx.strokeStyle = `rgba(${250 - i * 20}, ${200 - i * 50}, 255, ${(0.55 - i * 0.15) * pulse})`;
        ctx.lineWidth = 3 - i * 0.7;
        ctx.shadowColor = "rgba(232, 121, 249, 0.9)";
        ctx.shadowBlur = 22;
        ctx.stroke();
      }
      ctx.restore();
      // event horizon
      const hole = ctx.createRadialGradient(0, 0, HOLE_R * 0.6, 0, 0, HOLE_R * 1.05);
      hole.addColorStop(0, "#000");
      hole.addColorStop(0.85, "#000");
      hole.addColorStop(1, "rgba(0,0,0,0.0)");
      ctx.fillStyle = hole;
      ctx.beginPath();
      ctx.arc(0, 0, HOLE_R * 1.05, 0, Math.PI * 2);
      ctx.fill();
      // photon ring
      ctx.globalCompositeOperation = "lighter";
      ctx.beginPath();
      ctx.arc(0, 0, HOLE_R + 1.5, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(253, 230, 255, ${0.85 * pulse})`;
      ctx.lineWidth = 1.6;
      ctx.shadowColor = "rgba(240, 171, 252, 1)";
      ctx.shadowBlur = 18;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();

      // 6. front half of the disk (crosses in front of the hole)
      drawDisk(true, v);
      }

      ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(frame);
    };

    if (reducedMotion) {
      // static but still responsive to pan/zoom
      const loop = (now: number) => {
        frame(now);
      };
      let prev = "";
      const tick = () => {
        const v = viewRef.current;
        const key = `${v.x.toFixed(1)}|${v.y.toFixed(1)}|${v.k.toFixed(3)}|${W}|${H}`;
        if (key !== prev) {
          prev = key;
          loop(performance.now());
          cancelAnimationFrame(raf);
        }
        raf2 = requestAnimationFrame(tick);
      };
      let raf2 = requestAnimationFrame(tick);
      return () => {
        cancelAnimationFrame(raf2);
        cancelAnimationFrame(raf);
        ro.disconnect();
      };
    }

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [viewRef, reducedMotion]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />;
}
