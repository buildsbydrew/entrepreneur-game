// The logic behind the mentor's conversations. No drawing happens here.
// It works out what happened at the stall today, then picks and fills in her lines.

const lower = text => text.toLowerCase();
const people = n => `${n} ${n === 1 ? 'person' : 'people'}`;
const sum = record => Object.values(record ?? {}).reduce((total, n) => total + n, 0);

// Summarises today at the stall: who asked for what, who left with nothing,
// what is left over, and how the prices worked out
export function buildContext(state, setting) {
  const today = state.today;
  const items = setting.items;
  const symbol = setting.currencySymbol ?? '';
  const asked = id => today.asked[id] ?? 0;
  const missed = id => today.missedNoStock[id] ?? 0;
  const leftover = id => state.stock[id] ?? 0;
  const sold = id => today.soldBy[id] ?? 0;
  const pricedOut = id => today.pricedOut?.[id] ?? 0;
  const priceOf = item => state.prices?.[item.id] ?? item.sellPrice;
  const byMost = (list, score) => [...list].sort((a, b) => score(b) - score(a))[0];
  const money = amount => (amount < 0 ? `-${symbol}${-amount}` : `${symbol}${amount}`);

  const totalAsked = items.reduce((total, item) => total + asked(item.id), 0);
  const mostAsked = byMost(items, item => asked(item.id));
  const mostMissed = byMost(items, item => missed(item.id));

  // The item with the most stock beyond what people asked for
  const overstocked = byMost(items, item => leftover(item.id) - asked(item.id));

  const hasStockout = missed(mostMissed.id) > 0;
  const hasLeftover = leftover(overstocked.id) - asked(overstocked.id) >= 3;
  const leftoverAsked = asked(overstocked.id);

  // Pricing: who walked away, which item earns little per sale, which one loses money
  const pricedOutTotal = sum(today.pricedOut);
  const mostPricedOut = byMost(items, item => pricedOut(item.id));
  const thin = byMost(
    items.filter(item => sold(item.id) >= 3 && priceOf(item) >= item.buyPrice && (priceOf(item) - item.buyPrice) / priceOf(item) <= 0.25),
    item => sold(item.id)
  );
  const loss = byMost(
    items.filter(item => sold(item.id) >= 1 && priceOf(item) < item.buyPrice),
    item => (item.buyPrice - priceOf(item)) * sold(item.id)
  );
  const profit = today.revenue - (today.cogs ?? 0) - today.spoiledCost;

  const hasWalkaways = pricedOutTotal >= 3;
  const hasThinMargin = Boolean(thin);
  const hasLoss = Boolean(loss);

  return {
    totalAsked,
    // Lines can be switched on or off by these names
    flags: {
      hasStockout,
      hasLeftover,
      quiet: !hasStockout && !hasLeftover,
      hasWalkaways,
      noWalkaways: pricedOutTotal === 0,
      hasThinMargin,
      hasLoss,
      pricingQuiet: !hasWalkaways && !hasThinMargin && !hasLoss
    },
    // Lines can use these as {name}
    values: {
      day: state.day,
      totalAsked,
      mostAskedItem: lower(mostAsked.name),
      mostAskedCount: asked(mostAsked.id),
      missedItem: lower(mostMissed.name),
      missedPeople: people(missed(mostMissed.id)),
      leftoverItem: lower(overstocked.name),
      leftoverCount: leftover(overstocked.id),
      leftoverAskedSentence: leftoverAsked === 0
        ? 'Nobody asked for it today.'
        : `Only ${people(leftoverAsked)} asked for it today.`,
      pricedItem: lower(mostPricedOut.name),
      pricedPeople: people(pricedOut(mostPricedOut.id)),
      thinItem: thin ? lower(thin.name) : '',
      thinCount: thin ? sold(thin.id) : 0,
      thinProfit: thin ? money(priceOf(thin) - thin.buyPrice) : '',
      lossItem: loss ? lower(loss.name) : '',
      lossAmount: loss ? money(loss.buyPrice - priceOf(loss)) : '',
      revenueToday: money(today.revenue),
      profitToday: money(profit)
    }
  };
}

// Keeps the lines whose condition holds, and fills in the {placeholders}
export function renderLines(lines, ctx = { flags: {}, values: {} }) {
  return lines
    .map(line => (typeof line === 'string' ? { text: line } : line))
    .filter(line => !line.if || ctx.flags[line.if])
    .map(line => line.text.replace(/\{(\w+)\}/g, (match, key) => (key in ctx.values ? String(ctx.values[key]) : match)));
}

// The next conversation that is due, or null
export function findDueBeat(beats, when, state, ctx) {
  return beats.find(beat =>
    beat.when === when &&
    (beat.level === undefined || beat.level === state.level) &&
    !state.beatsSeen.includes(beat.id) &&
    (beat.minAsked === undefined || ctx.totalAsked >= beat.minAsked) &&
    (beat.minPriceChanges === undefined || state.priceChanges >= beat.minPriceChanges)
  ) ?? null;
}
