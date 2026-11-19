/* The picture-ready emoji in the library: animals, food, nature and things, each with a plain name and tags. Only these: this
   list is the whole of what a game can ask for from the emoji set, so a game made with the library can't show anything that
   isn't here (and nothing here is a weapon, a drink, or anything scary). The picture is the system's own emoji, the same
   ones Animal Gym uses. Each is [id, the emoji, name, tags]. */
export const EMOJI = [
  /* animals */
  ['giraffe', '\u{1F992}', 'Giraffe', 'animal tall'], ['bunny', '\u{1F430}', 'Bunny', 'animal hop'], ['bird', '\u{1F426}', 'Bird', 'animal fly'],
  ['frog', '\u{1F438}', 'Frog', 'animal pond'], ['elephant', '\u{1F418}', 'Elephant', 'animal big'], ['penguin', '\u{1F427}', 'Penguin', 'animal snow'],
  ['bear', '\u{1F43B}', 'Bear', 'animal forest'], ['cat', '\u{1F431}', 'Cat', 'animal pet'], ['dog', '\u{1F436}', 'Dog', 'animal pet'],
  ['fish', '\u{1F41F}', 'Fish', 'animal sea'], ['whale', '\u{1F433}', 'Whale', 'animal sea big'], ['butterfly', '\u{1F98B}', 'Butterfly', 'animal fly garden'],
  ['bee', '\u{1F41D}', 'Bee', 'animal fly garden'], ['turtle', '\u{1F422}', 'Turtle', 'animal slow'], ['owl', '\u{1F989}', 'Owl', 'animal night fly'],
  ['duck', '\u{1F986}', 'Duck', 'animal pond'], ['lion', '\u{1F981}', 'Lion', 'animal'], ['monkey', '\u{1F435}', 'Monkey', 'animal'],
  ['panda', '\u{1F43C}', 'Panda', 'animal'], ['fox', '\u{1F98A}', 'Fox', 'animal forest'], ['pig', '\u{1F437}', 'Pig', 'animal farm'],
  ['sheep', '\u{1F411}', 'Sheep', 'animal farm'], ['cow', '\u{1F42E}', 'Cow', 'animal farm'], ['horse', '\u{1F434}', 'Horse', 'animal farm'],
  ['mouse', '\u{1F42D}', 'Mouse', 'animal small'], ['hedgehog', '\u{1F994}', 'Hedgehog', 'animal forest small'], ['ladybug', '\u{1F41E}', 'Ladybug', 'animal garden small'],
  ['snail', '\u{1F40C}', 'Snail', 'animal slow garden'], ['crab', '\u{1F980}', 'Crab', 'animal sea'], ['octopus', '\u{1F419}', 'Octopus', 'animal sea'],
  ['dolphin', '\u{1F42C}', 'Dolphin', 'animal sea'], ['koala', '\u{1F428}', 'Koala', 'animal'], ['kangaroo', '\u{1F998}', 'Kangaroo', 'animal hop'],
  ['flamingo', '\u{1F9A9}', 'Flamingo', 'animal'], ['parrot', '\u{1F99C}', 'Parrot', 'animal fly'], ['swan', '\u{1F9A2}', 'Swan', 'animal pond'],
  ['dinosaur', '\u{1F995}', 'Dinosaur', 'animal big'], ['unicorn', '\u{1F984}', 'Unicorn', 'magic'], ['seal', '\u{1F9AD}', 'Seal', 'animal sea'],
  /* food */
  ['apple', '\u{1F34E}', 'Apple', 'food fruit'], ['pear', '\u{1F350}', 'Pear', 'food fruit'], ['strawberry', '\u{1F353}', 'Strawberry', 'food fruit'],
  ['banana', '\u{1F34C}', 'Banana', 'food fruit'], ['orange', '\u{1F34A}', 'Orange', 'food fruit'], ['grapes', '\u{1F347}', 'Grapes', 'food fruit'],
  ['cherry', '\u{1F352}', 'Cherries', 'food fruit'], ['watermelon', '\u{1F349}', 'Watermelon', 'food fruit'], ['carrot', '\u{1F955}', 'Carrot', 'food'],
  ['cookie', '\u{1F36A}', 'Cookie', 'food treat'], ['cupcake', '\u{1F9C1}', 'Cupcake', 'food treat'], ['icecream', '\u{1F366}', 'Ice cream', 'food treat'],
  ['lollipop', '\u{1F36D}', 'Lollipop', 'food treat'], ['pizza', '\u{1F355}', 'Pizza', 'food'],
  /* nature */
  ['flower', '\u{1F33C}', 'Flower', 'nature garden'], ['sunflower', '\u{1F33B}', 'Sunflower', 'nature garden'], ['tulip', '\u{1F337}', 'Tulip', 'nature garden'],
  ['mapleleaf', '\u{1F341}', 'Maple leaf', 'nature autumn'], ['fallenleaf', '\u{1F342}', 'Falling leaf', 'nature autumn'], ['mushroom', '\u{1F344}', 'Mushroom', 'nature forest'],
  ['snowflake', '❄️', 'Snowflake', 'nature snow'], ['moon', '\u{1F319}', 'Moon', 'nature night'], ['glowstar', '\u{1F31F}', 'Glowing star', 'nature night'],
  ['wave', '\u{1F30A}', 'Wave', 'nature sea'], ['snowman', '⛄', 'Snowman', 'snow'], ['palm', '\u{1F334}', 'Palm tree', 'nature beach'],
  ['cactus', '\u{1F335}', 'Cactus', 'nature'], ['seedling', '\u{1F331}', 'Seedling', 'nature garden'], ['shell', '\u{1F41A}', 'Shell', 'nature beach'],
  /* things */
  ['gift', '\u{1F381}', 'Present', 'thing party'], ['key', '\u{1F5DD}️', 'Key', 'thing'], ['crown', '\u{1F451}', 'Crown', 'thing'],
  ['rocket', '\u{1F680}', 'Rocket', 'thing space'], ['sailboat', '⛵', 'Sailboat', 'thing sea'], ['car', '\u{1F697}', 'Car', 'thing'],
  ['train', '\u{1F682}', 'Train', 'thing'], ['airplane', '✈️', 'Airplane', 'thing fly'], ['house', '\u{1F3E0}', 'House', 'place'],
  ['castle', '\u{1F3F0}', 'Castle', 'place'], ['tent', '⛺', 'Tent', 'place'], ['drum', '\u{1F941}', 'Drum', 'thing music'],
  ['guitar', '\u{1F3B8}', 'Guitar', 'thing music'], ['musicnote', '\u{1F3B5}', 'Music note', 'music'], ['bell', '\u{1F514}', 'Bell', 'thing music'],
  ['kite', '\u{1FA81}', 'Kite', 'thing fly'], ['teddy', '\u{1F9F8}', 'Teddy bear', 'thing toy'], ['paintbrush', '\u{1F58C}️', 'Paintbrush', 'thing art'],
  ['confetti', '\u{1F389}', 'Party popper', 'party'], ['sparkles', '✨', 'Sparkles', 'effect'], ['basketball', '\u{1F3C0}', 'Basketball', 'thing ball'],
  ['soccerball', '⚽', 'Football', 'thing ball'], ['lightbulb', '\u{1F4A1}', 'Light bulb', 'thing'], ['umbrella', '☂️', 'Umbrella', 'thing rain'],
  ['balloonemoji', '\u{1F388}', 'Party balloon', 'thing party']
];
