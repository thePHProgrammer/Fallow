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
- **A living, illustrated scene.** Drawn live with three.js in a
  storybook style (cel shading and ink outlines, no image or model files):
  a robin tucked in a nest on a desk by a rainy window — lamp glowing, tea
  steaming, fairy lights twinkling, a little radio that lights up when the
  lofi radio plays.
- **The sound mixer changes the weather.** Turn on sound and raise Waves:
  the robin flies out over a blue sea, past lighthouses and fishing boats.
  Add Rain and it becomes a storm — dark skies, big waves, rain, lightning.
  Rain alone keeps it home, with heavier rain on the window.
- **Feed the bird.** Each completed focus block earns seeds; feed them and
  the robin pecks them up (or catches them mid-air), hearts float up, and
  it chirps. It never gets hungry or leaves.
- **Landscape everywhere.** On wide screens the scene fills the window with
  the app in a column on the left; on phones it is a landscape banner above
  the app. **Fullscreen** hides the app and leaves the scene and a small
  clock, screen-awake — made for a second monitor; on a phone it turns the
  picture to landscape. Calm Mode and reduced motion hold it still.
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
