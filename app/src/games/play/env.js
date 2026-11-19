/* What a game description may name: the library's pieces and scenes, and Cubo's moves - the same lists in the app's check and in the
   runtime a game runs on. */
import { assets } from '../assets/index.js';
import { POSE_NAMES } from '../figure.js';

export function playEnv(){
  const all = assets.list();
  return { has: assets.has, scenes: all.filter(a => a.kind === 'scene').map(a => a.id), poses: POSE_NAMES, pieceNames: all.filter(a => a.kind !== 'scene').map(a => a.id) };
}
