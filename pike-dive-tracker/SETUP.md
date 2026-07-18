# Pike Dive Tracker — Setup Guide

## What's in this zip

```
pike-dive-tracker/
├── index.html              ← App entry point
├── netlify.toml            ← Netlify build config (auto-detected)
├── package.json            ← Dependencies (React, Firebase, Vite)
├── vite.config.js          ← Build config + PWA plugin
├── SETUP.md                ← This file
├── public/
│   ├── favicon.svg         ← Browser tab icon
│   ├── apple-touch-icon.png← iPhone home screen icon
│   ├── pwa-192.png         ← PWA icon
│   └── pwa-512.png         ← PWA icon (large)
└── src/
    ├── main.jsx            ← React entry
    ├── App.jsx             ← The main app (all your dive data)
    └── firebase.js         ← Firebase config + helper functions
```

---

## STEP 1: Set up Firebase (so you and Stephanie share data)

### 1a. Create a Firebase project

1. Go to **https://console.firebase.google.com**
2. Click **"Add project"**
3. Name it something like `pike-dive-tracker`
4. Disable Google Analytics (you don't need it) → **Create project**
5. Wait for it to finish, then click **Continue**

### 1b. Create a Firestore database

1. In the left sidebar, click **"Build" → "Firestore Database"**
2. Click **"Create database"**
3. Choose **"Start in test mode"** (we'll secure it later)
4. Select a location — pick **`us-east1` (South Carolina)** since you're in NJ
5. Click **Enable**

### 1c. Get your Firebase config keys

1. In the left sidebar, click the **gear icon ⚙️ → "Project settings"**
2. Scroll down to **"Your apps"** → click the **Web icon `</>`**
3. Register app — nickname: `pike-dive-tracker` → click **Register app**
4. You'll see a code block with `firebaseConfig`. Copy these values:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "pike-dive-tracker-xxxxx.firebaseapp.com",
  projectId: "pike-dive-tracker-xxxxx",
  storageBucket: "pike-dive-tracker-xxxxx.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

### 1d. Paste your keys into the app

1. Open `src/firebase.js` in any text editor (VS Code, TextEdit, etc.)
2. Find the block near the top that says `YOUR_API_KEY`, `YOUR_PROJECT`, etc.
3. Replace each placeholder with your real values from step 1c
4. Save the file

### 1e. (Later) Secure your database

The "test mode" rules expire after 30 days. Before then, go to:
**Firestore → Rules** and replace with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /divers/{diverId}/{document=**} {
      allow read, write: if true;
    }
  }
}
```

For tighter security later, you can add Firebase Authentication so only
you and Stephanie can write. But the above is fine to start.

---

## STEP 2: Deploy to Netlify

You already have a Netlify account with another app, so this should feel familiar.

### Option A: Drag-and-drop (quickest)

> **Note:** This requires building locally first. If you don't have Node.js
> on your computer, use Option B instead.

1. Open Terminal and `cd` into the unzipped `pike-dive-tracker` folder
2. Run:
   ```bash
   npm install
   npm run build
   ```
3. This creates a `dist/` folder
4. Go to **https://app.netlify.com** → click **"Add new site" → "Deploy manually"**
5. Drag the entire `dist/` folder onto the upload area
6. Done! Netlify gives you a URL like `https://random-name-12345.netlify.app`

### Option B: Connect to GitHub (recommended — auto-deploys on changes)

1. Create a new GitHub repository:
   - Go to **https://github.com/new**
   - Name: `pike-dive-tracker` → Private → **Create repository**

2. Push your code (in Terminal):
   ```bash
   cd pike-dive-tracker
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/pike-dive-tracker.git
   git push -u origin main
   ```

3. Connect to Netlify:
   - Go to **https://app.netlify.com**
   - Click **"Add new site" → "Import an existing project"**
   - Choose **GitHub** → authorize if needed
   - Select your `pike-dive-tracker` repository
   - Netlify auto-detects the settings from `netlify.toml`:
     - Build command: `npm install && npm run build`
     - Publish directory: `dist`
   - Click **"Deploy site"**

4. Wait 1-2 minutes for the build to complete
5. Your site is live! Click the URL Netlify gives you.

### Rename your Netlify URL (optional)

1. Go to **Site settings → Domain management → Custom domains**
2. Click **"Options" → "Edit site name"**
3. Change to something like `pike-dive-tracker` → Save
4. Your URL becomes: `https://pike-dive-tracker.netlify.app`

---

## STEP 3: Install on iPhone (PWA)

1. Open Safari on your iPhone
2. Go to your Netlify URL (e.g., `https://pike-dive-tracker.netlify.app`)
3. Tap the **Share button** (box with up-arrow) at the bottom
4. Scroll down and tap **"Add to Home Screen"**
5. Name it "DiveTracker" (or whatever you like) → tap **Add**
6. The app icon appears on your home screen and opens full-screen like a native app

**Do the same on Stephanie's iPhone** — since you're both hitting the same
Firebase Firestore database, any practice session either of you logs will
appear for both of you in real time.

---

## STEP 4: Verify Firebase sync works

1. Open the app on your phone
2. Look at the header — top-right corner shows a status dot:
   - 🟢 **Green "Synced"** = Firebase is connected and working
   - 🟡 **Yellow "Syncing..."** = Connecting to Firebase
   - ⚪ **Gray "Local only"** = Firebase keys not configured yet
3. Log a practice session on your phone
4. Open the app on Stephanie's phone — the session should appear within seconds

---

## Troubleshooting

**"Local only" even after adding Firebase keys?**
- Double check there are no typos in `src/firebase.js`
- Make sure you saved the file and redeployed (if using drag-and-drop)
  or pushed to GitHub (if using Option B)

**Build fails on Netlify?**
- Check the deploy log in Netlify dashboard for the specific error
- Most common: a typo in `firebase.js` or missing closing quote

**App doesn't install as PWA on iPhone?**
- Must use Safari (not Chrome) on iOS
- The site must be served over HTTPS (Netlify does this automatically)

**Practice sessions not syncing between phones?**
- Both phones must be online
- Check Firestore rules haven't expired (30-day test mode)
- Go to Firebase Console → Firestore → look for documents under `divers/`

---

## Updating the app later

If you make changes to the code:

- **GitHub method:** Push changes → Netlify auto-redeploys in ~1 min
- **Drag-and-drop:** Run `npm run build` again, re-upload `dist/` to Netlify

To update from Claude: I can edit App.jsx and you re-upload the zip.

---

## Data structure in Firestore

```
divers/
  hayden/
    practices/
      {auto-id}/
        date: "2026-03-12"
        type: "Pool"
        dives: [{code:"101A", height:"1M", reps:5, quality:4}, ...]
        createdAt: Timestamp
    meets/
      {auto-id}/
        meet: "CMD 2026 Spring Invitational"
        date: "2026-04-11"
        event: "Group C Boys 1m (12-13)"
        height: "1M"
        place: 3
        score: 195.50
        createdAt: Timestamp
  gale/
    practices/
      ...
    meets/
      ...
```
