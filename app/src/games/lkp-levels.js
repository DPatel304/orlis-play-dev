/* Last Known Position's levels. Everything that makes one level itself
   lives here, in one entry - the rest of the game reads it:

     name, goal     shown big as the level opens
     palette        its colours (lkp-art.js PAL): sky, floor, trees ...
     plan           the way through it, in order: corridor, cross (the
                    doors), room (whichever door won), depot (the story
                    moment that wakes the robots), boss, end
     enemies        who's in its fights: `wild` before the robots wake,
                    `awake` after (the art draws each kind)
     boss           its boss (the game's BOSSES: scout, warden ...)
     things         what the corridor's things are, here - for Nova
     tips           Nova's first word on each thing in a corridor
     lines          what's said in its scenes: [who, text, words] - who
                    is 'nova' or 'robot'; words, a few under the speaker,
                    or none. 'PRAISE' in `won` is each player, by colour.

   A run is five levels, one after another (only the first is built so
   far): hard, Slay the Spire hard - losing is normal, and the fun is
   getting further next time. The doors are the run's path, chosen
   blind: there's no map of what's ahead.

   A new level is a new entry (and, if it needs one, a new boss). */

/* The friendly giant's name, as Nova calls it (still to be chosen). */
export const GIANT = 'Zubu';

export const LEVELS = [
  {
    id: 'verdant', name: 'Verdant Crash Site', goal: 'Find the Star Core',
    palette: {
      bg: '#14261b', floor: '#2d4b2b', edge: 'rgba(255,255,255,.3)', trees: '#1f5a34',
      blocker: '#7a5230', beam: '#6b4423', post: '#3d2a17', gap: '#0b0e09', fountain: '#38bdf8',
      wall: '#22402a', hall: '#14261b', hallFloor: '#2d4b2b', hallRed: '#45282a',
      /* The real look (lkp-world.js): a fresh morning on an alien planet. */
      world: {
        /* The painted house style (as Pop Party): a calm morning - a soft
           blue sky going to cream at the horizon, sage hills fading into
           the haze, muted greens, a sandy path. Still a strange planet:
           its trees and crystals keep their odd shapes and soft lilacs. */
        key: 'verdant-painted-1',
        sky: ['#8fbde0', '#b9d6e6', '#e4e6dc', '#f6ead2'], sun: '#fff3cf', haze: '#e6e4d6',
        cloud: '#fbf8f0', cloudShade: '#ced8e4', planet: ['#e7dccb', '#b9b2c9'], planetAlpha: 0.45, smoke: '#8a8478', ship: '#7d7a8a',
        hillLit: '#b4c79a', hillDark: '#8ea383', rim: '#fff3dc',
        ground: ['#b2cc8e', '#93bb72', '#7eaa60'], grass: ['#a3c98a', '#5f8a4c'], path: ['#dcc8a2', '#c8b28a'],
        rock: ['#b8b2c4', '#8a8399'], crystal: ['#d9cdf0', '#a99ad0', '#7a6aa6'], trunk: ['#6a5848', '#9a8268'], wood: '#c9a77a',
        tree: ['#8fb873', '#4f7350'], bulb: '#f2b6c6', glow: '#c9ecd9', water: '#8fd0dc', flowers: ['#fff6d8', '#ffd2e0', '#e3f0cf'],
        warm: '#ffe0b0', cool: '#3a3360', stars: false
      }
    },
    /* The way through: the tutorial run (and the healing pond); a first,
       easy fight, straight in, to learn fighting; a run with the team
       jump over a gorge; the Star Core (the robots wake); a run with
       a ride on Mossy, the forest giant; a fork and a room; a run with a bigger gorge; the
       boss. */
    /* (Level 1 is all running, no fighting: it ends at the Star Core -
       the robots wake, and a friendly giant carries the crew away. After
       its 'end', the rest - the tutorial fight, a fork, a room, the big
       gorge and the Sweeper - kept for level 2: not played yet.) */
    plan: ['corridor', 'corridor', 'sneak', 'wing', 'corridor', 'depot', 'ride', 'end', 'tutorial', 'corridor', 'cross', 'room', 'corridor', 'boss', 'end'],
    /* What happens in each corridor (lkp-game.js _layout): one event
       apiece - the path squeezing narrow then opening wide, a big jump
       over a ravine, a zip line - and the run of obstacles round it,
       the set pieces it mixes in (pieces). big: a wider ravine. */
    corridors: [
      /* level 1: the crash site and the teaching run; the team jump; a
         short run on to the depot */
      { event: 'squeeze' },
      { event: 'leap', big: true, pieces: ['logs', 'slalom', 'duckrun', 'arc'] },
      { pieces: ['duckrun', 'slalom', 'logs', 'arc'] },
      /* (level 2, to come) */
      { pieces: ['duckrun', 'slalom', 'logs', 'arc'] },
      { event: 'leap', big: true, pieces: ['slalom', 'logs', 'duckrun', 'arc'] }
    ],
    enemies: { wild: 'beast', awake: 'rustbot', wildName: 'wild beasts', awakeName: 'robots' },
    boss: 'scout', bossName: 'Sweeper',
    tips: {
      crystal: ['See those glowing crystals? Collect them to level up! Lean to grab them!', 'CRYSTALS!'],
      blocker: ['Debris! Lean around it.', 'LEAN!'],
      fallen: ['A fallen tree! Lean round it.', 'LEAN!'],
      beam: ['Low branch! Duck!', 'DUCK!'],
      gap: ['A ditch! Hop over it!', 'HOP!'],
      roller: ['A log, rolling across! Lean out of its way!', 'DODGE IT!'],
      /* (no word for the herd, or the sky jellies: they just happen) */
      ravine: ['A gorge! Everyone, get ready to JUMP!', 'GET READY TO JUMP!']
      /* (no word for the springs: they're seen, healing) */
    },
    lines: {
      /* The opening (lkp-intro.js): answering her call, inside the helmet. */
      wakeup: [['nova', 'ksssh \u2014 Crew, do you read me?', '']],
      /* ...and their vitals: each one's health bar popping up - three-quarters full */
      vitals: [['nova', 'Your ship looks like it\'s in bad shape. How are everyone\'s vitals doing?', '']],
      hurt: [['nova', 'Hmm... looks like you took some damage when you crashed. Are you able to stand up, at least?', '']],
      /* ...and once they're up, on the path. */
      rise: [['nova', 'On your feet, crew!', '']],
      /* ...and up: can they move? - everyone wiggling, each one their own astronaut */
      canMove: [['nova', 'Great! Can you move at all? Give your arms and legs a wiggle!', 'WIGGLE!']],
      ready: [['nova', 'There you all are! Now follow that path.', '']],
      /* The first corridor: the story, a piece at a time, in the quiet
         between her tips (lkp-game.js: said as the run reaches them). */
      walk: [
        ['nova', 'Your ship came down hard, on a planet nobody\'s ever explored. Trouble is, the crash knocked out your Star Core \u2014 it\'s what powers your ship. Without it, you can\'t fly home.', ''],
        ['nova', 'I\'m picking up its glow, somewhere out there. We need to find that Star Core!', 'FIND THE STAR CORE']
      ],
      /* At the ship, its bay scanned: empty (lkp-summit.js). */
      shipCore: [['nova', 'Oh no... your Star Core is gone! It must have been thrown clear in the crash. Without it, the ship can\'t fly. Let\'s get up high and look for it.', 'STAR CORE: MISSING']],
      /* At the summit, looking out over the whole planet (lkp-summit.js). */
      summit: [['nova', 'Look at it all... The Star Core\'s signal is coming from down the river, crew. Let\'s follow it!', 'FOLLOW THE RIVER']],
      /* At the lookout, up on the ridge: the whole planet below. */
      overlook: [['nova', 'Whoa... look at it all, crew. A whole new world \u2014 and it goes on for ever.', '']],
      /* ...and more of it, in the quiet between the creatures along the way. */
      lore: [
        ['nova', 'So much life out here, crew. Nobody\'s ever seen any of it before \u2014 you\'re the first!', ''],
        ['nova', 'Those crystals are bits of Star Core energy, scattered all over. It\'s like the planet\'s sharing them with you.', ''],
        ['nova', 'Everything out here is so big and gentle... I wonder what the biggest thing on this planet is.', '']
      ],
      /* The run on to the Star Core: its signal getting stronger. */
      signal: [['nova', 'The Star Core\'s signal is getting stronger, crew. It\'s close now \u2014 look for the glow!', '']],
      /* The healing pond, a stop along the first corridor. */
      pondIn: [['nova', 'Stop here! Your vitals are climbing \u2014 the water\'s healing you.', '']],
      /* (the pond's end: the ground shaking, the far ridge - lkp-game.js _rest) */
      offTrail: [['nova', 'Whoa... something big is out there. And the signal\'s coming from that way. Follow that path!', 'FOLLOW THE PATH']],
      pondWait: [['nova', 'Almost there \u2014 hold position.', '']],
      /* The hill past her that wasn't: her wing, lifting with them on it (lkp-wing.js). */
      wingStart: [['nova', 'Whoa \u2014 the hill\'s moving! It\'s lifting! Run, crew \u2014 up to the top, and jump off!', 'RUN UP!']],
      wingEnd: [['nova', 'That hill... was her WING. And she slept right through it. Okay, crew \u2014 tiptoe on.', '']],
      /* The gentle giant from the glade, carrying them off - named, at last, as they climb down (lkp-ride.js). */
      rideMeet: [['nova', 'Look who it is! The giant from the glade. The robots woke it up too. Run, crew, catch up!', 'CATCH UP!']],
      rideOn: [['nova', 'Everyone on? Sit down and rest, crew. You\'ve earned it.', 'SIT AND RELAX']],
      rideOff: [['nova', `What a ride! Say thank you, crew. I think we'll call it... ${GIANT}!`, `BYE, ${GIANT.toUpperCase()}!`]],
      depot: [
        ['nova', 'There it is! The Star Core! Everyone, roll your arms to power it up!', 'ROLL YOUR ARMS']
      ],
      waking: [
        ['robot', 'Clean. The planet. Of everything.', 'CLEAN THE PLANET.'],
        ['nova', 'That surge woke every robot on the planet. And they think we\'re the mess. Stay sharp, crew!', '']
      ],
      boss: [
        ['robot', 'Contamination detected. Cleaning.', 'CLEANING.'],
        ['nova', 'An old street sweeper, gone haywire! Watch the red, dodge its charges, and hit it when it stops!', 'DODGE!']
      ],
      won: [
        ['nova', 'We\'ve got the Star Core! Brilliant work, crew.', 'LEVEL CLEAR!'],
        'PRAISE',
        ['nova', 'The ship\'s still a long way off, and more robots are waking. Rest up, crew.', '']
      ],
      lost: [
        ['nova', 'Everyone\'s down! Hang on, I\'m pulling you back.', ''],
        ['nova', 'That was brave, crew. We\'ll try again!', 'NEXT TIME!']
      ]
    }
  }
];
