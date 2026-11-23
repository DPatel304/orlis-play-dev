/* The parts of three.js a pad program may use. Listed by name so the bundle keeps only these (and what they need), not all of three.
   The pad page loads this file on demand (kit.loadThree), so phones that never play a 3D game never download it. */
export {
  Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh, Fog, Color, Vector3,
  PlaneGeometry, CircleGeometry, CylinderGeometry, SphereGeometry, ConeGeometry, BoxGeometry, LatheGeometry, BufferAttribute,
  MeshBasicMaterial, MeshToonMaterial, CanvasTexture, DataTexture,
  HemisphereLight, DirectionalLight,
  AdditiveBlending, DoubleSide, BackSide, SRGBColorSpace, LinearFilter, NearestFilter, RedFormat, Float32BufferAttribute
} from 'three';
export { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
