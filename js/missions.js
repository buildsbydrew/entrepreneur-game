// Goals for each level. No drawing happens here, so it can be tested on its own.
const total = (record = {}) => Object.values(record).reduce((sum, n) => sum + n, 0);

// Turns a mission's text into what the player reads, filling in {target} and {amount}
export function describeMission(mission, setting) {
  return mission.text
    .replace('{target}', mission.target)
    .replace('{amount}', `${setting.currencySymbol}${mission.target}`);
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
