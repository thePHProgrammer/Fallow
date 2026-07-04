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
  filter, brown via leaky integration — each looped with its own gain node and
  a low default level.

### Phase 2 — Restorative breaks
Triggered on timer completion or after 90 continuous minutes. Breathing widget
(4s in / 6s out, reduced-motion aware), 40-second green visualization, stretch
prompt, silent mindful pause. Small, because it's tightly coupled to the timer.

### Phase 3 — Prioritization board
Eisenhower Kanban with dnd-kit: four quadrants, hard cap of 10 tasks per
quadrant, separate work/personal boards, and an implementation-intention
prompt on task creation ("If X happens, then I will Y").

### Phase 4 — Habit engine (optional, gentle)
Max three habits, each tied to a trigger; sub-30-second logging;
"never miss twice"; streak freezes and a grace window; streak math in the
local timezone; encouraging language on a broken streak, never a punitive
reset. **If it starts feeling like pressure, drop it.**

### Phase 5 — Reflective journal (private by design, build last)
Two prompts (feelings, thoughts) to steer away from rumination.
Distraction-free editor, spellcheck/grammar off, autosave, optional gratitude
prompt. Local-only or client-side encrypted. Plain-text export. Zero content
analytics.

### Phase 6 — Polish
Installable offline PWA, JSON export/import (no data lock-in), and only then
optional Supabase sync + auth.

## Data model

```
settings: { soundMix, calmMode, timerConfig, theme }
task:     { id, title, quadrant: I|II|III|IV, context, trigger, done, createdAt }
habit:    { id, name, trigger, freezes, log: [dates], createdAt }   // max 3 active
session:  { id, mode, start, end, taskId? }                          // light, optional
journal:  { id, createdAt, feelings, thoughts }                      // local/encrypted
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
  audio/
    noise.ts            procedural white/pink/brown engine + chime
  components/
    TimerPanel.tsx      hybrid timer UI
    NoiseMixer.tsx      per-colour gain sliders
    SettingsPanel.tsx   Calm Mode + durations
```
