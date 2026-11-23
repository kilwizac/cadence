export type NoteKind = "improvement" | "revisit" | "issue" | "question";
export type ProcessStatus = "unmapped" | "mapped" | "documented" | "optimized";
export type SopStatus = "draft" | "review" | "approved";
export type StepType = "action" | "decision" | "handoff" | "wait";
export type AreaKind =
  | "shipping"
  | "inventory"
  | "purchasing"
  | "sales"
  | "engineering"
  | "production"
  | "quality"
  | "maintenance"
  | "office";

export interface Step {
  id: string;
  text: string;
  type?: StepType;
  role?: string;
  system?: string;
  durationMinutes?: number;
  branches?: StepBranch[];
}

export interface StepBranch {
  id: string;
  label: string;
  targetStepId: string;
}

export interface Process {
  id: string;
  name: string;
  owner: string;
  description: string;
  status: ProcessStatus;
  steps: Step[];
  sopIds: string[];
  createdAt: string;
}

export interface Attachment {
  storedName: string;
  originalName: string;
  size: number;
}

export interface Sop {
  id: string;
  title: string;
  status: SopStatus;
  kind: "written" | "file";
  content: string;
  attachment?: Attachment;
  updatedAt: string;
  reviewEveryMonths?: number;
  lastReviewedAt?: string;
}

export interface Note {
  id: string;
  kind: NoteKind;
  text: string;
  processId?: string;
  resolved: boolean;
  createdAt: string;
}

export interface Area {
  id: string;
  name: string;
  kind: AreaKind;
  description: string;
  hue: number;
  x: number;
  y: number;
  processes: Process[];
  sops: Sop[];
  notes: Note[];
  createdAt: string;
}

export interface Flow {
  id: string;
  from: string;
  to: string;
  label: string;
}

export interface Workspace {
  version: 2;
  name: string;
  areas: Area[];
  flows: Flow[];
}
