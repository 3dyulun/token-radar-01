// Token launch radar — entrypoint.
//
// Reads the sealed snapshot, ranks every pre-token protocol by the
// comparable-multiple model (lib/model.ts), writes the board, the dashboard
// data and the dossier. Deterministic: run it twice and every byte is the
// same. Node 22, standard library only, no network.
//
//   node main.ts [--input /input/snapshot.json] [--output /output]

import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AS_OF,
  ageDays,
  calibrateMultiples,
  farmSteps,
  isPreToken,
  isRankable,
  modelOf,
  planTotals,
  type Protocol,
  type Snapshot,
} from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number;
  watchlist: boolean;
  multiple: number;
  multiple_samples: number;
  multiple_fallback: boolean;
  implied_value_usd: number;
  farm_steps: string[];
  plan_capital_usd: number;
  plan_gas_usd: number;
  plan_days: number;
}

interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  tvl_usd: number;
  mcap_usd: number;
  mcap_tvl: number;
  change_7d: number | null;
}

function parseArgs(argv: string[]): { input: string; output: string } {
  let input = '/input/snapshot.json';
  let output = '/output';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--input' && argv[i + 1]) input = argv[++i]!;
    else if (argv[i] === '--output' && argv[i + 1]) output = argv[++i]!;
    else if (argv[i] === '--help') {
      console.log('usage: node main.ts [--input snapshot.json] [--output dir]');
      process.exit(0);
    }
  }
  return { input, output };
}

function main(): void {
  const { input, output } = parseArgs(process.argv.slice(2));
  const snapshot = JSON.parse(readFileSync(input, 'utf8')) as Snapshot;
  const watchlist = new Set(snapshot.watchlist);

  // Calibrate the comparable multiples from the snapshot's own live tokens.
  const { multiples, global } = calibrateMultiples(snapshot.protocols);

  // Rank every rankable pre-token protocol by implied launch value.
  const ranked = snapshot.protocols
    .filter(isRankable)
    .map((p) => ({ p, model: modelOf(p, multiples, global) }))
    .sort((a, b) => b.model.implied - a.model.implied || (a.p.slug < b.p.slug ? -1 : 1));

  const rows: BoardRow[] = ranked.map(({ p, model }, i) => {
    const plan = planTotals(p);
    return {
      rank: i + 1,
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      listed_at: p.listed_at,
      age_days: model.age,
      watchlist: watchlist.has(p.slug),
      multiple: model.multiple,
      multiple_samples: model.multipleSamples,
      multiple_fallback: model.multipleFallback,
      implied_value_usd: model.implied,
      farm_steps: farmSteps(p),
      plan_capital_usd: plan.capital,
      plan_gas_usd: plan.gas,
      plan_days: plan.days,
    };
  });

  // The watchlist is a floor, never a ceiling: every watchlist slug must be
  // on the board. isRankable already keeps all 40 of them; refuse to go on
  // if the snapshot ever changes that.
  for (const slug of watchlist) {
    if (!rows.some((r) => r.slug === slug)) {
      throw new Error(`watchlist protocol ${slug} is not rankable and would be missing from the board`);
    }
  }

  // Live-token protocols, for the separate Live view: by market cap.
  const live: LiveRow[] = snapshot.protocols
    .filter((p) => !isPreToken(p) && p.mcap_usd !== null && p.mcap_usd > 0)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd!,
      mcap_tvl: p.tvl_usd > 0 ? p.mcap_usd! / p.tvl_usd : 0,
      change_7d: p.change_7d,
    }))
    .sort((a, b) => b.mcap_usd - a.mcap_usd || (a.slug < b.slug ? -1 : 1));

  const board = {
    as_of: snapshot.as_of ?? AS_OF,
    floor_usd: snapshot.floor_usd,
    rows,
  };

  mkdirSync(output, { recursive: true });
  mkdirSync(join(output, 'dashboard'), { recursive: true });
  mkdirSync(join(output, 'screenshots'), { recursive: true });

  writeFileSync(join(output, 'board.json'), `${JSON.stringify(board, null, 2)}\n`);

  const data = {
    as_of: snapshot.as_of ?? AS_OF,
    floor_usd: snapshot.floor_usd,
    global_multiple: global,
    multiples,
    rows,
    live,
  };
  writeFileSync(join(output, 'data.js'), `window.RADAR = ${JSON.stringify(data)};\n`);

  // The dashboard page and the screenshots, as the gate reads them.
  cpSync(join(import.meta.dirname, 'dashboard'), join(output, 'dashboard'), { recursive: true });
  cpSync(join(import.meta.dirname, 'screenshots'), join(output, 'screenshots'), { recursive: true });

  const dossier = buildDossier(output, {
    text_max_bytes: 65536,
    screenshots: { max: 4, max_bytes: 524288 },
    dashboard: { max_files: 400, max_bytes: 4 * 1024 * 1024 },
  });
  writeFileSync(join(output, 'dossier.json'), dossier);

  const totalImplied = rows.reduce((n, r) => n + r.implied_value_usd, 0);
  console.log(`board: ${rows.length} rows, watchlist ${rows.filter((r) => r.watchlist).length}/40 covered`);
  console.log(`live view: ${live.length} protocols with a market cap`);
  console.log(`total implied launch value: $${totalImplied.toLocaleString('en-US')}`);
  console.log(`top 3: ${rows.slice(0, 3).map((r) => `${r.name} ($${r.implied_value_usd.toLocaleString('en-US')})`).join(', ')}`);
  console.log(`dossier: ${dossier.length} bytes written to ${join(output, 'dossier.json')}`);
}

main();
