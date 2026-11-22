// Token launch radar — value model and farm plans.
//
// The model is calibrated from the sealed snapshot itself, never from a
// hardcoded list of names. Live-token protocols (ones whose token already
// trades) tell us what the market pays per dollar of TVL in each category:
// the median market-cap/TVL ratio of that category's live protocols. A
// pre-token protocol's implied launch value is its TVL priced at its
// category's comparable multiple, adjusted for 7-day growth and for how long
// it has run with no token (maturity). See the dashboard's Model tab for the
// formula with live numbers.

export interface Protocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  floor_usd: number;
  protocols: Protocol[];
  watchlist: string[];
}

// --- model constants (stated on the dashboard; the sandbox can change them) ---

export const GROWTH_WEIGHT = 0.5; // how much of the 7d move carries over
export const GROWTH_MIN = -60; // clamp: one week's move, at most
export const GROWTH_MAX = 120;
export const MATURITY_FLOOR = 0.6; // a day-old protocol still counts 60%
export const MATURITY_DAYS = 1095; // maturity caps at 3 years
export const UNKNOWN_AGE_DAYS = 365; // no listed_at: one year
export const MULTIPLE_MIN = 0.05; // sanity clamp on the comparable multiple
export const MULTIPLE_MAX = 1.5;
export const MIN_CATEGORY_SAMPLES = 3; // live protocols needed to trust a category

export const AS_OF = '2026-11-14';

export function isPreToken(p: Protocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

const VERSION_SUFFIX = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A protocol the board can rank: pre-token, not a CEX, not a versioned clone. */
export function isRankable(p: Protocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSION_SUFFIX.test(p.name);
}

export function ageDays(p: Protocol, asOf = AS_OF): number {
  if (!p.listed_at) return UNKNOWN_AGE_DAYS;
  const ms = Date.parse(asOf) - Date.parse(p.listed_at);
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export interface CategoryMultiple {
  multiple: number;
  samples: number; // live protocols the multiple came from (0 = global fallback)
  fallback: boolean;
}

/**
 * Median mcap/TVL of the category's live-token protocols, with at least
 * MIN_CATEGORY_SAMPLES of them; otherwise the global median across all live
 * protocols. Clamped to [MULTIPLE_MIN, MULTIPLE_MAX] so one thin sample
 * (a single live protocol, or a token trading at 400x TVL) cannot set the
 * price for a whole category.
 */
export function calibrateMultiples(
  protocols: Protocol[],
): { multiples: Record<string, CategoryMultiple>; global: number } {
  const byCategory = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of protocols) {
    if (isPreToken(p) || p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    all.push(p.mcap_usd / p.tvl_usd);
    const key = p.category ?? 'Other';
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key)!.push(p.mcap_usd / p.tvl_usd);
  }
  const global = Math.min(MULTIPLE_MAX, Math.max(MULTIPLE_MIN, median(all)));
  const multiples: Record<string, CategoryMultiple> = {};
  for (const [cat, ratios] of byCategory) {
    if (ratios.length >= MIN_CATEGORY_SAMPLES) {
      multiples[cat] = {
        multiple: Math.min(MULTIPLE_MAX, Math.max(MULTIPLE_MIN, median(ratios))),
        samples: ratios.length,
        fallback: false,
      };
    }
  }
  return { multiples, global };
}

export interface ModelBreakdown {
  multiple: number;
  multipleSamples: number;
  multipleFallback: boolean;
  base: number; // tvl x multiple
  growth: number; // clamped 7d change, percent
  growthMult: number;
  age: number; // days
  maturity: number;
  implied: number;
}

export function modelOf(
  p: Protocol,
  multiples: Record<string, CategoryMultiple>,
  global: number,
  opts: { growthWeight?: number; maturityFloor?: number; multipleCap?: number } = {},
): ModelBreakdown {
  const growthWeight = opts.growthWeight ?? GROWTH_WEIGHT;
  const maturityFloor = opts.maturityFloor ?? MATURITY_FLOOR;
  const multipleCap = opts.multipleCap ?? MULTIPLE_MAX;
  const cat = multiples[p.category ?? 'Other'];
  const entry = cat ?? { multiple: global, samples: 0, fallback: true };
  const multiple = Math.min(multipleCap, entry.multiple);
  const base = p.tvl_usd * multiple;
  const growth =
    p.change_7d === null
      ? 0
      : Math.min(GROWTH_MAX, Math.max(GROWTH_MIN, p.change_7d));
  const growthMult = 1 + (growth / 100) * growthWeight;
  const age = ageDays(p);
  const maturity = maturityFloor + (Math.min(age, MATURITY_DAYS) / MATURITY_DAYS) * (1 - maturityFloor);
  const implied = Math.max(1, Math.round(base * growthMult * maturity));
  return {
    multiple,
    multipleSamples: entry.samples,
    multipleFallback: entry.fallback,
    base,
    growth,
    growthMult,
    age,
    maturity,
    implied,
  };
}

// --- farm plans ------------------------------------------------------------

// Capital tier by TVL: the bigger the protocol, the bigger the qualifying
// position a farmer is expected to hold.
export function capitalFor(tvl: number): number {
  if (tvl >= 1_000_000_000) return 250;
  if (tvl >= 250_000_000) return 150;
  if (tvl >= 100_000_000) return 100;
  return 50;
}

// Hold window by age: a protocol that has run tokenless for years gets a
// longer farming window than one listed last month.
export function holdDaysFor(age: number): number {
  if (age >= 730) return 60;
  if (age >= 365) return 45;
  return 30;
}

// The one action that qualifies for a drop, per category. Everything else in
// the plan is the same scaffolding around it.
const CATEGORY_ACTION: Record<string, string> = {
  'Risk Curators': 'deposit into a curated vault and keep the position open',
  Lending: 'supply collateral and borrow against it, keeping a healthy ratio',
  Dexs: 'add liquidity to a core pool and keep it in range',
  'Liquid Staking': 'stake the base asset and hold the liquid staking token',
  'Liquid Restaking': 'restake the liquid staking token and hold the receipt',
  Restaking: 'restake the base asset through the protocol and hold the receipt',
  'Restaked BTC': 'deposit BTC collateral and hold the restaked receipt token',
  RWA: 'buy the tokenised real-world asset and hold it in your wallet',
  Yield: 'deposit into the highest-yield vault and leave it compounding',
  'Yield Aggregator': 'deposit into the auto-compounding vault and leave it running',
  'Basis Trading': 'open a delta-neutral basis position and keep it funded',
  Bridge: 'bridge assets through the protocol on at least two different weeks',
  'Canonical Bridge': 'bridge assets through the canonical bridge on two separate weeks',
  'Cross Chain Bridge': 'bridge assets across two different chains through the protocol',
  CDP: 'open a collateralised debt position and keep it above the liquidation ratio',
  'CDP Manager': 'open a managed CDP position and keep it above the liquidation ratio',
  Derivatives: 'open a small perpetuals position and keep margin above the minimum',
  'Onchain Capital Allocator': 'deposit into the allocation vault and keep the position open',
  CeDeFi: 'deposit into the CeDeFi vault and keep the position open for the full window',
  Chain: 'bridge in, use the chain daily, and keep a balance on it',
  'Liquidity Manager': 'deposit into a managed liquidity position and keep it in range',
  Farm: 'stake in the farm and keep the position open for the full window',
  'Leveraged Farming': 'open a leveraged farm position within your risk limit and keep it open',
  'Anchor BTC': 'deposit BTC as collateral and hold the anchored receipt token',
  'Decentralized BTC': 'deposit BTC and hold the decentralised receipt token',
  'Dual-Token Stablecoin': 'mint the stablecoin against collateral and hold both tokens',
  'Stablecoin Wrapper': 'wrap the stablecoin and hold the wrapped token',
  'Prediction Market': 'place trades on at least three different markets',
  'Staking Pool': 'stake in the pool and hold the receipt token for the full window',
  Insurance: 'buy cover for a position you already hold and keep it active',
  Payments: 'pay or receive at least three times through the protocol',
  'Governance Incentives': 'lock the governance token and vote in at least one proposal',
  'Crypto Card Issuer': 'spend with the card at least three times during the window',
  Indexes: 'buy the index token and hold it for the full window',
  'Collateral Markets': 'supply collateral to a market and keep the position open',
  'Interest Rate Derivatives': 'open a rate position and hold it through the window',
  'OTC Marketplace': 'complete at least two OTC trades through the protocol',
};

function mainAction(p: Protocol): string {
  return CATEGORY_ACTION[p.category ?? ''] ?? 'use the protocol’s core product and keep the position open';
}

function chainList(p: Protocol): string {
  const chains = p.chains.slice(0, 3);
  return chains.length > 0 ? chains.join(', ') : 'its supported chains';
}

function money(n: number): string {
  return `$${n}`;
}

/**
 * Seven concrete steps. Each carries a cost and a time, in the same shape
 * the dashboard renders: "… — Cost: $X · Time: Y". Steps are derived from
 * the protocol's category, chains, TVL and age — never from its name.
 */
export function farmSteps(p: Protocol): string[] {
  const capital = capitalFor(p.tvl_usd);
  const hold = holdDaysFor(ageDays(p));
  const chains = chainList(p);
  const action = mainAction(p);
  return [
    `Set up a fresh wallet for ${p.name} on ${chains}, keep its seed phrase offline and never share it — Cost: $0 · Time: 10 min`,
    `Start farming: ${action}, with ${money(capital)} of capital, and keep the position open — Cost: ${money(capital)} · Time: 30 min`,
    `Repeat the qualifying action once a week so the position stays active and counts in every snapshot — Cost: $0 · Time: 15 min per week`,
    `Hold the position for the full ${hold}-day window without withdrawing, so no snapshot misses you — Cost: $0 · Time: ${hold} days`,
    `Check the protocol’s points or rewards page once a week and confirm your activity is being counted — Cost: $0 · Time: 10 min per week`,
    `When the token is announced, claim only through the protocol’s own app or its official announcement, and check the claim window before it closes — Cost: $2 gas · Time: 30 min`,
    `Log every deposit, date and fee in a spreadsheet, and never deposit more than you can afford to lose — Cost: $0 · Time: 20 min`,
  ];
}

export function planTotals(p: Protocol): { capital: number; gas: number; days: number } {
  return { capital: capitalFor(p.tvl_usd), gas: 2, days: holdDaysFor(ageDays(p)) };
}
