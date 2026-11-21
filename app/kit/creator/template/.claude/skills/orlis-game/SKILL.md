---
name: orlis-game
description: How to make an Orlis Play movement game - a short description (Orlis.play) made of ready-made pieces, movements, triggers and results - plus the asset library, the shared screen, orlis.json and what works for young children. Use it whenever writing or changing game.js or orlis.json.
---

# Making an Orlis Play game

A game is **a description, not a program**. `game.js` is one call, `Orlis.play({ ... })`, holding plain JSON that says what is on
screen, how it moves, and what happens when a hand touches it. There is no code to write: Orlis Play has the ready-made words
(below), the picture library, and the engine that runs it. Anything that isn't a word below isn't understood, so use only these.

```js
Orlis.play({
  "secs": 90, "scene": "meadow",
  "hint": "\u2B50 Catch the stars!", "card": "reach", "cardFor": 8,
  "goal": { "score": 40 },
  "things": [
    { "piece": "star", "size": 0.085, "appears": { "every": 1.3, "from": "top", "max": 9 }, "moves": "fall",
      "rules": [ { "when": "touched", "then": ["sparkle", "score", { "sound": "pop" }, "vanish"] } ] }
  ]
});
```

Keep the inside as **strict JSON**: names in "double quotes", no comments, no trailing commas, no functions. (A short `/* comment */`
before `Orlis.play(` is fine.) Orlis Play checks every word when the game is tried or sent, and says what's wrong - and what you
probably meant. If you can't say what the grown-up wants with these words, say so plainly: it can be asked for as a new word.

## The game

{{VOCAB}}

## Three examples (they are all the words you need to start)

**Catch** - things fall, hands catch them (this is the starter):
```json
{{CATCH}}
```

**Pop** - balloons float up, hands pop them:
```json
{{POP}}
```

**Keep it up** - a ball bounces, hands knock it back up:
```json
{{KEEPUP}}
```

Ideas that fit the words: catch falling things, pop rising things, tap things that appear, keep a ball in the air, swat things
drifting across, shoo wandering animals, grow things by touching them ("grow"), turn things into other things ("become"), a
chain reaction ("spawn"). Mix the words; give things names and have one spawn another.

## The players

Everyone plays with their **hands**: a glowing mitt in their colour follows each hand (the engine draws it). Up to two play at
once; a game must work for one child alone. A thing is touched by any player's hand, and the points go to whoever did it
(`"team": true` makes it one shared score and hides the pills). Nobody is ever out: no lives, no game over.

## Sounds

Only these sounds, in `{ "sound": "name" }`: pop, gold, hooray, whoosh, tada, chime, boing, chirp, plop, splash, spring, rustle, twinkle, bloom, tick.
Not every frame: one when something happens.

## orlis.json

```json
{
  "id": "bird-hoops",                       // lowercase letters, numbers and dashes; stays the same forever
  "name": "Bird Hoops",                     // up to 40 letters
  "version": "0.1",                         // raise it for each new version sent: 0.2, 0.3...
  "blurb": "Flap your arms to fly through the hoops",
  "about": "A few friendly sentences for the game's page in the Store.",
  "players": [1, 4],
  "uses": "body",                           // "hands" or "body"
  "ages": 3,                                // the youngest it's easy for
  "tags": ["Flying", "High energy"],        // up to 6. These sort it in Discover: "High energy", "Calm", "Music", "Dance", "Together"
  "howto": [ { "move": "wave", "title": "Flap", "line": "Flap your arms to fly up" } ],
  "icon": { "cols": ["#0ea5e9", "#6366f1"], "glyph": "<path d=\"...\" fill=\"#fff\"/>" },
  "cover": "<svg viewBox=\"0 0 160 100\" xmlns=\"http://www.w3.org/2000/svg\">...</svg>"
}
```

(no comments in the real file - it's JSON). `howto` moves: reach, jump, duck,
squat, wave, run, dance, together (up to 5). The icon's `glyph` is SVG on a
100 x 100 square: white shapes only (`path`, `circle`, `rect`, `ellipse`,
`polygon`) - no scripts, links or images.

### The cover

`cover` is the picture the game shows in Play and Discover: a little scene of
the game, as one SVG string. Orlis Play puts the game's name on it, so **no
words in the picture** (no `<text>`). Draw it on `viewBox="0 0 160 100"`
(wide), with the main thing - the creature, the balloons, the tower - in the
middle and right, because the name goes bottom left. Use bright, friendly
colours, 8 to 25 shapes, from `rect`, `circle`, `ellipse`, `path`, `polygon`
and `g`; gradients are fine (`<linearGradient>` inside `<defs>`, used as
`fill="url(#sky)"`). No `<text>`, `<style>`, `<use>`, `<image>`, links or
scripts. Keep it under 12,000 letters. Inside the JSON it's one line, so use
single quotes for the SVG's attributes (`fill='#fff'`) to avoid escaping.

## Good games for little ones

- One idea, obvious in the first five seconds.
- Big targets, generous hit areas, slow things at the start, a gentle build.
- Something nice happens for every player, often: sparkles, a chime.
- Nobody is ever stuck or out for long. No "game over" screens - the round
  just ends and everyone gets their score.


## Pictures: the asset library (the only pictures there are)

Orlis games don't draw their own art: every picture is a **piece** (or a **scene**) from the asset library, named in the
description, so every game looks like an Orlis game and only pieces that have been looked at can appear.

- `"scene": "meadow"` - the whole background.
- `"piece": "giraffe"` - what a thing looks like; a list (`["bunny", "frog"]`) picks one at random for each. `{ "become": "bunny" }` changes it.
- `"color": "touch.mint"` - for the pieces that take a colour (balloon, star, heart, block, cloud, ring, dot...); a name from the
  Orlis palette (see **Colours** below), or a list of names to pick from.
- `"size"` is the height as a share of the screen; the width follows from the piece (`aspect` below).

A name that isn't in the library is turned away with "did you mean...?". If a game truly needs a piece that isn't here (a boat, a
particular animal), tell the grown-up it isn't in the library yet - a picture can be requested and added for everyone. Don't try
to draw one yourself: games can't.

What's in the library:

{{ASSETS}}

## The shared screen (the engine fills it in)

Every Orlis game has the same edges, so players learn them once. You don't draw any of it: say what goes there.

```
hint words     under the clock      "hint": "\u{1F388} Pop the balloons!"   a picture and at most four words
move card      bottom left          "card": "reach", "cardFor": 8           which move Cubo shows (reach, jump, squat, flap...)
goal bar       under the clock      "goal": { "score": 40 }                 fills as points come in; three stars light up
scores         top left             (automatic)                             a coloured pill for each player
```

Hint words are **a picture and at most four words**; many players can't read yet. The first words arrive big in the middle,
shrink into place and are said aloud once. Colours mean one thing: a player's colour is always theirs, and orange arrows (the
move card's) always mean "move this way".

## Colours

Colours come from the Orlis master palette, **by name**, never as a code. In the description write the name, like
`"color": "touch.mint"` (it is what `Orlis.assets.color('touch.mint')` gives). **Never write `#ff9a55`, `rgb(...)` or `hsl(...)`**:
the checks turn a game with a colour code back. The palette is one list, so it can be tuned later and every game follows.

{{PALETTE}}

Pick the **touch** colours for things to catch and pop (they are the brightest things on screen); never for scenery. The plain
words red, orange, yellow, green, blue, purple, pink and gold still work, but the palette names are better.

## The Orlis look and feel

The asset library is drawn in the Orlis house style - flat colour, one soft shadow tone, painted skies, calm worlds - so a game
made from it looks like part of the family. **You can't draw shapes, pictures or letters of your own**, and there's no code to do
it with. Pick a scene, pick pieces, and let them move.

- **Gentle: nothing to lose.** No lives, no game over, nothing that takes points away. Things to catch, pop, find and grow.
- **Generous.** Big pieces (size 0.08 or more), things that don't move too fast (speed 0.05 to 0.15), plenty to touch.
- **A little more as it goes.** `"everyEnd"` makes things appear faster over the round.
- **Something nice happens often.** Sparkle, pop, a sound, a cheer.
- **For one child alone, too.** Test it in your head as a toddler would: slow, wobbly, standing in one place.
