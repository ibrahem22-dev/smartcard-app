// /src/types/feature.types.ts

/** Gate state for a single feature. */
export type FeatureStatus = 'live' | 'soon' | 'beta' | 'pro_only';

/** Config for one gated feature. */
export interface FeatureConfig {
  readonly status: FeatureStatus;
  /** User-facing label (Hebrew). */
  readonly label: string;
  /** Phase the feature is planned to go live; omitted once 'live'. */
  readonly availableInPhase?: number;
}

/** Keyed by feature id. */
export type FeatureFlags = Record<string, FeatureConfig>;

/**
 * SINGLE SOURCE OF TRUTH for feature gate state across the entire codebase.
 * No feature status may be hardcoded anywhere else — FEATURE-01 imports from here.
 *
 * `as const satisfies FeatureFlags` validates the shape while preserving literal
 * keys and narrowed status values for type-safe consumers.
 */
export const INITIAL_FEATURE_STATUS = {
  BenefitsScreen: { status: 'soon', label: 'הטבות', availableInPhase: 4 },
  SavingsTracker: { status: 'soon', label: 'חיסכון', availableInPhase: 3 },
  ScoreSection: { status: 'soon', label: 'ניקוד', availableInPhase: 3 },
  InternationalMode: { status: 'soon', label: 'חו"ל', availableInPhase: 3 },
  ProUpgrade: { status: 'pro_only', label: 'Pro', availableInPhase: 5 },
} as const satisfies FeatureFlags;