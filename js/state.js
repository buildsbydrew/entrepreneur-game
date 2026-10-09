// Holds the player's money, stock, and sales record. No drawing happens here.
export const state = {
  cash: 0,
  stock: {},
  stats: { served: 0, lost: 0 }
};

export function initState(setting) {
  state.cash = setting.startingCash;
  state.stock = {};
  state.stats = { served: 0, lost: 0 };
  setting.items.forEach(item => {
    state.stock[item.id] = 0;
  });
}

// Returns true if the purchase went through, false if the player can't afford it
export function buy(item) {
  if (state.cash < item.buyPrice) return false;
  state.cash -= item.buyPrice;
  state.stock[item.id] += 1;
  return true;
}

// Returns true if the sale went through, false if there is none in stock
export function sell(item) {
  if (state.stock[item.id] <= 0) return false;
  state.stock[item.id] -= 1;
  state.cash += item.sellPrice;
  state.stats.served += 1;
  return true;
}

export function recordLostCustomer() {
  state.stats.lost += 1;
}