# "I let AI live a whole life in my game": making an episode

Everything for the YouTube series lives in this folder. The game plays a whole life by itself (film
mode), a script records it, and the edit is built in code with Remotion. No voiceover: the story is told
by the game's own dialogue, chapter cards, short time-jump captions and music.

It plays like a film: no menus, answer lists, prompts or readouts ever appear. When the AI chooses, its
answer is simply said out loud as the character's line. Time jumps become one short caption ("A year
passed. Ada spent it with family."). Only the few biggest decisions of a life (4 by default) get a
two-second "decision" card in the edit. The music steps back whenever someone speaks, to leave room for
the characters' voices.

## One-time setup

```
cd video
npm install
```

You need Google Chrome installed (the recorder borrows it, with a fresh empty profile, so your own saved
life in the game is never touched).

## Make an episode (one command)

```
cd video
node make.mjs --id ep02 --name Remy --body boy --skin 5 --personality troublemaker --seed 42
```

- `--id`: the episode's folder name (`episodes/ep02`).
- `--name`, `--body` (boy or girl), `--skin` (1 to 6): who is born.
- `--personality`: `kind`, `troublemaker`, `ambitious` or `dreamer`. Every choice the AI makes follows it.
- `--seed`: any number. The same seed plays out exactly the same life, so you can re-record it.

It takes a while on this laptop: a few minutes to test-play the life, then an hour or two to record the
chosen moments, then a while to render. Leave it running, plugged in, with the lid open: the scripts keep
Windows from going to sleep while they run (a closed lid still sleeps). If it stops part way, run the same command
again with `--from record` (or `--from edit`, `--from render`) to carry on.

The finished videos land in `video/out/`: `ep02-episode.mp4` (16:9) and `ep02-short.mp4` (9:16, 60 s).

## Picking a dramatic life first

Before filming, let the scout play lots of lives quickly and score them for drama (big decisions,
hurt feelings, secrets kept, hardship, betrayals, the stranger, raised voices):

```
node scout.mjs --seeds 1-12 --personalities troublemaker,kind,ambitious,dreamer --until the-baby
```

It prints the most dramatic lives and the exact `make.mjs` command to film the best one. A seed always
plays out the same life, so what the scout saw is what gets filmed.

## One life, several episodes

A life is told as a serial, one stretch of life per episode, each ending on a big day's closing line:

```
node make.mjs --id remy1 --episode 1 --until the-baby --name Remy --body boy --skin 5 --personality troublemaker --seed 3
node make.mjs --id remy2 --episode 2 --after the-baby --until scholarship --name Remy --body boy --skin 5 --personality troublemaker --seed 3
```

Each episode opens cold on its most dramatic moment (cut just before the answer), then the title, one
line of premise and "Seven years earlier...". Later episodes start with a "Previously" recap. The first
time someone important appears, the picture freezes for a moment with their name and a line about who
they are on the surface (`intros.json`; never a secret). An episode that doesn't reach the end of the
life ends on "To be continued" and asks viewers what they would have done.

## Polishing the words before the final render

After the `edit` step, `episodes/<id>/script.draft.json` holds every chapter title, caption and decision
card the pipeline wrote (a decision card can be given a hand-written question, e.g. "Keep the money, or
give it back?", under its `decision-e...` key). The life's real numbers (age at death, choices,
conversations, days played) are in `episodes/<id>/facts.json`: use those in the YouTube text. To change any of them, copy it to `script.json` in the same folder, edit the words,
and run `node make.mjs --id <id> --from edit`. Your words are kept every time you re-run.

The YouTube chapter list is written to `episodes/<id>/chapters.txt`, ready to paste into the description.
`episodes/ep01/youtube.txt` shows the title, description, tags and thumbnail ideas for episode 1.

## Watching film mode yourself

With the game running (`npm run dev` in the main folder), open
http://localhost:5173/?film&name=Ada&personality=kind&seed=7 and the game plays itself in real time.
Add `&step` and it waits for the recorder instead (for recording only).

## The pieces

| File | What it does |
| --- | --- |
| `make.mjs` | Runs every step below in order. |
| `probe.mjs` | Test-plays a life quickly without drawing it, and saves the log of what happened. |
| `scout.mjs` | Plays many lives and ranks them for drama, to pick the one to film. |
| `intros.json` | The name and one line shown the first time each important person appears. |
| `plan.mjs` | Picks what to keep (cuts dull walking and waiting), writes chapters, captions and the AI's reasons. |
| `short.mjs` | Picks the moments for the 60-second Short. |
| `record.mjs` | Records the chosen moments at 1080p, frame by frame, smooth however slow the laptop is. |
| `snapshot.mjs` | Packs a frozen copy of the game for recording, so game edits can't disturb it. |
| `audio.mjs` | Makes the music and sound effects in code. |
| `render.mjs` | Renders the videos in chunks and adds the sound. |
| `src/` | The Remotion edit: `Episode.tsx`, `Short.tsx`, and the cards and captions in `parts.tsx`. |
| `../src/film/` | Film mode inside the game: the autopilot, the personalities, the film camera and the life log. |

To see and scrub the edit before rendering: `npx remotion studio src/index.ts`.
