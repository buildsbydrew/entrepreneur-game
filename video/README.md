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
node make.mjs --id ep02 --name Kofi --body boy --skin 5 --personality troublemaker --seed 42
```

- `--id`: the episode's folder name (`episodes/ep02`).
- `--name`, `--body` (boy or girl), `--skin` (1 to 6): who is born.
- `--personality`: `kind`, `troublemaker`, `ambitious` or `dreamer`. Every choice the AI makes follows it.
- `--seed`: any number. The same seed plays out exactly the same life, so you can re-record it.

It takes a while on this laptop: a few minutes to test-play the life, then an hour or two to record the
chosen moments, then a while to render. Leave it running. If it stops part way, run the same command
again with `--from record` (or `--from edit`, `--from render`) to carry on.

The finished videos land in `video/out/`: `ep02-episode.mp4` (16:9) and `ep02-short.mp4` (9:16, 60 s).

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
| `plan.mjs` | Picks what to keep (cuts dull walking and waiting), writes chapters, captions and the AI's reasons. |
| `short.mjs` | Picks the moments for the 60-second Short. |
| `record.mjs` | Records the chosen moments at 1080p, frame by frame, smooth however slow the laptop is. |
| `snapshot.mjs` | Packs a frozen copy of the game for recording, so game edits can't disturb it. |
| `audio.mjs` | Makes the music and sound effects in code. |
| `render.mjs` | Renders the videos in chunks and adds the sound. |
| `src/` | The Remotion edit: `Episode.tsx`, `Short.tsx`, and the cards and captions in `parts.tsx`. |
| `../src/film/` | Film mode inside the game: the autopilot, the personalities, the film camera and the life log. |

To see and scrub the edit before rendering: `npx remotion studio src/index.ts`.
