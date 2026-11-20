/* The catalogue. A game is a module with metadata plus create(playerCount),
   returning an object with step/draw/hud/tally/winner/value. The shell owns
   the camera, the clock, the HUD, pausing and every screen around the round -
   adding a game means adding a file and a line here. */
import popParty from './pop-party.js';
import lastKnownPosition from './lkp-game.js';
import castleDefense from './castle-defense.js';
import sleepyBear from './sleepy-bear.js';
import leafPile from './leaf-pile.js';
import stackItHigh from './stack-it-high.js';
import skyPainter from './sky-painter.js';
import animalGym from './animal-gym.js';
import keepItUp from './keep-it-up.js';
import pteroFlight from './ptero-flight.js';
import saveTheHarvest from './save-the-harvest.js';
import popPartyStage, { light as popPartyStageLight, canvas as popPartyStageCanvas } from './labs/pop-party-stage.js';
import { makeStory } from './story-player.js';
import cubionsLongWayHome from '../stories/cubions-long-way-home.js';

/* In the Windows app, some games aren't built in: they come from the Store,
   as .orlis files, and join this list when downloaded (ui/library.js).
   Opened any other way - the browser, the tests - they're all built in. */
export const FROM_STORE = new Set([]);
const inApp = typeof window !== 'undefined' && !!(window.__TAURI__ && window.__TAURI__.core);
export const GAMES = [popParty, sleepyBear, leafPile, stackItHigh, skyPainter, animalGym, keepItUp, pteroFlight, saveTheHarvest, makeStory(cubionsLongWayHome), lastKnownPosition, castleDefense]
  .filter(g => !(inApp && FROM_STORE.has(g.id)));
/* Experiments: reachable only by name (?game=pop-party-stage), never in the menu, and not part of the catalogue the tests walk. */
export const LABS = [popPartyStage, popPartyStageLight, popPartyStageCanvas];
export const byId = (id) => GAMES.find(g => g.id === id) || LABS.find(g => g.id === id);
/* Waiting for the owner to let you in: these two, built in, to play
   meanwhile. The rest - and the Store, and Create - open once you're in. */
export const STARTER_GAMES = ['pop-party', 'sky-painter'];
