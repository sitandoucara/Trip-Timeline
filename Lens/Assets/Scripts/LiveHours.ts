/**
 * The live grounded refresh.
 *
 * The Lens NEVER waits for this. It boots on the catalogue — cards visible, bar
 * usable — and this call runs in the background. When it lands, opening hours
 * and descriptions are updated in place; if it fails, times out, or returns
 * nonsense, nothing happens and the user notices nothing. There is deliberately
 * no state in which the network decides whether the Lens works.
 *
 * Gemini 2.5 Flash with Google Search grounding, via RSG. The Pass 1 spike
 * proved grounding and a strict responseSchema coexist (~13s), and that grounded
 * hours come back as PROSE — so the schema demands numeric openHour/closeHour
 * alongside the human string, because the CLOSED rule can only work on numbers.
 *
 * Durations are never requested and never touched: duration is block length, and
 * block length must not change between runs.
 */
import { Gemini } from "RemoteServiceGateway.lspkg/HostedExternal/Gemini";

import { Activity, City } from "./Catalogue";

/** Give up after this and keep the catalogue. Grounded calls run ~13s. */
const TIMEOUT_SECONDS = 30;

export interface RefreshResult {
  ok: boolean;
  changed: number;
  reason: string;
}

const HOURS_SCHEMA = {
  type: "object",
  properties: {
    activities: {
      type: "array",
      items: {
        type: "object",
        properties: {
          slug: { type: "string" },
          openingHours: { type: "string" },
          openHour: { type: "number" },
          closeHour: { type: "number" },
          description: { type: "string" },
        },
        required: ["slug", "openingHours", "openHour", "closeHour", "description"],
      },
    },
  },
  required: ["activities"],
};

function buildPrompt(city: City): string {
  const lines: string[] = [];
  for (let i = 0; i < city.activities.length; i++) {
    const a = city.activities[i];
    lines.push('- ' + a.slug + ' = "' + a.name + '"');
  }
  return (
    "Using current web information, give today's visitor opening hours for these " +
    city.name +
    " attractions.\n\n" +
    lines.join("\n") +
    "\n\nFor each slug return:\n" +
    "- openingHours: a short human-readable string, e.g. \"09:00 – 18:00 · Closed Tue\"\n" +
    "- openHour: the opening time as a DECIMAL number of hours (09:30 is 9.5)\n" +
    "- closeHour: the closing time as a DECIMAL number of hours (17:45 is 17.75)\n" +
    "- description: one short factual sentence about the place\n\n" +
    "openHour and closeHour must be plain numbers between 0 and 24, never text. " +
    "If a place is open all day use 8 and 22. Return every slug exactly once, " +
    "using the slug strings above verbatim. Do not invent slugs."
  );
}

/** A returned row is only usable if BOTH the numbers and the text are sane. */
function usable(row: any): boolean {
  if (!row || typeof row.slug !== "string") return false;
  const o = row.openHour;
  const c = row.closeHour;
  if (typeof o !== "number" || typeof c !== "number") return false;
  if (!isFinite(o) || !isFinite(c)) return false;
  if (o < 0 || o > 24 || c < 0 || c > 24) return false;
  if (c - o < 0.5) return false;
  if (typeof row.openingHours !== "string" || row.openingHours.length === 0) return false;
  if (typeof row.description !== "string" || row.description.length === 0) return false;
  return true;
}

function findActivityIn(city: City, slug: string): Activity {
  for (let i = 0; i < city.activities.length; i++) {
    if (city.activities[i].slug === slug) return city.activities[i];
  }
  return null;
}

function fmt(h: number): string {
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return (hh < 10 ? "0" : "") + hh + ":" + (mm < 10 ? "0" : "") + mm;
}

/**
 * Fetch and apply. Resolves with a result; never rejects, so callers cannot
 * accidentally take the Lens down with an unhandled rejection.
 */
export function refreshCityHours(
  script: BaseScriptComponent,
  city: City
): Promise<RefreshResult> {
  return new Promise<RefreshResult>((resolve) => {
    let settled = false;
    const finish = (r: RefreshResult) => {
      if (settled) return;
      settled = true;
      resolve(r);
    };

    // Hard deadline. A hung request must never leave the chip spinning forever.
    const timeout = script.createEvent("DelayedCallbackEvent");
    timeout.bind(() => finish({ ok: false, changed: 0, reason: "timed out" }));
    timeout.reset(TIMEOUT_SECONDS);

    print("[P10] fetching live hours for " + city.name + " (grounded, background)");

    Gemini.models({
      model: "gemini-2.5-flash",
      type: "generateContent",
      body: {
        contents: [{ role: "user", parts: [{ text: buildPrompt(city) }] }],
        tools: [{ google_search: {} }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: HOURS_SCHEMA,
        },
      },
    } as any)
      .then((resp: any) => {
        const cand = resp?.candidates?.[0];
        const grounded = cand?.groundingMetadata ? true : false;
        const text = cand?.content?.parts?.[0]?.text;
        if (!text) {
          finish({ ok: false, changed: 0, reason: "empty response" });
          return;
        }

        let parsed: any = null;
        try {
          parsed = JSON.parse(text);
        } catch (e) {
          finish({ ok: false, changed: 0, reason: "unparseable JSON" });
          return;
        }
        const rows = parsed?.activities;
        if (!rows || !rows.length) {
          finish({ ok: false, changed: 0, reason: "no activities in response" });
          return;
        }

        let changed = 0;
        let discarded = 0;
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!usable(row)) {
            discarded++;
            continue;
          }
          // The slug catalogue is closed: anything unrecognised is dropped.
          const activity = findActivityIn(city, row.slug);
          if (!activity) {
            discarded++;
            continue;
          }

          const hoursDiffer =
            activity.hoursText !== row.openingHours ||
            Math.abs(activity.openHour - row.openHour) > 0.001 ||
            Math.abs(activity.closeHour - row.closeHour) > 0.001;

          if (hoursDiffer) {
            print(
              "[P10] CHANGED " +
                activity.slug +
                '  "' +
                activity.hoursText +
                '" [' +
                fmt(activity.openHour) +
                "-" +
                fmt(activity.closeHour) +
                ']  ->  "' +
                row.openingHours +
                '" [' +
                fmt(row.openHour) +
                "-" +
                fmt(row.closeHour) +
                "]"
            );
            changed++;
          }

          activity.hoursText = row.openingHours;
          activity.openHour = row.openHour;
          activity.closeHour = row.closeHour;
          activity.description = row.description;
        }

        finish({
          ok: true,
          changed: changed,
          reason:
            (grounded ? "grounded" : "ungrounded") +
            (discarded > 0 ? ", " + discarded + " rows discarded" : ""),
        });
      })
      .catch((err: any) => {
        // Expired RSG tokens land here too. Silent by design.
        finish({ ok: false, changed: 0, reason: "request failed: " + err });
      });
  });
}
