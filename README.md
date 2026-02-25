# Swirl Theory ✨

A GPU-accelerated interactive visualization built with [Three.js](https://threejs.org/) and custom **GLSL shaders**.

Two animations live inside — **Swirl Theory** and **String Theory** — toggled by clicking the title. Inspired by theoretical physics: particles as vibrating one-dimensional strings existing in hidden dimensions, rendered as an evolving cosmic artwork.

---

## 🌌 Animations

### Swirl Theory *(default)*
Logarithmic spiral arms revolve inward from the screen edges toward the pointer. The swirl follows your cursor in real time, teleports on click with a fade-out/snap/fade-in transition, and fires a ripple shockwave that displaces the field with a coloured gradient ring (Neon Pink → Indigo → Royal → Sapphire → Sky Aqua).

When idle the swirl slowly sinks toward the nav icons and orbits them. On scroll it lifts upward then drifts back.

### String Theory *(click the title to toggle)*
The original animation: a dense sphere of vibrating dotted strings built from custom GLSL shaders. Strings drift and tumble in full 3D rotation across all axes with subtle quantum-jitter vibrations. Moving your cursor pulls nearby particles into a swirling vortex of colour.

---

## 🎨 Features

| Feature | Detail |
|---|---|
| **Dual animation modes** | Click the title to toggle Swirl Theory ↔ String Theory |
| **Dark / Light theme** | Sun/moon button with a full-screen ripple colour transition |
| **Mouse vortex** | Nearby particles swirl, brighten and burst into colour |
| **Click ripple** | Shockwave ring expands from click point with palette gradient |
| **Click teleport** | Swirl fades out, snaps, fades back in at the click position |
| **Idle sink** | Swirl drifts to the nav icons after inactivity and orbits them |
| **Touch inertia** | On mobile, releasing a flick sends the swirl coasting with velocity; gravity pulls it downward until it sinks to the nav |
| **Scroll lift** | Mouse wheel pushes the swirl upward with inertia |
| **Bloom post-processing** | `UnrealBloomPass` gives an ethereal volumetric glow |
| **Tiered performance** | Geometry density and pixel ratio scale by `hardwareConcurrency` |
| **Mobile-adaptive zoom** | Camera zooms out automatically on mobile in String Theory mode |
| **About panel** | Shown in light mode with clickable LinkedIn and GitHub links |
| **Contact nav** | Desktop icon links; mobile hamburger drawer with ripple expand |

---

## 🛠 Tech Stack

| Technology | Purpose |
|---|---|
| **Vite** | Development build tool |
| **TypeScript** | Type-safe application logic |
| **Three.js** | 3D rendering and post-processing |
| **GLSL Shaders** | GPU-accelerated animation, physics and colour |

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+

### Install & run

```bash
git clone https://github.com/jaaraarkey/string-theory.git
cd string-theory
npm install
npm run dev
```

Open `http://localhost:5173`.

### Build for production

```bash
npm run build
```

---

## 🎮 Interaction

| Input | Effect |
|---|---|
| **Move mouse / touch-drag** | Swirl follows the pointer; nearby strings swirl into a vortex |
| **Click / tap** | Swirl teleports to the click point + ripple shockwave |
| **Release touch flick** | Swirl coasts on velocity, arcs downward, sinks to nav |
| **Scroll wheel** | Lifts the swirl upward with inertia |
| **Click title** | Toggles between Swirl Theory and String Theory animations |
| **Sun/moon button** | Toggles dark and light theme with ripple transition |
| **Mobile circle button** | Opens contact drawer (LinkedIn, GitHub) |

---

## 📂 Project Structure

```
string-theory/
├── src/
│   ├── main.ts        # Three.js scene, GLSL shaders, interaction logic
│   └── style.css      # Layout, themes, animations
├── index.html         # Entry point
├── vite.config.ts     # Vite configuration
├── tsconfig.json      # TypeScript configuration
└── package.json
```

---

*Made with energy, light, and hidden dimensions.* 🌠
