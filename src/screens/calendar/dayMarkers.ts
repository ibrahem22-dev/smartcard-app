import type { SurfaceEngineResults } from '../../surfaces';

export type DayMarkerKind = 'risk' | 'salary' | 'billing';

export interface DayMarker {
  readonly kind: DayMarkerKind;
  readonly level?: string;
  readonly label: string;
}

/** Map the risk engine's dated fields to markers without reclassifying or deriving a date. */
export function markersFor(
  results: SurfaceEngineResults,
  iso: string,
): readonly DayMarker[] {
  const day = results.risk?.days.find((candidate) => candidate.date === iso);
  if (day === undefined) return [];

  const markers: DayMarker[] = [
    { kind: 'risk', level: day.riskLevel, label: 'סיכון' },
  ];
  if (day.salaryInflowIls.value > 0) {
    markers.push({ kind: 'salary', label: 'משכורת' });
  }
  if (day.billingOutflowIls.value > 0) {
    markers.push({ kind: 'billing', label: 'חיוב כרטיס' });
  }
  return markers;
}
