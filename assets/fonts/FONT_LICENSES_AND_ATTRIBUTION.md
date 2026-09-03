# SORLANE + TREVIK — FONT LICENSES AND ATTRIBUTION (PHASE 9)

**Package:** Typography System V1 — System B — Plex Tri-Script
**Status:** FINAL for Phase 9
**Date:** 2026-08-25
**Owner:** Ibrahim Abu Nasser

---

## 1. Covered Font Software

| Family | Version | Script | Upstream source | License |
|---|---|---|---|---|
| IBM Plex Sans | 3.005 | Latin | github.com/IBM/plex — `packages/plex-sans/fonts/complete/ttf` | SIL OFL 1.1 |
| IBM Plex Sans Hebrew | 1.2 | Hebrew | github.com/google/fonts — `ofl/ibmplexsanshebrew` | SIL OFL 1.1 |
| IBM Plex Sans Arabic | 1.101 | Arabic | github.com/google/fonts — `ofl/ibmplexsansarabic` | SIL OFL 1.1 |

All three families are © IBM Corp. and licensed under the **SIL Open Font License 1.1**
(Reserved Font Name: **"Plex"**). The verbatim license text ships in this folder as
`OFL_1.1_IBM_PLEX.txt`. The same statement is embedded in each binary's name table
(name IDs 13/14, verified by machine read in `../11_Validation/PHASE_9_FONT_INVENTORY_RAW.json`).

## 2. Design credits (from official sources)

- **IBM Plex Sans:** Mike Abbink, Paul van der Laan, Pieter van Rosmalen (with Bold Monday) — IBM Corp.
- **IBM Plex Sans Hebrew:** adds Yanek Iontef.
- **IBM Plex Sans Arabic:** adds Wael Morcos, Khajag Apelian.

## 3. Permitted uses (OFL 1.1 summary — the license file is authoritative)

- Commercial use — permitted.
- Web embedding (`@font-face`) — permitted.
- App/software bundling (iOS/Android/cross-platform/desktop) — permitted.
- Desktop installation — permitted.
- Redistribution — permitted **only with the copyright notice and this license text included**.
- No font purchase is required; nothing in this project sells the font files standalone.

## 4. Reserved Font Name discipline

RFN is **"Plex"**. Consequences recorded for future teams:

1. Bundling/redistributing these **unmodified** files requires only keeping the license text.
2. If a **modified** fork is ever distributed publicly, it must NOT use "Plex" in its primary
   name without written permission from IBM, and it must be released under OFL 1.1 as well.

## 5. Derivative/subsetting notes for this package

- **WOFF2 files in `../03_Web_Production/fonts/` are format conversions of unmodified
  upstream TTFs** (glyph outlines and name metadata unchanged; conversion method and
  hashes recorded in `../03_Web_Production/WOFF2_PROVENANCE.json`). They are treated
  as redistribution of the Original Version under condition 2 above.
- **No subsetting was performed in V1.** If subsets are produced later, they are Modified
  Versions under OFL 1.1: keep RFN rules in mind before any public distribution, ship the
  license with them, and record a glyph coverage report (Phase 9 §33–34 policy).
- App TTFs in `../04_App_Production/fonts/` are byte-identical copies of upstream files.

## 6. Attribution practice (good practice; not an OFL requirement)

Products should credit fonts in an appropriate place (e.g., settings → about, or third-party
notices): *"IBM Plex Sans / Sans Hebrew / Sans Arabic — © IBM Corp., SIL Open Font License 1.1."*

## 7. Non-covered research material

Inter, Assistant, Heebo, Rubik, Noto Sans Hebrew/Arabic and other Phase 8 candidate binaries
remain OUTSIDE this production package (retained in Phase 8 evidence folders as historical
research). Their licenses were verified in Phase 8 but they are not part of Typography V1.

---

*This document summarizes and points to the license; it does not replace or rewrite it.*
