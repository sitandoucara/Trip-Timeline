# Trip Timeline

**Plan your activities across the day.**

A spatial trip planner for SPECS, built with CLAD in Lens Studio.

Pick a city, then drag its activities onto a floating hour line to build your day.
Each placed activity shows exactly when it happens, and the line pushes back:
drop something outside its opening hours or on top of another activity and it
refuses, and tells you why. Mark things done as you go. Your week persists
between sessions.

> CLAD Summer Hackathon — Week 1: _Organize_

---

## What it does

- **Five cities** — Paris, London, Los Angeles, Tokyo, Marrakech, on a carousel.
  Six real activities each, with real durations, opening hours and prices.
- **A day as an object** — a horizontal hour line from 08:00 to 22:00. Drag an
  activity card down onto it; a dashed preview shows the snapped slot before
  you release.
- **Two rules that push back** — an activity refuses a slot outside its opening
  hours (_"Opens at 09:30"_) or one that collides with something already placed
  (_"Overlaps Louvre Museum"_). The preview turns coral before you release, so
  the rejection is never a surprise.
- **Live opening hours** — the Lens boots instantly on its own catalogue, then
  refreshes hours in the background from live web sources. It has corrected its
  own data: _"Sunrise – sunset"_ became _05:00 – 18:30_, which the closing-hours
  rule can actually read.
- **Done, not just planned** — tap a placed activity to mark it done as your day
  goes on. Tap again to undo.
- **One week, all cities** — a seven-day strip, one shared agenda. A single day
  can hold Paris in the morning and London in the evening.
- **It remembers** — the whole week persists between sessions.

---

## Built with

Lens Studio 5.22 · CLAD · Spectacles Interaction Kit ·
Remote Service Gateway → Gemini 2.5 Flash with Google Search grounding ·
`persistentStorageSystem` · procedural geometry (rounded rects, dashed ghost,
clock and calendar marks) · Abhaya Libre, metrics read from the font file

---

## Running it

1. Open `Lens/trip_timeline.esproj` in **Lens Studio 5.22+**, signed in to your
   Snapchat account.
2. Generate Remote Service Gateway tokens (**Window → Remote Service Gateway
   Token**) if you want the live hours refresh. Everything else runs without
   them — the Lens boots on its catalogue and the refresh is silent when it
   fails.
3. Preview works fully in-editor: every gesture is driven by the mouse.

---

## Built agentically

Every line of this Lens was written by CLAD across 33 numbered passes — from a
scoping pass that wrote no code, through a throwaway spike that measured API
latency before anything was built on top of it, to the typography pass that read
Abhaya Libre's real advance table out of the font file and re-solved every
layout against it.

The process, the decisions, the dead ends and the bugs that turned out to be the
medium rather than the code: see the CLAD prompt log submitted with this entry.

---

## Honesty ledger

This Lens was built and verified **entirely in Lens Studio preview** — no SPECS
hardware. What that leaves untested:

- **Hand input.** Every gesture is proven with mouse-driven input in the
  simulator. Pinch and hand-ray on device are wired but unverified.
- **Reach and scale.** The composition is authored for 75 cm. How it feels at
  real arm's length is unmeasured.
- **The additive display.** Surfaces are tuned against the preview compositor.
  On real hardware, nothing a Lens draws can subtract light — dark panels will
  read differently there.
- **Live-hours auth.** The refresh uses development RSG tokens, which expire
  hourly. Token persistence for a published Lens is not solved here.
