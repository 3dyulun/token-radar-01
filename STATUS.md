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
- [x] lib/model.ts + main.ts written (comparable-multiple model, 289 rows)
- [x] dashboard (index.html, app.css, app.js) written — dark radar theme
- [x] local run: board.json gate shape verified, run twice = byte-identical
- [x] 3 screenshots taken (1440x900 PNG: board 189 KB, detail 242 KB, filtered 192 KB)
- [x] git init + commit; LICENSE fixed (SPDX line); kit check 14 pass 0 fail
- [x] bundle v2 built — report to parent (below)
- [ ] (parent) re-run muse.db usage SELECT + re-bundle once this subagent run
      ends (my usage rows are written only after the run completes), then
      Terance creates repo 3dyulun/token-radar-01, push + submit

## Final state (2026-11-22 ~14:00 HKT)
- Local repo: ~/workspace/makefun/token-radar-entry/ (git, 2 commits)
- Commit to submit: f8da2664d16f4ca344b7d539a5b93a7515851df9
- Bundle v2: ~/workspace/makefun/token-radar-bundle-v2.tar.gz
  sha256 9829e3ed0f3a1e8657dcfe450d011c16fd9728ddabccc53337f2bb16f6ed16af
  (760,715 bytes; 2 sessions; system prompt uploaded; MCP none)
- Kit check (commit f8da266, bundle v2): 14 passed, 0 failed, 6 skipped,
  5 checked at submission. thinking_reproduces 70.4% (896/1272 lines),
  main.ts 105 authored lines, 59 assistant turns, thinking_priced pass.
- Board: 289 rows, watchlist 40/40, ranks 1..289, implied non-increasing,
  farm steps 7 per row (20–600 chars), dossier 867,640 bytes.
- Repo for Terance to create: 3dyulun/token-radar-01 (public).
- GitHub About: website https://make.fun/bounty/token-radar-01,
  topics makefun, ai-agents, bounties, trading.
- Entry route: GitHub repository (source_bundle is optional, not used).
  Submit CLI: node cli/makefun.mjs submit --competition token-radar-01
  --repo-url https://github.com/3dyulun/token-radar-01 --commit <sha>
  --title <name> --bundle <file> --keypair <file>

## Notes
- buildDossier only reads dashboard/ + screenshots/ — the judge reads ONLY the
  dashboard source + screenshots. So the model + farm derivation MUST be visible
  in app.js (recomputed in-page), not just in lib/model.ts.
- vendor/makefun-board.ts is house-provided: copy it in (its header says so).
- Kit CLI network fetch is policy-blocked; use the downloaded kit, curl for API.
- Bundle afterwards: parent re-runs the muse.db usage SELECT + re-bundle once
  this subagent run ends (usage rows are written only after the run completes).
