# Code map

Where things live in the 3D life game. Update this when the structure changes.

## Running it

```
npm install      (once, after cloning)
npm run dev      (play it at http://localhost:5173 ; add ?dev for the testing panel)
npm test         (checks the clock, saving and conversations)
npm run build    (packs the game into dist/ for the web and, later, the phone app)
```

## `src/`

| Folder / file | What it is |
| --- | --- |
| `main.js` | Starts the game. Adds the testing panel with `?dev`. |
| `core/Game.js` | The game itself: the 3D view, the current place, people, the player, camera, time, talking, sleeping, pause, saving. |
| `core/clock.js` | The calendar (seasons, years, age) and time of day. No drawing; tested. |
| `core/state.js` | The life being played: who you are, the date, money, where you are, how people feel about you, what has happened. |
| `core/save.js` | Saving and loading, with a version number. Saves every 10 seconds, on every change of place, on sleep, and when the game is hidden. Tested. |
| `core/input.js` | Keyboard, plus the phone joystick and action button. |
| `render/shapes.js` | Building blocks for 3D shapes, shared materials, painted text for signs. |
| `render/daylight.js` | The sun, sky and lamps through the day. |
| `render/quality.js` | Low / Medium / High picture quality. |
| `world/Place.js` | Builds a place from data: ground, props, exits at the edges, things to use. Lifts roofs when you walk inside. |
| `world/props.js` | Every kind of prop: houses you can walk into, shops, furniture, trees, fences, roads, lamps, cars. |
| `world/collision.js` | What can't be walked through: solid boxes and other people. Tested. |
| `people/body.js` | A person's body for each stage of life (baby, child, teen, adult, elder), and how it moves. |
| `people/Person.js` | One person: position, facing, walking, stepping aside for others. The player is one too. |
| `story/conversation.js` | Conversation rules: which conversation someone wants to have, which choices show, what they change. Tested. |
| `story/talk.js` | Plays a conversation on screen. |
| `ui/ui.js`, `ui/ui.css` | The interface: corner readouts, prompts, messages, conversations, title, new life, pause menu, fades. |

## `src/data/` (change the game without touching code)

| File | What it holds |
| --- | --- |
| `world.json` | The world's name, the currency's name, the calendar, the length of a day, starting money. |
| `places.json` | Every place: size, props, exits, entries, things to use. |
| `people.json` | Every person: where they live and stand, their look, their stage of life, their conversations. |
| `conversations.json` | What people say, the choices, and what each choice changes. |

## Elsewhere

- `tests/` — the automatic checks (`npm test`).
- `docs/life-design.md` — what the game is and what has been decided.
- `prototypes/3d-market/` — the first 3D test scene.
- `legacy-2d/` — the old 2D market game, kept for reference. It runs on its own with Live Server.
