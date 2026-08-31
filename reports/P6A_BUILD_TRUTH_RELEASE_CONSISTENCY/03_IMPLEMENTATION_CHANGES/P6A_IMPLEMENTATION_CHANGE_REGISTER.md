# WP1 Evidence-Recovery Change Register

This was not a WP1 implementation campaign. No missing product feature was reimplemented.

## Previous WP1 changes not present

The encrypted backup service, Learn and Data & Privacy screens, persistent pack store, stale-propagation test, release-consistency test, money-format test, associated routes, and associated dependencies are absent from the current working tree.

## Changes made by this recovery session

1. Re-ran the repository's boundary-control command. It updated only the generated `recordedAt` and `sha` fields in tracked `tools/p2/boundary-controls.json`.
2. Rebuilt the ignored Android release output from the current source. This replaced the orphaned APK with the reproducible current-source APK.
3. Created this non-authoritative evidence-recovery tree under `reports/P6A_BUILD_TRUTH_RELEASE_CONSISTENCY/`.

## Preserved work and excluded scope

The two pre-existing untracked P4/P5 reports were not modified. No reset, clean, stash, checkout, branch switch, commit, merge, rebase, or push occurred. No legal-package, data-pipeline, Israeli-law, archive, network-topology, accessibility, trademark, or public-release content was modified.
