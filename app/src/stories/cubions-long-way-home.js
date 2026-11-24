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
const R = { t: REFRAIN, refrain: true, face: 'smirk', hold: 1.2 };

/* where Cubo stands in the world (the Cube Planet is at the very start; the meadow begins at MEADOW) */
export const PLACES = { planet: 300, meadow: 2300, giraffe: 3100, bunny: 3800, bird: 4500, frog: 5200, home: 6100 };
export const MEADOW = 2000;
/* how far in front of Cubo each animal stands */
export const AHEAD = 360;

export default {
  id: 'cubions-long-way-home', name: 'Cubion’s Long Way Home',
  blurb: 'A funny story about a little cube learning to move.',
  beats: [
    /* page 1: the Cube Planet - and the first move, almost at once: be a cube */
    { t: 'Far away is a planet where everything is square.' },
    { t: 'Nothing moves here. The Cube Elders click: “Be a cube! Stand still!”', card: 'freeze', hold: 1.2, fx: [[1.5, 'tick'], [1.75, 'tick']] },
    /* page 2: Cubion */
    { t: 'One small cube was different. Cubion!#&-551. Call him Cubo.', say: 'One small cube was different. Cubion. Bleep, bloop, five five one! Call him Cubo.', face: 'grin', fx: [[1.7, 'beep'], [2, 'beep', true], [2.3, 'beep']] },
    { t: 'Cubo wondered how it felt to move. Click-click-CLICK! “Go to Earth. Learn to wiggle.”', face: 'wow', wobble: 0.45, fx: [[2.2, 'tick'], [2.45, 'tick'], [2.7, 'clank']] },
    { jump: true, to: PLACES.meadow, fx: [[0, 'windup'], [0.5, 'whoosh']] },
    /* page 3: the landing */
    { t: 'Cubo landed on Earth. THUD! Cubes don’t land softly.', face: 'wow', shake: true, fx: [[0, 'thud']] },
    { t: 'A tall giraffe was stretching up to the sky.', to: PLACES.giraffe, pose: 'march', face: 'wow' },
    /* page 4: the giraffe */
    { t: '“Reach up high!” said the giraffe.', card: 'reach', hold: 0.8 },
    { t: 'Cubo reached with all his might. No taller.', card: 'reach', face: 'tongue', hold: 0.6 },
    { t: 'He reached harder and tipped over. THUD! A hair taller!', pose: 'lean', shake: true, face: 'joy', fx: [[2.0, 'thud']] },
    R,
    /* page 5: the bunny */
    { t: 'Next, a bunny.', to: PLACES.bunny, pose: 'march', face: 'grin' },
    { t: '“Hop!” said the bunny.', card: 'jump', hold: 0.8 },
    { t: 'Cubo hopped. Flop. Hopped again. Flop.', card: 'jump', face: 'grin', fx: [[1.0, 'land'], [2.0, 'land']], hold: 0.6 },
    { t: 'For one wonderful second, he was off the ground. By a daisy’s width!', pose: 'jump', face: 'joy', fx: [[0.2, 'boing']] },
    R,
    /* page 6: the bird */
    { t: 'Then a bird fluttered by.', to: PLACES.bird, pose: 'march', face: 'wow', fx: [[0.5, 'chirp']] },
    { t: '“Flap!” chirped the bird.', card: 'flap', hold: 0.8, fx: [[0.3, 'chirp', 2]] },
    { t: 'No wings, so Cubo flapped his corners. Up an inch! Then, a bush.', card: 'flap', face: 'wow', hold: 0.6, fx: [[3.2, 'rustle'], [3.35, 'rustle']] },
    /* page 7: the frog */
    { t: 'Last, a frog.', to: PLACES.frog, pose: 'march', face: 'grin' },
    { t: '“Squat down low,” said the frog.', card: 'squat', hold: 0.8 },
    { t: 'Cubo squatted. He was so good, he couldn’t get back up.', card: 'squat', face: 'smirk', hold: 0.6 },
    { t: '“Cubes do that,” said the frog. “And Cubo does it VERY well.”', refrain: true, face: 'smirk', hold: 1.2 },
    /* page 8: everyone wobbles */
    { t: 'Something wonderful happened! The giraffe tripped. The bunny splashed. The frog flopped.', gather: true, face: 'wow', wobble: 0.7, fx: [[2.4, 'uhoh'], [4.2, 'splash'], [5.4, 'land']] },
    { t: 'They were all wobbling! Cubo laughed his very first laugh.', wobble: 1, pose: 'dance', face: 'joy', fx: [[1.5, 'hooray']] },
    { t: '“Everybody wobbles,” said the giraffe. “That’s the fun!”', wobble: 0.5, face: 'joy' },
    /* page 9: the long way home */
    { t: 'The Elders clicked: had he learned the secret? Yes! Wobbling is better with friends.', fx: [[0.3, 'tick'], [0.6, 'tick']], face: 'smile', wobble: 0 },
    { t: 'A warm glow in a window: a TV, with children wobbling and laughing!', to: PLACES.home, pose: 'march', face: 'joy' },
    { t: 'A long way home. Not the way he’d planned. So Cubo stayed.', face: 'smile' },
    { t: REFRAIN, refrain: true, face: 'joy', hold: 2.5, pose: 'wave' }
  ]
};
