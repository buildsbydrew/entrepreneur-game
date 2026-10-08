// Holds the player's money and stock. No drawing happens here.
export const state = {
  cash: 0,
  stock: {}
};

export function initState(setting) {
  state.cash = setting.startingCash;
  state.stock = {};
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