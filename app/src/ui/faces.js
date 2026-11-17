/* The children's faces used to be cut out of the camera's picture here, for
   games to wear. They aren't any more: Orlis Play only ever uses the camera
   to find the body's points, and never keeps or shows what it films. Every
   game already has its cartoon / avatar to draw instead, so this is the same
   interface with nothing behind it - no face is ever "had", so each call site
   falls back to the avatar. */
export function forgetFaces(){}

export class FaceCam {
  step(){}
  has(){ return false; }
  draw(){ return false; }
  drawMoment(){ return false; }
  photo(){ return false; }
}
