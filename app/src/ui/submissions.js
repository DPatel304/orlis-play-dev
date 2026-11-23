/* The owner's "Waiting for your OK" (kid-safety guardrail, moved here from the old Store page; decision 0055).

   Games creators have sent are tried by the owner here, in the sandbox and not kept, before they can say OK on the management page: play it
   long enough (main.js tells the server, `game.trial`) and the server lets the owner approve it. Only the owner sees any of it. */
import { account } from './account.js';
import { library } from './library.js';

/* the owner (and only the owner) sees waiting games */
export const seesWaiting = () => !!(account.signedIn && account.role === 'owner' && !account.waiting);

/* the server's waiting submissions, as entries shaped like Discover's (their own icon and words, and what to do about it) */
export function waitingEntries(submissions = []){
  return (submissions || []).filter(x => x && x.state === 'waiting').map(x => {
    const d = x.game || {};
    return { id: x.gameId, submission: x.id, name: x.name, version: x.version, bytes: x.bytes, sha256: x.sha256, by: x.family,
      icon: d.icon || undefined, players: d.players || [1, 4], uses: d.uses || '', ages: d.ages || null, tags: d.tags || [], howto: d.howto || [],
      blurb: d.blurb || `Sent by ${x.family}`, about: d.about || d.blurb || '' };
  });
}

/* Try it: the game, fetched and checked and played in the sandbox, marked as the trial of this submission (played long enough, it can be approved) */
export async function tryIt(g){
  const game = await library.preview(g);
  game.trial = g.submission;
  return game;
}
