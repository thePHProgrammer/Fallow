# Fallow

A calm, cozy, local-first focus app: a hybrid Pomodoro/Flowtime timer, a
little 3D bird you feed with focus, lofi radio, procedural noise, restorative
breaks, an Eisenhower board, gentle habits, a private
journal, and a field that grows as you focus.

Land left fallow recovers. So does attention.

- **Local-first.** No backend, no account, no analytics. Everything persists
  to your browser's localStorage.
- **Indivisible focus blocks.** No pause button; a block either completes or
  is deliberately abandoned.
- **Procedural sound.** White, pink, and brown noise plus rain and ocean
  waves, all generated with the
  Web Audio API — no audio files, works offline.
- **A living background.** The whole app sits on frosted panels over a
  full-screen low-poly scene, built in code with three.js (no model files):
  a small bird on a branch — breathing, blinking, tilting its head — over
  soft hills and drifting clouds. It frames itself for the screen: beside
  the content on wide monitors, in a clear window above it on phones.
- **Feed the bird.** Each completed focus block earns seeds; feed them and
  the bird hops over, pecks, and chirps. It never gets hungry or leaves.
- **Waves take it to sea.** Turn on sound and raise the Waves slider: the
  bird lifts off, the land drops away, and it glides over a rolling ocean
  at sunset. Turn Waves down and it flies home.
- **Ambient mode.** One button hides the app and leaves the scene and a
  small clock, fullscreen and screen-awake — made for a second monitor.
  Calm Mode and reduced motion hold the scene perfectly still.
- **Lofi radio (opt-in).** Streams live lofi when you press play, picking a
  working station from the public Radio Browser directory with fallbacks.
  The one feature that needs a connection; it never autoplays.
- **Growth-only gamification.** Completed blocks grow plants in the field;
  nothing decays, nothing is lost, rest is part of the cycle.
- **Installable PWA.** Works offline; export/import your data as JSON.
- **Calm by default.** Charcoal on off-white, generous line-height, visible
  focus rings, `prefers-reduced-motion` respected, and a Calm Mode toggle
  that mutes colour and motion entirely.

## Run it

```sh
npm install
npm run dev      # local dev server
npm run build    # type-check + production build in dist/
```

Deploys as a static site (e.g. Vercel) with zero configuration.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the staged plan and the
reasoning behind what was cut.
