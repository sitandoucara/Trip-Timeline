# TRIP TIMELINE — Spectacles

> A spatial trip planner for SPECS. You pick a city, browse the activities it offers, read their details, and place them on the timeline of the day you want to plan. The Lens queries Google's AI for real opening hours, and the timeline only accepts an activity placed within those hours. A placed activity can then be marked as done, or unchecked and moved elsewhere — the order is never enforced.

https://github.com/user-attachments/assets/cae8c6a6-9d46-4f94-9d57-5683ed4fab61

DEMO LINK

> CLAD Summer Hackathon — Week 1: _Organize_

---

## Cloning this repo

Assets are stored with **Git LFS**. GitHub's "Download ZIP" does **not** resolve
LFS files — you would get pointer stubs instead of images, and the project would
fail to open. Clone it instead:

```bash
git lfs install
git clone https://github.com/sitandoucara/Trip-Timeline
```

---

## What it does

- **Five cities** — Paris, London, Los Angeles, Tokyo, Marrakech, on a carousel.
  Six real activities each, with real durations, opening hours and prices.
- **A day as an object** — a horizontal timeline from 08:00 to 22:00. Drag an
  activity card down onto it; a dashed preview shows the snapped slot before you
  release.
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
`persistentStorageSystem` · procedural geometry (rounded rects, dashed preview,
clock and calendar marks) · Abhaya Libre, with its metrics read straight out of
the font file

---

## Running it

1. Clone the repo as above, then open `Lens/trip_timeline.esproj` in
   **Lens Studio 5.22+**, signed in to your Snapchat account.
2. Generate Remote Service Gateway tokens
   (**Window → Remote Service Gateway Token**) if you want the live hours
   refresh. Everything else runs without them — the Lens boots on its own
   catalogue, and the refresh fails silently rather than blocking anything.
3. Preview works fully in-editor: every gesture is driven by the mouse.

---

## Built agentically

Every line of this Lens was written by CLAD, one verifiable layer at a time —
from the timeline and its two rules, through the generation of all 31 thumbnails
and the procedural geometry, to the typography pass that read Abhaya Libre's real
advance table out of the font file and re-solved every layout against it.

The process, the decisions and the dead ends are in the CLAD prompt log submitted
with this entry.
