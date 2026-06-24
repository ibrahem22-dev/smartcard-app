import { INITIAL_FEATURE_STATUS } from '../types/feature.types';

export type FeatureKey = keyof typeof INITIAL_FEATURE_STATUS;
export type FeatureStatus = (typeof INITIAL_FEATURE_STATUS)[FeatureKey]['status'] | 'active';

export function useFeatureFlag(featureKey: FeatureKey): FeatureStatus {
  return INITIAL_FEATURE_STATUS[featureKey].status;
}
