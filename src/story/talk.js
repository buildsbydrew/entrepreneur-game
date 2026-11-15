// Plays a conversation on screen: each line in turn, then the player's choices, then whatever
// those choices lead to. Returns the notes about what changed (who liked what, money spent).
import { state } from '../core/state.js';
import { availableChoices, applyEffects, finishConversation, fillText } from './conversation.js';

// nameOf(id) gives a speaker's display name; names fills in words like {currency}
export async function runConversation(ui, convo, { personId, nameOf, names = {} }) {
  const you = state.life?.name ?? 'You';
  const notes = [];
  ui.dialogue.open();

  let nodeId = convo.start;
  let guard = 0;
  while (nodeId && guard++ < 100) {
    const node = convo.nodes[nodeId];
    if (!node) break;

    let last = null;
    for (const [speaker, text] of node.lines ?? []) {
      const isYou = speaker === 'you';
      last = { name: isYou ? you : nameOf(speaker), text: fillText(text, names), isYou };
      await ui.dialogue.say(last.name, last.text, isYou);
    }
    notes.push(...applyEffects(node.effects, personId));

    const choices = availableChoices(node, personId);
    if (!choices.length) {
      nodeId = node.next ?? null;
      continue;
    }

    // The last thing said stays on screen while the player decides
    const choice = await ui.dialogue.choose(last?.name ?? you, last?.text ?? '', choices, last?.isYou ?? true);
    notes.push(...applyEffects(choice.effects, personId));
    nodeId = choice.next ?? null;
  }

  finishConversation(convo, personId);
  ui.dialogue.close();
  return notes;
}
