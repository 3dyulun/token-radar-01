// Token Radar — dashboard logic.
//
// The value model and the farm plans are computed here, in the page, from
// the same snapshot figures the board was built from — so what you see is
// what the code does, and the screenshots agree with board.json.
//
// Model (defaults; the Model tab lets you change the constants):
//   multiple  = the category's comparable multiple: median mcap/TVL of that
//               category's live-token protocols (>= 3 of them), else the
//               global median; clamped to 0.05-1.50.
//   base      = TVL x multiple
//   growth    = 7-day TVL change clamped to -60%..+120%
//   implied   = max(1, round(base x (1 + growth/100 x 0.5)
//               x (0.6 + min(age, 1095)/1095 x 0.4)))
// Age is days since listed_at, or 365 when the listing date is unknown.

const D = window.RADAR;
const $ = (id) => document.getElementById(id);

// --- formatting ------------------------------------------------------------
const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
const moneyShort = (n) =>
  n >= 1e9 ? '$' + (n / 1e9).toFixed(2) + 'B'
  : n >= 1e6 ? '$' + (n / 1e6).toFixed(1) + 'M'
  : n >= 1e3 ? '$' + (n / 1e3).toFixed(0) + 'K'
  : '$' + Math.round(n);
const pct = (n) => (n === null || n === undefined ? '—' : (n > 0 ? '+' : '') + n.toFixed(1) + '%');
const pctClass = (n) => (n === null || n === undefined ? '' : n >= 0 ? 'pos' : 'neg');
const ageText = (d) => (d >= 365 ? (d / 365).toFixed(1) + 'y' : d + 'd');

// --- model (same as lib/model.ts) ------------------------------------------
const DEFAULTS = { growthWeight: 0.5, maturityFloor: 0.6, multipleCap: 1.5 };
let sandbox = { ...DEFAULTS };

function impliedOf(row, opts) {
  const multiple = Math.min(opts.multipleCap, row.multiple);
  const base = row.tvl_usd * multiple;
  const growth = row.change_7d === null ? 0 : Math.min(120, Math.max(-60, row.change_7d));
  const growthMult = 1 + (growth / 100) * opts.growthWeight;
  const age = row.age_days;
  const maturity = opts.maturityFloor + (Math.min(age, 1095) / 1095) * (1 - opts.maturityFloor);
  return { multiple, multipleSamples: row.multiple_samples, multipleFallback: row.multiple_fallback, base, growth, growthMult, age, maturity, implied: Math.max(1, Math.round(base * growthMult * maturity)) };
}

// --- farm plans (same derivation as lib/model.ts) ---------------------------
function capitalFor(tvl) {
  if (tvl >= 1_000_000_000) return 250;
  if (tvl >= 250_000_000) return 150;
  if (tvl >= 100_000_000) return 100;
  return 50;
}
function holdDaysFor(age) {
  if (age >= 730) return 60;
  if (age >= 365) return 45;
  return 30;
}
const CATEGORY_ACTION = {
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
function farmSteps(row) {
  const capital = capitalFor(row.tvl_usd);
  const hold = holdDaysFor(row.age_days);
  const chains = row.chains.length > 0 ? row.chains.slice(0, 3).join(', ') : 'its supported chains';
  const action = CATEGORY_ACTION[row.category || ''] || 'use the protocol’s core product and keep the position open';
  return [
    `Set up a fresh wallet for ${row.name} on ${chains}, keep its seed phrase offline and never share it — Cost: $0 · Time: 10 min`,
    `Start farming: ${action}, with $${capital} of capital, and keep the position open — Cost: $${capital} · Time: 30 min`,
    `Repeat the qualifying action once a week so the position stays active and counts in every snapshot — Cost: $0 · Time: 15 min per week`,
    `Hold the position for the full ${hold}-day window without withdrawing, so no snapshot misses you — Cost: $0 · Time: ${hold} days`,
    `Check the protocol’s points or rewards page once a week and confirm your activity is being counted — Cost: $0 · Time: 10 min per week`,
    `When the token is announced, claim only through the protocol’s own app or its official announcement, and check the claim window before it closes — Cost: $2 gas · Time: 30 min`,
    `Log every deposit, date and fee in a spreadsheet, and never deposit more than you can afford to lose — Cost: $0 · Time: 20 min`,
  ];
}

// --- data ------------------------------------------------------------------
const ROWS = D.rows;
const LIVE = D.live;
const maxImplied = Math.max(...ROWS.map((r) => r.implied_value_usd));
const totalImplied = ROWS.reduce((n, r) => n + r.implied_value_usd, 0);

// --- stats + chart ---------------------------------------------------------
function renderStats() {
  const stats = [
    { v: String(ROWS.filter((r) => r.watchlist).length), k: 'Watchlist protocols', green: true },
    { v: String(ROWS.length), k: 'Pre-token protocols ranked' },
    { v: String(LIVE.length), k: 'Live tokens (comparables)' },
    { v: moneyShort(totalImplied), k: 'Total implied launch value' },
  ];
  $('stats').innerHTML = stats.map((s) =>
    `<div class="stat"><div class="v${s.green ? ' green' : ''}">${s.v}</div><div class="k">${s.k}</div></div>`).join('');
}

function renderChart() {
  const top = ROWS.slice(0, 10);
  $('chart').innerHTML = top.map((r) => `
    <div class="chart-row${r.watchlist ? ' watch' : ''}" data-slug="${r.slug}" title="${r.name} — ${money(r.implied_value_usd)}">
      <span class="chart-name">${r.rank}. ${r.name}</span>
      <span class="chart-track"><span class="chart-fill" style="width:${(r.implied_value_usd / maxImplied * 100).toFixed(1)}%"></span></span>
      <span class="chart-val">${moneyShort(r.implied_value_usd)}</span>
    </div>`).join('');
  document.querySelectorAll('.chart-row').forEach((el) =>
    el.addEventListener('click', () => openDetail(el.dataset.slug)));
}

// --- board table -----------------------------------------------------------
function filteredRows() {
  const q = $('q').value.trim().toLowerCase();
  const cat = $('category').value;
  const chain = $('chain').value;
  const minTvl = Number($('minTvl').value);
  const watchOnly = $('watchOnly').checked;
  let rows = ROWS.filter((r) =>
    (!q || r.name.toLowerCase().includes(q) || r.slug.includes(q)) &&
    (!cat || r.category === cat) &&
    (!chain || r.chains.includes(chain)) &&
    r.tvl_usd >= minTvl &&
    (!watchOnly || r.watchlist));
  // Sandbox re-rank: recompute implied values with the sandbox constants.
  const sandboxed = sandbox.growthWeight !== DEFAULTS.growthWeight ||
    sandbox.maturityFloor !== DEFAULTS.maturityFloor ||
    sandbox.multipleCap !== DEFAULTS.multipleCap;
  if (sandboxed) {
    rows = rows.map((r) => ({ ...r, implied_value_usd: impliedOf(r, sandbox).implied }));
  }
  const sort = $('sort').value;
  const by = {
    rank: (a, b) => a.rank - b.rank,
    implied: (a, b) => b.implied_value_usd - a.implied_value_usd,
    tvl: (a, b) => b.tvl_usd - a.tvl_usd,
    growth: (a, b) => (b.change_7d ?? -Infinity) - (a.change_7d ?? -Infinity),
    age: (a, b) => b.age_days - a.age_days,
    name: (a, b) => a.name.localeCompare(b.name),
  }[sort];
  return { rows: rows.sort(by), sandboxed };
}

function renderBoard() {
  const { rows, sandboxed } = filteredRows();
  $('count').textContent = `${rows.length} of ${ROWS.length} protocols` +
    (sandboxed ? ' — re-ranked with your sandbox constants (defaults restore the ranked board)' : '');
  if (rows.length === 0) {
    $('boardBody').innerHTML = '<tr><td class="empty" colspan="9">No protocols match these filters.</td></tr>';
    return;
  }
  $('boardBody').innerHTML = rows.map((r) => `
    <tr data-slug="${r.slug}">
      <td class="num">${r.rank}</td>
      <td class="name"><b>${r.name}</b>${r.watchlist ? '<span class="badge">WATCH</span>' : ''}<span class="slug">${r.slug}</span></td>
      <td>${r.category || '—'}</td>
      <td class="chain-tag">${r.chains.slice(0, 3).join(', ')}</td>
      <td class="num">${moneyShort(r.tvl_usd)}</td>
      <td class="num ${pctClass(r.change_7d)}">${pct(r.change_7d)}</td>
      <td class="num">${ageText(r.age_days)}</td>
      <td><span class="implied-cell"><span class="implied-bar"><i style="width:${(r.implied_value_usd / maxImplied * 100).toFixed(1)}%"></i></span>${money(r.implied_value_usd)}</span></td>
      <td class="num">›</td>
    </tr>`).join('');
  document.querySelectorAll('#boardBody tr[data-slug]').forEach((tr) =>
    tr.addEventListener('click', () => openDetail(tr.dataset.slug)));
}

// --- live table ------------------------------------------------------------
function renderLive() {
  $('liveBody').innerHTML = LIVE.map((p, i) => `
    <tr data-slug="${p.slug}">
      <td class="num">${i + 1}</td>
      <td class="name"><b>${p.name}</b><span class="slug">${p.slug}</span></td>
      <td>${p.category || '—'}</td>
      <td class="num">${moneyShort(p.tvl_usd)}</td>
      <td class="num">${money(p.mcap_usd)}</td>
      <td class="num">${p.mcap_tvl.toFixed(2)}×</td>
      <td class="num ${pctClass(p.change_7d)}">${pct(p.change_7d)}</td>
    </tr>`).join('');
}

// --- multiples table -------------------------------------------------------
function renderMultiples() {
  const cats = Object.keys(D.multiples).sort();
  const rows = cats.map((c) => {
    const m = D.multiples[c];
    return { category: c, multiple: m.multiple, samples: m.samples, fallback: false };
  });
  // Categories with no trusted multiple fall back to the global median.
  const known = new Set(cats);
  const extra = [...new Set(ROWS.map((r) => r.category))].filter((c) => c && !known.has(c));
  for (const c of extra.sort()) {
    rows.push({ category: c, multiple: D.global_multiple, samples: 0, fallback: true });
  }
  rows.sort((a, b) => b.multiple - a.multiple);
  $('multBody').innerHTML = rows.map((r) => `
    <tr>
      <td>${r.category}</td>
      <td class="num">${r.multiple.toFixed(3)}×</td>
      <td class="num">${r.samples}</td>
      <td>${r.fallback ? 'Global median (fewer than 3 live protocols in this category)' : 'Median of this category’s live protocols'}</td>
    </tr>`).join('');
}

// --- detail drawer ---------------------------------------------------------
function openDetail(slug) {
  const r = ROWS.find((x) => x.slug === slug);
  if (!r) return;
  const m = impliedOf(r, DEFAULTS);
  const steps = farmSteps(r);
  const shown = m.multipleFallback
    ? `Global median (${D.global_multiple.toFixed(3)}×) — fewer than 3 live ${r.category || ''} protocols in the snapshot`
    : `Median mcap/TVL of ${m.multipleSamples} live ${r.category} protocols`;
  $('drawerBody').innerHTML = `
    <h2>${r.name}</h2>
    <p class="slug">${r.slug}${r.watchlist ? ' · on the watchlist' : ''}</p>
    <div class="kv">
      <div><div class="k">Rank</div><div class="v">#${r.rank} of ${ROWS.length}</div></div>
      <div><div class="k">Category</div><div class="v">${r.category || '—'}</div></div>
      <div><div class="k">TVL</div><div class="v">${money(r.tvl_usd)}</div></div>
      <div><div class="k">7-day change</div><div class="v">${pct(r.change_7d)}</div></div>
      <div><div class="k">Listed</div><div class="v">${r.listed_at || 'unknown'} (${ageText(r.age_days)})</div></div>
      <div><div class="k">Chains</div><div class="v">${r.chains.join(', ') || '—'}</div></div>
    </div>
    <h3>Model breakdown</h3>
    <div class="eq">TVL ${money(r.tvl_usd)}<br>
      × multiple <b>${m.multiple.toFixed(3)}×</b> <span style="color:var(--faint)">— ${shown}</span><br>
      = base ${money(m.base)}<br>
      × growth factor <b>${m.growthMult.toFixed(3)}</b> <span style="color:var(--faint)">— 7d ${pct(m.growth)} clamped, weight 0.5</span><br>
      × maturity <b>${m.maturity.toFixed(3)}</b> <span style="color:var(--faint)">— ${m.age} days, floor 0.6</span><br>
      = implied launch value <b>${money(m.implied)}</b></div>
    <h3>Farm plan — ${r.name}</h3>
    <ol class="steps">${steps.map((s) => {
      const [text, cost] = s.split(' — Cost: ');
      return `<li>${text}<span class="cost">Cost: ${cost}</span></li>`;
    }).join('')}</ol>
    <div class="plan-total">Plan total: $${r.plan_capital_usd} capital + $${r.plan_gas_usd} gas · ${r.plan_days}-day window</div>`;
  $('drawer').classList.remove('hidden');
}
function closeDetail() { $('drawer').classList.add('hidden'); }

// --- tabs, controls, sandbox, url params -----------------------------------
function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t) => {
    const on = t.dataset.tab === name;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', String(on));
  });
  for (const n of ['board', 'live', 'model']) $('tab-' + n).classList.toggle('hidden', n !== name);
}

function fillSelects() {
  const cats = [...new Set(ROWS.map((r) => r.category))].filter(Boolean).sort();
  $('category').innerHTML = '<option value="">All categories</option>' +
    cats.map((c) => `<option value="${c}">${c}</option>`).join('');
  const chains = [...new Set(ROWS.flatMap((r) => r.chains))].sort();
  $('chain').innerHTML = '<option value="">All chains</option>' +
    chains.map((c) => `<option value="${c}">${c}</option>`).join('');
}

function applySandbox() {
  sandbox = {
    growthWeight: Math.min(1, Math.max(0, Number($('sbGrowth').value) || DEFAULTS.growthWeight)),
    maturityFloor: Math.min(0.8, Math.max(0.4, Number($('sbFloor').value) || DEFAULTS.maturityFloor)),
    multipleCap: Math.min(3, Math.max(0.5, Number($('sbCap').value) || DEFAULTS.multipleCap)),
  };
  $('sbNote').textContent = `Sandbox on: growth weight ${sandbox.growthWeight}, maturity floor ${sandbox.maturityFloor}, multiple cap ${sandbox.multipleCap}. The board below re-ranks; the ranked board uses the defaults.`;
  switchTab('board');
  renderBoard();
}

function resetSandbox() {
  sandbox = { ...DEFAULTS };
  $('sbGrowth').value = '0.5';
  $('sbFloor').value = '0.6';
  $('sbCap').value = '1.5';
  $('sbNote').textContent = '';
  renderBoard();
}

function init() {
  fillSelects();
  renderStats();
  renderChart();
  renderBoard();
  renderLive();
  renderMultiples();
  document.querySelectorAll('.tab').forEach((t) =>
    t.addEventListener('click', () => switchTab(t.dataset.tab)));
  for (const id of ['q', 'category', 'chain', 'minTvl', 'watchOnly', 'sort']) {
    $(id).addEventListener('input', renderBoard);
    $(id).addEventListener('change', renderBoard);
  }
  $('sbApply').addEventListener('click', applySandbox);
  $('sbReset').addEventListener('click', resetSandbox);
  $('drawerClose').addEventListener('click', closeDetail);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDetail(); });

  // Deep links, used by the screenshots: ?detail=<slug>, ?category=<name>, ?q=<text>, ?tab=<board|live|model>.
  const params = new URLSearchParams(location.search);
  if (params.get('tab') && ['board', 'live', 'model'].includes(params.get('tab'))) switchTab(params.get('tab'));
  if (params.get('category')) { $('category').value = params.get('category'); renderBoard(); }
  if (params.get('q')) { $('q').value = params.get('q'); renderBoard(); }
  if (params.get('detail')) openDetail(params.get('detail'));
}

init();
