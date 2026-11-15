// Holds the player's money, stock, and the record of the current day.
// No drawing happens here.
export const state = {
  day: 1,
  cash: 0,
  stock: {},    // total count of each item
  batches: {},  // the same stock split by age: batches[id][age] = how many
  today: null,
  lastDay: null,     // the record of the day before, so the price board can show how prices did
  notebook: { unlocked: [], evidence: {} }, // ideas the player has found
  prices: {},        // what the player charges, by item id (empty means the standard price)
  priceChanges: 0,   // how many times the player has changed a price
  level: 1,          // the level being played
  missionsDone: [],  // ids of finished missions
  levelsDone: [],    // ids of finished levels
  beatsSeen: []                              // conversations that have already happened
};

function freshDay() {
  return {
    revenue: 0,
    spent: 0,
    served: 0,
    lost: 0,
    spoiled: {},        // item id -> how many went bad today
    spoiledCost: 0,     // what that stock cost to buy
    asked: {},          // item id -> customers who came wanting it
    soldBy: {},         // item id -> how many were sold
    missedNoStock: {},  // item id -> customers who left because there was none
    cogs: 0,            // what the goods that were sold cost to buy
    pricedOut: {},      // item id -> customers who walked away over the price
    startCash: state.cash
  };
}

export function initState(setting) {
  state.day = 1;
  state.cash = setting.startingCash;
  state.stock = {};
  state.batches = {};
  setting.items.forEach(item => {
    state.stock[item.id] = 0;
    state.batches[item.id] = [0];
  });
  state.notebook = { unlocked: [], evidence: {} };
  state.beatsSeen = [];
  state.level = 1;
  state.prices = {};
  state.priceChanges = 0;
  state.missionsDone = [];
  state.levelsDone = [];
  state.lastDay = null;
  state.today = freshDay();
}

export function startNextDay() {
  state.lastDay = state.today;
  state.day += 1;
  state.today = freshDay();
}

// Returns true if the purchase went through, false if the player can't afford it
export function buy(item) {
  if (state.cash < item.buyPrice) return false;
  state.cash -= item.buyPrice;
  state.stock[item.id] += 1;
  state.batches[item.id][0] += 1; // fresh stock is age 0
  state.today.spent += item.buyPrice;
  return true;
}

// Returns true if the sale went through, false if there is none in stock.
// The oldest stock is sold first.
export function sell(item) {
  if (state.stock[item.id] <= 0) return false;

  const ages = state.batches[item.id];
  for (let age = ages.length - 1; age >= 0; age--) {
    if (ages[age] > 0) {
      ages[age] -= 1;
      break;
    }
  }

  state.stock[item.id] -= 1;
  const price = priceOf(item);
  state.cash += price;
  state.today.revenue += price;
  state.today.cogs += item.buyPrice;
  state.today.served += 1;
  state.today.soldBy[item.id] = (state.today.soldBy[item.id] || 0) + 1;
  return true;
}

// noStock is true when the customer left and the shelf had none of what they wanted
export function recordLostCustomer(item, noStock) {
  state.today.lost += 1;
  if (noStock) state.today.missedNoStock[item.id] = (state.today.missedNoStock[item.id] || 0) + 1;
}

// A customer arrived at the stall wanting this item
export function recordAsked(item) {
  state.today.asked[item.id] = (state.today.asked[item.id] || 0) + 1;
}

export function unlockEntry(id, evidence) {
  if (!state.notebook.unlocked.includes(id)) state.notebook.unlocked.push(id);
  state.notebook.evidence[id] = evidence;
}

export function markBeatSeen(id) {
  if (!state.beatsSeen.includes(id)) state.beatsSeen.push(id);
}

// Called once when the day ends: all stock gets a day older,
// and anything past its shelf life goes bad.
export function endOfDayAging(setting) {
  setting.items.forEach(item => {
    const ages = state.batches[item.id];
    ages.unshift(0); // every batch moves one day older

    if (!item.shelfLifeDays) return; // never spoils

    while (ages.length > item.shelfLifeDays) {
      const spoiledCount = ages.pop();
      if (spoiledCount > 0) {
        state.stock[item.id] -= spoiledCount;
        state.today.spoiled[item.id] = (state.today.spoiled[item.id] || 0) + spoiledCount;
        state.today.spoiledCost += spoiledCount * item.buyPrice;
      }
    }
  });
}

// How many of this item will go bad at the end of today
export function expiringTonight(item) {
  if (!item.shelfLifeDays) return 0;
  return state.batches[item.id][item.shelfLifeDays - 1] || 0;
}

// What the stock on hand cost to buy
export function stockValue(setting) {
  return setting.items.reduce((sum, item) => sum + state.stock[item.id] * item.buyPrice, 0);
}

export function completeLevel(id) {
  if (!state.levelsDone.includes(id)) state.levelsDone.push(id);
}

// What the player is charging for an item right now
export function priceOf(item) {
  return state.prices[item.id] ?? item.sellPrice;
}

export function setPrice(item, price) {
  if (price === priceOf(item)) return;
  state.prices[item.id] = price;
  state.priceChanges += 1;
}

// A customer came, saw the price, and walked away
export function recordPricedOut(item) {
  state.today.pricedOut[item.id] = (state.today.pricedOut[item.id] || 0) + 1;
}

// Sales, minus what the goods cost to buy, minus anything that spoiled
export function profitToday() {
  return state.today.revenue - state.today.cogs - state.today.spoiledCost;
}

// Moves to the next level, unless there isn't one yet
export function advanceLevel(levels) {
  const next = levels.find(level => level.id === state.level + 1);
  if (next && !next.comingSoon) state.level = next.id;
}

// ---------- Saving ----------

// Everything that makes up a game in progress
const SAVED_KEYS = [
  'day', 'cash', 'stock', 'batches', 'today', 'lastDay', 'notebook',
  'beatsSeen', 'level', 'missionsDone', 'levelsDone', 'prices', 'priceChanges'
];

// A plain copy of the game, safe to store
export function exportState() {
  return JSON.parse(JSON.stringify(Object.fromEntries(SAVED_KEYS.map(key => [key, state[key]]))));
}

// Replaces the game with a saved one
export function importState(data) {
  const copy = JSON.parse(JSON.stringify(data));
  SAVED_KEYS.forEach(key => { state[key] = copy[key]; });
  state.lastDay = copy.lastDay ?? null;
}
