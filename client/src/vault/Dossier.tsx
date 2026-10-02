import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Copy,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  FileText,
  Folder,
  GitBranch,
  HardDrive,
  ImagePlus,
  Link2,
  MessageSquare,
  PenTool,
  ShieldCheck,
  X,
} from "lucide-react";
import type { Project, ReusableAsset, SourceKind, Verification } from "./types";
import {
  BASIS_LABEL,
  EVIDENCE_LEVELS,
  KIND_LABEL,
  PATHS,
  RATING_META,
  REUSABLE_LABEL,
  STRESS_LABEL,
  claimedLevel,
  evidenceGate,
  formatDate,
  verifiedLevel,
} from "./logic";

interface Props {
  project: Project;
  allProjects: Project[];
  assets: ReusableAsset[];
  onClose: () => void;
  onNavigate: (dir: -1 | 1) => void;
  onSelect: (id: string) => void;
  isMobile: boolean;
}

const SECTIONS = [
  { id: "move", label: "Next move" },
  { id: "overview", label: "Overview" },
  { id: "evidence", label: "Evidence" },
  { id: "stress", label: "Stress test" },
  { id: "assets", label: "Assets & files" },
  { id: "log", label: "Log" },
];

const SOURCE_ICON: Record<SourceKind, typeof Folder> = {
  folder: Folder,
  git: GitBranch,
  doc: FileText,
  chat: MessageSquare,
  design: PenTool,
  url: Link2,
  drive: HardDrive,
};

const VERIFY_META: Record<Verification, { title: string; sub: string; color: string }> = {
  verified: { title: "Verified", sub: "Backed by a file or record", color: "var(--ok)" },
  claimed: { title: "Claimed", sub: "Said, not yet documented", color: "var(--brass)" },
  assumed: { title: "Assumptions", sub: "Beliefs to test — not evidence", color: "var(--bone-3)" },
};

function CopyPath({ value, testId }: { value: string; testId: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          window.setTimeout(() => setDone(false), 1400);
        } catch {
          /* clipboard blocked — no-op */
        }
      }}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-white/5"
      aria-label={done ? "Location copied" : `Copy location ${value}`}
      title={done ? "Copied" : "Copy location"}
      data-testid={testId}
    >
      {done ? <Check className="h-3.5 w-3.5" style={{ color: "var(--ok)" }} /> : <Copy className="h-3.5 w-3.5" style={{ color: "var(--bone-3)" }} />}
    </button>
  );
}

function SectionHead({ num, title, aside }: { num: string; title: string; aside?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b hairline pb-3 mb-5">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[11px]" style={{ color: "var(--brass)" }}>
          {num}
        </span>
        <h3 className="font-display text-[26px] leading-none" style={{ color: "var(--bone)" }}>
          {title}
        </h3>
      </div>
      {aside}
    </div>
  );
}

export function Dossier({ project: p, allProjects, assets, onClose, onNavigate, onSelect, isMobile }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState("move");
  const path = PATHS[p.recommendation.path];
  const vl = verifiedLevel(p);
  const cl = claimedLevel(p);
  const gate = evidenceGate(p);
  const projectAssets = assets.filter((a) => p.reusableAssetIds.includes(a.id));
  const nameOf = (id: string) => allProjects.find((pp) => pp.id === id)?.name ?? id;

  // reset scroll on project change
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    setActiveSection("move");
  }, [p.id]);

  // track section in view
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActiveSection(vis[0].target.id.replace("sec-", ""));
      },
      { root, rootMargin: "-20% 0px -65% 0px" },
    );
    SECTIONS.forEach((s) => {
      const el = root.querySelector(`#sec-${s.id}`);
      if (el) obs.observe(el);
    });
    const onScroll = () => {
      if (root.scrollTop + root.clientHeight >= root.scrollHeight - 8) setActiveSection("log");
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      obs.disconnect();
      root.removeEventListener("scroll", onScroll);
    };
  }, [p.id]);

  const jump = (id: string) => {
    const root = scrollRef.current;
    const el = root?.querySelector(`#sec-${id}`) as HTMLElement | null;
    if (root && el) root.scrollTo({ top: el.offsetTop - 56, behavior: "smooth" });
  };

  const counts = { strong: 0, partial: 0, weak: 0, unknown: 0 };
  p.stress.forEach((s) => counts[s.rating]++);
  const evidenceBased = p.stress.filter((s) => s.basis === "evidence").length;

  return (
    <motion.aside
      key="dossier"
      initial={{ opacity: 0, x: isMobile ? 0 : 48, y: isMobile ? 40 : 0 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: isMobile ? 0 : 48, y: isMobile ? 40 : 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={
        isMobile
          ? "fixed inset-0 z-50 flex flex-col"
          : "fixed z-40 flex flex-col rounded-[18px] overflow-hidden"
      }
      style={{
        ...(isMobile ? {} : { top: 76, right: 14, bottom: 14, width: "min(660px, 46vw)" }),
        background: "rgba(10, 7, 20, 0.94)",
        border: isMobile ? "none" : "1px solid rgba(236,232,245,0.10)",
        backdropFilter: "blur(20px)",
        boxShadow: "0 40px 120px -20px rgba(0,0,0,0.9)",
      }}
      aria-label={`Dossier: ${p.name}`}
      data-testid="panel-dossier"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 h-14 border-b hairline shrink-0">
        <div className="flex items-center gap-3">
          <span className="eyebrow">Dossier Nº {String(p.index).padStart(2, "0")}</span>
          {p.sample && (
            <span className="font-mono text-[10.5px] tracking-wider rounded-full px-2 py-0.5" style={{ color: "var(--bone-3)", border: "1px dashed rgba(236,232,245,0.2)" }}>
              SAMPLE
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onNavigate(-1)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/5" aria-label="Previous project" data-testid="button-prev-project">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => onNavigate(1)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/5" aria-label="Next project" data-testid="button-next-project">
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="mx-1 h-5 w-px" style={{ background: "rgba(236,232,245,0.1)" }} />
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/5" aria-label="Close dossier (Esc)" data-testid="button-close-dossier">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="relative flex-1 overflow-y-auto scroll-quiet">
        {/* Hero */}
        <header className="relative">
          <div className="relative overflow-hidden" style={{ aspectRatio: "16 / 8" }}>
            <motion.img
              key={p.cover}
              src={p.cover}
              alt={p.media[0]?.caption ?? p.name}
              initial={{ scale: 1.08, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(10,7,20,0.1) 0%, rgba(10,7,20,0.2) 45%, rgba(10,7,20,1) 100%)" }} />
          </div>
          <div className="relative px-6 -mt-24 pb-2">
            <img
              src={p.orb}
              alt=""
              aria-hidden
              className="absolute right-5 -top-10 w-24 h-24 object-contain pointer-events-none"
              style={{ transform: `scale(${p.orbScale ?? 1})`, filter: "drop-shadow(0 0 24px rgba(196,161,255,0.45))" }}
            />
            <div className="eyebrow">
              {p.category}
              {p.area !== p.category ? ` · ${p.area}` : ""}
            </div>
            <h2 className="font-display mt-2 leading-[0.95] pr-24" style={{ fontSize: "clamp(34px, 3.4vw, 48px)", color: "var(--bone)" }} data-testid="text-dossier-name">
              {p.name}
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed max-w-[52ch]" style={{ color: "var(--bone-2)" }}>
              {p.oneLiner}
            </p>

            <dl className="mt-5 grid grid-cols-3 gap-px rounded-xl overflow-hidden" style={{ background: "rgba(236,232,245,0.08)" }}>
              {[
                { k: "Status", v: p.status },
                { k: "Recommended", v: path.label, dot: path.color },
                { k: "Evidence", v: `L${vl} · ${EVIDENCE_LEVELS[vl].name}` },
              ].map((m) => (
                <div key={m.k} className="px-3.5 py-3" style={{ background: "rgba(17,12,32,0.96)" }}>
                  <dt className="eyebrow" style={{ fontSize: 10 }}>
                    {m.k}
                  </dt>
                  <dd className="mt-1 flex items-start gap-1.5 text-[14px] font-medium" style={{ color: "var(--bone)" }}>
                    {m.dot && <span className="h-2 w-2 rounded-full shrink-0 mt-[7px]" style={{ background: m.dot }} />}
                    <span className="leading-snug">{m.v}</span>
                  </dd>
                </div>
              ))}
            </dl>

            {/* Media strip */}
            <div className="mt-4 flex gap-2 overflow-x-auto no-scrollbar">
              {p.media.map((m) => (
                <figure key={m.id} className="relative shrink-0 w-28 h-[70px] rounded-lg overflow-hidden border hairline-strong">
                  <img src={m.src} alt={m.caption} className="h-full w-full object-cover" loading="lazy" />
                  <figcaption className="absolute inset-x-0 bottom-0 px-1.5 py-0.5 text-[10px] font-mono truncate" style={{ background: "rgba(6,4,14,0.75)", color: "var(--bone-2)" }}>
                    {m.caption}
                  </figcaption>
                </figure>
              ))}
              <button
                type="button"
                disabled
                title="Linking screenshots arrives with the Intake flow"
                className="shrink-0 w-28 h-[70px] rounded-lg grid place-items-center text-[11px] gap-1 cursor-not-allowed"
                style={{ border: "1px dashed rgba(236,232,245,0.18)", color: "var(--bone-3)" }}
                data-testid="button-add-media"
              >
                <span className="flex flex-col items-center gap-1">
                  <ImagePlus className="h-4 w-4" />
                  Link screenshot
                </span>
              </button>
            </div>
          </div>
        </header>

        {/* Section nav */}
        <nav className="sticky top-0 z-10 mt-4 px-6 border-y hairline" style={{ background: "rgba(10,7,20,0.92)", backdropFilter: "blur(12px)" }} aria-label="Dossier sections">
          <div className="flex gap-5 overflow-x-auto no-scrollbar">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => jump(s.id)}
                className="relative py-3.5 text-[13px] whitespace-nowrap transition-colors"
                style={{ color: activeSection === s.id ? "var(--bone)" : "var(--bone-3)" }}
                data-testid={`tab-section-${s.id}`}
              >
                {s.label}
                {activeSection === s.id && (
                  <motion.span layoutId="sec-underline" className="absolute left-0 right-0 -bottom-px h-px" style={{ background: "var(--brass)" }} />
                )}
              </button>
            ))}
          </div>
        </nav>

        <div className="px-6 pb-16">
          {/* ---------------- NEXT MOVE + RECOMMENDATION ---------------- */}
          <section id="sec-move" className="pt-7">
            <div
              className="relative rounded-2xl p-5 overflow-hidden"
              style={{
                background: "linear-gradient(160deg, rgba(196,161,255,0.14), rgba(196,161,255,0.03) 60%)",
                border: "1px solid rgba(196,161,255,0.4)",
              }}
              data-testid="card-next-move"
            >
              <div className="flex items-center justify-between">
                <span className="eyebrow" style={{ color: "var(--brass)" }}>
                  The one next move
                </span>
                <span className="font-mono text-[11px] rounded-full px-2 py-0.5" style={{ color: "var(--brass)", border: "1px solid rgba(196,161,255,0.35)" }}>
                  {p.nextMove.timebox}
                </span>
              </div>
              <p className="font-display mt-3 text-[25px] leading-[1.12]" style={{ color: "var(--bone)" }} data-testid="text-next-move">
                {p.nextMove.action}
              </p>
              <div className="mt-4 grid sm:grid-cols-2 gap-4 text-[13.5px] leading-relaxed">
                <div>
                  <div className="eyebrow mb-1" style={{ fontSize: 10 }}>Why this, now</div>
                  <p style={{ color: "var(--bone-2)" }}>{p.nextMove.why}</p>
                </div>
                <div>
                  <div className="eyebrow mb-1" style={{ fontSize: 10 }}>Done when</div>
                  <p style={{ color: "var(--bone-2)" }}>{p.nextMove.doneWhen}</p>
                </div>
              </div>
            </div>

            {/* Recommendation */}
            <div className="mt-6 rounded-2xl border hairline p-5" style={{ background: "rgba(22,15,40,0.6)" }} data-testid="card-recommendation">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="eyebrow">Recommended path</div>
                  <div className="mt-1.5 flex items-center gap-2.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: path.color }} />
                    <span className="font-display text-[30px] leading-none" style={{ color: "var(--bone)" }}>
                      {path.label}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="eyebrow">Confidence</div>
                  <div className="mt-2 flex items-center justify-end gap-1" aria-label={`Confidence ${p.recommendation.confidence}`}>
                    {["low", "medium", "high"].map((c, i) => (
                      <span
                        key={c}
                        className="h-1.5 w-5 rounded-full"
                        style={{
                          background:
                            i <= ["low", "medium", "high"].indexOf(p.recommendation.confidence) ? "var(--bone)" : "rgba(236,232,245,0.12)",
                        }}
                      />
                    ))}
                  </div>
                  <div className="mt-1 font-mono text-[11px] capitalize" style={{ color: "var(--bone-2)" }}>
                    {p.recommendation.confidence}
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <div className="eyebrow mb-2" style={{ fontSize: 10 }}>Why this path</div>
                <ol className="space-y-2">
                  {p.recommendation.reasons.map((r, i) => (
                    <li key={i} className="flex gap-3 text-[14px] leading-relaxed" style={{ color: "var(--bone)" }}>
                      <span className="font-mono text-[11px] pt-[3px]" style={{ color: "var(--bone-3)" }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {r}
                    </li>
                  ))}
                </ol>
              </div>

              <div
                className="mt-5 flex gap-3 rounded-xl px-3.5 py-3 text-[13px] leading-relaxed"
                style={{
                  background: gate.passes ? "rgba(126,224,184,0.07)" : "rgba(255,159,122,0.08)",
                  border: `1px solid ${gate.passes ? "rgba(126,224,184,0.25)" : "rgba(255,159,122,0.35)"}`,
                }}
                data-testid="status-evidence-gate"
              >
                {gate.passes ? (
                  <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "var(--ok)" }} />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "var(--warn)" }} />
                )}
                <div>
                  <div className="font-medium" style={{ color: "var(--bone)" }}>
                    Evidence gate {gate.exempt ? "· relaxed" : gate.passes ? "· passes" : "· not met"}
                  </div>
                  <div style={{ color: "var(--bone-2)" }}>{gate.message}</div>
                </div>
              </div>

              <div className="mt-4">
                <div className="eyebrow mb-2" style={{ fontSize: 10 }}>Paths the current evidence supports</div>
                <div className="flex flex-wrap gap-1.5" data-testid="list-path-gates">
                  {(Object.keys(PATHS) as (keyof typeof PATHS)[])
                    .filter((k) => k !== "archive")
                    .map((k) => {
                      const def = PATHS[k];
                      const open = vl >= def.gate || (k === "build" && p.internalUse);
                      const isRec = k === p.recommendation.path;
                      return (
                        <span
                          key={k}
                          title={def.gateText}
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px]"
                          style={{
                            color: open ? "var(--bone)" : "var(--bone-3)",
                            border: `1px ${open ? "solid" : "dashed"} ${isRec ? "var(--brass)" : open ? "rgba(236,232,245,0.18)" : "rgba(236,232,245,0.12)"}`,
                            background: isRec ? "rgba(196,161,255,0.1)" : "transparent",
                          }}
                        >
                          {open ? <Check className="h-3 w-3" style={{ color: def.color }} /> : <span className="font-mono text-[10px]">L{def.gate}</span>}
                          {def.short}
                        </span>
                      );
                    })}
                </div>
              </div>

              <div className="mt-5">
                <div className="eyebrow mb-2" style={{ fontSize: 10 }}>What would change this decision</div>
                <ul className="space-y-2">
                  {p.recommendation.wouldChange.map((w, i) => (
                    <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed" style={{ color: "var(--bone-2)" }}>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 mt-[5px]" style={{ color: "var(--brass)" }} />
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* ---------------- OVERVIEW ---------------- */}
          <section id="sec-overview" className="pt-12">
            <SectionHead num="01" title="What it is" />
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-5">
              {[
                { k: "What it is", v: p.whatItIs },
                { k: "Who it's for", v: p.audience },
                { k: "Problem", v: p.problem },
                { k: "Could become", v: p.couldBecome },
              ].map((d) => (
                <div key={d.k}>
                  <dt className="eyebrow mb-1.5" style={{ fontSize: 10 }}>{d.k}</dt>
                  <dd className="text-[14px] leading-relaxed" style={{ color: "var(--bone)" }}>{d.v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-6 rounded-xl px-4 py-3 text-[13.5px]" style={{ background: "rgba(236,232,245,0.04)", border: "1px solid rgba(236,232,245,0.08)" }}>
              <span className="eyebrow mr-2" style={{ fontSize: 10 }}>Decision needed</span>
              <span style={{ color: "var(--bone)" }}>{p.decisionNeeded}</span>
            </div>

            <div className="mt-7">
              <div className="eyebrow mb-3" style={{ fontSize: 10 }}>What exists now</div>
              <ul className="divide-y" style={{ borderColor: "rgba(236,232,245,0.06)" }}>
                {p.whatExists.map((w) => (
                  <li key={w} className="flex items-start gap-3 py-2.5 text-[14px] border-t hairline first:border-t-0" style={{ color: "var(--bone)" }}>
                    <Check className="h-3.5 w-3.5 mt-1 shrink-0" style={{ color: "var(--bone-3)" }} />
                    {w}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8">
              <div className="eyebrow mb-3" style={{ fontSize: 10 }}>Opportunity assessment</div>
              <p className="font-display text-[21px] leading-snug" style={{ color: "var(--bone)" }}>
                {p.opportunity.summary}
              </p>
              <dl className="mt-4 grid sm:grid-cols-3 gap-px rounded-xl overflow-hidden" style={{ background: "rgba(236,232,245,0.07)" }}>
                {[
                  { k: "Business model", v: p.opportunity.model },
                  { k: "Distribution", v: p.opportunity.distribution },
                  { k: "Differentiation", v: p.opportunity.differentiation },
                ].map((d) => (
                  <div key={d.k} className="p-3.5" style={{ background: "rgba(15,10,30,0.98)" }}>
                    <dt className="eyebrow mb-1.5" style={{ fontSize: 10 }}>{d.k}</dt>
                    <dd className="text-[13px] leading-relaxed" style={{ color: "var(--bone-2)" }}>{d.v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          {/* ---------------- EVIDENCE ---------------- */}
          <section id="sec-evidence" className="pt-12">
            <SectionHead
              num="02"
              title="Evidence ledger"
              aside={
                <span className="font-mono text-[11px]" style={{ color: "var(--bone-3)" }}>
                  {p.evidence.filter((e) => e.verification === "verified").length} verified / {p.evidence.length}
                </span>
              }
            />

            {/* Ladder */}
            <div className="rounded-2xl border hairline p-4" style={{ background: "rgba(22,15,40,0.5)" }} data-testid="chart-evidence-ladder">
              <div className="grid grid-cols-6 gap-1.5">
                {EVIDENCE_LEVELS.map((lv) => {
                  const verified = lv.level <= vl;
                  const claimed = !verified && lv.level <= cl;
                  return (
                    <div key={lv.level} className="flex flex-col gap-2" title={lv.test}>
                      <div
                        className="h-2 rounded-sm"
                        style={{
                          background: verified
                            ? "var(--brass)"
                            : claimed
                              ? "repeating-linear-gradient(135deg, rgba(196,161,255,0.5) 0 3px, transparent 3px 6px)"
                              : "rgba(236,232,245,0.08)",
                          border: claimed ? "1px solid rgba(196,161,255,0.5)" : "none",
                        }}
                      />
                      <div>
                        <div className="font-mono text-[10px]" style={{ color: verified ? "var(--brass)" : "var(--bone-3)" }}>
                          L{lv.level}
                        </div>
                        <div className="text-[11.5px] leading-tight" style={{ color: verified || claimed ? "var(--bone)" : "var(--bone-3)" }}>
                          {lv.name}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px]" style={{ color: "var(--bone-2)" }}>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-4 rounded-sm" style={{ background: "var(--brass)" }} />
                  Verified supports <b className="font-medium" style={{ color: "var(--bone)" }}>L{vl} {EVIDENCE_LEVELS[vl].name}</b>
                </span>
                {cl > vl && (
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-4 rounded-sm" style={{ background: "repeating-linear-gradient(135deg, rgba(196,161,255,0.6) 0 3px, transparent 3px 6px)", border: "1px solid rgba(196,161,255,0.5)" }} />
                    Claims would reach <b className="font-medium" style={{ color: "var(--bone)" }}>L{cl}</b> if documented
                  </span>
                )}
              </div>
              <p className="mt-3 text-[12.5px] leading-relaxed" style={{ color: "var(--bone-3)" }}>
                Next rung — L{Math.min(5, vl + 1)} {EVIDENCE_LEVELS[Math.min(5, vl + 1)].name}: {EVIDENCE_LEVELS[Math.min(5, vl + 1)].test.toLowerCase()}.
              </p>
            </div>

            <div className="mt-6 space-y-6">
              {(["verified", "claimed", "assumed"] as Verification[]).map((v) => {
                const items = p.evidence.filter((e) => e.verification === v);
                if (!items.length) return null;
                const meta = VERIFY_META[v];
                return (
                  <div key={v}>
                    <div className="flex items-baseline gap-2.5 mb-2">
                      <span className="h-1.5 w-1.5 rounded-full translate-y-[-2px]" style={{ background: meta.color }} />
                      <span className="text-[14px] font-medium" style={{ color: "var(--bone)" }}>{meta.title}</span>
                      <span className="text-[12px]" style={{ color: "var(--bone-3)" }}>{meta.sub}</span>
                    </div>
                    <ul className="space-y-2">
                      {items.map((e) => {
                        const src = p.sources.find((s) => s.id === e.sourceId);
                        return (
                          <li
                            key={e.id}
                            className="rounded-xl px-4 py-3"
                            style={{
                              background: v === "verified" ? "rgba(236,232,245,0.04)" : "transparent",
                              border: v === "verified" ? "1px solid rgba(236,232,245,0.08)" : "1px dashed rgba(236,232,245,0.12)",
                            }}
                            data-testid={`row-evidence-${e.id}`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-[10.5px] uppercase tracking-wider" style={{ color: meta.color }}>
                                {KIND_LABEL[e.kind]}
                              </span>
                              <span className="font-mono text-[10.5px]" style={{ color: "var(--bone-3)" }}>· {formatDate(e.date)}</span>
                            </div>
                            <p className="text-[14px] leading-relaxed" style={{ color: v === "assumed" ? "var(--bone-2)" : "var(--bone)", fontStyle: v === "assumed" ? "italic" : "normal" }}>
                              {e.statement}
                            </p>
                            {src && (
                              <div className="mt-1.5 flex items-center gap-1.5 text-[12px] font-mono" style={{ color: "var(--bone-3)" }}>
                                <Link2 className="h-3 w-3" /> {src.label}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ---------------- STRESS TEST ---------------- */}
          <section id="sec-stress" className="pt-12">
            <SectionHead
              num="03"
              title="Stress test"
              aside={
                <span className="font-mono text-[11px]" style={{ color: "var(--bone-3)" }}>
                  {evidenceBased} of 10 rest on evidence
                </span>
              }
            />
            <div className="flex h-2 rounded-full overflow-hidden gap-[2px]" aria-hidden>
              {(["strong", "partial", "weak", "unknown"] as const).map((r) =>
                counts[r] ? <span key={r} style={{ flex: counts[r], background: RATING_META[r].color, opacity: r === "unknown" ? 0.6 : 0.9 }} /> : null,
              )}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px]" style={{ color: "var(--bone-2)" }}>
              {(["strong", "partial", "weak", "unknown"] as const).map((r) => (
                <span key={r} className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: RATING_META[r].color }} />
                  {counts[r]} {RATING_META[r].label.toLowerCase()}
                </span>
              ))}
            </div>

            <ul className="mt-5">
              {p.stress.map((s) => {
                const r = RATING_META[s.rating];
                return (
                  <li key={s.key} className="grid grid-cols-[1fr_auto] sm:grid-cols-[170px_1fr] gap-x-4 gap-y-1.5 py-3.5 border-t hairline" data-testid={`row-stress-${s.key}`}>
                    <div className="text-[13.5px] font-medium" style={{ color: "var(--bone)" }}>
                      {STRESS_LABEL[s.key]}
                    </div>
                    <div className="flex items-center gap-3 sm:justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="flex gap-[3px] w-[66px]" aria-hidden>
                          {[1, 2, 3].map((i) => (
                            <span key={i} className="seg flex-1" style={{ background: i <= r.fill ? r.color : undefined }} />
                          ))}
                        </span>
                        <span className="text-[12.5px] w-14" style={{ color: r.color === "var(--ink-4)" ? "var(--bone-3)" : r.color }}>
                          {r.label}
                        </span>
                      </div>
                      <span
                        className="hidden sm:inline font-mono text-[10.5px] uppercase tracking-wider rounded px-1.5 py-0.5"
                        style={{
                          color: s.basis === "evidence" ? "var(--ok)" : s.basis === "judgment" ? "var(--bone-2)" : "var(--bone-3)",
                          border: `1px ${s.basis === "evidence" ? "solid" : "dashed"} ${s.basis === "evidence" ? "rgba(126,224,184,0.35)" : "rgba(236,232,245,0.15)"}`,
                        }}
                      >
                        {BASIS_LABEL[s.basis]}
                      </span>
                    </div>
                    <div className="hidden sm:block" />
                    <p className="col-span-2 sm:col-span-1 text-[13px] leading-relaxed" style={{ color: "var(--bone-2)" }}>
                      {s.note}
                    </p>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-[12.5px] leading-relaxed" style={{ color: "var(--bone-3)" }}>
              Ratings are working judgments, not predictions. There is no overall score — a project with strong ratings built on judgment alone is still unproven.
            </p>

            {/* Risks + missing */}
            <div className="mt-8 grid sm:grid-cols-2 gap-5">
              <div>
                <div className="eyebrow mb-3" style={{ fontSize: 10 }}>Risks</div>
                <ul className="space-y-2.5">
                  {p.risks.map((r) => (
                    <li key={r.text} className="flex gap-2.5 text-[13.5px] leading-relaxed" style={{ color: "var(--bone)" }}>
                      <span
                        className="mt-[3px] font-mono text-[9.5px] uppercase tracking-wider rounded px-1 py-px h-fit shrink-0"
                        style={{
                          color: r.severity === "high" ? "var(--danger)" : r.severity === "medium" ? "var(--brass)" : "var(--bone-3)",
                          border: "1px solid currentColor",
                          opacity: 0.9,
                        }}
                      >
                        {r.severity === "medium" ? "med" : r.severity}
                      </span>
                      {r.text}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="eyebrow mb-3" style={{ fontSize: 10 }}>Missing information</div>
                <ul className="space-y-2.5">
                  {p.missing.map((m) => (
                    <li key={m} className="flex gap-2.5 text-[13.5px] leading-relaxed" style={{ color: "var(--bone-2)" }}>
                      <CircleDashed className="h-3.5 w-3.5 mt-[4px] shrink-0" style={{ color: "var(--bone-3)" }} />
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* ---------------- ASSETS & FILES ---------------- */}
          <section id="sec-assets" className="pt-12">
            <SectionHead num="04" title="Reusable assets" />
            <ul className="grid sm:grid-cols-2 gap-2.5">
              {projectAssets.map((a) => {
                const others = a.projectIds.filter((id) => id !== p.id);
                return (
                  <li key={a.id} className="rounded-xl p-3.5 border hairline" style={{ background: "rgba(22,15,40,0.55)" }} data-testid={`card-asset-${a.id}`}>
                    <div className="font-mono text-[10.5px] uppercase tracking-wider" style={{ color: "var(--brass)" }}>
                      {REUSABLE_LABEL[a.type]}
                    </div>
                    <div className="mt-1 text-[14.5px] font-medium" style={{ color: "var(--bone)" }}>{a.name}</div>
                    <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: "var(--bone-2)" }}>{a.note}</p>
                    {others.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        <span className="text-[11.5px]" style={{ color: "var(--bone-3)" }}>Also in</span>
                        {others.map((id) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => onSelect(id)}
                            className="text-[11.5px] underline decoration-dotted underline-offset-2 hover:decoration-solid"
                            style={{ color: "var(--bone)" }}
                            data-testid={`link-asset-project-${a.id}-${id}`}
                          >
                            {nameOf(id)}
                          </button>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="mt-10">
              <SectionHead num="05" title="Original files" />
              <ul className="rounded-xl border hairline overflow-hidden">
                {p.sources.map((s, i) => {
                  const Icon = SOURCE_ICON[s.kind];
                  return (
                    <li
                      key={s.id}
                      className={`flex items-center gap-3.5 px-4 py-3 ${i ? "border-t hairline" : ""}`}
                      style={{ background: "rgba(17,12,32,0.6)" }}
                      data-testid={`row-source-${s.id}`}
                    >
                      <Icon className="h-4 w-4 shrink-0" style={{ color: "var(--bone-2)" }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[13.5px] font-medium truncate" style={{ color: "var(--bone)" }}>{s.label}</span>
                          {s.isSourceOfTruth && (
                            <span className="shrink-0 font-mono text-[9.5px] uppercase tracking-wider rounded px-1 py-px" style={{ color: "var(--ok)", border: "1px solid rgba(126,224,184,0.35)" }}>
                              Original
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-[11.5px] truncate mt-0.5" style={{ color: "var(--bone-3)" }}>{s.location}</div>
                      </div>
                      <div className="hidden sm:block text-right shrink-0">
                        <div className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--bone-3)" }}>Checked</div>
                        <div className="font-mono text-[11px]" style={{ color: "var(--bone-2)" }}>{formatDate(s.lastVerified)}</div>
                      </div>
                      <CopyPath value={s.location} testId={`button-copy-${s.id}`} />
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-[12.5px] leading-relaxed" style={{ color: "var(--bone-3)" }}>
                Originals stay where they live. The Vault keeps links, summaries and preview copies — not the only copy.
              </p>
            </div>
          </section>

          {/* ---------------- LOG ---------------- */}
          <section id="sec-log" className="pt-12">
            <SectionHead num="06" title="Decision log" />
            <ol className="relative ml-1.5">
              <span className="absolute left-0 top-1 bottom-1 w-px" style={{ background: "rgba(236,232,245,0.1)" }} aria-hidden />
              {[...p.log].reverse().map((l, i) => (
                <li key={i} className="relative pl-6 pb-5 last:pb-0">
                  <span
                    className="absolute -left-[4px] top-[6px] h-[9px] w-[9px] rounded-full"
                    style={{
                      background: l.type === "decision" ? "var(--brass)" : l.type === "evidence" ? "var(--ok)" : "var(--ink-0)",
                      border: `1.5px solid ${l.type === "decision" ? "var(--brass)" : l.type === "evidence" ? "var(--ok)" : "var(--bone-3)"}`,
                    }}
                  />
                  <div className="flex items-baseline gap-2.5">
                    <span className="font-mono text-[11px]" style={{ color: "var(--bone-3)" }}>{formatDate(l.date)}</span>
                    <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: l.type === "decision" ? "var(--brass)" : l.type === "evidence" ? "var(--ok)" : "var(--bone-3)" }}>
                      {l.type}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[14px] leading-relaxed" style={{ color: "var(--bone)" }}>{l.text}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </motion.aside>
  );
}
