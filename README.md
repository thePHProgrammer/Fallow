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
- **A bird to keep you company.** A low-poly 3D bird, built in code with
  three.js (no model files), sits on a branch above the timer — breathing,
  blinking, tilting its head. Each completed focus block earns seeds; feed
  them and it hops over, pecks, and chirps. It never gets hungry or leaves.
  Stays perfectly still in Calm Mode or with reduced motion.
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
