# Dive Tracker — Data Flow & Algorithms

## How Data Flows Through the App

```
                    ┌─────────────────┐
                    │   DATA SOURCES  │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   DiveMeets.com      DiveLive PDFs         Practice Logs
   (Sync button)    (hardcoded in JS)     (Firebase/local)
        │                    │                    │
        ▼                    ▼                    ▼
   meetHistory[]      DIVELIVE_RESULTS     practiceLog[]
        │              (merged at load)          │
        │                    │                   │
        └────────┬───────────┘                   │
                 │                               │
                 ▼                               │
           diveStats[]                           │
           (high/avg/times per dive)             │
                 │                               │
        ┌────────┼───────────────────────────────┤
        │        │                               │
        ▼        ▼                               ▼
   Dashboard  Competition              buildPracticePlan()
   (PBs,      Dive List                      │
    trends,    Builder                 ┌─────┼─────┐
    qualify)      │                    │           │
                  │               Plan Tab    Print Tab
                  │              (tips,       (sheet,
                  │               goals)       QR code)
                  │
            Upgrade Paths
           (what-if analysis)
```

## Practice → Recommendations Pipeline

```
Practice Session Logged
        │
        ▼
practiceLog[] updated (Firebase + local state)
        │
        ▼
practiceFrequency computed (last 5 sessions)
        │
        ├──▶ Stats tab: "3× practiced / 1× refused"
        │
        ▼
practicePatterns computed (streak, lastStatus, etc.)
        │
        ├──▶ buildPracticePlan() uses patterns for:
        │       • Tips: "Practiced last session — keep building!"
        │       • Auto-promotion: struggling → working (3 consecutive practices)
        │       • Auto-demotion: complete → working (refused in last session)
        │
        ├──▶ Print tab: last-week P/R/N badges on each dive
        │
        └──▶ Competition Builder: practice-ready dives (3+ practices, 0 competitions)
                appear with estimated scores based on avg execution × DD
```

## Competition Builder Algorithm

### Step 1: Gather Available Dives
- Start with `diveStats` (competed dives on selected height)
- Remove any in `removedCompDives` set
- Add practice-ready dives (3+ practices, never competed) with estimated scores
- Add manually added dives from `compDiveOverrides`

### Step 2: Calculate Execution Rate
```
avgExec = average(each dive's avgScore ÷ its DD)
bestExec = max(each dive's avgScore ÷ its DD)
```
For practice-ready/manual dives: `estimatedScore = avgExec × dive DD`

### Step 3: Select Voluntaries (Greedy)
- If `volList` restricted (Group E): only pick from allowed codes
- Pass 1: one vol per required group, respecting DD cap
- Pass 2: fill remaining vol slots

### Step 4: Select Optionals (Greedy)
- From remaining (non-vol) dives
- Respect `maxOptDD` cap per individual dive
- Pass 1: one opt per required group
- Pass 2: fill remaining opt slots

### Step 5: Calculate Projections
```
projectedTotal = sum(all selected dives' avgScore)
bestCaseTotal = sum(all selected dives' highScore)
```

### Step 6: Generate Upgrade Paths
For each dive in the current list, check natural progressions:
```
101A/101C → 102C → 103C → 104C
201A/201C → 202C → 203C
301C → 302C → 303C
401C → 402C → 403C
5121B → 5131D → 5132D
5211A → 5221D → 5231D
```
For each possible swap, calculate:
```
estAvgNew = avgExec × newDD
projGain = estAvgNew - currentAvg
newProjected = projectedTotal + projGain
```
Flag if `newBest >= qualifyingScore` and current `bestCase < qualifyingScore` → "🎯 This upgrade could unlock qualifying!"

## Practice Plan Algorithm (buildPracticePlan)

### Gale's Path (coachDiveList present)

1. Look up recent practice status per dive (newest session first)
2. For each dive in coach list, determine category:
   - `complete` → MAINTAIN (priority 3)
   - `struggling` → IMPROVE (priority 1)
   - `working` → DEVELOP (priority 2)
   - `learning` → DEVELOP (priority 2)
   - `planned` → NEXT UP (priority 3)
3. Apply auto-promotion from practice patterns:
   - 3 consecutive "practiced" → promote one level
   - 2+ "refused" in last 5 → demote one level
   - 2+ "practiced" with 0 refused → promote learning → working
4. Generate contextual tip based on most recent session status
5. Sort by priority (IMPROVE first, then DEVELOP, then MAINTAIN/NEXT)

### Hayden's Path (no coachDiveList)

1. For each competed dive in diveStats:
   - Calculate consistency = (high - avg) / high
   - If low consistency + high times + low DD → skip (mastered)
   - If < 3 times → DEVELOP
   - If >= 3 times + high inconsistency → IMPROVE
   - If >= 5 times + low inconsistency → MAINTAIN
2. Boost priority for higher DD dives (DD ≥ 2.0)
3. Apply same practice-based adjustments as Gale's path
4. Add progression dives (next step from competed dives)
5. Sort by priority, cap at reasonable per-height count

## Print Sheet Generation

1. Run `buildPracticePlan()` to get recommended dives
2. Filter out dives in `hiddenPrintDives` set
3. Add dives from `extraPrintDives` array
4. Generate QR code encoding: `PDT|diverId|date|dive1:height1:reps,...`
5. Build HTML string with:
   - Header: diver name, age group, practice date, dive count
   - Per dive: code, name, DD badge, last-week P/R/N badge, tip text, category badge, P/R/N checkboxes
   - Footer: legend
6. Open in new Safari tab via Blob URL (iOS-compatible)
7. User taps Share → Print

## QR Scan → Practice Log Flow

1. User opens camera via "📷 Scan" button
2. jsQR library reads QR code from video frames
3. Parsed format: `PDT|diverId|date|101A:1M:3,201A:1M:3,...`
4. Each dive starts as "not_attempted" status
5. Dives sorted by height (1M section, then 3M section)
6. User changes each to Practiced/Refused as appropriate
7. "Save Practice Session" writes to Firebase + local state
8. Next time Print tab is opened, tips update based on this new session
