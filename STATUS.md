# token-radar-01 — STATUS

Competition: token-radar-01 · $1,325 total (1st $1,000, 2nd–5th $50, 6th–10th $25)
Closes: 2026-12-14 18:00 HKT · Result due 2026-12-28 · Free entry
Account: coral-orca-93 · Wallet HLZ7bUyMeNMg2aJP9CxBZX8YgkWqtQv6qHhEfDyixhGw
Repo (to be created by Terance): 3dyulun/token-radar-01

## Snapshot (input/snapshot.json, as_of 2026-11-14)
- 758 protocols, watchlist 40 (TVL >= $50M, no token), 342 pre-token
- Rankable pre-token after the starter's filters (no CEX, no versioned names): **289 rows**
- Live-token comparables: 129 with mcap/TVL; global median mcap/TVL **0.205**
- Growth: p5 -16.6%, p95 +11.2%, max +4448% (clamp matters). Age median 486 days.

## Design (decided 2026-11-22)
- **Value model — comparable-multiple calibration.** Base multiple is NOT a fixed
  0.25. Per category: median mcap/TVL of live-token protocols in that category
  (needs >= 3 samples), else the global median 0.205; clamped to [0.05, 1.50].
  implied = max(1, round(TVL x multiple x (1 + clamp(growth,-60,120)/100 x 0.5)
  x (0.6 + min(age,1095)/1095 x 0.4))). Age unknown = 365 days.
  Category multiples computed from the snapshot itself, shown in the dashboard
  with the sample count and fallback note — judge criterion 2.
- **Board: all 289 rankable rows** (starter ranks 200). Live-token protocols in a
  separate Live view with market caps, never mixed into the ranked board.
- **Farm plans: 7 steps**, category-specific main action, capital by TVL tier
  ($50/$100/$150/$250), hold 30/45/60 days by age, weekly action, points check,
  claim guidance, record-keeping + risk note. Each step carries Cost and Time.
- **Dashboard: dark "radar terminal" theme**, distinct from the starter's light
  green. Sortable table, filters (search, category, chain, watchlist-only, min
  TVL), Board / Live / Model tabs, detail drawer per protocol with a full model
  breakdown (each factor shown) and farm plan, top-10 implied-value bar chart
  (inline SVG), model sandbox (growth weight, maturity floor, multiple cap —
  re-ranks live in the browser). Source budget < 64 KB total.
- Screenshots: 3 (board, detail, filtered), 1440x900, 300-350 KB each, JPEG/PNG.

## Progress
- [x] 2026-11-22: kit + requirements read; snapshot analysed; starter read
- [ ] lib/model.ts + main.ts written
- [ ] dashboard (index.html, app.css, app.js) written
- [ ] local run: board.json gate shape verified, run twice = byte-identical
- [ ] 3 screenshots taken, size-tuned
- [ ] git init + commit, bundle, kit check passes
- [ ] report to parent (commit sha, bundle path + sha256, kit check, repo name)
- [ ] (parent) Terance creates repo 3dyulun/token-radar-01, then push + submit

## Notes
- buildDossier only reads dashboard/ + screenshots/ — the judge reads ONLY the
  dashboard source + screenshots. So the model + farm derivation MUST be visible
  in app.js (recomputed in-page), not just in lib/model.ts.
- vendor/makefun-board.ts is house-provided: copy it in (its header says so).
- Kit CLI network fetch is policy-blocked; use the downloaded kit, curl for API.
- Bundle afterwards: parent re-runs the muse.db usage SELECT + re-bundle once
  this subagent run ends (usage rows are written only after the run completes).
