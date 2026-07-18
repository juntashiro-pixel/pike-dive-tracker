# Dive Tracker — Quick Task Reference

This is a concise reference for the most common things you'll ask Claude to do with this app. Copy-paste the relevant prompt.

---

## After a Meet

**If on DiveMeets.com:**
> The boys competed at [MEET NAME] on [DATE]. Can you open the app source from pike-dive-tracker.zip and sync the new results? Hayden placed #[X] with [SCORE] on 1M and Gale placed #[X] with [SCORE] on 1M. Then rebuild and give me the dist zip.

**If on DiveLive (PDF results):**
> Here are the DiveLive result PDFs from [MEET NAME]. Can you parse them and add the results to the app's DIVELIVE_RESULTS array in App.jsx? Rebuild and give me the dist zip.
> [Attach the PDFs]

---

## Update Gale's Coach Dive List

> Gale has progressed on some dives. Can you update his coachDiveList in App.jsx?
> - 301C on 1M: change from "struggling" to "working"
> - 102C on 3M: change from "working" to "complete"
> - 5132D on 1M: add as "planned"
> Then rebuild and give me the dist zip.

---

## Add a New Dive to the DD Table

> Can you add these dives to DD_TABLE in App.jsx?
> - 303C (Reverse 1½ Somersault Tuck): 1M DD 2.1, 3M DD 2.3
> - 5132D (Forward 1½ Somersault 1 Twist Free): 1M DD 2.2, 3M DD 2.4
> Then rebuild and give me the dist zip.

---

## Update Season Schedule

> The JDA Invite 2026 is confirmed for May 16-17 in Ewing, NJ. Can you update UPCOMING_MEETS in App.jsx? Also remove [OLD MEET] since it's passed. Rebuild and give me the dist zip.

---

## Change AAU Qualifying Scores

> The AAU qualifying scores for 2027 have changed. Hayden (Group C) now needs 215 on 1M and 230 on 3M. Can you update the qualifying object in DIVERS.hayden? Rebuild and give me the dist zip.

---

## Fix a Date or Meet Detail

> The Knight Invite date is wrong in the app. It should be [CORRECT DATE], not [WRONG DATE]. Can you fix it in both Hayden's and Gale's meetHistory in App.jsx? Rebuild and give me the dist zip.

---

## Add Event Rule Preset for a New Meet

> The upcoming [MEET NAME] has different rules:
> - Group C Boys 1m: 6 vols, 2 opts, max vol DD 10.0, 5 different vol groups
> Can you add this as a new preset in the EVENT_RULES object in App.jsx? Rebuild and give me the dist zip.

---

## Update the App Icon or Branding

> Can you change the app icon to say "[NEW TEXT]" instead of "Dive Tracker"? The icon is generated via Python/PIL in the build process — regenerate all three sizes (180, 192, 512px) and rebuild.

---

## Transition Hayden to Next Age Group

When Hayden ages up (e.g., from Group C to Group B), update:
> Hayden is now in Group B (14-15). Can you update his ageGroup to "B", ageGroupLabel, and add Group B event rule presets (B-1M, B-3M) with the correct rules? Also update his qualifying scores. Rebuild and give me the dist zip.

---

## Full Rebuild from Source

> Can you take the pike-dive-tracker.zip source, install dependencies, build, and give me a fresh dist zip?

---

## Deploy Steps (Non-Technical)

1. Download the dist zip from Claude
2. Unzip it (you'll get a folder called `dist`)
3. Go to https://app.netlify.com
4. Log in → click on "pike-dive-tracker" site
5. Go to "Deploys" tab
6. Drag the `dist` folder onto the upload area
7. Wait ~15 seconds for "Published"
8. On your phone: close the Dive Tracker app completely (swipe up from app switcher), then reopen

---

## Key Files to Provide Claude

When asking Claude to modify the app, always attach:
- **pike-dive-tracker.zip** (full source code, ~120KB)

Claude will unzip, modify, rebuild, and return:
- **pike-dive-tracker-dist.zip** (ready to deploy to Netlify)
- **pike-dive-tracker.zip** (updated source for next time)

---

## Important: What NOT to Modify

- **node_modules/** — never edit; npm install regenerates these
- **dist/** — never edit; npm run build regenerates this
- **firebase.js** — contains API keys that are already configured; only change if migrating Firebase projects
- **main.jsx** — 3-line entry point; never needs changes
- **vite.config.js** — only change if modifying PWA manifest (icon paths, app name)
