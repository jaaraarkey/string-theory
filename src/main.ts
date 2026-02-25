import './style.css';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

// Setup Scene, Camera, Renderer
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.015);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 45; // Zoomed in

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);

// Adaptive pixel ratio: cap lower on weak devices (low CPU count = likely mobile/low-end)
const isLowEnd = navigator.hardwareConcurrency <= 4;
const isMidRange = navigator.hardwareConcurrency <= 8;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isLowEnd ? 1 : isMidRange ? 1.5 : 2));
document.getElementById('app')?.appendChild(renderer.domElement);

// Post-Processing (Bloom for the Ethereal Glow)
const renderScene = new RenderPass(scene, camera);
// Bloom rendered at half resolution — huge saving on its 5 internal passes, barely visible difference
const bloomRes = new THREE.Vector2(Math.round(window.innerWidth * 0.5), Math.round(window.innerHeight * 0.5));
const bloomPass = new UnrealBloomPass(
  bloomRes,
  2.5,  // strength
  0.9,  // radius
  0.1   // threshold
);

const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// Swirl Theory Geometry setup - Converting to Dotted Lines / Particles
// Tiered geometry density based on device capability
const STRINGS_COUNT      = isLowEnd ? 350 : isMidRange ? 520 : 700;
const POINTS_PER_STRING  = isLowEnd ? 50  : isMidRange ? 65  : 80;
const SEGS_PER_STRING = POINTS_PER_STRING - 1; // segments between consecutive points
const TOTAL_VERTICES = STRINGS_COUNT * SEGS_PER_STRING * 2; // 2 verts per segment

const uvs = new Float32Array(TOTAL_VERTICES * 2);
const randoms = new Float32Array(TOTAL_VERTICES * 3);

for (let i = 0; i < STRINGS_COUNT; i++) {
  const rX = Math.random();
  const rY = Math.random();
  const rZ = Math.random();

  for (let j = 0; j < SEGS_PER_STRING; j++) {
    const tA = j / (POINTS_PER_STRING - 1);
    const tB = (j + 1) / (POINTS_PER_STRING - 1);
    const base = (i * SEGS_PER_STRING + j) * 2;
    // Vertex A
    uvs[base * 2 + 0] = tA; uvs[base * 2 + 1] = i;
    randoms[base * 3 + 0] = rX; randoms[base * 3 + 1] = rY; randoms[base * 3 + 2] = rZ;
    // Vertex B
    uvs[(base+1) * 2 + 0] = tB; uvs[(base+1) * 2 + 1] = i;
    randoms[(base+1) * 3 + 0] = rX; randoms[(base+1) * 3 + 1] = rY; randoms[(base+1) * 3 + 2] = rZ;
  }
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TOTAL_VERTICES * 3), 3));
geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 3));

// Custom Shader Material -> Adjusted for Points & Interactive
const vertexShader = `
  uniform float uTime;
  uniform vec3 uMouse;
  uniform vec3 uCenter;
  attribute vec3 aRandom;
  
  varying vec3 vColor;
  varying float vOpacity;

  void main() {
    float tAlong = uv.x; // 0.0 to 1.0 along the string curve
    float stringId = uv.y;
    
    // Flow time — faster for more visible evolution
    float flowTime  = uTime * 0.04;
    float flowTime2 = uTime * 0.017; // second independent slow layer
    
    // 1. Macro Origin - horn torus (sphere-like)
    float R = 14.0;
    float tubeR = 22.0;

    float theta = aRandom.x * 6.2831;
    float phi   = aRandom.y * 6.2831;

    float rawOffset = aRandom.z * 2.0 - 1.0;
    float shellBias = sign(rawOffset) * pow(abs(rawOffset), 2.0);
    float r = tubeR + shellBias * tubeR * 0.35;

    vec3 origin = vec3(
      (R + r * cos(phi)) * cos(theta),
      r * sin(phi),
      (R + r * cos(phi)) * sin(theta)
    );

    // Shape-level breathing: slow large-scale deformation morphs the sphere over time
    float breathe = sin(flowTime2 * 0.7 + aRandom.x * 4.0) * 3.5
                  + sin(flowTime2 * 1.1 + aRandom.y * 3.0) * 2.0;
    origin += normalize(origin) * breathe;

    // Drift: two-frequency for richer organic motion
    float driftAmp = 2.2;
    origin.x += sin(flowTime + aRandom.y * 10.0) * driftAmp
              + sin(flowTime2 * 1.3 + aRandom.z * 7.0) * 1.0;
    origin.y += cos(flowTime * 1.2 + aRandom.z * 10.0) * driftAmp
              + cos(flowTime2 * 0.9 + aRandom.x * 7.0) * 1.0;
    origin.z += sin(flowTime * 0.8 + aRandom.x * 10.0) * driftAmp
              + sin(flowTime2 * 1.5 + aRandom.y * 7.0) * 1.0;

    // 2. Macro Path — two overlapping wave layers for fluid, evolving lines
    float length = 6.0 + aRandom.x * 5.0;
    float localT = tAlong - 0.5;

    vec3 thetaTangent = vec3(-sin(theta), 0.0, cos(theta));
    vec3 phiTangent   = vec3(-sin(phi)*cos(theta), cos(phi), -sin(phi)*sin(theta));

    float wave1 = sin(localT * 3.5 + flowTime  * 2.5 + aRandom.z * 6.28) * length;
    float wave2 = sin(localT * 2.1 + flowTime2 * 3.0 + aRandom.x * 6.28) * length * 0.45;
    float wave  = wave1 + wave2;
    vec3 path = thetaTangent * wave * 0.6 + phiTangent * wave;
    
    // Convert to world pos without rotation
    vec3 basePos = origin + path;

    // Rotation: X fixed at 90° — donut lies flat, no wobble
    float rotX = 1.5708;
    float rotY = uTime * 0.006 + cos(uTime * 0.002) * 0.3;
    
    // Basic X rotation matrix
    mat3 rotMatX = mat3(
      1.0, 0.0, 0.0,
      0.0, cos(rotX), -sin(rotX),
      0.0, sin(rotX), cos(rotX)
    );
    // Basic Y rotation matrix
    mat3 rotMatY = mat3(
      cos(rotY), 0.0, sin(rotY),
      0.0, 1.0, 0.0,
      -sin(rotY), 0.0, cos(rotY)
    );
    
    // Apply X and Y rotations only (no Z roll)
    vec3 rotatedPos = rotMatY * rotMatX * basePos;
    // Shift the entire structure very slowly toward the pointer
    vec3 finalPos = rotatedPos + uCenter;

    // 3. Quantum Vibrations - subtle jitter kept small to preserve hole clarity
    float microFreq = 15.0 + aRandom.y * 10.0;
    float microAmp = 0.15 + aRandom.z * 0.25;
    
    // EVEN SLOWER jitter speed
    vec3 microOffset = vec3(
      sin(tAlong * microFreq + uTime * 1.0 + aRandom.x * 6.28),
      cos(tAlong * microFreq * 1.1 - uTime * 0.8 + aRandom.y * 6.28),
      sin(tAlong * microFreq * 0.9 + uTime * 1.2 + aRandom.z * 6.28)
    ) * microAmp;
    
    // Taper: pow(3) makes tips very transparent, softening the visible donut edges
    float taper = pow(sin(tAlong * 3.14159), 3.0);
    finalPos += microOffset * taper;

    // 4. Interactive Pointer / Mouse Gravity and Swirl
    // Calculate distance to mouse
    float distToMouse = distance(finalPos, uMouse);
    // Smoothstep creates a force field out to 40 units
    float interactionForce = smoothstep(40.0, 0.0, distToMouse);
    
    // Create a swirling vortex vector around the mouse position
    vec3 toMouse = normalize(uMouse - finalPos);
    
    // EVEN SLOWER swirl axis rotation
    vec3 swirlAxis = normalize(vec3(sin(uTime * 0.2), cos(uTime * 0.2), 1.0));
    vec3 swirlForce = cross(toMouse, swirlAxis);
    
    // Apply pull and swirl — gentler pull so the hole stays open
    finalPos += toMouse * interactionForce * 6.0 * aRandom.x; // Pull toward mouse
    finalPos += swirlForce * interactionForce * 10.0; // Swirl around the mouse
    finalPos += microOffset * interactionForce * 2.0; // Subtle chaos in the vortex

    // Projection
    vec4 mvPosition = viewMatrix * vec4(finalPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // ---- PALETTE (dimmed ~50% of true vibrancy for atmospheric glow) ----
    // Neon Pink         #f72585 -> rgb(247, 37, 133)   dimmed
    vec3 palNeonPink       = vec3(0.485, 0.073, 0.261);
    // Indigo Bloom      #7209b7 -> rgb(114,  9, 183)   dimmed
    vec3 palIndigoBoom     = vec3(0.224, 0.018, 0.359);
    // Vivid Royal       #3a0ca3 -> rgb( 58, 12, 163)   dimmed
    vec3 palVividRoyal     = vec3(0.114, 0.024, 0.320);
    // Electric Sapphire #4361ee -> rgb( 67, 97, 238)   dimmed
    vec3 palElecSapphire   = vec3(0.132, 0.190, 0.467);
    // Sky Aqua          #4cc9f0 -> rgb( 76,201, 240)   dimmed
    vec3 palSkyAqua        = vec3(0.149, 0.395, 0.471);

    // Cycle faster so colours visibly evolve across the sphere
    float cycle = mod(stringId * 0.037 + tAlong * 2.5 + flowTime * 3.0, 5.0);
    
    vec3 palColor;
    if (cycle < 1.0) {
      palColor = mix(palNeonPink,     palIndigoBoom,   cycle);
    } else if (cycle < 2.0) {
      palColor = mix(palIndigoBoom,   palVividRoyal,   cycle - 1.0);
    } else if (cycle < 3.0) {
      palColor = mix(palVividRoyal,   palElecSapphire, cycle - 2.0);
    } else if (cycle < 4.0) {
      palColor = mix(palElecSapphire, palSkyAqua,      cycle - 3.0);
    } else {
      palColor = mix(palSkyAqua,      palNeonPink,     cycle - 4.0);
    }

    vec3 baseColor = palColor;

    // Slightly brighten the midpoints of each string (taper effect)
    baseColor = mix(baseColor * 0.5, baseColor, taper);
    
    // White-silver stellar highlights: rare bright flashes along the string
    vec3 whiteSilver = vec3(0.85, 0.88, 0.95); // Slightly cool silver-white
    float silverHighlight = pow(max(0.0, cos(stringId * 13.0 + tAlong * 20.0 + flowTime * 0.5)), 12.0);
    baseColor = mix(baseColor, whiteSilver, silverHighlight * 0.75);
    
    // Mouse vortex: flash full-brightness Neon Pink & Sky Aqua
    vec3 swirlColorA = vec3(0.969, 0.145, 0.522);  // Full-brightness Neon Pink
    vec3 swirlColorB = vec3(0.298, 0.789, 0.941);  // Full-brightness Sky Aqua

    float swirlColorMix = sin(tAlong * 5.0 + uTime * 2.0 + stringId) * 0.5 + 0.5;
    vec3 activeColor = mix(swirlColorA, swirlColorB, swirlColorMix);
    
    vColor = mix(baseColor, activeColor, interactionForce * 1.2);
    
    float flash = sin(stringId * 0.05 + uTime * 1.8) * 0.5 + 0.5;
    float depthFade = smoothstep(50.0, -80.0, mvPosition.z);
    
    // Glow brighter when in the vortex
    vOpacity = taper * depthFade * (0.2 + 0.8 * flash) + interactionForce;
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  varying float vOpacity;

  void main() {
    gl_FragColor = vec4(vColor, vOpacity);
  }
`;

const material = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader,
  uniforms: {
    uTime: { value: 0 },
    uMouse: { value: new THREE.Vector3(0, 0, -200) }, // Default off-camera
    uCenter: { value: new THREE.Vector3(0, 0, 0) }   // Very slow drift toward pointer
  },
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

// LineSegments gives continuous flame-like lines along the torus surface
// const points = new THREE.LineSegments(geometry, material);
// Sphere removed — swirl only
// scene.add(points);

// ─── SPIRAL SWIRL ────────────────────────────────────────────────────────────
// Logarithmic spiral arms that revolve very slowly from the screen edges inward.
const SWIRL_ARMS    = 100;   // number of spiral arms
const SWIRL_PTS     = 70;   // points per arm
const SWIRL_SEGS    = SWIRL_PTS - 1;
const SWIRL_TOTAL   = SWIRL_ARMS * SWIRL_SEGS * 2;

const swirlUvs   = new Float32Array(SWIRL_TOTAL * 2);
const swirlRands = new Float32Array(SWIRL_TOTAL * 3); // r0: arm offset angle, r1: radius jitter, r2: opacity seed

for (let i = 0; i < SWIRL_ARMS; i++) {
  const r0 = i / SWIRL_ARMS;          // evenly distributed start angle (0–1)
  const r1 = Math.random();            // radius spread
  const r2 = Math.random();            // shimmer seed
  for (let j = 0; j < SWIRL_SEGS; j++) {
    const base = (i * SWIRL_SEGS + j) * 2;
    const tA = j / (SWIRL_PTS - 1);
    const tB = (j + 1) / (SWIRL_PTS - 1);
    swirlUvs[base * 2 + 0] = tA;  swirlUvs[base * 2 + 1] = i;
    swirlRands[base * 3 + 0] = r0; swirlRands[base * 3 + 1] = r1; swirlRands[base * 3 + 2] = r2;
    swirlUvs[(base+1) * 2 + 0] = tB;  swirlUvs[(base+1) * 2 + 1] = i;
    swirlRands[(base+1) * 3 + 0] = r0; swirlRands[(base+1) * 3 + 1] = r1; swirlRands[(base+1) * 3 + 2] = r2;
  }
}

const flameGeo = new THREE.BufferGeometry();
flameGeo.setAttribute('uv',      new THREE.BufferAttribute(swirlUvs,   2));
flameGeo.setAttribute('aRandom', new THREE.BufferAttribute(swirlRands, 3));
flameGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SWIRL_TOTAL * 3), 3));

const flameVertexShader = `
  uniform float uTime;
  uniform vec3  uCenter;
  uniform vec3  uSwirlCenter;
  uniform vec3  uRippleOrigin;  // 3D world position of click
  uniform float uRippleTime;    // seconds since last click (-1 = inactive)
  attribute vec3 aRandom;

  varying float vFlameOpacity;
  varying float vT;
  varying float vRippleInfluence;
  varying float vRippleAge;

  void main() {
    float tAlong = uv.x;
    float t = 1.0 - tAlong;

    float revolution = uTime * 0.006;
    float armAngle = aRandom.x * 6.2831 + revolution;
    float spiralTurns = 1.8;
    float angle = armAngle + t * spiralTurns * 6.2831;

    float outerR = 72.0 + aRandom.y * 20.0;
    float innerR = 4.0  + aRandom.y * 8.0;
    float radius  = mix(innerR, outerR, t);

    vec2 spiralXY = vec2(cos(angle), sin(angle)) * radius;

    float wispAmp = t * 3.5;
    float wispFreq = 3.0 + aRandom.z * 2.0;
    vec2 perp = vec2(-sin(angle), cos(angle));
    float wisp = sin(tAlong * wispFreq * 6.28 + uTime * 0.8 + aRandom.z * 6.28) * wispAmp;

    vec2 finalXY = spiralXY + perp * wisp + vec2(uSwirlCenter.x, uSwirlCenter.y);
    float z = (aRandom.y - 0.5) * 12.0;

    // ── Ripple displacement ──
    if (uRippleTime >= 0.0) {
      float rippleDuration = 2.2;   // seconds the ring expands
      float rippleSpeed    = 55.0;  // world units per second
      float rippleWidth    = 8.0;   // ring thickness
      float rippleAge      = uRippleTime;

      vec2 toVertex = finalXY - vec2(uRippleOrigin.x, uRippleOrigin.y);
      float dist = length(toVertex);
      float waveFront = rippleAge * rippleSpeed;  // expanding ring radius

      // Signed distance from the wave ring
      float delta = dist - waveFront;
      // Smooth Gaussian bell centred on the ring
      float rippleShape = exp(-delta * delta / (rippleWidth * rippleWidth));
      // Fade the ring out as it ages
      float rippleFade  = 1.0 - smoothstep(0.0, rippleDuration, rippleAge);
      float rippleAmp   = rippleShape * rippleFade * 12.0;

      // Push outward from click centre
      vec2 outDir = dist > 0.001 ? normalize(toVertex) : vec2(1.0, 0.0);
      finalXY += outDir * rippleAmp;
    }

    vec4 mvPosition = viewMatrix * vec4(vec3(finalXY, z), 1.0);
    gl_Position     = projectionMatrix * mvPosition;

    float edgeFade  = smoothstep(0.0, 0.18, tAlong);
    float coreFade  = smoothstep(0.0, 0.12, t);
    float shimmer   = 0.55 + 0.45 * sin(tAlong * 10.0 + uTime * 1.2 + aRandom.z * 6.28);
    vFlameOpacity   = edgeFade * coreFade * shimmer * 0.22;
    vT = tAlong;

    // Ripple colour influence — peaks right on the wave ring, fades out
    if (uRippleTime >= 0.0) {
      float rippleDuration = 2.2;
      float rippleSpeed    = 55.0;
      float rippleWidth    = 8.0;
      vec2  toV2  = finalXY - vec2(uRippleOrigin.x, uRippleOrigin.y);
      float dist2 = length(toV2);
      float delta2 = dist2 - uRippleTime * rippleSpeed;
      vRippleInfluence = exp(-delta2 * delta2 / (rippleWidth * rippleWidth))
                       * (1.0 - smoothstep(0.0, rippleDuration, uRippleTime));
      vRippleAge = uRippleTime / rippleDuration;
    } else {
      vRippleInfluence = 0.0;
      vRippleAge       = 0.0;
    }
  }
`;

const flameFragmentShader = `
  varying float vFlameOpacity;
  varying float vT;
  varying float vRippleInfluence;
  varying float vRippleAge;
  uniform float uGlobalOpacity;

  void main() {
    // Base palette: deep violet → lavender silver → ice white
    vec3 colOuter  = vec3(0.12, 0.08, 0.28);
    vec3 colMid    = vec3(0.55, 0.58, 0.80);
    vec3 colInner  = vec3(0.90, 0.93, 1.00);

    vec3 col;
    if (vT < 0.5) {
      col = mix(colOuter, colMid,   vT * 2.0);
    } else {
      col = mix(colMid,   colInner, (vT - 0.5) * 2.0);
    }

    // Ripple gradient: sphere palette — Neon Pink → Indigo → Royal → Sapphire → Sky Aqua
    vec3 rp0 = vec3(0.969, 0.145, 0.522);  // Neon Pink      (full brightness)
    vec3 rp1 = vec3(0.447, 0.035, 0.718);  // Indigo Bloom
    vec3 rp2 = vec3(0.227, 0.047, 0.639);  // Vivid Royal
    vec3 rp3 = vec3(0.263, 0.380, 0.933);  // Electric Sapphire
    vec3 rp4 = vec3(0.298, 0.789, 0.941);  // Sky Aqua       (full brightness)
    float ra = vRippleAge * 4.0;            // map 0–1 → 0–4 across 4 transitions
    vec3 rippleCol;
    if (ra < 1.0)      rippleCol = mix(rp0, rp1, ra);
    else if (ra < 2.0) rippleCol = mix(rp1, rp2, ra - 1.0);
    else if (ra < 3.0) rippleCol = mix(rp2, rp3, ra - 2.0);
    else               rippleCol = mix(rp3, rp4, ra - 3.0);

    col = mix(col, rippleCol, vRippleInfluence);

    gl_FragColor = vec4(col, vFlameOpacity * uGlobalOpacity);
  }
`;

const flameMaterial = new THREE.ShaderMaterial({
  vertexShader:   flameVertexShader,
  fragmentShader: flameFragmentShader,
  uniforms: {
    uTime:         { value: 0 },
    uCenter:       { value: new THREE.Vector3(0, 0, 0) },
    uSwirlCenter:  { value: new THREE.Vector3(0, 0, 0) },
    uRippleOrigin: { value: new THREE.Vector3(0, 0, 0) },
    uRippleTime:   { value: -1.0 }, // -1 = no active ripple
    uGlobalOpacity:{ value: 1.0 },
  },
  transparent: true,
  depthWrite:  false,
  blending:    THREE.AdditiveBlending,
});

const flamePoints = new THREE.LineSegments(flameGeo, flameMaterial);
scene.add(flamePoints);
// ─────────────────────────────────────────────────────────────────────────────

// Mouse Interaction Setup
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(-999, -999);
const targetMouse = new THREE.Vector3(0, 0, 0);
// Center drift target for the sphere (kept for uniforms, sphere hidden)
const centerTarget = new THREE.Vector3(0, 0, 0);
// Swirl centre target — follows pointer slowly across the full screen
const swirlCenterTarget = new THREE.Vector3(0, 0, 0);
// The resting pointer position (where the pointer last stopped)
const pointerRest = new THREE.Vector3(0, 0, 0);
// Previous pointer world pos — used to compute movement speed for dynamic droop
const prevPointerWorld = new THREE.Vector3(0, 0, 0);
// How far below the pointer the swirl center sits (world units)
const SWIRL_Y_OFFSET = -12;  // constant downward bias

// Scroll-driven Y lift: wheel events push the swirl upward like it's attached to the page
let scrollWorldY = 0;        // accumulated world-unit scroll offset
let scrollVelY   = 0;        // inertia velocity (decays each frame)
const mousePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

// Idle orbit state — kicks in once the swirl centre has reached the pointer
let orbitAngle     = Math.random() * Math.PI * 2;
let orbitDir       = Math.random() < 0.5 ? 1 : -1;
let orbitRadius    = 1.5 + Math.random() * 2.5;  // small tight orbit
let orbitSpeed     = 0.0004 + Math.random() * 0.0004; // very slow
let isArrived      = false;

// Sink-to-bottom state
const IDLE_TIMEOUT   = 1800;  // ms of no pointer movement before sinking starts
let   lastMoveTime   = Date.now();
let   isSinking      = false;
let   isResting      = false;
//!
// Swirl velocity tracking — used for inertia when sink begins
const swirlVel     = new THREE.Vector3(); // world units per frame
const prevSwirlPos = new THREE.Vector3(); // previous frame position
let   sinkStartTime  = 5;                 // clock time when sink began
const SINK_COAST_DUR = 1.4;              // seconds of inertia coast before nav pull takes over
const SINK_PULL_DUR  = 15.5;             // seconds for nav pull to reach full strength

// Teleport state — fade out, snap position, fade back in
const FADE_OUT_DUR = 0.25;  // seconds to dim to 0
const FADE_IN_DUR  = 0.25;  // seconds to brighten back to 1
let   teleportPhase: 'none' | 'fadeOut' | 'fadeIn' = 'none';
let   teleportStartTime = 0;
let   teleportDestination = new THREE.Vector3();

function computeBottomWorldY(): number {
  // Convert NDC (0, -1) bottom edge to world, then go 16px further down.
  // At Z=0 plane with PerspectiveCamera(60°, ...) at z=75:
  const halfH = Math.tan((60 * Math.PI / 180) / 2) * 45;
  const pxPerUnit = (window.innerHeight / 2) / halfH;
  return -halfH - (16 / pxPerUnit);
}

function getNavWorldPos(): THREE.Vector3 {
  // Get the screen-space center of the contact-links nav and unproject to world Z=0
  const nav = document.querySelector('.contact-links');
  if (!nav) return new THREE.Vector3(0, computeBottomWorldY(), 0);
  const rect = nav.getBoundingClientRect();
  const cx = rect.left + rect.width  / 2;
  const cy = rect.top  + rect.height / 2;
  // NDC
  const ndcX =  (cx / window.innerWidth)  * 2 - 1;
  const ndcY = -(cy / window.innerHeight) * 2 + 1;
  // Unproject: at z=0 plane, camera at z=45
  const halfH = Math.tan((60 * Math.PI / 180) / 2) * 45;
  const halfW = halfH * (window.innerWidth / window.innerHeight);
  return new THREE.Vector3(ndcX * halfW, ndcY * halfH, 0);
}

function startSink() {
  if (isSinking || isResting) return;
  isSinking     = true;
  isArrived     = false;
  sinkStartTime = clock.getElapsedTime();
  // Target is the nav center — pull builds in slowly
  swirlCenterTarget.copy(getNavWorldPos());
}

window.addEventListener('wheel', (event) => {
  // Convert pixel delta to world units — scale so one page-worth feels natural
  const halfH = Math.tan((60 * Math.PI / 180) / 2) * 45;
  const worldPerPx = (halfH * 2) / window.innerHeight;
  scrollVelY -= event.deltaY * worldPerPx * 0.6;  // negative deltaY = scroll up = swirl goes up
}, { passive: true });

window.addEventListener('pointermove', (event) => {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  
  raycaster.setFromCamera(pointer, camera);
  raycaster.ray.intersectPlane(mousePlane, targetMouse);

  centerTarget.set(
    Math.max(-8, Math.min(8, targetMouse.x * 0.12)),
    Math.max(-8, Math.min(8, targetMouse.y * 0.12)),
    0
  );

  // Update resting position — swirl center sits SWIRL_Y_OFFSET units below the pointer
  const pointerSpeed = targetMouse.distanceTo(prevPointerWorld);
  prevPointerWorld.copy(targetMouse);
  // Extra dynamic droop: faster movement = swirl lags further down (capped)
  const dynamicDroop = Math.min(pointerSpeed * 1.2, 8);
  const targetY = targetMouse.y + SWIRL_Y_OFFSET - dynamicDroop;
  pointerRest.set(targetMouse.x, targetY, 0);
  swirlCenterTarget.copy(pointerRest);
  isArrived  = false;
  isSinking  = false;
  isResting  = false;
  lastMoveTime = Date.now();
});

// Ripple state
let rippleStartTime = -1; // elapsed time when last click happened
const RIPPLE_DURATION = 2.2;

window.addEventListener('pointerdown', (event) => {
  const clickPointer = new THREE.Vector2(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1
  );
  const clickTarget = new THREE.Vector3();
  raycaster.setFromCamera(clickPointer, camera);
  raycaster.ray.intersectPlane(mousePlane, clickTarget);

  // Fire ripple at click position
  flameMaterial.uniforms.uRippleOrigin.value.copy(clickTarget);
  rippleStartTime = clock.getElapsedTime();

  // Start teleport: fade out → snap to click → fade in
  teleportDestination.copy(clickTarget);
  teleportPhase     = 'fadeOut';
  teleportStartTime = clock.getElapsedTime();

  // Wake swirl up — cancel any sink/rest so it follows after arriving
  isSinking  = false;
  isResting  = false;
  isArrived  = false;
  lastMoveTime = Date.now();
});

// Animation Loop
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  
  const elapsedTime = clock.getElapsedTime();
  material.uniforms.uTime.value = elapsedTime;
  flameMaterial.uniforms.uTime.value = elapsedTime;
  flameMaterial.uniforms.uCenter.value.copy(material.uniforms.uCenter.value);

  // Update ripple age; deactivate once it has fully expanded
  if (rippleStartTime >= 0) {
    const age = elapsedTime - rippleStartTime;
    flameMaterial.uniforms.uRippleTime.value = age < RIPPLE_DURATION ? age : -1.0;
    if (age >= RIPPLE_DURATION) rippleStartTime = -1;
  }

  const swirlPos = flameMaterial.uniforms.uSwirlCenter.value;

  // ── Teleport fade ──
  if (teleportPhase === 'fadeOut') {
    const t = (elapsedTime - teleportStartTime) / FADE_OUT_DUR;
    flameMaterial.uniforms.uGlobalOpacity.value = Math.max(0, 1 - t);
    if (t >= 1) {
      // Snap to destination
      swirlPos.copy(teleportDestination);
      swirlCenterTarget.copy(teleportDestination);
      pointerRest.copy(teleportDestination);
      teleportPhase     = 'fadeIn';
      teleportStartTime = elapsedTime;
    }
  } else if (teleportPhase === 'fadeIn') {
    const t = (elapsedTime - teleportStartTime) / FADE_IN_DUR;
    flameMaterial.uniforms.uGlobalOpacity.value = Math.min(1, t);
    if (t >= 1) {
      flameMaterial.uniforms.uGlobalOpacity.value = 1;
      teleportPhase = 'none';
    }
  }

  // Scroll inertia — decay velocity and accumulate offset
  scrollVelY *= 0.88;                     // friction
  scrollWorldY += scrollVelY;             // integrate
  scrollWorldY *= 0.96;                   // slowly drift back to 0 when idle

  // Check if pointer has been idle long enough to start sinking
  if (!isSinking && !isResting && Date.now() - lastMoveTime > IDLE_TIMEOUT) {
    startSink();
  }

  if (isResting) {
    // Slowly orbit the contact-links nav center
    const navPos = getNavWorldPos();
    orbitAngle += orbitDir * orbitSpeed;
    swirlPos.set(
      navPos.x + Math.cos(orbitAngle) * orbitRadius,
      navPos.y + Math.sin(orbitAngle) * orbitRadius,
      0
    );
  } else if (isSinking) {
    const navPos = getNavWorldPos();
    const sinkAge = elapsedTime - sinkStartTime;

    // Phase 1: coast on existing velocity, decaying fast (pointer direction momentum)
    const coastT  = Math.min(1, sinkAge / SINK_COAST_DUR);
    void coastT; // used conceptually via inertia decay below

    // Phase 2: nav pull ramps in slowly after coast fades
    const pullT   = Math.max(0, (sinkAge - SINK_COAST_DUR * 0.3) / SINK_PULL_DUR);
    // Ease-in cubic so it starts imperceptibly slow
    const pullWeight = Math.min(1, pullT * pullT * pullT) * 0.0012;

    // Apply inertia coast (velocity decays each frame)
    swirlVel.multiplyScalar(0.94);
    swirlPos.add(swirlVel);

    // Apply nav pull
    const toNav = navPos.clone().sub(swirlPos);
    swirlPos.addScaledVector(toNav, pullWeight);

    // Arrived?
    if (swirlPos.distanceTo(navPos) < 2.0 && sinkAge > SINK_COAST_DUR) {
      isSinking   = false;
      isResting   = true;
      orbitDir    = Math.random() < 0.5 ? 1 : -1;
      orbitRadius = 3.0 + Math.random() * 2.0;
      orbitSpeed  = 0.0005 + Math.random() * 0.0003;
      orbitAngle  = Math.atan2(swirlPos.y - navPos.y, swirlPos.x - navPos.x);
    }
  } else if (!isArrived) {
    // Decelerate as it closes in: lerp factor scales with distance so it glides to a halt
    const scrolledTarget = swirlCenterTarget.clone();
    scrolledTarget.y += scrollWorldY;
    const dist = swirlPos.distanceTo(scrolledTarget);
    const lerpFactor = Math.min(0.0008, 0.00012 * dist + 0.00004);
    swirlPos.lerp(scrolledTarget, lerpFactor);

    // Check if close enough to consider "arrived"
    if (dist < 1.0) {
      isArrived = true;
      // Pick a new very slow, tight orbit when we arrive
      orbitDir    = Math.random() < 0.5 ? 1 : -1;
      orbitRadius = 1.5 + Math.random() * 2.5;
      orbitSpeed  = 0.0004 + Math.random() * 0.0004;
      orbitAngle  = Math.atan2(swirlPos.y - pointerRest.y, swirlPos.x - pointerRest.x);
    }
  } else {
    // Idle: very slowly orbit around the pointer rest position
    orbitAngle += orbitDir * orbitSpeed;
    swirlPos.set(
      pointerRest.x + Math.cos(orbitAngle) * orbitRadius,
      pointerRest.y + Math.sin(orbitAngle) * orbitRadius + scrollWorldY,
      0
    );
  }
  
  // Sample swirl velocity for inertia (used when sink starts)
  if (!isSinking) {
    swirlVel.subVectors(swirlPos, prevSwirlPos);
  }
  prevSwirlPos.copy(swirlPos);

  material.uniforms.uMouse.value.lerp(targetMouse, 0.05);
  material.uniforms.uCenter.value.lerp(centerTarget, 0.008);

  // Render via composer for Bloom
  composer.render();
}

animate();

// Handle Resizing
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloomPass.resolution.set(Math.round(window.innerWidth * 0.5), Math.round(window.innerHeight * 0.5));
});

// Update DOM to add a cool overlay title
const overlay = document.createElement('div');
overlay.className = 'overlay';
overlay.innerHTML = `
  <h1>Swirl Theory</h1>

  <nav class="contact-links">
    <a href="https://www.linkedin.com/in/oleg-dyachenko-287125b9/" target="_blank" rel="noopener" title="LinkedIn" aria-label="LinkedIn">
      <span class="link-label">Oleg Dyachenko</span>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
    </a>
    <a href="https://github.com/jaaraarkey" target="_blank" rel="noopener" title="GitHub" aria-label="GitHub">
      <span class="link-label">jaaraarkey</span>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
    </a>
  </nav>
`;
document.body.appendChild(overlay);

// ── Mobile sandwich bar ──────────────────────────────────────────────────────
const mobileBar = document.createElement('div');
mobileBar.className = 'mobile-bar';
mobileBar.innerHTML = `
  <div class="mobile-bar__drawer" id="mob-drawer">
    <a href="https://www.linkedin.com/in/oleg-dyachenko-287125b9/" target="_blank" rel="noopener" aria-label="LinkedIn">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
    </a>
    <a href="https://github.com/jaaraarkey" target="_blank" rel="noopener" aria-label="GitHub">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
    </a>
  </div>
  <button class="mobile-bar__toggle" id="mob-toggle" aria-label="Toggle contact links"></button>
`;
document.body.appendChild(mobileBar);

// ── Circle-expand transition overlay ─────────────────────────────────────────
const rippleOverlay = document.createElement('div');
rippleOverlay.id = 'mob-ripple';
document.body.appendChild(rippleOverlay);

const mobToggle = document.getElementById('mob-toggle')!;
const mobDrawer = document.getElementById('mob-drawer')!;

function openDrawer() {
  mobDrawer.classList.add('is-open');
  mobToggle.classList.add('is-hidden');
}

function closeDrawer() {
  mobDrawer.classList.remove('is-open');
  mobToggle.classList.remove('is-hidden');
}

mobToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  if (mobDrawer.classList.contains('is-open')) {
    closeDrawer();
  } else {
    openDrawer();
  }
});

// Close on tap anywhere outside the drawer
document.addEventListener('click', (e) => {
  if (!mobDrawer.classList.contains('is-open')) return;
  if (mobDrawer.contains(e.target as Node)) return;
  closeDrawer();
});

// Intercept drawer link clicks → expand circle → navigate
mobDrawer.addEventListener('click', (e) => {
  const anchor = (e.target as Element).closest('a') as HTMLAnchorElement | null;
  if (!anchor) return;
  const href = anchor.getAttribute('href');
  if (!href) return;
  const isExternal = anchor.target === '_blank';
  e.preventDefault();

  // Position ripple at the circle's center
  const toggleRect = mobToggle.getBoundingClientRect();
  const cx = toggleRect.left + toggleRect.width / 2;
  const cy = toggleRect.top + toggleRect.height / 2;
  const maxDim = Math.hypot(Math.max(cx, window.innerWidth - cx), Math.max(cy, window.innerHeight - cy)) * 2;

  rippleOverlay.style.left = cx + 'px';
  rippleOverlay.style.top  = cy + 'px';
  rippleOverlay.style.width  = '56px';
  rippleOverlay.style.height = '56px';
  rippleOverlay.style.marginLeft = '-28px';
  rippleOverlay.style.marginTop  = '-28px';
  rippleOverlay.style.setProperty('--ripple-size', maxDim + 'px');
  rippleOverlay.classList.remove('is-expanding');
  // force reflow
  void rippleOverlay.offsetWidth;
  rippleOverlay.classList.add('is-expanding');

  setTimeout(() => {
    if (isExternal) {
      window.open(href, '_blank', 'noopener');
      closeDrawer();
    } else {
      window.location.href = href;
    }
    setTimeout(() => {
      rippleOverlay.classList.remove('is-expanding');
    }, 400);
  }, 520);
});

// ── Dark / Light theme toggle ─────────────────────────────────────────────────
const DARK_BG = 0x000000;

let isLight = false;

// Sun icon (shown in dark mode — click to go light)
const sunSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;

// Moon icon (shown in light mode — click to go dark)
const moonSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

const themeBtn = document.createElement('button');
themeBtn.className = 'theme-btn';
themeBtn.setAttribute('aria-label', 'Toggle light / dark theme');
themeBtn.innerHTML = sunSVG;
document.body.appendChild(themeBtn);

function applyTheme(light: boolean) {
  isLight = light;
  if (light) {
    document.body.classList.add('light');
    document.documentElement.style.colorScheme = 'light';
    themeBtn.innerHTML = moonSVG;
  } else {
    document.body.classList.remove('light');
    document.documentElement.style.colorScheme = 'dark';
    themeBtn.innerHTML = sunSVG;
  }
}

// Initialise renderer clear colour (always dark — light theme uses CSS invert)
renderer.setClearColor(DARK_BG, 1);

themeBtn.addEventListener('click', () => applyTheme(!isLight));
