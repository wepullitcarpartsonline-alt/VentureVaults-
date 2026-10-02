import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, List, Plus, SlidersHorizontal, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { connections, projects, reusableAssets } from "./worlds";
import {
  CONNECTION_META,
  EVIDENCE_LEVELS,
  PATHS,
  SIZE_METRICS,
  verifiedLevel,
  type SizeMetric,
} from "./logic";
import type { ConnectionType, PathKey, Project } from "./types";
import { VaultMap, type MapHandle } from "./VaultMap";
import { Dossier } from "./Dossier";

/* ------------------------------------------------------------------ */

function Logo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="Creative Studio Vault" role="img">
      <rect x="4.5" y="4.5" width="23" height="23" rx="3.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12.8" cy="12.8" r="3.8" stroke="var(--brass)" strokeWidth="1.5" />
      <path d="M15.6 15.6 21.2 21.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="21.8" cy="21.8" r="1.7" fill="currentColor" />
    </svg>
  );
}

function useMediaQuery(q: string) {
  const [m, setM] = useState(() => (typeof window !== "undefined" ? window.matchMedia(q).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [q]);
  return m;
}

function useWindowWidth() {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return w;
}

/* ------------------------------------------------------------------ */

type FilterKey = "category" | "status" | "path" | "evidence" | "area";
type Filters = Record<FilterKey, Set<string>>;

const emptyFilters = (): Filters => ({
  category: new Set(),
  status: new Set(),
  path: new Set(),
  evidence: new Set(),
  area: new Set(),
});

function valueFor(p: Project, k: FilterKey): string {
  switch (k) {
    case "category":
      return p.category;
    case "status":
      return p.status;
    case "path":
      return p.recommendation.path;
    case "evidence":
      return String(verifiedLevel(p));
    case "area":
      return p.area;
  }
}

function FilterChip({
  label,
  options,
  selected,
  onToggle,
  onClear,
  testId,
}: {
  label: string;
  options: { value: string; label: string; count: number; dot?: string }[];
  selected: Set<string>;
  onToggle: (v: string) => void;
  onClear: () => void;
  testId: string;
}) {
  const n = selected.size;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="chrome inline-flex h-9 items-center gap-1.5 rounded-full pl-3.5 pr-2.5 text-[13px] whitespace-nowrap transition-colors hover:border-white/20"
          style={{ color: n ? "var(--bone)" : "var(--bone-2)", borderColor: n ? "rgba(196,161,255,0.45)" : undefined }}
          data-testid={`button-filter-${testId}`}
        >
          {label}
          {n > 0 && (
            <span className="font-mono text-[10.5px] rounded-full px-1.5" style={{ background: "var(--brass)", color: "var(--ink-0)" }}>
              {n}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-64 p-1.5 rounded-xl border-0"
        style={{ background: "rgba(17,12,32,0.97)", boxShadow: "0 24px 60px -12px rgba(0,0,0,0.8), 0 0 0 1px rgba(236,232,245,0.1)" }}
      >
        <div className="flex items-center justify-between px-2.5 pt-1.5 pb-2">
          <span className="eyebrow" style={{ fontSize: 10 }}>{label}</span>
          {n > 0 && (
            <button type="button" onClick={onClear} className="text-[12px] underline underline-offset-2" style={{ color: "var(--bone-2)" }}>
              Clear
            </button>
          )}
        </div>
        <ul role="listbox" aria-multiselectable>
          {options.map((o) => {
            const on = selected.has(o.value);
            return (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => onToggle(o.value)}
                  className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] text-left hover:bg-white/5 disabled:opacity-40"
                  disabled={o.count === 0}
                  style={{ color: "var(--bone)" }}
                  data-testid={`option-${testId}-${o.value}`}
                >
                  <span
                    className="grid h-4 w-4 place-items-center rounded-[4px] shrink-0"
                    style={{ border: `1px solid ${on ? "var(--brass)" : "rgba(236,232,245,0.25)"}`, background: on ? "var(--brass)" : "transparent" }}
                  >
                    {on && <Check className="h-3 w-3" style={{ color: "var(--ink-0)" }} strokeWidth={3} />}
                  </span>
                  {o.dot && <span className="h-2 w-2 rounded-full shrink-0" style={{ background: o.dot }} />}
                  <span className="flex-1 truncate">{o.label}</span>
                  <span className="font-mono text-[11px]" style={{ color: "var(--bone-3)" }}>{o.count}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */

export default function VaultPage() {
  const mapRef = useRef<MapHandle>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [sizeMetric, setSizeMetric] = useState<SizeMetric>("evidence");
  const [hiddenLinks, setHiddenLinks] = useState<Set<ConnectionType>>(new Set());
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const width = useWindowWidth();
  const isMobile = width < 768;
  const isWide = width >= 1280;
  const [indexOpen, setIndexOpen] = useState(() => window.innerWidth >= 1280);
  const [filtersOpenMobile, setFiltersOpenMobile] = useState(false);

  const ordered = useMemo(() => [...projects].sort((a, b) => a.index - b.index), []);
  const selected = ordered.find((p) => p.id === selectedId) ?? null;

  const matches = useCallback(
    (p: Project) => (Object.keys(filters) as FilterKey[]).every((k) => filters[k].size === 0 || filters[k].has(valueFor(p, k))),
    [filters],
  );
  const matchCount = ordered.filter(matches).length;
  const activeFilterCount = Object.values(filters).reduce((n, s) => n + s.size, 0);

  const toggle = (k: FilterKey, v: string) =>
    setFilters((f) => {
      const next = { ...f, [k]: new Set(f[k]) };
      next[k].has(v) ? next[k].delete(v) : next[k].add(v);
      return next;
    });
  const clearKey = (k: FilterKey) => setFilters((f) => ({ ...f, [k]: new Set() }));

  const optionsFor = (k: FilterKey, values: { value: string; label: string; dot?: string }[]) =>
    values.map((v) => ({ ...v, count: ordered.filter((p) => valueFor(p, k) === v.value).length }));

  const uniq = <T,>(a: T[]) => Array.from(new Set(a));
  const filterDefs: { key: FilterKey; label: string; options: ReturnType<typeof optionsFor> }[] = [
    { key: "category", label: "Category", options: optionsFor("category", uniq(ordered.map((p) => p.category)).map((c) => ({ value: c, label: c }))) },
    {
      key: "status",
      label: "Status",
      options: optionsFor(
        "status",
        ["Idea", "Exploring", "Prototyping", "Piloting", "Active", "Paused", "Archived"].map((s) => ({ value: s, label: s })),
      ),
    },
    {
      key: "path",
      label: "Opportunity",
      options: optionsFor(
        "path",
        (Object.keys(PATHS) as PathKey[]).filter((k) => k !== "archive").map((k) => ({ value: k, label: PATHS[k].label, dot: PATHS[k].color })),
      ),
    },
    { key: "evidence", label: "Evidence", options: optionsFor("evidence", EVIDENCE_LEVELS.map((l) => ({ value: String(l.level), label: `L${l.level} · ${l.name}` }))) },
    { key: "area", label: "Area", options: optionsFor("area", ["Creative", "Business", "Nonprofit", "Technology"].map((a) => ({ value: a, label: a }))) },
  ];

  const navigate = useCallback(
    (dir: -1 | 1) => {
      if (!selectedId) return;
      const i = ordered.findIndex((p) => p.id === selectedId);
      setSelectedId(ordered[(i + dir + ordered.length) % ordered.length].id);
    },
    [selectedId, ordered],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Escape" && selectedId) setSelectedId(null);
      if (selectedId && e.key === "ArrowRight") navigate(1);
      if (selectedId && e.key === "ArrowLeft") navigate(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, navigate]);

  const dossierWidth = Math.min(660, width * 0.46) + 14;
  const insets = {
    top: isMobile ? 112 : 104,
    left: indexOpen && isWide ? 276 : 0,
    right: selected && !isMobile ? dossierWidth : 0,
    bottom: isMobile ? 96 : 40,
  };

  return (
    <div className="grain relative h-full w-full overflow-clip">
      <a href="#vault-index" className="skip-link chrome rounded-full px-4 py-2 text-sm" onClick={(e) => { e.preventDefault(); setIndexOpen(true); document.getElementById("vault-index")?.focus(); }}>
        Skip to project index
      </a>

      <main className="absolute inset-0">
        <h1 className="sr-only">Creative Studio Vault — Vault Map</h1>
        <VaultMap
          ref={mapRef}
          projects={ordered}
          assets={reusableAssets}
          connections={connections}
          selectedId={selectedId}
          onSelect={(id) => {
            if (ordered.some((p) => p.id === id)) setSelectedId(id);
          }}
          sizeMetric={sizeMetric}
          matches={matches}
          hiddenLinks={hiddenLinks}
          insets={insets}
          reducedMotion={reducedMotion}
        />
      </main>

      {/* ---------------- Header ---------------- */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30">
        <div className="pointer-events-auto flex h-16 items-center justify-between gap-4 px-4 md:px-6 border-b hairline" style={{ background: "linear-gradient(180deg, rgba(6,4,14,0.92), rgba(6,4,14,0.6))", backdropFilter: "blur(10px)" }}>
          <div className="flex items-center gap-3 min-w-0">
            <Logo className="h-8 w-8 shrink-0 text-[color:var(--bone)]" />
            <div className="min-w-0 leading-tight">
              <div className="font-display text-[21px] leading-none truncate" style={{ color: "var(--bone)" }}>
                Creative Studio Vault
              </div>
              <div className="font-mono text-[10px] tracking-[0.16em] uppercase mt-1 hidden sm:block" style={{ color: "var(--bone-3)" }}>
                Project Intelligence
              </div>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-1" aria-label="Views">
            {[
              { k: "Vault Map", active: true },
              { k: "Opportunities" },
              { k: "Assets" },
              { k: "Intake" },
            ].map((n) => (
              <button
                key={n.k}
                type="button"
                disabled={!n.active}
                aria-current={n.active ? "page" : undefined}
                title={n.active ? undefined : "Planned for the next build"}
                className="relative px-3.5 h-10 text-[13.5px] rounded-full disabled:cursor-not-allowed"
                style={{ color: n.active ? "var(--bone)" : "var(--bone-3)" }}
                data-testid={`nav-${n.k.toLowerCase().replace(" ", "-")}`}
              >
                {n.k}
                {n.active && <span className="absolute left-3.5 right-3.5 -bottom-[13px] h-px" style={{ background: "var(--brass)" }} />}
                {!n.active && <span className="ml-1.5 font-mono text-[9px] tracking-wider uppercase opacity-70">soon</span>}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled
              title="The guided Intake flow is the next build"
              className="chrome hidden sm:inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] cursor-not-allowed"
              style={{ color: "var(--bone-2)" }}
              data-testid="button-add-project"
            >
              <Plus className="h-4 w-4" /> Add project
              <span className="ml-1 font-mono text-[9px] tracking-wider uppercase opacity-70">soon</span>
            </button>
          </div>
        </div>

        {/* ---------------- Filter bar ---------------- */}
        <div className="pointer-events-auto flex items-center gap-2 px-4 md:px-6 pt-3 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setIndexOpen((o) => !o)}
            className="chrome inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-[13px] shrink-0"
            style={{ color: indexOpen ? "var(--bone)" : "var(--bone-2)", borderColor: indexOpen ? "rgba(236,232,245,0.22)" : undefined }}
            aria-expanded={indexOpen}
            aria-controls="vault-index"
            data-testid="button-toggle-index"
          >
            <List className="h-4 w-4" /> Index
          </button>

          {isMobile ? (
            <button
              type="button"
              onClick={() => setFiltersOpenMobile((o) => !o)}
              className="chrome inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-[13px] shrink-0"
              style={{ color: "var(--bone-2)" }}
              data-testid="button-filters-mobile"
            >
              <SlidersHorizontal className="h-4 w-4" /> Filters
              {activeFilterCount > 0 && (
                <span className="font-mono text-[10.5px] rounded-full px-1.5" style={{ background: "var(--brass)", color: "var(--ink-0)" }}>
                  {activeFilterCount}
                </span>
              )}
            </button>
          ) : (
            <>
              <span className="mx-1 h-5 w-px shrink-0" style={{ background: "rgba(236,232,245,0.12)" }} />
              {filterDefs.map((f) => (
                <FilterChip
                  key={f.key}
                  label={f.label}
                  options={f.options}
                  selected={filters[f.key]}
                  onToggle={(v) => toggle(f.key, v)}
                  onClear={() => clearKey(f.key)}
                  testId={f.key}
                />
              ))}
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => setFilters(emptyFilters())}
                  className="inline-flex h-9 items-center gap-1 px-2 text-[12.5px] shrink-0"
                  style={{ color: "var(--bone-2)" }}
                  data-testid="button-clear-filters"
                >
                  <X className="h-3.5 w-3.5" /> Clear · {matchCount} of {ordered.length}
                </button>
              )}
            </>
          )}

          <div className="ml-auto flex items-center gap-2 shrink-0 pl-2">
            <span className="eyebrow hidden md:inline" style={{ fontSize: 10 }}>Size by</span>
            <div className="chrome flex rounded-full p-0.5" role="radiogroup" aria-label="Size cards by">
              {SIZE_METRICS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  role="radio"
                  aria-checked={sizeMetric === m.key}
                  title={m.hint}
                  onClick={() => setSizeMetric(m.key)}
                  className="relative h-8 px-3 rounded-full text-[12.5px] transition-colors"
                  style={{ color: sizeMetric === m.key ? "var(--ink-0)" : "var(--bone-2)" }}
                  data-testid={`radio-size-${m.key}`}
                >
                  {sizeMetric === m.key && (
                    <motion.span layoutId="size-pill" className="absolute inset-0 rounded-full" style={{ background: "var(--bone)" }} transition={{ duration: reducedMotion ? 0 : 0.35, ease: [0.16, 1, 0.3, 1] }} />
                  )}
                  <span className="relative">{m.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile filter drawer */}
        <AnimatePresence>
          {isMobile && filtersOpenMobile && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="pointer-events-auto flex flex-wrap gap-2 px-4 pt-2"
            >
              {filterDefs.map((f) => (
                <FilterChip key={f.key} label={f.label} options={f.options} selected={filters[f.key]} onToggle={(v) => toggle(f.key, v)} onClear={() => clearKey(f.key)} testId={`m-${f.key}`} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ---------------- Index panel ---------------- */}
      <AnimatePresence>
        {indexOpen && (
          <motion.nav
            id="vault-index"
            tabIndex={-1}
            aria-label="Project index"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="chrome absolute z-20 rounded-2xl overflow-hidden flex flex-col"
            style={
              isMobile
                ? { left: 12, right: 12, top: 112, maxHeight: "55vh" }
                : { left: 16, top: 128, width: 256, maxHeight: "calc(100% - 200px)" }
            }
            data-testid="panel-index"
          >
            <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b hairline">
              <span className="eyebrow" style={{ fontSize: 10 }}>Index · {ordered.length} projects</span>
              <span className="font-mono text-[10px]" style={{ color: "var(--bone-3)" }}>EVID.</span>
            </div>
            <ol className="overflow-y-auto scroll-quiet py-1">
              {ordered.map((p) => {
                const vl = verifiedLevel(p);
                const on = selectedId === p.id;
                const dim = !matches(p);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(p.id);
                        if (isMobile) setIndexOpen(false);
                      }}
                      className="group w-full grid grid-cols-[22px_1fr_auto] items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
                      style={{ opacity: dim ? 0.35 : 1, background: on ? "rgba(196,161,255,0.08)" : undefined }}
                      aria-current={on ? "true" : undefined}
                      data-testid={`link-index-${p.id}`}
                    >
                      <span className="font-mono text-[11px]" style={{ color: on ? "var(--brass)" : "var(--bone-3)" }}>
                        {String(p.index).padStart(2, "0")}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13.5px] leading-snug truncate" style={{ color: "var(--bone)" }}>{p.name}</span>
                        <span className="flex items-center gap-1.5 mt-0.5 text-[11.5px]" style={{ color: "var(--bone-3)" }}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: PATHS[p.recommendation.path].color }} />
                          {PATHS[p.recommendation.path].label}
                        </span>
                      </span>
                      <span className="font-mono text-[11px]" style={{ color: vl >= 3 ? "var(--brass)" : "var(--bone-2)" }}>L{vl}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </motion.nav>
        )}
      </AnimatePresence>

      {/* ---------------- Legend + footer ---------------- */}
      <div
        className={`absolute z-20 items-center gap-1 overflow-x-auto no-scrollbar ${isMobile ? "hidden" : "flex"}`}
        style={{ left: 16, right: isMobile ? 16 : insets.right + 200, transition: "right 520ms cubic-bezier(0.16,1,0.3,1)", bottom: isMobile ? 70 : 16 }}
      >
        <div className="chrome flex items-center gap-0.5 rounded-full p-1 shrink-0" role="group" aria-label="Show connection types">
          {(Object.keys(CONNECTION_META) as ConnectionType[]).map((t) => {
            const m = CONNECTION_META[t];
            const off = hiddenLinks.has(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={!off}
                onClick={() =>
                  setHiddenLinks((s) => {
                    const n = new Set(s);
                    n.has(t) ? n.delete(t) : n.add(t);
                    return n;
                  })
                }
                title={m.label}
                className="flex items-center gap-2 h-8 rounded-full px-3 text-[12px] whitespace-nowrap transition-opacity hover:bg-white/5"
                style={{ color: off ? "var(--bone-3)" : "var(--bone-2)", opacity: off ? 0.5 : 1 }}
                data-testid={`toggle-link-${t}`}
              >
                <svg width="18" height="6" aria-hidden>
                  <line x1="1" y1="3" x2="17" y2="3" stroke={m.color} strokeWidth="1.6" strokeDasharray={m.dash || undefined} strokeLinecap="round" />
                </svg>
                {!(selected || isMobile) && m.label}
                {(selected || isMobile) && <span className="sr-only">{m.label}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {!isMobile && (
        <div
          className="pointer-events-none absolute z-10 font-mono text-[10.5px] tracking-[0.14em] uppercase text-right"
          style={{ right: insets.right + 290, bottom: 28, color: "var(--bone-3)", transition: "right 520ms cubic-bezier(0.16,1,0.3,1)", display: width - insets.right > 1250 ? "block" : "none" }}
        >
          {ordered.length} projects · {reusableAssets.filter((a) => a.onMap).length} shared assets · sample data
        </div>
      )}

      {/* Mobile quick strip */}
      {isMobile && !selected && (
        <div className="absolute inset-x-0 bottom-0 z-20 flex gap-2 overflow-x-auto no-scrollbar px-3 pb-3 pt-2" style={{ background: "linear-gradient(0deg, rgba(6,4,14,0.95), transparent)" }}>
          {ordered.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedId(p.id)}
              className="chrome shrink-0 flex items-center gap-2 rounded-full pl-1 pr-3.5 h-11"
              style={{ opacity: matches(p) ? 1 : 0.4 }}
              data-testid={`chip-mobile-${p.id}`}
            >
              <img src={p.orb} alt="" className="h-9 w-9 object-contain" style={{ transform: `scale(${p.orbScale ?? 1})` }} />
              <span className="text-[13px] whitespace-nowrap" style={{ color: "var(--bone)" }}>{p.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* ---------------- Dossier ---------------- */}
      <AnimatePresence mode="wait">
        {selected && (
          <Dossier
            key="dossier"
            project={selected}
            allProjects={ordered}
            assets={reusableAssets}
            onClose={() => setSelectedId(null)}
            onNavigate={navigate}
            onSelect={setSelectedId}
            isMobile={isMobile}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
