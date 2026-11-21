/* Star Catch - the starter game. Stars drift down through an evening sky; reach out and catch them with your hands. They
   sparkle, score a point, and fill the goal bar at the top.

   A game is a description: the ready-made words in the orlis-game skill say what is on screen, how it moves, and what
   happens when a hand touches it. There is no code to write - change a word or a number and the game changes. Keep the
   inside of Orlis.play( ... ) as plain JSON: names in "double quotes", no comments, no trailing commas. */
Orlis.play({
  "secs": 90,
  "scene": "sunset",
  "hint": "⭐ Catch the stars!",
  "hintFor": 8,
  "card": "reach",
  "cardFor": 8,
  "goal": {
    "score": 40
  },
  "things": [
    {
      "name": "star",
      "piece": "star",
      "color": [
        "touch.sunflower",
        "touch.sunflower",
        "touch.sunflower",
        "ui.gold"
      ],
      "size": 0.085,
      "spins": true,
      "sway": 0.01,
      "appears": {
        "every": 1.3,
        "everyEnd": 0.5,
        "from": "top",
        "max": 9
      },
      "moves": "fall",
      "speed": 0.1,
      "rules": [
        {
          "when": "touched",
          "then": [
            "sparkle",
            "score",
            {
              "sound": "pop"
            },
            "vanish"
          ]
        }
      ]
    }
  ]
});
