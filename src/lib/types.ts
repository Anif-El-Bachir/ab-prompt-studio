/* Tipos de domínio partilhados por motores, dados e interface. */

export type CategoryId =
  | "software"
  | "website"
  | "app"
  | "agent"
  | "multiagent"
  | "automation"
  | "business"
  | "marketing"
  | "content"
  | "data"
  | "organization"
  | "security";

export type TargetModel =
  | "claude"
  | "claude-code"
  | "chatgpt"
  | "codex"
  | "gemini"
  | "openrouter"
  | "custom";

export type DetailLevel = "compact" | "standard" | "detailed";

/** Natureza de uma afirmação: o utilizador disse-o, o sistema assumiu-o, ou não se sabe. */
export type Basis = "evidence" | "assumption" | "unknown";

export interface InjectionWarning {
  pattern: string;
  excerpt: string;
  severity: "low" | "medium" | "high";
}

export interface Interpretation {
  raw: string;
  category: CategoryId;
  categoryConfidence: number; // 0..1
  categoryScores: Partial<Record<CategoryId, number>>;
  objective: string;
  context: string;
  expectedOutput: string;
  audience?: string;
  platforms: string[];
  technologies: string[];
  budget?: { amount: number; currency: string; text: string };
  deadline?: { weeks: number; text: string };
  constraints: string[];
  features: string[];
  wordCount: number;
  injectionWarnings: InjectionWarning[];
}

export interface ClarificationQuestion {
  id: string;
  question: string;
  why: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
}

export type Answers = Record<string, string>;

export interface PromptSpec {
  role: string;
  context: string;
  objective: string;
  requirements: string[];
  constraints: string[];
  tools: string[];
  workflow: string[];
  expectedOutput: string;
  qualityCriteria: string[];
  validation: string[];
}

export interface DimensionScore {
  key: string;
  label: string;
  score: number; // 0..100
  /** Se true, valores altos são "maus" (ex.: complexidade). */
  inverted?: boolean;
  basis: Basis;
  rationale: string[];
}

export interface RiskItem {
  text: string;
  severity: "low" | "medium" | "high";
  mitigation: string;
}

export interface IdeaAnalysis {
  dimensions: DimensionScore[];
  estimatedTime: { minWeeks: number; maxWeeks: number; assumptions: string[] };
  resources: string[];
  opportunities: string[];
  risks: RiskItem[];
  obstacles: string[];
  alternatives: string[];
  knowledge: { evidence: string[]; assumptions: string[]; unknowns: string[] };
  disclaimer: string;
}

export interface ArchComponent {
  id: string;
  name: string;
  tech: string;
  description: string;
}

export interface ArchLayer {
  id: string;
  name: string;
  components: ArchComponent[];
}

export interface ArchDependency {
  from: string;
  to: string;
  label?: string;
}

export interface Architecture {
  kind: string;
  kindLabel: string;
  summary: string;
  layers: ArchLayer[];
  dependencies: ArchDependency[];
  frontend: string[];
  backend: string[];
  database: { engine: string; entities: { name: string; fields: string[] }[] };
  apis: { method: string; path: string; description: string }[];
  auth: string[];
  security: string[];
  integrations: string[];
  agents: { name: string; responsibility: string }[];
  workflows: string[];
  folderStructure: string;
  phases: { name: string; goals: string[]; deliverables: string[] }[];
}

export interface CriterionScore {
  key: string;
  label: string;
  score: number;
  notes: string[];
}

export interface PromptEvaluation {
  criteria: CriterionScore[];
  overall: number;
  suggestions: string[];
  detectedSections: string[];
  missingSections: string[];
}

/* ---------- Entidades persistidas ---------- */

export type ProjectStatus = "draft" | "analysed" | "in-development" | "done";

export interface Project {
  id: string;
  title: string;
  idea: string;
  status: ProjectStatus;
  category: CategoryId;
  step: number;
  interpretation?: Interpretation;
  answers: Answers;
  analysis?: IdeaAnalysis;
  architecture?: Architecture;
  promptId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PromptRecord {
  id: string;
  title: string;
  content: string;
  target: TargetModel;
  category: CategoryId;
  tags: string[];
  collectionIds: string[];
  projectId?: string;
  spec?: PromptSpec;
  score?: number;
  favorite: boolean;
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface PromptVersion {
  id: string;
  promptId: string;
  version: number;
  title: string;
  content: string;
  note: string;
  createdAt: number;
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  createdAt: number;
}

export interface AnalysisRecord {
  id: string;
  title: string;
  idea: string;
  category: CategoryId;
  result: IdeaAnalysis;
  projectId?: string;
  createdAt: number;
}

export type ActivityType =
  | "project.created"
  | "project.updated"
  | "prompt.created"
  | "prompt.updated"
  | "prompt.deleted"
  | "analysis.created"
  | "architecture.created"
  | "evaluation.run"
  | "collection.created"
  | "backup.imported";

export interface Activity {
  id: string;
  type: ActivityType;
  message: string;
  refId?: string;
  createdAt: number;
}

export interface AppSettings {
  id: "app";
  defaultTarget: TargetModel;
  responseLanguage: string;
  detail: DetailLevel;
  customModel: { name: string; format: "xml" | "markdown" | "plain"; supportsTools: boolean; maxChars: number };
}
