/* What every game may know about the camera's players, without the camera
   engine itself: the names of the body's points, the skeleton between them,
   and the four players' colours. (pose.js re-exports these; a downloaded
   game carries its own copy - see app/kit/runtime.) */

/* Landmark indices we actually use. MediaPipe gives 33; naming the handful
   that matter keeps the game code readable. */
export const L = {
  NOSE:0, L_EYE:2, R_EYE:5,
  L_SHOULDER:11, R_SHOULDER:12, L_ELBOW:13, R_ELBOW:14, L_WRIST:15, R_WRIST:16,
  L_HIP:23, R_HIP:24, L_KNEE:25, R_KNEE:26, L_ANKLE:27, R_ANKLE:28
};

/* Drawn skeleton: pairs of landmark indices. */
import { color } from '../games/assets/palette.js';
export const BONES = [
  [11,12],[11,13],[13,15],[12,14],[14,16],
  [11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]
];

/* Up to four can play at once, each in their own colour - the games are
   made for four. PLAYING is how many places the camera fills (it was 2
   while we play-tested with our own children; now all four). Lower it to
   seat fewer. */
export const MAX_PLAYERS = 4;
export const PLAYING = 4;
/* The player colours are favourites (0040), by default the first four; player-colours.js re-fills this one array in place when it is known
   who is playing (U8), so every game that reads PLAYER_COLORS[i] gets that player's avatar colour. */
export const DEFAULT_PLAYER_FAVS = ['sky', 'orange', 'green', 'purple'];
export const PLAYER_COLORS = DEFAULT_PLAYER_FAVS.map(n => color('fav.' + n));
