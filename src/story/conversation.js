// Conversations: what people say, the choices the player gets, and what each choice changes.
// No drawing happens here, so it can be tested on its own. Conversations are data (src/data/conversations.json):
//
//   { "id": "nico-first", "with": "nico", "once": true, "when": { ... }, "start": "a",
//     "nodes": { "a": { "lines": [["nico", "Hey."]], "choices": [ { "text": "Hi!", "effects": { "bond": 2 }, "next": "b" } ] } } }
//
// A line is [speaker, text]; the speaker "you" is the player. A node with no choices ends the conversation.
// "when" and a choice's "if" are conditions; "effects" change the game.
import { state, personRecord, giveItem, takeItem } from '../core/state.js';
import { playerAge, stageForAge, changeNeed, addTrait, addSkill, remember } from '../core/life.js';
import world from '../data/world.json';

// Conditions:  { "flag": "name" }  { "notFlag": "name" }  { "bondAtLeast": 3 }  { "bondBelow": 0 }
//              { "moneyAtLeast": 5 }  { "talkedBefore": true }  { "stage": "baby" or ["child", "teen"] }
//              { "minAge": 6 }  { "maxAge": 12 }  { "trait": "kind" }   (all listed must be true)
export function conditionsMet(cond, personId) {
  if (!cond) return true;
  const record = personId ? personRecord(personId) : null;
  if (cond.flag && ![].concat(cond.flag).every(f => state.flags[f])) return false;       // one flag, or a list of them all
  if (cond.notFlag && [].concat(cond.notFlag).some(f => state.flags[f])) return false;
  if (cond.bondAtLeast !== undefined && (!record || record.bond < cond.bondAtLeast)) return false;
  if (cond.bondBelow !== undefined && (!record || record.bond >= cond.bondBelow)) return false;
  if (cond.moneyAtLeast !== undefined && state.money < cond.moneyAtLeast) return false;
  if (cond.talkedBefore !== undefined && (!record || (record.talks > 0) !== cond.talkedBefore)) return false;
  if (cond.stage || cond.minAge !== undefined || cond.maxAge !== undefined) {
    const age = playerAge(world);
    const stages = [].concat(cond.stage ?? []);
    if (stages.length && !stages.includes(stageForAge(age))) return false;
    if (cond.minAge !== undefined && age < cond.minAge) return false;
    if (cond.maxAge !== undefined && age > cond.maxAge) return false;
  }
  if (cond.trait && !((state.traits[cond.trait] ?? 0) > 0)) return false;
  if (cond.today && state.flags.today !== cond.today) return false;   // only on this big day
  if (cond.has && !state.items.includes(cond.has)) return false;     // carrying this thing
  return true;
}

// Effects:  { "bond": 2 }  (how the person you're talking to feels)  { "money": -5 }
//           { "setFlag": "name" }  { "bondWith": { "mum": 1 } }  { "traits": { "bold": 1 } }
//           { "skills": { "social": 1 } }  { "happiness": 5 }  { "remember": "A line for the life journal" }
export function applyEffects(effects, personId) {
  if (!effects) return [];
  const notes = []; // short messages for the player, like "Nico liked that"
  if (effects.bond && personId) {
    personRecord(personId).bond += effects.bond;
    notes.push({ kind: 'bond', personId, amount: effects.bond });
  }
  if (effects.bondWith) {
    Object.entries(effects.bondWith).forEach(([id, amount]) => {
      personRecord(id).bond += amount;
      notes.push({ kind: 'bond', personId: id, amount });
    });
  }
  if (effects.money) {
    state.money = Math.max(0, state.money + effects.money);
    notes.push({ kind: 'money', amount: effects.money });
  }
  [].concat(effects.setFlag ?? []).forEach(flag => { state.flags[flag] = true; });
  if (effects.nameSibling) state.life.sibling = { ...(state.life.sibling ?? {}), name: effects.nameSibling };
  Object.entries(effects.traits ?? {}).forEach(([id, v]) => addTrait(id, v));
  Object.entries(effects.skills ?? {}).forEach(([id, v]) => addSkill(id, v));
  if (effects.happiness) {
    changeNeed('happiness', effects.happiness);
    notes.push({ kind: 'happiness', amount: effects.happiness });
  }
  if (effects.remember) remember(fillText(effects.remember), world);
  if (effects.give) { giveItem(effects.give); notes.push({ kind: 'item', id: effects.give, gained: true }); }
  if (effects.take) { takeItem(effects.take); notes.push({ kind: 'item', id: effects.take, gained: false }); }
  return notes;
}

// The conversation this person wants to have right now: the first one in their list whose
// conditions are met (one-off conversations only happen once)
export function pickConversation(person, conversations) {
  for (const id of person.conversations ?? []) {
    const convo = conversations.find(c => c.id === id);
    if (!convo) continue;
    if (convo.once && state.flags[`talked:${convo.id}`]) continue;
    if (conditionsMet(convo.when, person.id)) return convo;
  }
  return null;
}

// The choices the player can see at a node
export function availableChoices(node, personId) {
  return (node.choices ?? []).filter(choice => conditionsMet(choice.if, personId));
}

// Marks a conversation as had
export function finishConversation(convo, personId) {
  state.flags[`talked:${convo.id}`] = true;
  const record = personRecord(personId);
  record.met = true;
  record.talks += 1;
}

// Replaces {name} and {money} in a line with the real values
export function fillText(text, names = {}) {
  return text
    .replace(/\{name\}/g, state.life?.name ?? 'you')
    .replace(/\{sibling\}/g, state.life?.sibling?.name ?? 'the baby')
    .replace(/\{(\w+)\}/g, (match, key) => names[key] ?? match);
}
