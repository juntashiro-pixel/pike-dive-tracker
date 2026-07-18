# Dive Tracker — Cowork Handoff

## What This App Is

A mobile-first PWA (Progressive Web App) that tracks competitive diving progress for two boys — Hayden Tashiro (FINA 12, Group C Boys 12-13) and Gale Tashiro (FINA 9, Group E Boys 9 & Under) — training at Pike Dive Academy under Coach Dora Fyfe. Their father Jun built this with Claude to prepare for AAU National Championship qualification in July 2026 (Fort Lauderdale, FL).

**Live URL:** https://pike-dive-tracker.netlify.app  
**Firebase Project:** `pike-dive-tracker`  
**DiveMeets Profiles:** Hayden #80986, Gale #152421

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 (single file: App.jsx, ~2800 lines) |
| Build | Vite 6 + vite-plugin-pwa |
| Database | Firebase Firestore (project: pike-dive-tracker) |
| Hosting | Netlify (drag-and-drop deploy of dist/ folder) |
| Libraries | qrcode (QR generation), jsqr (QR scanning), Firebase SDK |
| PWA | Service worker via Workbox, installable on iOS/Android |

---

## File Structure

```
pike-dive-tracker/
├── src/
│   ├── App.jsx          ← ALL app logic, UI, data (single file)
│   ├── firebase.js      ← Firebase config + Firestore CRUD functions
│   └── main.jsx         ← React entry point (3 lines)
├── public/
│   ├── apple-touch-icon.png   ← 180px icon
│   ├── pwa-192.png            ← 192px icon (pike diver + "DIVE TRACKER")
│   ├── pwa-512.png            ← 512px icon
│   └── favicon.svg            ← Browser tab icon
├── index.html           ← HTML shell
├── vite.config.js       ← Vite + PWA manifest config
├── netlify.toml         ← Build command + SPA redirects
├── package.json         ← Dependencies
└── SETUP.md             ← Firebase setup instructions
```

---

## App.jsx Architecture (Top to Bottom)

The entire app lives in one file. Here's the section map:

| Line Range | Section | What It Contains |
|-----------|---------|-----------------|
| 1-14 | Imports + Firebase check | React hooks, QR libs, Firebase functions |
| 16-72 | DD_TABLE | FINA degree of difficulty for every dive code, keyed by 1M/3M |
| 74-96 | Helpers + Constants | getDiveGroup(), GROUP_NAMES, GROUP_COLORS, AAU qualifying scores, upcoming meets |
| 98-118 | DIVELIVE_RESULTS | Hardcoded array of 18 meet results from DiveLive PDFs (AAU Nationals + CMD meets) |
| 120-249 | DIVERS | Main data object for Hayden and Gale — meetHistory, diveStats, coachDiveList (Gale only), qualifying scores |
| 251-293 | mergeDiveLive() | IIFE that merges DIVELIVE_RESULTS into each diver's meetHistory and diveStats at load time |
| 296-338 | Practice Log Seeds | Initial practice sessions (hardcoded seeds that get overwritten by Firestore) |
| 340-432 | Shared Components | Icon, Sparkline, StatusBadge, MiniDiveAdder — all stateless/standalone |
| 435-510 | App State | useState declarations, useEffect for Firebase sync, diver-switch reset logic |
| 511-600 | Computed Data | practiceFrequency, practicePatterns (recent session analysis) |
| 600-950 | renderDashboard() | Home tab: stat cards, score trends (1M+3M sparklines), qualifying progress bars, personal bests, recent meets |
| 860-1050 | renderDiveStats() | Stats tab: DD lookup tool, dive cards grouped by Forward/Back/Reverse/Inward/Twisting, expandable details with sparklines |
| 1050-1400 | renderPracticeLog() | Practice tab: QR scanner, quick-add buttons, search/add manually, status (P/R/N), session history with edit/delete |
| 1600-1770 | buildPracticePlan() | Algorithm that generates practice recommendations from coach dive list (Gale) or competition stats (Hayden), incorporating recent practice status |
| 1770-2100 | renderPracticePlan() | Print tab: hide/show toggles, add dives, print button that opens Safari-compatible printable HTML with QR code |
| 2100-2200 | renderCompetition() | Compete tab: Dive List Builder (top), event rule presets, results by height, DiveMeets sync, manual entry |
| 2200-2450 | Competition Builder Logic | Greedy dive selection algorithm, upgrade paths with execution-based projections, practice-ready dive injection |
| 2450-2550 | renderRecommendations() | Plan tab: coach dive list (Gale), auto-promotion from practice patterns, add dive goals, group coverage chart |
| 2550-2800 | Main Layout | Tab bar, header with diver switcher, sync indicator, safe area insets |

---

## Data Model

### DIVERS Object (in-memory, seeded in App.jsx)

```javascript
DIVERS.hayden = {
  id: "hayden",
  name: "Hayden Tashiro",
  diveMeetsNum: 80986,           // DiveMeets profile number
  finaAge: 12,
  ageGroup: "C",                 // C = 12-13, E = 9 & Under
  ageGroupLabel: "Group C Boys (12-13)",
  qualifying: {
    "1M": { score: 210, dives: 8 },  // AAU qualifying thresholds
    "3M": { score: 225, dives: 8 }
  },
  meetHistory: [                 // Array of meet results
    { meet: "Knight Invite", date: "2026-02-28", event: "Group C Boys 1m (12-13)",
      height: "1M", place: 6, score: 143.05,
      round: "single",          // "single" | "prelim" | "final"
      source: "divelive"        // optional: "divelive" for imported results
    }
  ],
  diveStats: [                   // Per-dive competition statistics
    { dive: "101A", height: "1M", highScore: 23.80, avgScore: 19.95, times: 14 }
  ],
  coachDiveList: null            // null for Hayden (uses generic algorithm)
}

DIVERS.gale = {
  // ... same structure, plus:
  coachDiveList: {               // Coach Dora's prescribed dive list
    "1M": [
      { dive: "101A", status: "complete" },    // complete | working | struggling | learning | planned
      { dive: "301C", status: "struggling" }
    ],
    "3M": [ ... ]
  }
}
```

### Firestore Structure

```
pike-dive-tracker (project)
└── (default) database
    └── divers/
        ├── hayden/
        │   ├── practices/{auto-id}  → { date, type, dives: [{code, height, status}] }
        │   └── meets/{auto-id}      → { meet, date, event, height, place, score }
        └── gale/
            ├── practices/{auto-id}
            └── meets/{auto-id}
```

### localStorage Keys

```
dt-prefs-hayden    → { hidden: [...], extraPrint: [...], extraPlan: [...], compOverrides: [...], removedComp: [...] }
dt-prefs-gale      → (same structure)
```

---

## Event Rule Presets (Competition Dive List Builder)

| Key | Vols | Opts | Max Vol DD | Max Opt DD | Vol Groups | Vol List |
|-----|------|------|-----------|-----------|-----------|---------|
| E-1M | 3 | 2 | 5.4 | 2.2 | 3 | 101C, 201C, 301C, 401C |
| E-3M | 3 | 2 | 5.4 | 2.6 | 3 | 101C, 201C, 301C, 401C |
| C-1M | 5 | 3 | 9.0 | No limit | 5 | Any |
| C-3M | 5 | 3 | 9.5 | No limit | 5 | Any |
| Custom | User-defined | User-defined | User-defined | User-defined | User-defined | N/A |

Hayden only sees Group C rules. Gale only sees Group E rules.

---

## How to Deploy

### Quick Deploy (Drag and Drop)

1. Download `pike-dive-tracker-dist.zip` from Claude
2. Unzip to get a `dist/` folder
3. Go to https://app.netlify.com → Sites → pike-dive-tracker
4. Drag the `dist/` folder onto the deploy area
5. Wait 10-15 seconds — done

### After Deploying

Users on iOS need to hard-refresh the PWA: close the app from the app switcher (swipe up), then reopen from the home screen. The service worker will fetch the new version.

### Full Rebuild from Source

```bash
cd pike-dive-tracker
npm install
npm run build        # outputs to dist/
# Then drag dist/ to Netlify, or:
npx netlify-cli deploy --prod
```

---

## Common Modifications

### Adding a New Meet Result (DiveMeets)

If the meet is on DiveMeets.com, the in-app **🔄 Sync** button on the Compete tab should pull it automatically. If it doesn't (CORS issues), add manually via the "+ Add Manually" form in the app.

### Adding a DiveLive Meet Result

DiveLive results must be added to the source code. In App.jsx, find `const DIVELIVE_RESULTS = [` and add a new entry:

```javascript
{diverId:"hayden", meet:"Meet Name", date:"2026-07-15",
 event:"12-13 Boys 1M", height:"1M", round:"final",
 place:3, score:195.50, source:"divelive",
 dives:[
   {code:"101A", dd:1.4, net:15.5, award:21.70, role:"vol"},
   // ... each dive
 ]},
```

The `mergeDiveLive()` function automatically incorporates these into meetHistory and diveStats at load time.

### Updating Gale's Coach Dive List

Find `coachDiveList` in the DIVERS.gale section. Change status values:

- `"complete"` → diver can do this dive consistently in competition
- `"working"` → actively practicing, building consistency
- `"struggling"` → attempted but having difficulty
- `"learning"` → just starting to learn
- `"planned"` → not yet introduced

The app auto-promotes/demotes based on practice logs (3 consecutive practices → promote, 2 refusals → demote).

### Adding a New Dive to DD_TABLE

Find `const DD_TABLE = {` and add:

```javascript
"303C": { name: "Reverse 1½ Somersault Tuck", "1M": 2.1, "3M": 2.3 },
```

### Changing AAU Qualifying Scores

Find `const AAU_QUALIFYING` or the `qualifying` property inside each diver in DIVERS.

### Adding/Editing Season Meets

Find `const UPCOMING_MEETS = [` and modify the array.

### Changing Practice Days

Find `const PRACTICE_DAYS = {Sun:"Pool", Mon:"Pool", Tue:"Dryland/Trampoline", Thu:"Pool"}`.

---

## Key Features Inventory

| Feature | Tab | Description |
|---------|-----|-------------|
| Diver Switcher | Header | Tap name to switch between Hayden (blue) and Gale (green) |
| Score Trends | Home | Dual sparklines for 1M and 3M, showing score progression |
| Qualifying Progress | Home | Progress bars toward AAU qualifying thresholds |
| Personal Bests | Home | Top 3 highest competition scores with meet name/date |
| DD Lookup | Stats | Search bar to look up any dive's DD by code or name |
| Dive Detail Cards | Stats | Expandable cards with sparklines, avg/best gap, practice frequency |
| QR Scanner | Practice | Camera-based scanner reads printed practice sheet QR codes |
| Quick Add Buttons | Practice | Color-coded tap buttons for the diver's known dive list |
| Practice Status | Practice | Practiced (✓) / Refused (✗) / Not Attempted (—) per dive |
| Session Editor | Practice | Edit button on past sessions to fix status mistakes |
| Practice Plan | Plan | Auto-generated recommendations based on coach list + practice history |
| Auto-Promotion | Plan | Dive categories update based on practice patterns |
| Add Goal Dives | Plan | Manually add dive goals beyond the algorithm's suggestions |
| Hide Dives | Print | Eye toggle to exclude dives from the printed sheet |
| Add Dives | Print | Search to add extra dives to the printed sheet |
| QR Code | Print | Encodes the practice sheet dive list for scanning back in |
| Printed Sheet | Print | Safari-compatible printable HTML with P/R/N badges, tips, checkboxes |
| Dive List Builder | Compete | Greedy optimizer that builds the best competition dive list given event rules |
| Event Rule Presets | Compete | Dropdown with Group C and Group E rules + custom option |
| Upgrade Paths | Compete | "What if" scenarios showing how leveling up a dive affects qualifying |
| Practice-Ready Dives | Compete | Dives practiced 3+ times but never competed appear with estimated scores |
| DiveMeets Sync | Compete | Fetches diver's profile page and imports new results |
| Manual Entry | Compete | Form to add meet results not on DiveMeets |
| Firebase Sync | Global | Real-time sync of practice logs and meet results between devices |

---

## Firebase Security Rules

Current rules may be in test mode (expiring). Replace with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /divers/{diverId}/{document=**} {
      allow read, write: if diverId in ["hayden", "gale"];
    }
  }
}
```

Set at: https://console.firebase.google.com/project/pike-dive-tracker/firestore/rules

---

## Known Issues & Limitations

1. **DiveMeets sync uses a CORS proxy** (api.allorigins.win) which can be unreliable. Fallback is manual entry.
2. **DiveLive results require source code changes** — no in-app import for DiveLive PDFs.
3. **Dive stats from DiveMeets are per-dive totals** (high/avg/times), not per-meet breakdowns. DiveLive imports include individual dive scores.
4. **Service worker caching** can delay updates. Users may need to close/reopen the PWA after a deploy.
5. **Coach dive list statuses** (complete/working/struggling) are hardcoded in App.jsx. Auto-promotion from practice logs adjusts them at runtime but doesn't persist the promotion back to the source.
6. **Practice log seeds** in App.jsx can overwrite Firestore data if Firestore hasn't loaded yet on a fresh install. Once Firebase syncs, real data takes priority.

---

## Season Context (as of April 2026)

- **Hayden's 1M PB:** 182.10 (LIDC, Feb 21, 2026). Needs 210 to qualify. Gap: 27.9 points.
- **Hayden's 3M PB:** 136.80 (JDA Summer, May 2025). Needs 225 to qualify. Gap: 88.2 points.
- **Gale:** No minimum qualifying score for Group E (coach discretion). Competes 4-5 dives.
- **Next meets:** JDA Invite (May 2026, tentative), AAU National Championships (July 2026, Fort Lauderdale).
- **Key strategy for Hayden:** Higher DD dives needed. The upgrade paths feature shows exactly which progressions (e.g., 102C→103C, 5211A→5221D) would close the qualifying gap.
