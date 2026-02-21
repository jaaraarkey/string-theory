import './style.css';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

// Setup Scene, Camera, Renderer
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.015);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 75; // Slightly zoomed in

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
  0.5,  // radius
  0.1   // threshold
);

const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// String Theory Geometry setup - Converting to Dotted Lines / Particles
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
const points = new THREE.LineSegments(geometry, material);
// Sphere removed — swirl only
// scene.add(points);

// ─── SPIRAL SWIRL ────────────────────────────────────────────────────────────
// Logarithmic spiral arms that revolve very slowly from the screen edges inward.
const SWIRL_ARMS    = 180;  // number of spiral arms (dense for a galaxy feel)
const SWIRL_PTS     = 100;  // points per arm
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
  attribute vec3 aRandom; // .x armAngle, .y radiusJitter, .z shimmerSeed

  varying float vFlameOpacity;
  varying float vT;

  void main() {
    float tAlong   = uv.x;   // 0 = outer edge, 1 = centre
    float stringId = uv.y;

    // t runs from 1 (outer) to 0 (inner) so radius shrinks as we go in
    float t = 1.0 - tAlong;

    // Very slow global revolution — one full turn every ~105 seconds
    float revolution = uTime * 0.006;

    // Each arm starts at its evenly-spaced angle + the slow revolution
    float armAngle = aRandom.x * 6.2831 + revolution;

    // Logarithmic spiral: angle increases as radius decreases inward
    // spiralTurns controls how tightly wound the arms are (1.8 = ~1.8 extra turns edge→centre)
    float spiralTurns = 1.8;
    float angle = armAngle + t * spiralTurns * 6.2831;

    // Outer radius: arms start well beyond screen, taper to ~sphere surface
    float outerR = 72.0 + aRandom.y * 20.0;
    float innerR = 4.0  + aRandom.y * 8.0;  // dissolve into the sphere
    float radius  = mix(innerR, outerR, t);

    // Position on spiral
    vec2 spiralXY = vec2(cos(angle), sin(angle)) * radius;

    // Add very gentle lateral wisp — smaller near centre so the core stays clean
    float wispAmp = t * 3.5;
    float wispFreq = 3.0 + aRandom.z * 2.0;
    vec2 perp = vec2(-sin(angle), cos(angle)); // perpendicular to radial direction
    float wisp = sin(tAlong * wispFreq * 6.28 + uTime * 0.8 + aRandom.z * 6.28) * wispAmp;

    vec2 finalXY = spiralXY + perp * wisp + vec2(uSwirlCenter.x, uSwirlCenter.y);
    float z = (aRandom.y - 0.5) * 12.0;

    vec4 mvPosition = viewMatrix * vec4(vec3(finalXY, z), 1.0);
    gl_Position     = projectionMatrix * mvPosition;

    // Opacity: fades at outer edge, fades at inner core, shimmer along arm
    float edgeFade  = smoothstep(0.0, 0.18, tAlong);          // fade in from outer edge
    float coreFade  = smoothstep(0.0, 0.12, t);               // fade out into core
    float shimmer   = 0.55 + 0.45 * sin(tAlong * 10.0 + uTime * 1.2 + aRandom.z * 6.28);
    vFlameOpacity   = edgeFade * coreFade * shimmer * 0.22;
    vT = tAlong;
  }
`;

const flameFragmentShader = `
  varying float vFlameOpacity;
  varying float vT;

  void main() {
    // Outer edges: deep indigo/violet → mid: soft lavender-silver → core: ice white
    vec3 colOuter  = vec3(0.12, 0.08, 0.28);   // deep violet
    vec3 colMid    = vec3(0.55, 0.58, 0.80);   // lavender silver
    vec3 colInner  = vec3(0.90, 0.93, 1.00);   // ice white

    vec3 col;
    if (vT < 0.5) {
      col = mix(colOuter, colMid,   vT * 2.0);
    } else {
      col = mix(colMid,   colInner, (vT - 0.5) * 2.0);
    }

    gl_FragColor = vec4(col, vFlameOpacity);
  }
`;

const flameMaterial = new THREE.ShaderMaterial({
  vertexShader:   flameVertexShader,
  fragmentShader: flameFragmentShader,
  uniforms: {
    uTime:        { value: 0 },
    uCenter:      { value: new THREE.Vector3(0, 0, 0) },
    uSwirlCenter: { value: new THREE.Vector3(0, 0, 0) }, // slow drift toward pointer
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
const mousePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

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

  // Swirl centre follows the pointer directly — no clamp so it travels anywhere on screen
  swirlCenterTarget.set(targetMouse.x, targetMouse.y, 0);
});

// Animation Loop
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  
  const elapsedTime = clock.getElapsedTime();
  material.uniforms.uTime.value = elapsedTime;
  flameMaterial.uniforms.uTime.value = elapsedTime;
  flameMaterial.uniforms.uCenter.value.copy(material.uniforms.uCenter.value);
  // Very slowly drift the swirl centre toward the pointer
  flameMaterial.uniforms.uSwirlCenter.value.lerp(swirlCenterTarget, 0.006);
  
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
  <h1>String Theory</h1>
  <p>vibrating<br />in<br />hidden<br />dimensions</p>
`;
document.body.appendChild(overlay);
