/**
 * THE P5 SURFACE SEAM — the one import path a P5 screen uses to reach an engine result.
 *
 * A screen imports from here. It does not import from `src/engines/` — criterion B1's gate
 * (`surfaces-pure`) is what enforces that, and this barrel is what makes obeying it the easy path.
 */
export { evaluateSurfaceEngines, type SurfaceEngineResults } from './surfaceEngines';
export {
  ABSENCE_DETAIL,
  absence,
  type SurfaceContext,
  type SurfaceEngineAbsence,
} from './surfaceContext';
