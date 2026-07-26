import { api } from "@/shared/api/client";

export type MatchStatus = "processing" | "completed" | "failed";
export type MatchVerdict = "apply" | "maybe" | "skip";
export type MatchConfidence = "high" | "medium" | "low";
export type NextAction = "create_application" | "review_gaps" | "archive_vacancy";
export type ScoreCategory =
  | "skills"
  | "experience"
  | "location"
  | "compensation"
  | "domain";
export type RequirementStatus = "met" | "partial" | "missing" | "unknown";

export interface RequirementFinding {
  requirement: string;
  category: ScoreCategory;
  importance: "required" | "preferred";
  status: RequirementStatus;
  vacancy_quote: string;
  evidence: string | null;
  evidence_source: "cv" | "profile" | null;
}

export interface RedFlag {
  kind: string;
  detail: string;
  vacancy_quote: string;
  /** True for a hard blocker — the thing that capped the score. */
  blocking: boolean;
}

export interface CategoryScore {
  category: ScoreCategory;
  score: number;
  max_score: number;
  /** False when the vacancy said nothing this category could be judged on. */
  assessed: boolean;
}

export interface ScoreBreakdown {
  categories: CategoryScore[];
  capped_by_blocker: boolean;
}

export interface MatchAnalysis {
  id: string;
  /** Null while the analysis belongs to an import preview that is not saved yet. */
  vacancy_id: string | null;
  cv_version_id: string | null;
  profile_revision: number;
  status: MatchStatus;
  score: number | null;
  verdict: MatchVerdict | null;
  confidence: MatchConfidence | null;
  summary: string | null;
  next_action: NextAction | null;
  score_breakdown: ScoreBreakdown | null;
  matches: RequirementFinding[] | null;
  gaps: RequirementFinding[] | null;
  red_flags: RedFlag[] | null;
  unknowns: string[] | null;
  model_name: string | null;
  prompt_version: string | null;
  scoring_version: string | null;
  error_code: string | null;
  created_at: string;
  completed_at: string | null;
  /** The vacancy, CV or profile changed after this analysis ran. */
  is_stale: boolean;
}

export interface MatchSummary {
  vacancy_id: string;
  status: MatchStatus;
  score: number | null;
  verdict: MatchVerdict | null;
  confidence: MatchConfidence | null;
  is_stale: boolean;
}

/** Latest analysis per vacancy, so a list needs one request rather than one per row. */
export function getMatchSummaries(vacancyIds: string[]) {
  if (vacancyIds.length === 0) return Promise.resolve([] as MatchSummary[]);
  const query = vacancyIds.map((id) => `vacancy_ids=${id}`).join("&");
  return api<MatchSummary[]>(`/vacancy-matches/summary?${query}`);
}

export function getMatch(analysisId: string) {
  return api<MatchAnalysis>(`/vacancy-matches/${analysisId}`);
}

export function getLatestMatch(vacancyId: string) {
  return api<MatchAnalysis>(`/vacancies/${vacancyId}/matches/latest`);
}

export function listMatches(vacancyId: string) {
  return api<MatchAnalysis[]>(`/vacancies/${vacancyId}/matches`);
}

export function requestMatch(
  vacancyId: string,
  body: { cv_version_id?: string; force?: boolean } = {},
) {
  return api<MatchAnalysis>(`/vacancies/${vacancyId}/match`, { method: "POST", body });
}
