// Goals for each level. No drawing happens here, so it can be tested on its own.
const total = (record = {}) => Object.values(record).reduce((sum, n) => sum + n, 0);

// Turns a mission's text into what the player reads, filling in {target} and {amount}
export function describeMission(mission, setting) {
  return mission.text
    .replace('{target}', mission.target)
    .replace('{amount}', `${setting.currencySymbol}${mission.target}`)
    .replace('{rate}', Math.round((mission.minRate ?? 0) * 100))
    .replace('{min}', mission.minCustomers);
}

// Is this mission done right now, and how far along is it?
// dayEnded matters for goals that can only be judged once the whole day is over.
export function checkMission(mission, state, { dayEnded = false } = {}) {
  const today = state.today;

  switch (mission.type) {
    case 'servedInDay':
      return { done: today.served >= mission.target, progress: `${Math.min(today.served, mission.target)}/${mission.target} today` };

    case 'salesInDay':
      return { done: today.revenue >= mission.target, progress: `${Math.min(today.revenue, mission.target)}/${mission.target} today` };

    case 'noStockoutDay': {
      const missed = total(today.missedNoStock);
      const enoughCustomers = total(today.asked) >= mission.minAsked;
      return { done: dayEnded && enoughCustomers && missed === 0, progress: missed > 0 ? `${missed} missed today` : '' };
    }

    // Putting her advice to work: after the mentor has spoken, serve most of the customers who
    // come. It is only judged at the end of a day, and the day she speaks can't count, because
    // the game checks that day before she says anything. Customers still queuing at closing time
    // are left out, since they never had the chance to be served or to leave.
    case 'servedRateDay': {
      const heardAdvice = state.beatsSeen.includes(mission.beat);
      const resolved = today.served + today.lost;
      const rate = resolved > 0 ? today.served / resolved : 0;
      return {
        done: dayEnded && heardAdvice && resolved >= mission.minCustomers && rate >= mission.minRate,
        progress: heardAdvice ? `${today.served} served, ${today.lost} lost today` : 'she visits after a busy day'
      };
    }

    case 'priceChanged':
      return { done: state.priceChanges >= 1, progress: '' };

    // Profit is sales minus what the goods cost and anything that spoiled.
    // It is judged at the end of the day, when the spoilage is known.
    // With a beat set, it only counts after the mentor has spoken.
    case 'profitInDay': {
      const profit = today.revenue - today.cogs - today.spoiledCost;
      const heardAdvice = !mission.beat || state.beatsSeen.includes(mission.beat);
      const enoughCustomers = !mission.minCustomers || total(today.asked) >= mission.minCustomers;
      return {
        done: dayEnded && heardAdvice && enoughCustomers && profit >= mission.target,
        progress: heardAdvice ? `${Math.max(0, profit)}/${mission.target} today` : 'she visits after you try some prices'
      };
    }

    case 'beatSeen':
      return { done: state.beatsSeen.includes(mission.beat), progress: '' };

    default:
      return { done: false, progress: '' };
  }
}

// Marks any newly finished missions as done, and returns them.
// A finished mission stays finished, even if a later day goes badly.
export function updateMissions(level, state, setting, options) {
  const finished = [];

  level.missions.forEach(mission => {
    if (state.missionsDone.includes(mission.id)) return;
    if (checkMission(mission, state, options).done) {
      state.missionsDone.push(mission.id);
      finished.push(mission);
    }
  });

  return finished;
}

export function levelProgress(level, state) {
  const done = level.missions.filter(m => state.missionsDone.includes(m.id)).length;
  return { done, total: level.missions.length, complete: level.missions.length > 0 && done === level.missions.length };
}
