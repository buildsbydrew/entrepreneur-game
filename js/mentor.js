// The logic behind the mentor's conversations. No drawing happens here.
// It works out what happened at the stall today, then picks and fills in her lines.

const lower = text => text.toLowerCase();
const people = n => `${n} ${n === 1 ? 'person' : 'people'}`;

// Summarises today at the stall: who asked for what, who left with nothing, what is left over
export function buildContext(state, setting) {
  const today = state.today;
  const items = setting.items;
  const asked = id => today.asked[id] ?? 0;
  const missed = id => today.missedNoStock[id] ?? 0;
  const leftover = id => state.stock[id] ?? 0;

  const totalAsked = items.reduce((sum, item) => sum + asked(item.id), 0);
  const mostAsked = [...items].sort((a, b) => asked(b.id) - asked(a.id))[0];
  const mostMissed = [...items].sort((a, b) => missed(b.id) - missed(a.id))[0];

  // The item with the most stock beyond what people asked for
  const overstocked = [...items].sort(
    (a, b) => (leftover(b.id) - asked(b.id)) - (leftover(a.id) - asked(a.id))
  )[0];

  const hasStockout = missed(mostMissed.id) > 0;
  const hasLeftover = leftover(overstocked.id) - asked(overstocked.id) >= 3;
  const leftoverAsked = asked(overstocked.id);

  return {
    totalAsked,
    // Lines can be switched on or off by these names
    flags: { hasStockout, hasLeftover, quiet: !hasStockout && !hasLeftover },
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
        : `Only ${people(leftoverAsked)} asked for it today.`
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
    !state.beatsSeen.includes(beat.id) &&
    (beat.minAsked === undefined || ctx.totalAsked >= beat.minAsked)
  ) ?? null;
}
