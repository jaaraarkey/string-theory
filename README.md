# String Theory ✨

A stunning, GPU-accelerated **string theory** visualization built with [Three.js](https://threejs.org/) and custom **GLSL shaders**, deployed to the web.

Inspired by the theoretical physics concept where fundamental particles are modeled as one-dimensional, vibrating strings of energy existing in multiple hidden dimensions, this animation recreates that concept as an interactive, evolving cosmic artwork.

---

## 🌌 Features

- **Custom GLSL Vertex & Fragment Shaders** — All animation and physics runs natively on the GPU, ensuring smooth 60 FPS performance
- **Slow, Evolving Motion** — Strings drift, vibrate, and tumble with a gentle, meditative pace
- **Full 3D Rotation** — The entire structure slowly and randomly rotates around all three axes (X, Y, Z)
- **Interactive Mouse Vortex** — Moving your cursor through the strings pulls the particles into a swirling, glowing vortex with vivid colors
- **Atmospheric Glow** — Gaussian falloff glow on every particle creates a soft, volumetric light effect
- **Multi-Color Palette** — Deep ocean blues, dark purples, bright cyans, electric blue pulses, white-yellow highlights, salmon, and soft green tints all evolve slowly through the system
- **Bloom Post-Processing** — Three.js `UnrealBloomPass` gives the strings an ethereal, energetic glow against the dark cosmos

---

## 🛠 Tech Stack

| Technology | Purpose |
|---|---|
| **Vite** | Development build tool |
| **TypeScript** | Type-safe application logic |
| **Three.js** | 3D rendering and post-processing |
| **GLSL Shaders** | GPU-accelerated physics and color |

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)

### Installation

```bash
git clone https://github.com/jaaraarkey/string-theory.git
cd string-theory
npm install
```

### Run locally

```bash
npm run dev
```

Then open your browser and navigate to `http://localhost:5173`.

### Build for production

```bash
npm run build
```

---

## 🪐 Deployment — Internet Computer (ICP)

This project is designed to be deployed to the **DFINITY Internet Computer** (ICP) as a decentralized asset canister, making it globally accessible without any centralized server.

> Deployment steps via the `dfx` SDK coming soon.

---

## 🎨 Interaction

- **Move your mouse** across the canvas to create a gravitational vortex — nearby particles will swirl, glow brighter, and burst into vivid salmon and purple.
- The animation runs autonomously without any interaction, evolving slowly over time.

---

## 📂 Project Structure

```
string-theory/
├── src/
│   ├── main.ts        # Three.js scene + GLSL shaders
│   └── style.css      # Full-screen canvas styles
├── index.html         # Entry point
├── vite.config.ts     # Vite configuration
├── tsconfig.json      # TypeScript configuration
└── package.json
```

---

*Made with energy, light, and hidden dimensions.* 🌠
