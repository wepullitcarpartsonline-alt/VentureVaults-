/**
 * Creative Studio Vault — data model
 * ------------------------------------------------------------
 * Every interface below maps 1:1 to a future table (SQLite / Supabase / Postgres).
 * Arrays of primitives become JSON columns or join tables; see /docs/schema.sql.
 *
 * Rule: the Vault stores metadata, summaries, previews and links.
 * Original files stay where they live today (disk, Git, Drive, chat exports).
 */

export type Category =
  | "Portfolio"
  | "Internal Tool"
  | "Dev Tool"
  | "Nonprofit"
  | "Template System"
  | "Business Pilot"
  | "AI Concepts";

export type Area = "Creative" | "Business" | "Nonprofit" | "Technology";

export type Status =
  | "Idea"
  | "Exploring"
  | "Prototyping"
  | "Piloting"
  | "Active"
  | "Paused"
  | "Archived";

/** The recommended path. One per project at a time. */
export type PathKey =
  | "build"
  | "validate"
  | "package"
  | "pitch"
  | "portfolio"
  | "pause"
  | "archive";

/**
 * Evidence ladder. Computed from VERIFIED evidence only.
 * 0 Idea · 1 Artifact · 2 Signal · 3 Usage · 4 Commitment · 5 Traction
 */
export type EvidenceLevel = 0 | 1 | 2 | 3 | 4 | 5;

export type EvidenceKind =
  | "prototype"
  | "research"
  | "feedback"
  | "usage"
  | "pilot"
  | "revenue"
  | "partnership"
  | "repeat-revenue";

/** verified = you can point to the file/record · claimed = said but not documented · assumed = belief */
export type Verification = "verified" | "claimed" | "assumed";

/** table: evidence */
export interface EvidenceItem {
  id: string;
  projectId: string;
  kind: EvidenceKind;
  verification: Verification;
  statement: string;
  /** SourceLink.id that backs this item, if any */
  sourceId?: string;
  date: string; // ISO yyyy-mm-dd
}

export type SourceKind = "folder" | "git" | "doc" | "chat" | "design" | "url" | "drive";

/** table: sources — pointers to the originals, never the originals themselves */
export interface SourceLink {
  id: string;
  projectId: string;
  kind: SourceKind;
  label: string;
  location: string;
  isSourceOfTruth: boolean;
  lastVerified: string; // when you last confirmed the original still exists there
}

/** table: media — previews / working copies */
export interface MediaItem {
  id: string;
  projectId: string;
  type: "screenshot" | "image" | "video";
  src: string;
  caption: string;
}

export type ReusableType =
  | "component"
  | "prompt"
  | "code"
  | "template"
  | "research"
  | "brand"
  | "workflow"
  | "content"
  | "effect";

/** table: reusable_assets (+ join table asset_projects) */
export interface ReusableAsset {
  worldId?: string;
  id: string;
  name: string;
  type: ReusableType;
  projectIds: string[];
  note: string;
  /** Shown as a small moon on the Vault Map: orbit radius (world px) + starting angle (deg) */
  onMap?: { radius: number; angle: number };
  /** Moon render used on the map */
  orb?: string;
}

export type StressKey =
  | "problem"
  | "audience"
  | "proof"
  | "differentiation"
  | "scope"
  | "model"
  | "distribution"
  | "feasibility"
  | "risk"
  | "nextSteps";

export type Rating = "strong" | "partial" | "weak" | "unknown";
/** What the rating rests on. "judgment" is honest shorthand for "my opinion". */
export type Basis = "evidence" | "judgment" | "none";

export interface StressCheck {
  key: StressKey;
  rating: Rating;
  basis: Basis;
  note: string;
}

export interface Risk {
  text: string;
  severity: "high" | "medium" | "low";
}

export interface Recommendation {
  path: PathKey;
  confidence: "low" | "medium" | "high";
  reasons: string[];
  /** Concrete conditions that would move the recommendation */
  wouldChange: string[];
}

export interface NextMove {
  action: string;
  why: string;
  doneWhen: string;
  timebox: string;
}

/** table: decision_log */
export interface LogEntry {
  date: string;
  type: "created" | "decision" | "evidence" | "milestone" | "note";
  text: string;
}

/** table: projects */
export interface Project {
  worldId?: string;
  id: string;
  index: number;
  name: string;
  oneLiner: string;
  category: Category;
  area: Area;
  status: Status;
  /** Internal tools: you are the customer, so the evidence gate is relaxed */
  internalUse?: boolean;

  /** 1–5. How close to shippable (your assessment) */
  readiness: number;
  /** 1–5. Upside if it works (self-assessed — NOT evidence) */
  potential: number;
  /** 1–5. How much it matters to your overall direction (your call) */
  strategic: number;

  cover: string;
  /** 3D orb/planet render used on the Vault Map (transparent PNG/WebP) */
  orb: string;
  /** Visual scale correction for renders with rings/halos */
  orbScale?: number;
  media: MediaItem[];
  sources: SourceLink[];

  whatItIs: string;
  audience: string;
  problem: string;
  whatExists: string[];
  couldBecome: string;
  decisionNeeded: string;

  evidence: EvidenceItem[];

  opportunity: {
    summary: string;
    model: string;
    distribution: string;
    differentiation: string;
  };

  stress: StressCheck[];
  risks: Risk[];
  missing: string[];
  reusableAssetIds: string[];

  recommendation: Recommendation;
  nextMove: NextMove;
  log: LogEntry[];

  /** Orbit placement around the Vault core. ring 0 = inner (near term), 1 = outer. angle in degrees, 90 = front */
  orbit: { ring: 0 | 1; angle: number };

  /** Sample records are flagged so they can be cleared when real projects arrive */
  sample: boolean;
}

export type ConnectionType =
  | "audience"
  | "technology"
  | "asset"
  | "model"
  | "style"
  | "opportunity";

/** table: connections */
export interface Connection {
  id: string;
  from: string; // project id or reusable asset id
  to: string;
  type: ConnectionType;
  label: string;
}
