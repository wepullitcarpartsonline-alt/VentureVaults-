import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Minus, Pause, Play, Plus, Scan } from "lucide-react";
import type { Connection, ConnectionType, Project, ReusableAsset } from "./types";
import { CONNECTION_META, EVIDENCE_LEVELS, PATHS, claimedLevel, metricValue, verifiedLevel, type SizeMetric } from "./logic";
import { worlds, worldOrigin } from "./worlds";
import { SpaceCanvas, TILT } from "./SpaceCanvas";

export interface MapHandle {
  fit: () => void;
}

interface Props {
  projects: Project[];
  assets: ReusableAsset[];
  connections: Connection[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  sizeMetric: SizeMetric;
  matches: (p: Project) => boolean;
  hiddenLinks: Set<ConnectionType>;
  insets: { left: number; right: number; top: number; bottom: number };
  reducedMotion: boolean;
}

const RING_R = [390, 660];
const ORBIT_DEG_PER_SEC = 360 / 420; // one full revolution every 7 minutes
const WORLD = { minX: -900, maxX: 3300, minY: -500, maxY: 570 };
const DEG = Math.PI / 180;

/** depth factor 0 (far/back) → 1 (near/front) from orbit angle */
const depthOf = (angleDeg: number) => (Math.sin(angleDeg * DEG) + 1) / 2;

export const VaultMap = forwardRef<MapHandle, Props>(function VaultMap(
  { projects, assets, connections, selectedId, onSelect, sizeMetric, matches, hiddenLinks, insets, reducedMotion },
  ref,
) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 0.8 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const [animating, setAnimating] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [userPaused, setUserPaused] = useState(false);

  /* ---------- clock: orbit rotation + pulse time + cursor parallax ---------- */
  const [clock, setClock] = useState({ rot: 0, t: 0, px: 0, py: 0 });
  const paused = userPaused || !!hoverId || !!selectedId || reducedMotion;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const rotRef = useRef(0);
  const target = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (reducedMotion) return;
    let raf = 0;
    let last = performance.now();
    let t = 0;
    const cur = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      target.current = { x: (e.clientX / window.innerWidth) * 2 - 1, y: (e.clientY / window.innerHeight) * 2 - 1 };
    };
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      if (!pausedRef.current) rotRef.current = (rotRef.current + ORBIT_DEG_PER_SEC * dt) % 360;
      cur.x += (target.current.x - cur.x) * 0.06;
      cur.y += (target.current.y - cur.y) * 0.06;
      setClock({ rot: rotRef.current, t, px: cur.x, py: cur.y });
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener("pointermove", onMove);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
    };
  }, [reducedMotion]);

  const mapAssets = useMemo(() => assets.filter((a) => a.onMap), [assets]);

  /* ---------- positions ---------- */
  const place = useCallback((radius: number, angle: number, rot: number, parallax: { x: number; y: number }) => {
    const a = angle + rot;
    const d = depthOf(a);
    const amp = 6 + d * 18; // nearer bodies shift more with the cursor
    return {
      x: Math.cos(a * DEG) * radius + parallax.x * amp,
      y: Math.sin(a * DEG) * radius * TILT + parallax.y * amp * 0.6,
      depth: d,
    };
  }, []);

  const positions = useMemo(() => {
    const pos: Record<string, { x: number; y: number; depth: number }> = {};
    const par = { x: clock.px, y: clock.py };
    for (const p of projects) {
      const origin = worldOrigin(p.worldId);
      const local = place(RING_R[p.orbit.ring], p.orbit.angle, clock.rot, par);
      pos[p.id] = { ...local, x: local.x + origin.x, y: local.y + origin.y };
    }
    for (const a of mapAssets) {
      const origin = worldOrigin(a.worldId);
      const local = place(a.onMap!.radius, a.onMap!.angle, clock.rot, par);
      pos[a.id] = { ...local, x: local.x + origin.x, y: local.y + origin.y };
    }
    return pos;
  }, [projects, mapAssets, clock.rot, clock.px, clock.py, place]);

  /* ---------- fit / center ---------- */
  const visibleRect = useCallback(() => {
    const el = viewportRef.current;
    const w = el?.clientWidth ?? window.innerWidth;
    const h = el?.clientHeight ?? window.innerHeight;
    return {
      w,
      h,
      cx: insets.left + (w - insets.left - insets.right) / 2,
      cy: insets.top + (h - insets.top - insets.bottom) / 2,
      vw: Math.max(200, w - insets.left - insets.right),
      vh: Math.max(200, h - insets.top - insets.bottom),
    };
  }, [insets.left, insets.right, insets.top, insets.bottom]);

  const fitView = useCallback(() => {
    const r = visibleRect();
    const fitK = Math.min(r.vw / (WORLD.maxX - WORLD.minX), r.vh / (WORLD.maxY - WORLD.minY));
    const k = Math.min(1.1, Math.max(0.04, fitK));
    const wx = (WORLD.minX + WORLD.maxX) / 2;
    const wy = (WORLD.minY + WORLD.maxY) / 2;
    return { x: r.cx - wx * k, y: r.cy - wy * k, k };
  }, [visibleRect]);

  const animateTo = useCallback(
    (next: { x: number; y: number; k: number }) => {
      if (!reducedMotion) {
        setAnimating(true);
        window.setTimeout(() => setAnimating(false), 760);
      }
      setView(next);
    },
    [reducedMotion],
  );

  const fit = useCallback(() => animateTo(fitView()), [animateTo, fitView]);
  useImperativeHandle(ref, () => ({ fit }), [fit]);

  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    setView(fitView());
  }, [fitView]);

  useEffect(() => {
    if (!didInit.current) return;
    if (selectedId) {
      const p = projects.find((pp) => pp.id === selectedId);
      if (!p) return;
      const pos = place(RING_R[p.orbit.ring], p.orbit.angle, rotRef.current, { x: 0, y: 0 });
      const origin = worldOrigin(p.worldId);
      pos.x += origin.x;
      pos.y += origin.y;
      const r = visibleRect();
      const k = Math.max(viewRef.current.k, Math.min(0.9, r.vw / 820));
      animateTo({ x: r.cx - pos.x * k, y: r.cy - pos.y * k, k });
    } else {
      fit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, insets.right, insets.left]);

  /* ---------- pan / pinch / wheel ---------- */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ moved: number; startDist?: number; startK?: number; last?: { x: number; y: number } }>({ moved: 0 });
  const suppressClick = useRef(false);

  const zoomAt = useCallback((sx: number, sy: number, factor: number) => {
    setView((v) => {
      const k = Math.min(1.8, Math.max(0.04, v.k * factor));
      const f = k / v.k;
      return { k, x: sx - (sx - v.x) * f, y: sy - (sy - v.y) * f };
    });
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-map-control]")) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesture.current.moved = 0;
    gesture.current.last = { x: e.clientX, y: e.clientY };
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      gesture.current.startDist = Math.hypot(a.x - b.x, a.y - b.y);
      gesture.current.startK = view.k;
    }
    suppressClick.current = false;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && gesture.current.startDist) {
      const [a, b] = Array.from(pointers.current.values());
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const rect = viewportRef.current!.getBoundingClientRect();
      zoomAt((a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top, (gesture.current.startK! * d) / gesture.current.startDist / view.k);
      suppressClick.current = true;
      return;
    }
    const last = gesture.current.last!;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    gesture.current.last = { x: e.clientX, y: e.clientY };
    gesture.current.moved += Math.abs(dx) + Math.abs(dy);
    if (gesture.current.moved > 5) {
      suppressClick.current = true;
      if (!dragging) {
        setDragging(true);
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {}
      }
      setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
    }
  };

  const endPointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current.startDist = undefined;
    if (pointers.current.size === 0) setDragging(false);
  };

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
      } else {
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const zoomCenter = (factor: number) => {
    const r = visibleRect();
    if (!reducedMotion) {
      setAnimating(true);
      window.setTimeout(() => setAnimating(false), 500);
    }
    zoomAt(r.cx, r.cy, factor);
  };

  /* ---------- highlight state ---------- */
  const active = hoverId ?? selectedId;
  const related = useMemo(() => {
    if (!active) return null;
    const s = new Set<string>([active]);
    for (const c of connections) {
      if (hiddenLinks.has(c.type)) continue;
      if (c.from === active) s.add(c.to);
      if (c.to === active) s.add(c.from);
    }
    return s;
  }, [active, connections, hiddenLinks]);

  const matchMap = useMemo(() => {
    const m: Record<string, boolean> = {};
    for (const p of projects) m[p.id] = matches(p);
    for (const a of mapAssets) m[a.id] = a.projectIds.some((id) => m[id]);
    return m;
  }, [projects, mapAssets, matches]);

  /* ---------- link geometry (curves bend toward the core, like lensed light) ---------- */
  const linkGeom = (c: Connection) => {
    const a = positions[c.from];
    const b = positions[c.to];
    if (!a || !b) return null;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const pull = c.type === "asset" ? 0.75 : 0.45;
    const owner = projects.find((p) => p.id === c.from) ?? mapAssets.find((a) => a.id === c.from);
    const origin = worldOrigin(owner?.worldId);
    const cx = origin.x + (mx - origin.x) * pull;
    const cy = origin.y + (my - origin.y) * pull;
    return { a, b, cx, cy, d: `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}` };
  };
  const qPoint = (g: NonNullable<ReturnType<typeof linkGeom>>, t: number) => {
    const u = 1 - t;
    return { x: u * u * g.a.x + 2 * u * t * g.cx + t * t * g.b.x, y: u * u * g.a.y + 2 * u * t * g.cy + t * t * g.b.y };
  };

  // neuron pings on arrival
  const pings: Record<string, number> = {};
  const visibleLinks = connections.filter((c) => !hiddenLinks.has(c.type));
  if (!reducedMotion) {
    visibleLinks.forEach((c, i) => {
      const dur = 3.2 + (i % 5) * 0.7;
      const t = ((clock.t / dur + i * 0.37) % 1 + 1) % 1;
      const dest = i % 2 ? c.from : c.to;
      if (t > 0.9) pings[dest] = Math.max(pings[dest] ?? 0, (t - 0.9) / 0.1);
    });
  }

  const handleNodeClick = (id: string) => {
    if (suppressClick.current) return;
    onSelect(id);
  };

  const inv = 1 / view.k;

  return (
    <div
      ref={viewportRef}
      className="absolute inset-0 overflow-clip touch-none select-none"
      style={{ cursor: dragging ? "grabbing" : "grab", background: "#04020a" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onScroll={(e) => {
        e.currentTarget.scrollTop = 0;
        e.currentTarget.scrollLeft = 0;
      }}
      data-testid="vault-map"
      aria-label="Vault map. Drag to pan, scroll to zoom. Use the project index for a list view."
      role="application"
    >
      <SpaceCanvas viewRef={viewRef} reducedMotion={reducedMotion} />

      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.k})`,
          transition: animating ? "transform 740ms cubic-bezier(0.16, 1, 0.3, 1)" : "none",
          willChange: "transform",
        }}
      >
        {worlds.map((world) => (
          <button key={world.id} data-map-control type="button"
            className="absolute chrome rounded-full px-4 py-2 whitespace-nowrap text-xs"
            style={{ left: world.x, top: world.y - 510, transform: "translateX(-50%)", color: "#f5d0fe" }}
            onClick={() => { const r = visibleRect(); const k = Math.min(0.8, r.vw / 1800, r.vh / 1070); animateTo({ x: r.cx - world.x * k, y: r.cy - world.y * k, k }); }}>
            {world.label}
          </button>
        ))}
        {/* Orbit rings */}
        <svg className="absolute overflow-visible" style={{ left: 0, top: 0, width: 1, height: 1 }} aria-hidden>
          <defs>
            <filter id="pulse-glow" x="-200%" y="-200%" width="500%" height="500%">
              <feGaussianBlur stdDeviation="3.5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {worlds.flatMap((world) => RING_R.map((r, i) => (
            <g key={`${world.id}-${r}`} transform={`translate(${world.x}, ${world.y})`}>
              <ellipse rx={r} ry={r * TILT} fill="none" stroke="rgba(216, 180, 254, 0.14)" strokeDasharray={i ? "2 9" : undefined} />
              <text x={r * 0.72 + 12} y={-r * TILT * 0.7 - 10} fill="rgba(233, 213, 255, 0.4)" fontSize={11} fontFamily="JetBrains Mono" letterSpacing="2.5">
                {["NEAR TERM", "HORIZON"][i]}
              </text>
            </g>
          )))}
        </svg>

        {/* Links + neuron pulses */}
        <svg className="absolute overflow-visible" style={{ left: 0, top: 0, width: 1, height: 1 }} aria-hidden>
          {visibleLinks.map((c, i) => {
            const g = linkGeom(c);
            if (!g) return null;
            const meta = CONNECTION_META[c.type];
            const isHi = active ? c.from === active || c.to === active : false;
            const filteredOut = !matchMap[c.from] || !matchMap[c.to];
            const base = filteredOut ? 0.04 : active ? (isHi ? 0.95 : 0.06) : c.type === "asset" ? 0.28 : 0.38;
            const dur = 3.2 + (i % 5) * 0.7;
            const t = ((clock.t / (isHi ? dur * 0.6 : dur) + i * 0.37) % 1 + 1) % 1;
            const forward = i % 2 === 0;
            const pulseT = forward ? t : 1 - t;
            const showPulse = !reducedMotion && !filteredOut && (!active || isHi);
            return (
              <g key={c.id} style={{ transition: "opacity 300ms" }}>
                <path d={g.d} fill="none" stroke={meta.color} strokeWidth={isHi ? 1.8 : 1.1} strokeDasharray={meta.dash || undefined} opacity={base} strokeLinecap="round" />
                {isHi && <path d={g.d} fill="none" stroke={meta.color} strokeWidth={7} opacity={0.14} />}
                {showPulse &&
                  [0, 0.025, 0.05, 0.075].map((lag, j) => {
                    const tt = forward ? pulseT - lag : pulseT + lag;
                    if (tt < 0 || tt > 1) return null;
                    const pt = qPoint(g, tt);
                    return (
                      <circle
                        key={j}
                        cx={pt.x}
                        cy={pt.y}
                        r={(isHi ? 4 : 3) * (1 - j * 0.22)}
                        fill={j === 0 ? "#fff" : meta.color}
                        opacity={(isHi ? 1 : 0.8) * (1 - j * 0.25)}
                        filter={j === 0 ? "url(#pulse-glow)" : undefined}
                      />
                    );
                  })}
              </g>
            );
          })}
        </svg>

        {/* Link labels on hover */}
        {hoverId &&
          visibleLinks
            .filter((c) => c.type !== "asset" && (c.from === hoverId || c.to === hoverId))
            .map((c) => {
              const g = linkGeom(c);
              if (!g) return null;
              const pt = qPoint(g, 0.5);
              const meta = CONNECTION_META[c.type];
              return (
                <div
                  key={`l-${c.id}`}
                  className="absolute pointer-events-none"
                  style={{ left: pt.x, top: pt.y, transform: `translate(-50%, -50%) scale(${Math.min(1.8, inv)})`, zIndex: 400 }}
                >
                  <div className="chrome whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-mono tracking-wide flex items-center gap-1.5">
                    <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
                    <span style={{ color: "var(--bone-2)" }}>{meta.label}:</span>
                    <span style={{ color: "var(--bone)" }}>{c.label}</span>
                  </div>
                </div>
              );
            })}

        {/* Asset moons */}
        {mapAssets.map((a) => {
          const pos = positions[a.id];
          const dim = !matchMap[a.id] || (related ? !related.has(a.id) : false);
          const s = 0.8 + pos.depth * 0.35;
          const size = 46 * s;
          return (
            <button
              key={a.id}
              type="button"
              className="moon absolute left-0 top-0 flex flex-col items-center"
              style={{
                transform: `translate3d(${pos.x}px, ${pos.y}px, 0) translate(-50%, -${size / 2}px)`,
                opacity: dim ? 0.28 : 0.6 + pos.depth * 0.4,
                zIndex: Math.round(100 + pos.depth * 100),
              }}
              onPointerEnter={() => setHoverId(a.id)}
              onPointerLeave={() => setHoverId((h) => (h === a.id ? null : h))}
              onFocus={() => setHoverId(a.id)}
              onBlur={() => setHoverId(null)}
              aria-label={`Shared asset: ${a.name}, used in ${a.projectIds.length} projects`}
              data-testid={`node-asset-${a.id}`}
            >
              <span className="relative block" style={{ width: size, height: size }}>
                <span className="absolute inset-[-40%] rounded-full" style={{ background: "radial-gradient(closest-side, rgba(216,180,254,0.28), transparent)" }} />
                <img src={a.orb} alt="" draggable={false} className="relative h-full w-full object-contain" />
              </span>
              <span className="mt-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-medium label-shadow" style={{ color: "var(--bone)", background: "rgba(10,6,20,0.55)", border: "1px solid rgba(216,180,254,0.18)" }}>
                {a.name} <span className="font-mono" style={{ color: "var(--bone-3)" }}>×{a.projectIds.length}</span>
              </span>
            </button>
          );
        })}

        {/* Project orbs */}
        {projects.map((p) => {
          const pos = positions[p.id];
          const vl = verifiedLevel(p);
          const cl = claimedLevel(p);
          const path = PATHS[p.recommendation.path];
          const isSel = selectedId === p.id;
          const isHover = hoverId === p.id;
          const dim = !matchMap[p.id];
          const faded = !dim && related ? !related.has(p.id) : false;
          const depthScale = 0.8 + pos.depth * 0.32;
          const size = (96 + 64 * metricValue(p, sizeMetric)) * depthScale;
          const ping = pings[p.id] ?? 0;
          return (
            <div
              key={p.id}
              className="orb-node absolute left-0 top-0"
              data-selected={isSel}
              data-dim={dim}
              data-faded={faded}
              style={{
                transform: `translate3d(${pos.x}px, ${pos.y}px, 0) translate(-50%, -${size / 2}px)`,
                zIndex: isSel || isHover ? 500 : Math.round(100 + pos.depth * 100),
                width: Math.max(size, 200),
              }}
              role="button"
              tabIndex={0}
              aria-pressed={isSel}
              aria-label={`${p.name}. ${p.category}, ${p.status}. Recommended: ${path.label}. Verified evidence level ${vl}, ${EVIDENCE_LEVELS[vl].name}.`}
              onPointerEnter={() => setHoverId(p.id)}
              onPointerLeave={() => setHoverId((h) => (h === p.id ? null : h))}
              onFocus={() => setHoverId(p.id)}
              onBlur={() => setHoverId(null)}
              onClick={() => handleNodeClick(p.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(p.id);
                }
              }}
              data-testid={`node-project-${p.id}`}
            >
              <div className="flex flex-col items-center">
                {/* the body */}
                <div className="orb-body relative" style={{ width: size, height: size, transition: "width 520ms cubic-bezier(0.16,1,0.3,1), height 520ms cubic-bezier(0.16,1,0.3,1)" }}>
                  <span className="orb-glow absolute rounded-full" style={{ inset: "-38%", background: `radial-gradient(closest-side, ${path.color}55, rgba(168,85,247,0.18) 55%, transparent)` }} />
                  {ping > 0 && (
                    <span
                      className="absolute rounded-full pointer-events-none"
                      style={{ inset: `${-4 - ping * 22}%`, border: `1.5px solid rgba(240,171,252,${(1 - ping) * 0.8})`, boxShadow: `0 0 18px rgba(232,121,249,${(1 - ping) * 0.6})` }}
                    />
                  )}
                  {(isSel || isHover) && <span className="orb-halo absolute rounded-full" style={{ inset: "-14%" }} />}
                  <img
                    src={p.orb}
                    alt=""
                    draggable={false}
                    className="orb-img relative h-full w-full object-contain"
                    style={{ transform: `scale(${p.orbScale ?? 1})` }}
                  />
                </div>
                {/* label */}
                <div className="orb-label mt-1.5 text-center label-shadow" style={{ maxWidth: 200 }}>
                  <div className="flex items-center justify-center gap-1.5 font-mono text-[12.5px] tracking-[0.08em] whitespace-nowrap" style={{ color: "rgba(233,213,255,0.85)" }}>
                    <span>{String(p.index).padStart(2, "0")}</span>
                    <span className="opacity-40">·</span>
                    <span title={`Verified evidence: ${EVIDENCE_LEVELS[vl].name}${cl > vl ? ` (claims suggest L${cl})` : ""}`}>L{vl}</span>
                    <span className="opacity-40">·</span>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: path.color, boxShadow: `0 0 8px ${path.color}` }} />
                    <span style={{ color: path.color }}>{path.label.toUpperCase()}</span>
                  </div>
                  <h3 className="font-display leading-[1.0] mt-1" style={{ fontSize: 26 + pos.depth * 5, color: "var(--bone)" }}>
                    {p.name}
                  </h3>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Controls */}
      <div
        data-map-control
        className="chrome absolute flex items-center rounded-full p-1 gap-0.5"
        style={{ right: insets.right + 16, bottom: insets.bottom > 80 ? 72 : 16, transition: "right 520ms cubic-bezier(0.16,1,0.3,1)" }}
      >
        {!reducedMotion && (
          <>
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/5"
              onClick={() => setUserPaused((v) => !v)}
              aria-label={userPaused ? "Resume orbit" : "Pause orbit"}
              title={userPaused ? "Resume orbit" : "Pause orbit"}
              data-testid="button-toggle-orbit"
            >
              {userPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
            <span className="mx-1 h-5 w-px" style={{ background: "rgba(236,232,245,0.1)" }} />
          </>
        )}
        <button type="button" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/5" onClick={() => zoomCenter(1 / 1.2)} aria-label="Zoom out" data-testid="button-zoom-out">
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-12 text-center font-mono text-[11px]" style={{ color: "var(--bone-2)" }} data-testid="text-zoom">
          {Math.round(view.k * 100)}%
        </span>
        <button type="button" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/5" onClick={() => zoomCenter(1.2)} aria-label="Zoom in" data-testid="button-zoom-in">
          <Plus className="h-4 w-4" />
        </button>
        <span className="mx-1 h-5 w-px" style={{ background: "rgba(236,232,245,0.1)" }} />
        <button type="button" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/5" onClick={fit} aria-label="Fit all projects" data-testid="button-fit">
          <Scan className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
});
