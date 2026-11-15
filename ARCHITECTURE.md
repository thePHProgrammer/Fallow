# Fallow — architecture

A personal focus app. The design constraint that outranks every other: **this
app must not become the procrastination.** The smallest useful version ships in
a weekend; everything after it is optional and earns its place only by being
used.

## Stack

| Concern | Choice | Why |
| --- | --- | --- |
| UI | React + Vite SPA | Already familiar; deploys to Vercel like the portfolio |
| State | Zustand + `persist` middleware | Tiny, no boilerplate; persists to localStorage |
| Audio | Web Audio API, procedural | Zero audio assets, tiny bundle |
| Drag & drop | dnd-kit (Phase 3) | Accessible, headless |
| Backend | **None for v1** | Single-user, local-first, private, offline |

Data lives on the device. A backend (optional Supabase, never hand-rolled AWS)
enters only in Phase 6, and only for cross-device sync.

## Deliberate cuts

- **No binaural/monaural beats.** The evidence is weak-to-negative (unguided
  binaural beats can impair performance). White/pink/brown noise is generated
  procedurally instead.
- **No pause button.** Focus blocks are indivisible: once running, the only
  exit is a hard stop that doesn't count. Pausing is how blocks quietly
  dissolve.
- **No "scroll social media" break option.** Breaks are restorative by
  construction.
- **Streaks and journaling come last, gently, or not at all.** A streak engine
  can become a source of anxiety; a journal holds emotional content and must
  never be casually synced to a cloud database.

## Phases

Each phase is shippable on its own. **Stop and use the app for a week between
phases** — usage, not completeness, decides whether the next phase gets built.

### Phase 0 — Foundation & calm design system ✅
App shell, stable tab navigation (WCAG 3.2.3), global settings store, and
accessibility tokens baked in from the start: left-aligned body text,
line-height ≥ 1.5, 70–80 character measure, charcoal on off-white, visible
focus rings, `prefers-reduced-motion` respected globally. One **Calm Mode**
toggle wired to a root `data-calm` attribute that all CSS reads.
Retrofitting this later is expensive; doing it first is nearly free.

### Phase 1 — Focus core (the MVP) ✅
- **Hybrid timer.** Pomodoro (default 25/5, long break after 4 blocks) and
  Flowtime (count-up; finishing earns a proportional break, elapsed ÷ 5,
  clamped to 2–30 min).
- **Indivisibility rule.** No pause. "Stop" abandons the block behind a
  confirm, and it doesn't count.
- **Timing correctness.** Background tabs throttle `setTimeout`/`setInterval`,
  so all elapsed/remaining time is derived from wall-clock timestamps
  (`startedAt` / `endsAt`); the render interval only refreshes the display.
  Phase-change chimes run on the Web Audio clock, which is not throttled.
- **Noise mixer.** White noise from a random buffer, pink via Paul Kellet's
  filter, brown via leaky integration, rain as high-passed hiss plus random
  droplet transients, and waves as brown noise on a slow swell envelope with
  crest hiss — all procedural, each a seamlessly crossfaded loop with its own
  gain node and a low default level.

### Phase 2 — Restorative breaks ✅
Triggered on timer completion (the break phase shows an activity picker) plus
a gentle nudge after 90 continuous minutes of focus. Breathing widget (4s in /
6s out, reduced-motion aware), 40-second green visualization (inline SVG, no
assets), stretch prompts, silent mindful pause. No doom-scroll option, by
construction. Small, because it's tightly coupled to the timer.

### Phase 3 — Prioritization board ✅
Eisenhower Kanban with dnd-kit: four quadrants, hard cap of 10 tasks per
quadrant, separate work/personal boards, and an implementation-intention
prompt on task creation ("If X happens, then I will Y").

### Phase 4 — Habit engine (optional, gentle) ✅
Max three habits, each tied to a trigger; sub-30-second logging;
"never miss twice"; streak freezes and a grace window; streak math in the
local timezone; encouraging language on a broken streak, never a punitive
reset. **If it starts feeling like pressure, drop it.**

### Phase 5 — Reflective journal (private by design) ✅
Two prompts (feelings, thoughts) to steer away from rumination.
Distraction-free editor, spellcheck/grammar off, autosave, optional gratitude
prompt. Local-only or client-side encrypted. Plain-text export. Zero content
analytics.

### Phase 6 — Polish ✅ (sync deferred)
Installable offline PWA (manifest + service worker with cached fallback) and
JSON export/import of every store, so data is never locked in. Optional
Supabase sync + auth remains deliberately unbuilt until single-device use
proves limiting.

### The field — gentle gamification
Gamification made it in, but growth-only by design: completed focus blocks
grow plants in a 14-day field. There is no decay, no loss state, no points,
no red numbers — a bare plot is soil resting, which is what "fallow" means.
Loss-framed mechanics (dying streaks, wilting plants) convert a focus tool
into an anxiety source, so they are banned here the same way the doom-scroll
break option is.

### The living scene & lofi radio — coziness
A three.js scene drawn like an illustration: `MeshToonMaterial` with three
light bands, and ink outlines made from inverted hulls (`scene/toon.ts`).
Everything is generated from primitives and small canvas-drawn textures (no
asset files) and lazy-loaded so the app paints first.

- **Places.** `room` (nest on a desk by a rainy window), `sea`, and `storm`.
  The sound mixer picks: Waves → sea, Waves + Rain → storm, otherwise room
  (Rain alone just makes the window rain heavier). Room ↔ sea goes through
  a short veil while the robin takes off or lands; sea ↔ storm is one
  `storm` value blending sky, water, wave height, rain and lightning.
- **Layout.** One `.backdrop` element, three CSS states: fixed behind the
  app on wide screens (the app is a left column), a 16:9 banner on narrow
  screens, and full-screen in Fullscreen mode (rotated 90° in CSS on an
  upright phone that cannot lock to landscape). The scene is told where the
  robin should appear (an anchor in screen fractions plus a pixel height)
  and frames it with camera distance and a view offset.
- **Feeding** follows the field's rules: completed blocks earn seeds (3 per
  Pomodoro, ~1 per 10 Flowtime minutes, max 5), abandoned blocks earn none,
  and the bird has no hunger meter or sad state.
- **Fullscreen mode** hides the shell (kept mounted), shows a corner clock,
  requests fullscreen, landscape and a screen wake lock. Timer phase
  transitions live in an always-mounted `TimerDriver`, so they fire on any
  tab.
- Calm Mode / reduced motion render single still frames in any place.

The lofi radio is the one deliberate exception to "works offline": an
opt-in `<audio>` stream that never autoplays and is never cached. Stations
come from the Radio Browser directory at play time (stream URLs rot) with
hard-coded fallbacks; each failure moves to the next station exactly once.

## Data model

```
settings: { soundMix, calmMode, timerConfig, theme }
task:     { id, title, quadrant: I|II|III|IV, context, trigger, done, createdAt }
habit:    { id, name, trigger, freezes, log: [dates], createdAt }   // max 3 active
session:  { id, mode, start, end, taskId? }                          // light, optional
journal:  { id, createdAt, feelings, thoughts }                      // local/encrypted
bird:     { seeds, fed, lastFedAt }                                  // growth-only
```

All of it persists via Zustand `persist` (localStorage now; IndexedDB if the
journal ever needs client-side encryption).

## Source layout

```
src/
  main.tsx              entry
  App.tsx               shell + tab navigation
  styles.css            Phase 0 tokens, Calm Mode, reduced motion
  store/
    settings.ts         calmMode, timerConfig, soundMix (persisted)
    timer.ts            phase machine, timestamps, session log (persisted)
    tasks.ts            Eisenhower tasks, 10-per-quadrant cap (persisted)
    habits.ts           max-3 habits, freezes, local-tz streaks (persisted)
    journal.ts          entries + autosaved draft (persisted, local-only)
    bird.ts             seeds earned by focus, lifetime feedings (persisted)
    ui.ts               session-only: mixer on/off, fullscreen mode
    timerClock.ts       clock formatting + display hooks
  audio/
    noise.ts            procedural noise engine + chime + bird chirp
    radio.ts            opt-in lofi radio stream with station fallback
  scene/
    birdScene.ts        orchestrator: camera, places, feeding, render loop
    toon.ts             cel shading, ink outlines, shape + texture helpers
    bird.ts             the robin (feathered wings) and floating hearts
    room.ts             the cozy room
    sea.ts              sea, sky, lighthouses, boats, calm ↔ storm blend
    weather.ts          rain streaks and lightning
    handle.ts           shared reference to the live scene
  components/
    TimerPanel.tsx      hybrid timer UI + 90-minute nudge
    BirdScene.tsx       the scene's stage (lazy-loads it) + feed button
    AmbientMode.tsx     fullscreen overlay, wake lock, always-on TimerDriver
    BreakPanel.tsx      restorative break activities (Phase 2)
    BoardPanel.tsx      Eisenhower board, dnd-kit drag between quadrants
    HabitsPanel.tsx     gentle habit cards, one-tap logging
    JournalPanel.tsx    two-prompt editor, plain-text export
    FieldPanel.tsx      growth-only field of completed blocks
    NoiseMixer.tsx      lofi radio controls + per-colour gain sliders
    SettingsPanel.tsx   Calm Mode + durations + JSON export/import
public/
  manifest.webmanifest  PWA install metadata
  sw.js                 offline cache (network-first navigations)
  icon.svg              app icon
```
