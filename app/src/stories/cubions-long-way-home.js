/* Cubion's Long Way Home - the first Storytime story (the script is in app/stories/cubions-long-way-home.md).
   A story is data: the player (games/story-player.js) reads it and does the rest.

   A story is a list of beats. A beat has:
     t       the words on the plate (and, unless `say` is given, the words spoken)
     say     the words spoken, when they differ from what's shown (a name made of bleeps)
     to      walk to this place in the world while it's told (Cubo stays at the same spot on the screen; the world slides by)
     card    a move card (a pose name from figure.js) - Cubo does the move too, and anyone watching can copy; nothing is checked
     pose    a pose for Cubo without the card
     face    a face for Cubo (figure.js FACES)
     fx      sounds: [[seconds into the beat, sfx name, argument], ...]
     hold    seconds of quiet after the words (the echo moment after the refrain; time to join in)
     refrain the line the story keeps coming back to (drawn bigger, in gold)
     jump    a beat with no words: the flash, and Cubo is somewhere else (`to`)
     gather  the animals come to Cubo; wobble: how much everything wobbles (0..1)
     shake   the screen thuds */
export const REFRAIN = 'Cubes don’t do that. But Cubo does.';
const R = { t: REFRAIN, refrain: true, face: 'smirk', hold: 1.6 };

/* where Cubo stands in the world (the Cube Planet is at the very start; the meadow begins at MEADOW) */
export const PLACES = { planet: 300, meadow: 2300, giraffe: 3100, bunny: 3800, bird: 4500, frog: 5200, home: 6100 };
export const MEADOW = 2000;
/* how far in front of Cubo each animal stands */
export const AHEAD = 360;

export default {
  id: 'cubions-long-way-home', name: 'Cubion’s Long Way Home',
  blurb: 'A funny story about a little cube learning to move.',
  beats: [
    /* page 1: the Cube Planet */
    { t: 'Far, far away there is a planet where everything is square.' },
    { t: 'The houses are square. The hills are square. Even the clouds sit in neat little stacks.' },
    { t: 'Nothing ever moves, because moving is messy.' },
    { t: 'Click, click, said the tall, stern Cube Elders. That means, “Please stay exactly where you are.”', fx: [[0.2, 'tick'], [0.45, 'tick']] },
    /* page 2: Cubion */
    { t: 'One small cube was different. His name was Cubion!#&-551.', say: 'One small cube was different. His name was Cubion. Bleep, bloop, five five one!', face: 'grin', fx: [[2.7, 'beep'], [3, 'beep', true], [3.3, 'beep']] },
    { t: '(Say it fast, with lots of bleeps.) On Earth, everyone would call him Cubo.', say: 'Say it fast, with lots of bleeps. On Earth, everyone would call him Cubo.' },
    { t: 'Cubo wondered what it would feel like to move. The Elders did not like wondering.', face: 'wow', wobble: 0.35 },
    { t: 'Click-click-CLICK. That means, “Go to Earth, where everything wiggles, and learn how.”', fx: [[0.1, 'tick'], [0.35, 'tick'], [0.6, 'clank']], wobble: 0.5 },
    { jump: true, to: PLACES.meadow, fx: [[0, 'windup'], [0.5, 'whoosh']] },
    /* page 3: the landing */
    { t: 'Cubo landed on Earth with a great big THUD.', face: 'wow', shake: true, fx: [[0, 'thud']] },
    { t: 'Cubes don’t land softly. Cubes land squarely.' },
    { t: 'He looked around. Everything here was moving! Leaves wiggled. Clouds drifted.', to: PLACES.giraffe - 300, pose: 'march', face: 'grin' },
    { t: 'And a very tall giraffe was stretching up to the sky.', to: PLACES.giraffe, pose: 'march', face: 'wow' },
    /* page 4: the giraffe */
    { t: '“Reach up high!” said the giraffe.', card: 'reach', hold: 1.5 },
    { t: 'Cubo reached with all his might. He was exactly as tall as before.', card: 'reach', face: 'tongue', hold: 1 },
    { t: 'He reached harder and tipped right over. THUD.', pose: 'lean', shake: true, fx: [[2.4, 'thud']] },
    { t: 'Then he looked up. He was a teeny bit taller. A hair taller.', face: 'joy' },
    R,
    /* page 5: the bunny */
    { t: 'Next came a bunny.', to: PLACES.bunny, pose: 'march', face: 'grin' },
    { t: '“Hop!” said the bunny.', card: 'jump', hold: 1.5 },
    { t: 'Cubo hopped. Flop. Cubo hopped again. Flop.', card: 'jump', face: 'grin', fx: [[1.1, 'land'], [2.3, 'land']], hold: 1 },
    { t: 'Then, for one wonderful second, he was off the ground. By the width of a daisy.', pose: 'jump', face: 'joy', fx: [[0.2, 'boing']] },
    R,
    /* page 6: the bird */
    { t: 'A little bird fluttered by.', to: PLACES.bird, pose: 'march', face: 'wow', fx: [[0.5, 'chirp']] },
    { t: '“Flap!” chirped the bird. But Cubo has no wings, so he flapped his corners.', card: 'flap', hold: 1.5, fx: [[0.3, 'chirp', 2]] },
    { t: 'Flap, flap, flap. Nothing. Flap, flap, FLAP!', card: 'flap', face: 'tongue', hold: 1 },
    { t: 'He rose up a whole inch, and landed in a bush.', pose: 'flap', face: 'wow', fx: [[1.5, 'rustle'], [1.65, 'rustle']] },
    R,
    /* page 7: the frog */
    { t: 'Last came a frog.', to: PLACES.frog, pose: 'march', face: 'grin' },
    { t: '“Squat down low,” said the frog.', card: 'squat', hold: 1.5 },
    { t: 'Cubo squatted down low. He was very, very good at this. He was so good that he couldn’t get back up.', card: 'squat', face: 'smirk', hold: 1 },
    { t: '“Cubes do that,” said the frog. “And Cubo does it VERY well.”', refrain: true, face: 'smirk', hold: 1.6 },
    /* page 8: everyone wobbles */
    { t: 'Then something wonderful happened.', gather: true, face: 'wow' },
    { t: 'The giraffe tripped over her own feet. The bunny landed in a pond. The bird missed her branch. The frog flopped on his back.', wobble: 0.7, fx: [[0.6, 'uhoh'], [2.4, 'splash'], [4.2, 'rustle'], [6, 'land']] },
    { t: 'They were all wobbling! Cubo laughed his very first laugh.', wobble: 1, pose: 'dance', face: 'joy', fx: [[1.5, 'hooray']] },
    { t: '“Everybody wobbles,” said the giraffe. “That’s the fun of it.”', wobble: 0.5, face: 'joy' },
    /* page 9: the long way home */
    { t: 'Far away, the Elders clicked, asking if he’d learned the secret.', fx: [[0.3, 'tick'], [0.6, 'tick']], face: 'smile', wobble: 0 },
    { t: 'Cubo thought about it. The secret was wobbling, and wobbling is better with friends.', face: 'smirk' },
    { t: 'Then he saw a warm glow in a window.', to: PLACES.home, pose: 'march', face: 'wow' },
    { t: 'A TV! With children in front of it, wobbling and laughing.', face: 'joy' },
    { t: 'It was a very long way home. Just not the way he’d planned. So Cubo stayed.', face: 'smile' },
    { t: REFRAIN, refrain: true, face: 'joy', hold: 3.5, pose: 'wave' }
  ]
};
