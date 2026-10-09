// Holds the player's money, stock, and the record of the current day.
// No drawing happens here.
export const state = {
  day: 1,
  cash: 0,
  stock: {},
  today: null
};

function freshDay() {
  return { revenue: 0, spent: 0, served: 0, lost: 0, startCash: state.cash };
}

export function initState(setting) {
  state.day = 1;
  state.cash = setting.startingCash;
  state.stock = {};
  setting.items.forEach(item => {
    state.stock[item.id] = 0;
  });
  state.today = freshDay();
}

export function startNextDay() {
  state.day += 1;
  state.today = freshDay();
}

// Returns true if the purchase went through, false if the player can't afford it
export function buy(item) {
  if (state.cash < item.buyPrice) return false;
  state.cash -= item.buyPrice;
  state.stock[item.id] += 1;
  state.today.spent += item.buyPrice;
  return true;
}

// Returns true if the sale went through, false if there is none in stock
export function sell(item) {
  if (state.stock[item.id] <= 0) return false;
  state.stock[item.id] -= 1;
  state.cash += item.sellPrice;
  state.today.revenue += item.sellPrice;
  state.today.served += 1;
  return true;
}

export function recordLostCustomer() {
  state.today.lost += 1;
}