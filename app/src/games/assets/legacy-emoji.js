/* The old way to put a picture in a hint was an emoji at the front of the words ("balloon Pop the balloons!"). Games made before painted icons
   (and Last Known Position's corner) may still send one, so this turns the common ones into the library icon that says the same, and drops any
   other. Nothing in Orlis shows an emoji any more (U4): this file is the one place they are named, and the emoji test lets it be. */
export const EMOJI_ICON = {
  '⭐': 'glowstar', '\u{1F31F}': 'glowstar', '\u{1F48E}': 'gem', '✨': 'sparkles', '❤': 'heartfull', '\u{1F388}': 'balloon', '\u{1F3D0}': 'volleyball',
  '\u{1F342}': 'fallenleaf', '\u{1F995}': 'dinosaur', '\u{1F996}': 'dinosaur', '\u{1F34E}': 'apple', '\u{1F350}': 'pear', '\u{1F353}': 'strawberry', '\u{1F3B2}': 'dice',
  '\u{1F9F1}': 'block', '\u{1F483}': 'musicnote', '❄': 'snowflake', '\u{1F389}': 'confetti', '\u{1F992}': 'giraffe', '\u{1F430}': 'bunny', '\u{1F426}': 'bird',
  '\u{1F438}': 'frog', '\u{1F418}': 'elephant', '\u{1F427}': 'penguin', '\u{1F9FA}': 'basket', '\u{1F3AF}': 'pointer', '\u{1F308}': 'rainbow', '☀': 'sun',
  '\u{1F319}': 'moon', '\u{1F680}': 'rocket', '\u{1F41F}': 'fish', '\u{1F98B}': 'butterfly', '\u{1F338}': 'flower', '\u{1F33C}': 'flower', '\u{1F381}': 'gift',
  '\u{1F451}': 'crown', '\u{1F514}': 'bell', '\u{1F3A8}': 'palette', '\u{1F58C}': 'paintbrush'
};
/* the words with any emoji taken out (to count them) */
export const stripEmoji = (t) => String(t).replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, ' ');
const LEAD = /^((?:\p{Extended_Pictographic}️?‍?)+)\s*/u;
export const iconOf = (v) => { if (!v) return ''; const k = String(v).replace(/️/g, ''); return EMOJI_ICON[k] || (LEAD.test(k) ? '' : k); };
/* "balloon Pop them!" -> { icon: 'balloon', text: 'Pop them!' } (an old-style hint); plain words come back as they are */
export function splitHint(text){
  const s = String(text == null ? '' : text), m = LEAD.exec(s);
  if (!m) return { icon: '', text: s };
  const first = [...m[1].replace(/️|‍/g, '')][0];
  return { icon: EMOJI_ICON[first] || '', text: s.slice(m[0].length) };
}
