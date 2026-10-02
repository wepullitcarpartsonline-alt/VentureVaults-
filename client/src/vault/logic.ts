import type {
  Basis,
  ConnectionType,
  EvidenceItem,
  EvidenceKind,
  EvidenceLevel,
  PathKey,
  Project,
  Rating,
  ReusableType,
  StressKey,
} from "./types";

/* ------------------------------------------------------------------ */
/* Evidence ladder                                                     */
/* ------------------------------------------------------------------ */

export const EVIDENCE_LEVELS: { level: EvidenceLevel; name: string; test: string }[] = [
  { level: 0, name: "Idea", test: "Only a concept or conversation" },
  { level: 1, name: "Artifact", test: "A prototype, mockup, or document exists" },
  { level: 2, name: "Signal", test: "Target people gave feedback or showed interest" },
  { level: 3, name: "Usage", test: "Real people used it in a test or pilot" },
  { level: 4, name: "Commitment", test: "Money paid, contract, LOI, or partner signed" },
  { level: 5, name: "Traction", test: "Repeat revenue, retention, or renewal" },
];

const KIND_LEVEL: Record<EvidenceKind, EvidenceLevel> = {
  prototype: 1,
  research: 1,
  feedback: 2,
  usage: 3,
  pilot: 3,
  revenue: 4,
  partnership: 4,
  "repeat-revenue": 5,
};

export const KIND_LABEL: Record<EvidenceKind, string> = {
  prototype: "Prototype",
  research: "Research",
  feedback: "Feedback",
  usage: "Usage",
  pilot: "Pilot",
  revenue: "Revenue",
  partnership: "Partnership",
  "repeat-revenue": "Repeat revenue",
};

function maxLevel(items: EvidenceItem[]): EvidenceLevel {
  return items.reduce<EvidenceLevel>(
    (m, e) => (KIND_LEVEL[e.kind] > m ? KIND_LEVEL[e.kind] : m),
    0,
  );
}

/** Level supported by documented evidence only. */
export function verifiedLevel(p: Project): EvidenceLevel {
  return maxLevel(p.evidence.filter((e) => e.verification === "verified"));
}

/** Level you'd reach if every claim turned out to be true. */
export function claimedLevel(p: Project): EvidenceLevel {
  return maxLevel(p.evidence.filter((e) => e.verification !== "assumed"));
}

/* ------------------------------------------------------------------ */
/* Paths + evidence gate                                               */
/* ------------------------------------------------------------------ */

export const PATHS: Record<
  PathKey,
  { label: string; short: string; color: string; gate: EvidenceLevel; gateText: string }
> = {
  build: {
    label: "Build now",
    short: "Build",
    color: "var(--path-build)",
    gate: 3,
    gateText: "Usually needs real usage (L3) before committing build time.",
  },
  validate: {
    label: "Validate first",
    short: "Validate",
    color: "var(--path-validate)",
    gate: 0,
    gateText: "Any level. Validation exists to create evidence.",
  },
  package: {
    label: "Package & sell",
    short: "Package",
    color: "var(--path-package)",
    gate: 3,
    gateText: "Needs proof it worked for someone (L3) before selling it.",
  },
  pitch: {
    label: "Pitch / partner",
    short: "Pitch",
    color: "var(--path-pitch)",
    gate: 3,
    gateText: "Partners and funders expect pilot results (L3) or better.",
  },
  portfolio: {
    label: "Use in portfolio",
    short: "Portfolio",
    color: "var(--path-portfolio)",
    gate: 1,
    gateText: "Needs a finished, showable artifact (L1).",
  },
  pause: {
    label: "Pause",
    short: "Pause",
    color: "var(--path-pause)",
    gate: 0,
    gateText: "Any level. Pausing is a decision, not a failure.",
  },
  archive: {
    label: "Archive",
    short: "Archive",
    color: "var(--path-pause)",
    gate: 0,
    gateText: "Any level. Keep reusable parts, close the rest.",
  },
};

export interface GateResult {
  passes: boolean;
  exempt: boolean;
  required: EvidenceLevel;
  actual: EvidenceLevel;
  message: string;
}

export function evidenceGate(p: Project): GateResult {
  const path = PATHS[p.recommendation.path];
  const actual = verifiedLevel(p);
  const exempt = Boolean(p.internalUse) && p.recommendation.path === "build";
  const passes = exempt || actual >= path.gate;
  let message: string;
  if (exempt) {
    message = "Internal tool — you are the user, so your own daily use is the test.";
  } else if (passes) {
    message = `Verified evidence (L${actual}) meets the bar for this path (L${path.gate}).`;
  } else {
    message = `This path usually needs L${path.gate}. Verified evidence is L${actual} — treat the recommendation as provisional.`;
  }
  return { passes, exempt, required: path.gate, actual, message };
}

/* ------------------------------------------------------------------ */
/* Stress test                                                         */
/* ------------------------------------------------------------------ */

export const STRESS_LABEL: Record<StressKey, string> = {
  problem: "Problem clarity",
  audience: "Customer / audience",
  proof: "Proof",
  differentiation: "Competition & differentiation",
  scope: "Scope",
  model: "Business model",
  distribution: "Distribution",
  feasibility: "Technical feasibility",
  risk: "Risk",
  nextSteps: "Next-step clarity",
};

export const RATING_META: Record<Rating, { label: string; fill: number; color: string }> = {
  strong: { label: "Strong", fill: 3, color: "var(--ok)" },
  partial: { label: "Partial", fill: 2, color: "var(--brass)" },
  weak: { label: "Weak", fill: 1, color: "var(--warn)" },
  unknown: { label: "Unknown", fill: 0, color: "var(--ink-4)" },
};

export const BASIS_LABEL: Record<Basis, string> = {
  evidence: "Evidence",
  judgment: "Judgment",
  none: "No basis",
};

/* ------------------------------------------------------------------ */
/* Connections                                                         */
/* ------------------------------------------------------------------ */

export const CONNECTION_META: Record<ConnectionType, { label: string; color: string; dash: string }> = {
  audience: { label: "Shared audience", color: "var(--c-audience)", dash: "" },
  technology: { label: "Technology", color: "var(--c-tech)", dash: "6 6" },
  asset: { label: "Reusable asset", color: "var(--c-asset)", dash: "2 5" },
  model: { label: "Business model", color: "var(--c-model)", dash: "10 5" },
  style: { label: "Visual style", color: "var(--c-style)", dash: "1 4" },
  opportunity: { label: "Opportunity", color: "var(--c-opp)", dash: "" },
};

export const REUSABLE_LABEL: Record<ReusableType, string> = {
  component: "Component",
  prompt: "Prompt",
  code: "Code pattern",
  template: "Template",
  research: "Research",
  brand: "Brand",
  workflow: "Workflow",
  content: "Content",
  effect: "Interaction effect",
};

/* ------------------------------------------------------------------ */
/* Card sizing                                                         */
/* ------------------------------------------------------------------ */

export type SizeMetric = "evidence" | "readiness" | "potential" | "strategic";

export const SIZE_METRICS: { key: SizeMetric; label: string; hint: string }[] = [
  { key: "evidence", label: "Evidence", hint: "Verified evidence level" },
  { key: "readiness", label: "Readiness", hint: "How close to shippable" },
  { key: "potential", label: "Potential", hint: "Self-assessed upside — not proof" },
  { key: "strategic", label: "Strategic", hint: "Importance to your direction" },
];

/** returns 0..1 */
export function metricValue(p: Project, m: SizeMetric): number {
  switch (m) {
    case "evidence":
      return verifiedLevel(p) / 5;
    case "readiness":
      return (p.readiness - 1) / 4;
    case "potential":
      return (p.potential - 1) / 4;
    case "strategic":
      return (p.strategic - 1) / 4;
  }
}

export function formatDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
