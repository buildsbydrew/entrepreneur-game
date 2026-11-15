# Life design (living document)

The game is becoming a **life simulator**: live one whole life, from birth to old age, in a walkable 3D
world full of people with their own stories. This document records what has been decided. It replaces
`world-design.md`, which described the earlier market-centred plan.

## Decided (2026-11-15)

### The game
- **A life, not a job.** The market is one possible path, not the centre. Money still matters in every
  life (rent, fees, debts, dreams), so ideas about earning and running things come up naturally, never as
  the point and never named as something being taught.
- **No guide.** Nobody gets a guide in real life, so there is no mentor character. The player learns from
  what happens and from the people around them, who have their own lives and opinions.
- **Story first.** People remember what you did. Storylines run in the background and move on whether or
  not you are watching. Conversations offer real choices, and choices are trade-offs, not good/bad buttons.
  Drama is allowed (gossip, love, betrayal, family pressure, rivalry, reconciliation), kept family-friendly.
- **A life begins with a prologue, then your first memory at age 5.** Nobody remembers being a baby, and
  babies don't make choices, so the first years are a short prologue (about a minute, skippable): scenes told
  the way families tell them, each with one family choice that shapes your personality and closest people.
  The played life starts at age 5, on the first day you're allowed out on your street alone. Later starts
  (teen, adult, elder) unlock for free after finishing a life, with paying only as a shortcut. New *lives*
  (different families, cities, circumstances) are the thing worth paying for. The scenes are in
  `src/data/prologue.json`.
- **Life is uncertain.** Accidents, illness and sudden death can happen. Choices change the odds (health,
  habits, risks taken), but never remove them completely.
- **When the character dies, the game ends** with a **life story**: the people, choices, turning points and
  what was left behind. Then a new life can begin.

### Time
- **Standard length:** a whole life takes about **25 hours** to play, about **100 played days**.
- **While a day is played, time flows** like an open world: the sun moves, places open and close, people go
  about their day. A played day lasts about **15 real minutes**. Conversations pause the clock.
- **Between played days, time jumps.** A short scene shows what happened, then the player chooses what to
  focus on next (studies, friends, family, money, love). That choice shapes the jump.
- **Big moments are always played**, never skipped.

| Chapter | Rough play time |
| --- | --- |
| Baby and child | about 2 hours |
| Teenager | about 4 hours |
| Young adult | about 7 hours |
| Adult | about 8 hours |
| Elder | about 3 hours |

### The world
- **Names:** the game is called **Urlivaven**, the country is **Urlivana**, and the money is **livs**
  ("12 livs"). The feel is a modern-day city.
- **Made up and fully developed, for a global audience.** It must not copy any real country's places,
  towns, names, currency or brands. It needs its own geography, neighbourhoods, culture, food, names,
  money and history, consistent everywhere.
- **Our own currency.** Its name lives in one data file (`src/data/world.json`), so it can be renamed in one
  place. On screen, money shows as a coin icon and a number.
- Places open as the life needs them: home, neighbourhood, schools, workplaces, markets, eating places,
  places of worship, campus, bank, hospital, and more.

### Look and platform
- **3D**, low-poly "toy diorama" style with a moving sun (see `prototypes/3d-market/`).
- **Web first, then an Android app** (APK / Play Store) from the same game.
- All earlier polish ideas and changes are approved: clean interface, phone controls, frequent saving,
  settings for cheap phones, fair monetisation only (no gambling-style mechanics, no pay-to-win).

### The build is documented
- Each stage of the build becomes a YouTube video for Drew's Builds, made from real footage of the game.
  How this is done is still to be worked out.

## Still to decide
- The world: its name, its main city or town, its look and feel.
- The storylines and the first cast of characters (to be discussed together).
- The rest of the names: the city, neighbourhood, people and brands (suggestions are on the table).
- The 2D market game is kept in `legacy-2d/` for reference only. Maame Gyasiwaa is retired with it.
- The title of the game.
- Money model (free, one-time price, ads, premium lives) and online features (leaderboards, sharing).
