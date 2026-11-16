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
| `core/input.js` | Keyboard, plus the phone joystick, action button and jump button. Move: WASD/arrows. Run: Shift (or the stick pushed all the way). Jump: Space. Use, talk, sit: E or Enter. |
| `render/shapes.js` | Building blocks for 3D shapes, shared materials, painted text for signs. |
| `render/daylight.js` | The sun, sky and lamps through the day. |
| `render/quality.js` | Low / Medium / High picture quality. |
| `world/Place.js` | Builds a place from data: ground, props, exits at the edges, things to use. Lifts roofs when you walk inside. |
| `world/props.js` | Every kind of prop: houses you can walk into, shops, furniture, trees, fences, roads, lamps, cars. |
| `world/collision.js` | What can't be walked through: solid boxes and other people. Tested. |
| `world/spots.js` | Places on furniture to sit, lie, cook, kneel, play or lean; props add them as they're built. |
| `people/body.js` | A person's body for each stage of life (baby, child, teen, adult, elder), and how it moves. |
| `people/Person.js` | One person: position, facing, walking, stepping aside for others, activities, jumping, running, fidgets. The player is one too. |
| `people/actions.js` | Everyday moves: run, jump, sit, lie, kneel, wave, talking with hands, eat, cook, read, sew, sweep, play, lean, phone, and little fidgets. |
| `story/conversation.js` | Conversation rules: which conversation someone wants to have, which choices show, what they change. Tested. |
| `story/talk.js` | Plays a conversation on screen. |
| `story/storyDays.js` | Big days (the first day out, the night the baby came...): time jumps stop at them, goals, moments, closing lines. Data in `data/storydays.json`. Tested. |
| `story/prologue.js` | The prologue: the years you don't remember, as short scenes. Data in `data/prologue.json`. |
| `audio/voice.js` | People speak Urlivani, the made-up language: each person's own voice, with feeling. |
| `world/propsTown.js` | Props for the town: school desks, hospital beds, the supermarket, the park's pond and swings. |
| `film/` | Film mode (`?film`): the game plays a whole life by itself for the YouTube series. `autopilot.js` plays (walks with `nav.js`, talks, chooses with `personality.js`), `bigdays.js` follows a big day's goals and moments, `camera.js` shoots it like a film (establishing, tracking, over-the-shoulder, close-ups), `look.js` adds depth of field and a colour grade, `film.js` keeps the life log; `vclock.js` lets the recorder move time frame by frame. Never shown to normal players. |
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
- `video/` — records autopiloted lives and edits them into YouTube videos with Remotion. See `video/README.md`.
- `docs/life-design.md` — what the game is and what has been decided.
- `prototypes/3d-market/` — the first 3D test scene.
- `legacy-2d/` — the old 2D market game, kept for reference. It runs on its own with Live Server.
