// Conversations: what people say, the choices the player gets, and what each choice changes.
// No drawing happens here, so it can be tested on its own. Conversations are data (src/data/conversations.json):
//
//   { "id": "nico-first", "with": "nico", "once": true, "when": { ... }, "start": "a",
//     "nodes": { "a": { "lines": [["nico", "Hey."]], "choices": [ { "text": "Hi!", "effects": { "bond": 2 }, "next": "b" } ] } } }
//
// A line is [speaker, text]; the speaker "you" is the player. A node with no choices ends the conversation.
// "when" and a choice's "if" are conditions; "effects" change the game.
import { state, personRecord } from '../core/state.js';

// Conditions:  { "flag": "name" }  { "notFlag": "name" }  { "bondAtLeast": 3 }  { "bondBelow": 0 }
//              { "moneyAtLeast": 5 }  { "talkedBefore": true }   (all listed must be true)
export function conditionsMet(cond, personId) {
  if (!cond) return true;
  const record = personId ? personRecord(personId) : null;
  if (cond.flag && !state.flags[cond.flag]) return false;
  if (cond.notFlag && state.flags[cond.notFlag]) return false;
  if (cond.bondAtLeast !== undefined && (!record || record.bond < cond.bondAtLeast)) return false;
  if (cond.bondBelow !== undefined && (!record || record.bond >= cond.bondBelow)) return false;
  if (cond.moneyAtLeast !== undefined && state.money < cond.moneyAtLeast) return false;
  if (cond.talkedBefore !== undefined && (!record || (record.talks > 0) !== cond.talkedBefore)) return false;
  return true;
}

// Effects:  { "bond": 2 }  (how the person you're talking to feels)  { "money": -5 }
//           { "setFlag": "name" }  { "bondWith": { "mum": 1 } }
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
  if (effects.setFlag) state.flags[effects.setFlag] = true;
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
    .replace(/\{(\w+)\}/g, (match, key) => names[key] ?? match);
}
