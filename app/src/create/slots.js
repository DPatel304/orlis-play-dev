/* The family's game slots (decision 0056: three per family; 0057: when they are full, Create says so and shows how to remove one - it never
   offers to replace one). Pure, so it can be tested: the screens ask this what to show. */
export const MAX_SLOTS = 3;
export const FULL_LINE = 'Your slots are full - remove one to make another';

/* the three slots, in order: a game each, then the empty ones */
export const slotsOf = (list = []) => Array.from({ length: MAX_SLOTS }, (_, i) => list[i] ? { kind: 'full', c: list[i] } : { kind: 'empty' });
export const usedOf = (list = []) => Math.min(list.length, MAX_SLOTS);
export const isFull = (list = []) => list.length >= MAX_SLOTS;
export const canMake = (list = []) => !isFull(list);
/* "1 of 3 slots used" */
export const slotsLine = (list = []) => `${usedOf(list)} of ${MAX_SLOTS} slots used`;
/* what "Make a game" says: its words, and whether it starts the builder */
export const makeCard = (list = []) => isFull(list)
  ? { title: 'Make a game', line: FULL_LINE, full: true, starts: false }
  : { title: 'Make a game', line: 'Pick pictures, play it, change a step.', full: false, starts: true };
