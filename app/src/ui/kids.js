/* Skin tones for the cartoon children, one per player. */
export const KID_SKINS = ['#e9b892', '#c98f6a', '#f2c6a0', '#b97f5c'];

/* A cartoon child, shared by the games: for when there's no camera to show a real face. */
export function drawKid(c, x, y, r, t, skin = '#e9b892'){
  c.fillStyle = skin;
  c.beginPath(); c.ellipse(x, y + r * 0.95, r * 0.7, r * 0.45, 0, 0, 6.2832); c.fill();
  c.beginPath(); c.ellipse(x, y + r * 0.1, r * 0.5, r * 0.56, 0, 0, 6.2832); c.fill();
  c.fillStyle = '#2b2440';
  const blink = (t % 3.3) < 0.12 ? 0.15 : 1;
  for (const side of [-1, 1]){ c.beginPath(); c.ellipse(x + side * r * 0.18, y + r * 0.02, r * 0.06, r * 0.08 * blink, 0, 0, 6.2832); c.fill(); }
  c.strokeStyle = '#2b2440'; c.lineWidth = r * 0.05;
  c.beginPath(); c.arc(x, y + r * 0.22, r * 0.18, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
  c.fillStyle = 'rgba(255,120,120,.35)';
  for (const side of [-1, 1]){ c.beginPath(); c.arc(x + side * r * 0.33, y + r * 0.24, r * 0.09, 0, 6.2832); c.fill(); }
}
