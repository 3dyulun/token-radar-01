# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/3dyulun/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/3dyulun/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token launch radar ranking 289 pre-token protocols by implied launch value, with farm plans and a sortable dashboard.

The implied value is priced from the snapshot itself, not from a fixed multiple or a list of favourite names: each category's comparable multiple is the median market-cap / TVL ratio of that category's live-token protocols (at least 3 of them, otherwise the global median), clamped to 0.05–1.50. TVL × multiple, adjusted for 7-day growth (clamped, half weight) and for how long the protocol has run with no token (maturity). The board ranks every rankable pre-token protocol — all 289 of them, with all 40 watchlist protocols covered — and live-token protocols sit in a separate view as the comparables the model is priced from. Each protocol gets a 7-step farm plan with concrete costs and times, derived from its category, chains, TVL and age.

## Run it

```sh
# with the sealed snapshot at snapshot.json, writing to out/
node main.ts --input snapshot.json --output out
```

Node 22 or later, standard library only, no network, no install. `main.ts` reads the snapshot, writes `out/board.json` (the ranked board), `out/data.js` (dashboard data), copies `dashboard/` and `screenshots/` into `out/`, and writes `out/dossier.json` via the house dossier library. The run is deterministic: run it twice and every byte is the same. Open `out/dashboard/index.html` to use the radar.

---

<sub>Entered on [make.fun](https://make.fun/?ref=CLH4FP&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
