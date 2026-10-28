# World design (living document)

This is the plan for growing the game from one market into a place the player lives in.
It records what we have decided, and what is still open. Change it as the game changes.

## The idea

The player runs a stall, and also lives a life around it. The stall's money has to survive the
rest of life: rent, food, family, friends. That is what makes cash flow, saving and funding
feel real, and why the world grows alongside the levels.

## Decisions so far

- **The player chooses who they are at the start.** Each background is a set of data, not new code.
- **The world starts small and grows as levels unlock.** Each new place opens with the idea it belongs to.
- **Evenings balance cosy and pressure.** Obligations arrive on a schedule. Good evenings cost something, and skipped ones have a price too.
- **Travel: walk off the edge of a place into the next one.**
- **Evenings are walkable scenes**, built the same way as the market.
- **A missed payment is decided by the background**, not by one global rule.

## A day

| Time | What happens |
| --- | --- |
| Morning | Wake at home. Breakfast costs money. Family may need something. |
| Day | Walk to the market. The stall is open from about 7:00 AM to 6:00 PM. |
| Evening | After 6:00 PM, the player is free to walk around: rest, eat, visit, help family. |
| Night | Sleep. A summary of the whole day, not only the stall. The game saves. |

Times and the length of a day are tunable. Today the stall day lasts two minutes of real time.

## Places, and when they open

| Level | Idea | New place or feature |
| --- | --- | --- |
| 1 | Customers and what they want | The market (built) |
| 2 | Pricing | Price board (built) |
| 3 | Cash flow | Home. Weekly rent and food. Walking between home and the market. |
| 4 | Marketing and reputation | The neighbourhood: a chop bar, neighbours. Word of mouth. |
| 5 | Saving and reinvesting | A susu group and a mobile-money kiosk |
| 6 | Funding | A bank or microfinance office |
| 7 | Teams | A helper at the stall |
| 8 | Risk | Illness, theft, floods, price shocks |

## Backgrounds (to design)

A background sets: starting cash and stock, what is owed and how often, who lives with the
player, what evenings offer, and **what happens when a bill can't be paid**.

Starting ideas, to be worked out:

- **A student paying their own way.** Fees due each term, cheap living, less time for the stall.
- **A young adult living with family.** A share of the household costs, more people who need things, more help available.
- **An adult supporting a family.** Higher fixed costs, a bit more to start with, people depending on them.

Each has its own answer to a missed payment, for example late fees that grow, a setback with
help that comes with strings attached, or a warning followed by a harder consequence.

## How it will be built

- **Locations described by data.** A place has a size, ground, props, solid things, people,
  exits and things to interact with. The market's stall, customers and supplier become
  features attached to the market. Home gets a bed, a table, family and a door.
- **A day director.** The clock and the phases of the day live outside any one scene, so they
  carry across the edges between places.
- **One shared game state and one save**, covering every place. The save gets a new version
  number when the game's shape changes, and older saves are ignored instead of crashing.
- **Backgrounds as data files**, like the country settings.

## Build order

1. **Invisible first step.** Split the market into the location framework and a day director.
   Nothing changes on screen. Saves are versioned.
2. **Home and the edge between home and the market.** Wake up at home, walk to the market, walk
   back, sleep. No bills yet.
3. **Backgrounds and obligations.** Choose a background when creating a character. Rent and food
   arrive on a schedule. This is Level 3, cash flow.
4. **Evenings.** Things to do at home: eat, rest, family. Energy and mood.
5. **The neighbourhood and the next places**, one level at a time.

## Open questions

- How long is a full day, from waking up to sleeping, in real time?
- What does a player lose by skipping an evening, and by skipping a meal?
- How does the player pick a background? A plain choice, or a short story?
- Which people do we want first, and what does each one do?
- What does sleep and the day summary look like?
