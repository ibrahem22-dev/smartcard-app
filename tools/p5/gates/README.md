# tools/p5/gates/

Each gate is one module: `SENTINEL`, `CRITERIA`, `MEASURES`, and an async `run({ root })`.
`MEASURES` is required and must be one of source · render · artifact · agreement
(P5_VALIDATION_PLAN.md section 0). The population is derived from this directory;
tools/p5/required-gates.json says which ones the contract requires to exist.

Files beginning with an underscore are ignored by the runner.
