/**
 * Three.js barrel export - Only export what we actually use
 * This helps with tree shaking and reduces bundle size
 */

// Core math classes
export {
  Vector3,
  Vector2,
  Matrix4,
  Euler,
  Quaternion,
  Color,
  MathUtils,
  Spherical
} from 'three';

// Geometry classes
export {
  BufferGeometry,
  SphereGeometry,
  PlaneGeometry,
  BoxGeometry,
  CylinderGeometry,
  ConeGeometry,
  Shape,
  CircleGeometry,
  Box3,
  Sphere,
  RingGeometry,
  OctahedronGeometry,
  TorusGeometry,
  BufferAttribute,
  Float32BufferAttribute
} from 'three';

// Curve classes
export {
  CatmullRomCurve3,
  CubicBezierCurve3
} from 'three';

// Material classes
export {
  Material,
  MeshBasicMaterial,
  MeshStandardMaterial,
  MeshPhongMaterial,
  ShaderMaterial,
  PointsMaterial,
  LineBasicMaterial
} from 'three';

// Object3D and mesh classes
export {
  Object3D,
  Mesh,
  Group,
  Points,
  Line,
  InstancedMesh
} from 'three';

// Scene and rendering
export {
  Scene,
  Camera,
  PerspectiveCamera,
  OrthographicCamera,
  WebGLRenderer,
  Fog,
  FogExp2
} from 'three';

// Lights
export {
  Light,
  DirectionalLight,
  PointLight,
  AmbientLight,
  SpotLight
} from 'three';

// Animation
export {
  AnimationMixer,
  AnimationClip,
  AnimationAction,
  LoopRepeat,
  LoopOnce
} from 'three';

// Textures and loaders
export {
  Texture,
  TextureLoader,
  CubeTextureLoader,
  CanvasTexture,
  CubeTexture
} from 'three';

// Constants
export {
  PCFSoftShadowMap,
  sRGBEncoding,
  LinearEncoding,
  DoubleSide,
  FrontSide,
  BackSide,
  AdditiveBlending,
  LinearFilter,
  DynamicDrawUsage,
  RepeatWrapping
} from 'three';

// Raycasting
export {
  Raycaster,
  Ray,
  Frustum
} from 'three';

// Controls (if used)
export type { WebGLRendererParameters } from 'three';
