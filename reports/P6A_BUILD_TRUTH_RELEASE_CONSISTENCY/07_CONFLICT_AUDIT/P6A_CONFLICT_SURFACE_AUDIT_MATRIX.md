# P6-A Conflict Surface Audit Matrix

Authority: product spec §11-A. Detailed surfaces show candidates; Wallet/Home/Plan aggregates carry Estimate without exposing candidates; Check/Verdict and FX show/suppress conflict effects only when material.

| Surface | Field | Fixture | Expected state | Actual state | Result | Evidence |
|---|---|---|---|---|---|---|
| Card DNA §A | Annual fee/cost | `card-dna-conflict` two-source envelope | Full `ConflictedValue`, all values/scope/source, no winner, pencil retained | Matches | PASS | `cardDnaConflict.render.test.tsx`, N9 gate |
| Wallet tile | Annual fee aggregate | `wallet-conflict-v1` | Estimate scalar only; no candidate list | Matches | PASS | Wallet discipline suite/W5 gate |
| Home | Load/risk aggregates | Engine-derived local values | Estimate/derived state; no raw candidate list | No raw official conflict enters current Home seam | PASS FOR CURRENT INPUTS | Home agreement/render suites |
| Plan commitments/calendar | User commitments and derived aggregates | Existing Plan fixtures | User/Estimate values; no official-source candidate list | Matches current user-data inputs | PASS FOR CURRENT INPUTS | P5 Plan gates |
| Check input | User amount/card selection | Existing Check fixtures | No invented official value | Matches | PASS | Check input gates |
| Verdict cost/FX lines | Material conflicted official cost | No production fixture/path exists | Conservative calculation, Estimate, compact expandable conflict | Engine quote types do not carry conflict candidates/reason | MISSING | Source audit |
| FX Compare | Conflicted FX fee changing order | No production fixture/path exists | Mark affected row; suppress savings delta; full expansion available | `CardFxQuote` accepts numeric/unknown only | MISSING | `src/engines/fx.ts` and FX render audit |
| Card DNA §B/§D | Benefit/waiver conflicts | No applicable shipped UI fixture found | Shared component if one reaches surface | No production path proven | PARTIAL | Source audit |

## Verdict

P6-11 is **PARTIALLY_SATISFIED**. Existing behavior is internally consistent where a conflict can reach a release surface, and the W5/N9 distinction is authoritative. The missing Check/Verdict/FX conflict-input contract cannot be closed honestly by inventing a candidate mapping or Owner resolution.

