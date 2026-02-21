import './style.css';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

// Setup Scene, Camera, Renderer
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.015);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 100; // Zoomed out significantly

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap pixel ratio for performance
document.getElementById('app')?.appendChild(renderer.domElement);

// Post-Processing (Bloom for the Ethereal Glow)
const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  2.5,  // strength
  0.5,  // radius
  0.1   // threshold
);

const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// String Theory Geometry setup - Converting to Dotted Lines / Particles
const STRINGS_COUNT = 400; // Dense enough to show shapes, sparse enough to breathe
const POINTS_PER_STRING = 60; // How many dots per string curve
const TOTAL_VERTICES = STRINGS_COUNT * POINTS_PER_STRING;

const positions = new Float32Array(TOTAL_VERTICES * 3);
const uvs = new Float32Array(TOTAL_VERTICES * 2);
const randoms = new Float32Array(TOTAL_VERTICES * 3);

let vertexIndex = 0;

for (let i = 0; i < STRINGS_COUNT; i++) {
  // Random properties for this specific string curve
  const rX = Math.random();
  const rY = Math.random();
  const rZ = Math.random();

  for (let j = 0; j < POINTS_PER_STRING; j++) {
    const tAlong = j / (POINTS_PER_STRING - 1);
    
    uvs[vertexIndex * 2 + 0] = tAlong;
    uvs[vertexIndex * 2 + 1] = i; // String ID mapping
    
    randoms[vertexIndex * 3 + 0] = rX;
    randoms[vertexIndex * 3 + 1] = rY;
    randoms[vertexIndex * 3 + 2] = rZ;
    
    vertexIndex++;
  }
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 3));

// Custom Shader Material -> Adjusted for Points & Interactive
const vertexShader = `
  uniform float uTime;
  uniform vec3 uMouse;
  attribute vec3 aRandom;
  
  varying vec3 vColor;
  varying float vOpacity;

  void main() {
    float tAlong = uv.x; // 0.0 to 1.0 along the string curve
    float stringId = uv.y;
    
    // EVEN SLOWER: uTime multiplier from 0.05 to 0.015
    float flowTime = uTime * 0.015; 
    
    // 1. Macro Origin - where does this string live?
    float radius = 25.0 + aRandom.z * 20.0;
    float theta = aRandom.x * 6.2831;
    float phi = acos(aRandom.y * 2.0 - 1.0);
    
    vec3 origin = vec3(
      sin(phi) * cos(theta),
      sin(phi) * sin(theta),
      cos(phi)
    ) * radius;
    
    // Make the origin drift slowly (EVEN SLOWER multipliters)
    origin.x += sin(flowTime + aRandom.y * 10.0) * 10.0;
    origin.y += cos(flowTime * 1.2 + aRandom.z * 10.0) * 10.0;
    origin.z += sin(flowTime * 0.8 + aRandom.x * 10.0) * 10.0;

    // 2. Macro Path - the general wavy curve of the string
    float length = 20.0 + aRandom.x * 15.0;
    float localT = tAlong - 0.5; // -0.5 to 0.5
    
    // EVEN SLOWER wave speeds
    vec3 path = vec3(
      sin(origin.y * 0.1 + localT * 3.0 + flowTime * 2.0) * length,
      cos(origin.x * 0.1 + localT * 2.5 - flowTime * 1.5) * length,
      sin(origin.z * 0.1 - localT * 3.5 + flowTime * 2.5) * length
    );
    
    // Convert to world pos without rotation
    vec3 basePos = origin + path;

    // Apply rotation mathematically here to sync with the scene.rotation in JS
    // Complex, extremely slow tumble around all 3 axes
    float rotX = uTime * 0.007 + sin(uTime * 0.002) * 0.5;
    float rotY = uTime * 0.005 + cos(uTime * 0.003) * 0.5;
    float rotZ = uTime * 0.009;
    
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
    // Basic Z rotation matrix
    mat3 rotMatZ = mat3(
      cos(rotZ), -sin(rotZ), 0.0,
      sin(rotZ), cos(rotZ), 0.0,
      0.0, 0.0, 1.0
    );
    
    // Apply all three rotations (Z * Y * X matrix multiplication order)
    vec3 rotatedPos = rotMatZ * rotMatY * rotMatX * basePos;
    vec3 finalPos = rotatedPos;

    // 3. Quantum Vibrations - the high frequency jitter
    float microFreq = 15.0 + aRandom.y * 10.0;
    float microAmp = 0.5 + aRandom.z * 1.5;
    
    // EVEN SLOWER jitter speed
    vec3 microOffset = vec3(
      sin(tAlong * microFreq + uTime * 1.0 + aRandom.x * 6.28),
      cos(tAlong * microFreq * 1.1 - uTime * 0.8 + aRandom.y * 6.28),
      sin(tAlong * microFreq * 0.9 + uTime * 1.2 + aRandom.z * 6.28)
    ) * microAmp;
    
    // Taper the vibrations at the very ends of the string
    float taper = sin(tAlong * 3.14159);
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
    
    // Apply pull and swirl
    finalPos += toMouse * interactionForce * 15.0 * aRandom.x; // Pull them densely towards the center
    finalPos += swirlForce * interactionForce * 20.0; // Swirl them around the mouse
    finalPos += microOffset * interactionForce * 5.0; // Add extra jitter chaos in the vortex

    // Projection
    vec4 mvPosition = viewMatrix * vec4(finalPos, 1.0); // We ignore modelMatrix intentionally since we do rotation in shader now to coordinate with uMouse
    gl_Position = projectionMatrix * mvPosition;
    
    // BIGGER PARTICLES: Increased base size multiplier from 40.0 to 100.0
    gl_PointSize = (100.0 / -mvPosition.z) * (0.5 + taper * 1.5 + interactionForce * 5.0);

    // ---- PALETTE (dimmed ~50% of true vibrancy for atmospheric glow) ----
    // Amber Gold   #ffbe0b -> rgb(255,190,11)   dimmed
    vec3 palAmberGold   = vec3(0.50, 0.37, 0.02);
    // Blaze Orange #fb5607 -> rgb(251,86,7)     dimmed
    vec3 palBlazeOrange = vec3(0.49, 0.17, 0.01);
    // Neon Pink    #ff006e -> rgb(255,0,110)     dimmed
    vec3 palNeonPink    = vec3(0.50, 0.00, 0.22);
    // Blue Violet  #8338ec -> rgb(131,56,236)   dimmed
    vec3 palBlueViolet  = vec3(0.26, 0.11, 0.46);
    // Azure Blue   #3a86ff -> rgb(58,134,255)   dimmed
    vec3 palAzureBlue   = vec3(0.11, 0.26, 0.50);

    // The 5 colors are cycled based on (stringId + tAlong) over time
    // Each period covers all 5 colors in a smooth gradient loop
    float cycle = mod(stringId * 0.037 + tAlong * 2.0 + flowTime * 0.8, 5.0);
    
    vec3 palColor;
    if (cycle < 1.0) {
      palColor = mix(palAmberGold,   palBlazeOrange, cycle);
    } else if (cycle < 2.0) {
      palColor = mix(palBlazeOrange, palNeonPink,    cycle - 1.0);
    } else if (cycle < 3.0) {
      palColor = mix(palNeonPink,    palBlueViolet,  cycle - 2.0);
    } else if (cycle < 4.0) {
      palColor = mix(palBlueViolet,  palAzureBlue,   cycle - 3.0);
    } else {
      palColor = mix(palAzureBlue,   palAmberGold,   cycle - 4.0);
    }

    vec3 baseColor = palColor;

    // Slightly brighten the midpoints of each string (taper effect)
    baseColor = mix(baseColor * 0.5, baseColor, taper);
    
    // Mouse vortex: flash brighter versions of Neon Pink & Amber Gold
    vec3 swirlColorA = vec3(1.0, 0.0, 0.43);   // Full-brightness Neon Pink
    vec3 swirlColorB = vec3(1.0, 0.75, 0.04);  // Full-brightness Amber Gold

    float swirlColorMix = sin(tAlong * 5.0 + uTime * 2.0 + stringId) * 0.5 + 0.5;
    vec3 activeColor = mix(swirlColorA, swirlColorB, swirlColorMix);
    
    vColor = mix(baseColor, activeColor, interactionForce * 1.2);
    
    float flash = sin(stringId * 0.05 + uTime * 0.8) * 0.5 + 0.5;
    float depthFade = smoothstep(50.0, -80.0, mvPosition.z);
    
    // Glow brighter when in the vortex
    vOpacity = taper * depthFade * (0.2 + 0.8 * flash) + interactionForce;
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  varying float vOpacity;

  void main() {
    // Make the point circular instead of square
    vec2 cxy = 2.0 * gl_PointCoord - 1.0;
    float r = dot(cxy, cxy);
    if (r > 1.0) {
      discard; // Mask out the corners
    }
    
    // Create a very smooth, gradual radial gradient for the glow
    // exp(-r * factor) produces a lovely Gaussian falloff (much softer than pow)
    float softGlow = exp(-r * 3.0); 
    
    // The core is slightly brighter, the edges fade out gracefully into the background
    float alpha = softGlow * vOpacity;
    
    // We also push the color intensity slightly up in the very center
    vec3 glowColor = vColor * (1.0 + softGlow * 0.5);
    
    gl_FragColor = vec4(glowColor, alpha);
  }
`;

const material = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader,
  uniforms: {
    uTime: { value: 0 },
    uMouse: { value: new THREE.Vector3(0, 0, -200) } // Default off-camera
  },
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

// Using Points instead of LineSegments creates the "dotted" effect
const points = new THREE.Points(geometry, material);
// We disabled scene rotation in JS because we moved it into the shader to keep mouse coordinates accurate
scene.add(points);

// Mouse Interaction Setup
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(-999, -999);
const targetMouse = new THREE.Vector3(0, 0, 0);
// Create an invisible plane at Z=0 to test mouse intersection against
const mousePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

window.addEventListener('pointermove', (event) => {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  
  // Calculate where the mouse pointer hits the invisible 3D plane
  raycaster.setFromCamera(pointer, camera);
  raycaster.ray.intersectPlane(mousePlane, targetMouse);
});

// Animation Loop
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  
  const elapsedTime = clock.getElapsedTime();
  material.uniforms.uTime.value = elapsedTime;
  
  // Smoothly lerp the shader uniform to the actual mouse hit point
  material.uniforms.uMouse.value.lerp(targetMouse, 0.05);

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
});

// Update DOM to add a cool overlay title
const overlay = document.createElement('div');
overlay.className = 'overlay';
overlay.innerHTML = `
  <h1>String Theory</h1>
  <p>Vibrating in hidden dimensions</p>
`;
document.body.appendChild(overlay);
