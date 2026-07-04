# Fallow

A calm, local-first focus app: a hybrid Pomodoro/Flowtime timer, procedural
noise, restorative breaks, an Eisenhower board, gentle habits, a private
journal, and a field that grows as you focus.

Land left fallow recovers. So does attention.

- **Local-first.** No backend, no account, no analytics. Everything persists
  to your browser's localStorage.
- **Indivisible focus blocks.** No pause button; a block either completes or
  is deliberately abandoned.
- **Procedural sound.** White, pink, and brown noise generated with the
  Web Audio API — no audio files, works offline.
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
