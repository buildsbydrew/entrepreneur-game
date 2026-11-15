# Code map

Where things live. Update this when the structure changes.

## Scenes (`js/scenes/`)

| File | What it is |
| --- | --- |
| `BootScene.js` | Loads the data files and draws the art once, then opens the menu. |
| `MenuScene.js` | The title screen, with Continue if there is a saved game. |
| `SetupScene.js` | Building the character and naming the stall. |
| `WorldScene.js` | What every place the player can walk around has in common. |
| `HomeScene.js` | Home: where the player wakes and sleeps. Games start here. It extends `WorldScene`. |
| `MarketScene.js` | The market. It extends `WorldScene`. |
| `PauseScene.js` | The pause menu, shown over a frozen place. |
| `constants.js` | Numbers shared by the scenes: sizes, speeds, drawing order. |

### Shared by every place (`js/scenes/world/`)

| File | What it does |
| --- | --- |
| `hud.js` | The interface: cash, stock, clock, messages, the "press E" prompt. |
| `controls.js` | The player, the camera, and moving with keys or the joystick. |
| `modal.js` | Conversations and the Notebook. |
| `pause.js` | Opening the pause menu. |
| `missions.js` | The goals panel, finishing goals, the level-complete screen. |
| `clock.js` | The clock on screen, and noticing 6 PM (trading ends) and 10 PM (bedtime). |
| `day.js` | The shape of a day anywhere: closing the trading day, the Takings report, the evening, sleeping, waking up. |
| `travel.js` | Getting a place ready, and walking off an edge into the next place (arrows, signposts, the fade). |
| `saving.js` | Saving the game. |
| `signs.js` | Wooden name boards over stalls. |

### The market only (`js/scenes/market/`)

| File | What it does |
| --- | --- |
| `stall.js` | The player's stall, opening and closing, serving customers. |
| `customers.js` | Where customers wait, who comes, what they want. |
| `supplier.js` | The supplier, buying stock, the umbrellas. |
| `mentor.js` | Maame Gyasiwaa: her stall, her walks and errands, what she says. |
| `ambient.js` | The other traders and strollers, and who shops where. |
| `prices.js` | The price board and how customers react to prices. |
| `day.js` | The market's part of the day: closing the stall at 6 PM, her evening visit, her morning talks, leaving for home. |

### Home only (`js/scenes/home/`)

| File | What it does |
| --- | --- |
| `room.js` | The walls, door, furniture, the bed, and the path to the market. Laid out in `data/places.json`. |

A scene is built from its own class plus these files. Each file exports a group of methods that
are added to the scene, so inside them `this` is the scene.

## Everything else

| Folder | What is in it |
| --- | --- |
| `js/entities/` | People and how they move: `Customer`, `Walker`, `PersonSprite`, `Mover`, `crowd`, `routes`, `movement`. |
| `js/art/` | The art, drawn as code: `shapes`, `people`, `home`, `textures`. |
| `js/audio/` | Sound effects, music and the market sounds, all made in code. |
| `js/ui/` | The menu screens, touch controls, backdrop and options. |
| `js/state.js` | The game's money, stock, goals and prices. No drawing. |
| `js/dayClock.js` | The time of day, shared by every place, and the light at each hour. No drawing. |
| `js/save.js` | Saving and loading. |
| `js/mentor.js`, `js/missions.js` | The logic behind her conversations and the goals. |
| `data/` | Items and prices (and the day's hours), levels and goals, the mentor's lines, the Notebook, the market's people, and `places.json`: each place's exits, entries, and home's layout. |
| `docs/` | Design documents. |
