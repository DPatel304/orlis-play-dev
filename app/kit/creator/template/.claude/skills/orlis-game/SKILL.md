---
name: orlis-game
description: How an Orlis Play movement game works - the players' body points from the camera, the round (step, draw, score), the game's settings, Orlis Play's sounds and music, orlis.json, and patterns that work well for young children. Use it whenever writing or changing game.js or orlis.json.
---

# Making an Orlis Play game

The game is `game.js`: one plain script (no `import`, no `export`), ending with
`Orlis.run(game)`. It runs in a sandbox and draws on a canvas Orlis Play gives
it; Orlis Play puts the picture on the TV, plays the sounds, and keeps time.

## The game object

```js
Orlis.run({
  secs: 90,            // seconds in a round (or endless: true - it runs until over)
  endless: false,
  music: undefined,    // Orlis Play's band, which builds through the round; or 'action' (tense)
  loud: false,         // true: the music's up from the start (a dance game)
  // (pausing: Back on the remote, or everyone stepping away - leave pausing to Orlis Play)
  keepSitters: false,  // true: someone squatting or sitting stays a player (squat games)
  minPlayers: 1, maxPlayers: 4,
  create(n){ return round; }
});
```

## The round

`create(n)` gives back a round. Orlis Play calls, every frame:

- `step(dt, W, H)` - move the game on by `dt` seconds (about 1/30 to 1/60).
  `W` and `H` are the picture's size in pixels; they can change, so work in
  0..1 units and multiply by `W`/`H` when drawing.
- `draw(c, W, H)` - draw the whole picture on canvas context `c`, every frame,
  from scratch (clear or paint a background first).
- `hud()` - what Orlis Play shows for the game (see **The shared screen**):
  `{ score: [p1, p2, p3, p4] }` for the scores in the top-left corner; also
  `hideScore: true` (a team game), `hideClock: true`, and `panel: [ ... ]` for
  your own counters and bars there.
- `card()` (optional) - which move card Orlis Play shows, bottom left: one of
  `reach`, `flap`, `wave`, `clap`, `hug`, `jump`, `squat`, `march`, `lean`, `duck`,
  `run`, `dance`, `freeze`, `side`, or `null` for none. It slides in and out by itself.
- `value()` - the round's result: the best score.
- `over` - set it to `true` to end the round early.
- `mood` (optional, 0..1) - how big the music is right now.
- `outro(dt, W, H)` (optional) - a short ending after the round; return `true`
  when it's done.

## The players: `Orlis.pose.players`

Up to 4 (`Orlis.MAX_PLAYERS`), always the same 4 slots. Each player:

- `present` - in front of the camera and playing. **Check it first**: absent
  players keep their last position.
- `color` - their colour (also `Orlis.PLAYER_COLORS[i]`). Use it for anything
  that's theirs.
- `hands.left`, `hands.right` - `{ x, y, vx, vy, speed }`: `x`, `y` from 0 to 1
  (0,0 top left of the screen; already mirrored, so moving your right hand
  moves it right on screen), velocity, and speed (screen-widths a second).
- `centre` - `{ x, y }`, the middle of their body.
- `scale` - their size on screen (bigger = closer).
- `lm` - 33 body points (or `null`), each `{ x, y, z, v }` (`v` is how sure the
  camera is, 0..1). Name them with `Orlis.L`: `NOSE`, `L_SHOULDER`,
  `R_SHOULDER`, `L_ELBOW`, `R_ELBOW`, `L_WRIST`, `R_WRIST`, `L_HIP`, `R_HIP`,
  `L_KNEE`, `R_KNEE`, `L_ANKLE`, `R_ANKLE`. `Orlis.BONES` lists pairs to draw
  a stick figure.

Patterns that work:

- **Touching something:** hand within a radius, in pixels:
  `Math.hypot((h.x - t.x) * W, (h.y - t.y) * H) < r * H`.
- **A jump:** the player's `centre.y` rising quickly (smaller `y`), compared
  with where it's been the last half-second.
- **Arms up:** both wrists above the nose (`lm[L.L_WRIST].y < lm[L.NOSE].y`).
- **A squat:** hips dropping towards the knees (set `keepSitters: true`).
- Show each player where their hands are (a soft circle in their colour) so
  children see what they control.

## Sounds and music

Only Orlis Play's own sounds play; anything else is ignored. Kind ones:

`Orlis.sfx.` pop, gold, chime, twinkle, boing, plop, splash, whoosh, tada,
hooray, fanfare, bloom, rainbow, firefly, squeak, quack, meow, bark, honk,
chirp, warble, bird, drum, trumpet, spring, flip, pick, combo, slice, land,
nibble, zap, uhoh, hmm, hey, yawn, startle, step, tick, select, nav

Music: `Orlis.music.intensity(0..1)` (or use `mood` in the round).

Don't play a sound every frame - only when something happens.

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

## The shared screen

Every Orlis Play game has the same edges. The screen is a grid of 20 columns by
11 rows of square cells; Orlis Play and a few helpers draw these, always in the
same place:

```
clock          top centre (Orlis Play draws it)
goal bar       under the clock       Orlis.ui.goal(c, W, H, k)           k from 0 to 1; three stars light up as it fills
hint words     under the goal bar    Orlis.ui.say(c, W, H, { text, t })  t = seconds since the words changed
scores         top left              hud() -> { score: [..] }            a coloured pill for each player
your counters  top left, under them  hud() -> { panel: [..] }            see below
move card      bottom left           card() -> 'reach' ...               Orlis Play draws Cubo doing the move
one badge      bottom right          Orlis.ui.badge(c, W, H, { icon, value })
```

**Hint words are a picture and at most four words**: `\u{1F388} Pop the balloons!`.
Many players can't read yet, so the picture does the job. The first words of a
round arrive big in the middle, shrink into place and are said aloud once, by
Orlis Play; later words just appear. Fade a hint that has done its job with
`until` (seconds): `Orlis.ui.say(c, W, H, { text, t, until: 8 })`.

**Your counters** go in `hud().panel`, up to four rows in all with the scores,
as pictures and numbers only (no words):

```js
hud(){ return { score, panel: [
  { icon: '\u{1F48E}', value: crystals },                          // a chip: a picture and a number
  { icon: '\u2B50', fill: xp / xpNeeded, color: 'gold' },          // a bar: color is 'gold', 'rose' or 'indigo'
] }; }
```

**Keep anything the players have to touch, catch or read out of the shared
areas** - Orlis Play draws on top of them, so it would be hidden. `Orlis.ui.zones(W, H)`
gives their rectangles (`top`, `score`, `card`, `badge`, in pixels) and
`Orlis.ui.under(W, H, x, y)` says whether a point is under one. Targets can pass
behind them briefly (a balloon floating up), but nothing should *stay* there.

Colours mean one thing: a player's colour is always theirs, orange arrows (the
move card's) always mean "move this way", and cream pills are information, never
something to touch. Don't draw your own score, clock or move cards.

## Good games for little ones

- One idea, obvious in the first five seconds.
- Big targets, generous hit areas, slow things at the start, a gentle build.
- Something nice happens for every player, often: sparkles, a chime.
- Nobody is ever stuck or out for long. No "game over" screens - the round
  just ends and everyone gets their score.


## Pictures: the asset library (use it for every picture)

Orlis games don't draw their own art: they ask the **asset library** for it, so every game looks like an Orlis game and
only pieces that have been looked at can appear. This is enforced: the canvas `c` a game is given has no `fillRect`, `arc`,
`fillText` or the like (they say "use Orlis.assets"), and the checks turn those calls away before a game can be sent.
Draw with `Orlis.assets`:

```js
Orlis.assets.scene(c, W, H, 'meadow', { t });                 // a whole background, first (t: seconds, the clouds drift)
Orlis.assets.draw(c, 'giraffe', x * W, y * H, 0.12 * H);      // a piece, centred on (x, y), this many pixels tall
Orlis.assets.draw(c, 'cubo', x, y, size, { pose: 'jump', face: 'grin', t });   // Cubo does his moves (t: seconds)
Orlis.assets.draw(c, 'balloon', x, y, size, { color: '#ff5d6c' });   // some take a colour
Orlis.assets.draw(c, 'bunny', x, y, size, { flip: true, rotate: 0.2, alpha: 0.8, shadow: true });
Orlis.assets.draw(c, 'sparkle', x, y, size, { t: age / 0.6 });        // effects: t goes 0 to 1 and the piece fades
Orlis.assets.text(c, 'Great!', x, y, size, { color: '#fff', outline: '#2b2275' });   // a few words (up to 40 letters)
Orlis.assets.list('animal');   // what there is: [{ id, name, kind, tags, aspect, poses, faces }]
```

`size` is the piece's height; its width is `size * aspect` (from `list()`). A name that isn't in the library draws a
dashed "?" box - the game still runs, but it isn't ready: **use only the names below**. If a game truly needs a piece that
isn't here (a boat, a particular animal), tell the grown-up it isn't in the library yet (a picture can be requested and
added for everyone). Don't draw one yourself.

What's in the library:

{{ASSETS}}

## The Orlis look and feel (follow this)

Every Orlis Play game looks and plays like part of one family. Before
writing `draw`, read this.

### First person: the players are their hands

- Don't draw the players - no bodies, avatars, stick figures or skeletons.
  The screen is the world they're reaching into.
- Each hand is a **glowing mitt** in its player's colour: `Orlis.assets.draw(c, 'hand', x * W, y * H, H * 0.12, { color })`.
  Draw the mitts **last**, on top of everything, so a child never loses them.

### Two players for now

Orlis Play is played two at a time for now: only `players[0]` and
`players[1]` ever fill. Make the game work for **one child alone** too (a
child on their own must still get through everything, not just half the
screen), and still check `present` for every player every frame.

### Gentle: nothing to lose

- No lives, no game over, no "you lose", nothing that takes points away.
- Only things to chase, catch, build, make or find - and a celebration when
  it's done (a burst, a "Hooray!", the thing coming alive), then again.
- A loop that comes round every 20-40 seconds, many times in a 2-3 minute
  round, so there's always a next good moment.
- Generous: big targets, reach that counts from a little way off, a gentle
  pull when something's nearly there. Test it as a toddler would: slow,
  wobbly, standing in one spot.

### The painted house style (the library does it for you)

The asset library is drawn in the Orlis house style: flat colour, one soft shadow tone on the right of things (the sun is up
on the left), painted skies with a warm glow, hills fading into the distance, a calm world with bright players. Use its
scenes and pieces as they are, and your game looks like part of the family. **Don't draw shapes, pictures or letters of your
own: games can't** - the canvas `c` you're given only lets you place what the library draws (`save`, `restore`, `translate`,
`rotate`, `scale`, `globalAlpha`). For words on screen (a short "+1" or "Go!"), use
`Orlis.assets.text(c, '+1', x, y, size, { color: '#fff', outline: '#2b2275' })`.
