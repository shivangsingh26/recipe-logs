# CulinaryLog

A personal recipe vault and daily cook log that installs on your phone like an app. It works
offline, and your data never leaves the device unless you export it.

- **Recipe Vault**: search, filter by category and sort. Each recipe has prep/cook time,
  servings and per-serving macros, ingredients you can tick off while cooking, and steps where
  every time ("14 min", "5–6 minutes") is a tap-to-start timer. Notes & tips live on the recipe.
- **Cook Log**: a calendar and a timeline of what you cooked each day. "Log dish" takes a recipe
  from the vault or a custom name, a meal tag (breakfast/lunch/snack/dinner), your tweaks
  ("Air fried birista for 14 mins, extra pepper") and an optional plate photo from the camera.
  Each recipe page shows its own cook history, so you see last time's tweaks before you start.
- **Quick-Import**: paste a recipe as Markdown or plain text (ChatGPT/Claude answers with emoji
  headings, recipe-website text, your own notes). Title, times, servings, macros, ingredients
  (with sub-sections), steps and tips are filled in automatically. You can review before saving.
- **Starter recipes**: Kacchi Chicken Dum Biryani (5L Cooker & Air Fryer Method) and South
  Indian Black Pepper Chicken Roast (Dry Fry) are added the first time the app opens.
- **Backup & export**: one tap makes a `.zip` with a restorable JSON backup, every recipe as
  Markdown, a readable `cook-log.md` and your photos. JSON-only and Markdown-only exports too.

## Brainstorm in Gemini, save here

The app keeps everything on your phone and has no server, so Gemini can't write into it
directly. The bridge is the clipboard, and it takes two taps per recipe:

1. **Once:** in the app, Import → **Copy Gem instructions**. In Gemini, open Gems → New Gem
   (easiest at gemini.google.com), name it "CulinaryLog Chef" and paste the instructions. They
   tell Gemini to hand over finished recipes in the exact format the importer reads (times,
   servings, categories, per-serving macros table, ingredient/step sections, durations written
   so they become timers, tips).
2. Brainstorm in that Gem as usual. When the recipe is right, say **"save it"**: Gemini replies
   with just the recipe in a code block.
3. Tap the code block's copy icon (copying the whole reply works too), open CulinaryLog →
   Import → **Paste & save**. A complete recipe is saved straight away. An incomplete one opens
   in the preview so you can fix it first.

Saving a recipe with the same title again offers to **update** the existing one, so later
rounds of the same brainstorm update the recipe without losing its cook history. The same
instructions work in a ChatGPT custom GPT or a Claude project.

### Skip the trip back (iPhone Shortcut, optional)

With a small relay of your own, step 3 becomes "tap copy". An iPhone Shortcut sends the copied
recipe to the relay, and CulinaryLog collects it the next time it opens, comes back to the
foreground or gets its connection back.

1. **Once:**
   - Deploy the relay. It's a separate free Vercel project with Upstash Redis; see
     [relay/README.md](relay/README.md). That gives you a connection code.
   - In the app, open Settings → **Gemini**, paste the connection code and tap **Connect**.
   - Tap **Set up** and build the "Save to CulinaryLog" Shortcut (about five actions).
   - Run the Shortcut with **Back Tap** (double-tap the back of the phone). Or make it automatic:
     a Shortcuts automation for when Gemini is closed.
2. In Gemini, say "save it" and tap the copy icon. The Shortcut shows "Sent “Chana Masala” to
   CulinaryLog".
3. Next time you open CulinaryLog, it says **Saved from Gemini**, with **Undo**. If the title is
   already in your vault, it updates that recipe instead and says **Updated from Gemini**. The
   cook history stays, and Undo puts the previous version back.

Paste & save keeps working with or without the relay, and offline. "Save it" with no tap at all
would need Gemini's custom MCP apps. Those are US-only for now; the options are compared in
[docs/automation-options.md](docs/automation-options.md).

## Run it locally

Requires Node.js 22+.

```bash
npm install
npm run dev        # http://localhost:3000 (hot reload; no service worker)
npm test           # unit tests: parser, timers, backup/restore, search, editor, log, inbox
npm run build      # static export to out/ + generates the offline service worker
npm run preview    # serves out/ at http://localhost:4173 (offline mode works here)
```

`npm run preview` also prints a Wi-Fi address (e.g. `http://192.168.1.6:4173`) you can open on
your phone for a quick look. Over plain `http` on Wi-Fi the app works but can't go offline or be
installed; for that it needs HTTPS, so deploy it (below).

## Install it on your phone

`out/` is a plain static site, so any static host works. Pick one:

**GitHub Pages (workflow included).** Push this folder to a GitHub repo, then in the repo go to
Settings → Pages → Source: **GitHub Actions**. Every push to `main` runs the tests, builds and
publishes to `https://<you>.github.io/<repo>/`. The workflow sets the base path from the repo
name.

**Vercel.** From this folder run `npx vercel deploy --prod` and open the URL it prints.

**Netlify Drop (no account setup).** Run `npm run build`, then drag the `out` folder onto
<https://app.netlify.com/drop>.

Then, on the phone:

- **iPhone**: open the URL in **Safari**, tap Share → **Add to Home Screen**. Launch it from the
  home screen icon once while online; after that it works offline.
- **Android**: open the URL in Chrome and tap **Install app** (or ⋮ → Add to Home screen).
  Long-press the icon for shortcuts: Log a dish, New recipe, Import recipe. Sharing text from
  another app to CulinaryLog opens it in Import.

New versions show an "Update available" prompt in the app; tap Reload.

## Your data

Everything is stored in the browser's IndexedDB on the device. There is no account, and no
server unless you set up the optional Gemini relay.

- **Gemini relay (optional):** recipes you send from Gemini with the Shortcut pass through your
  relay (your Vercel project and Upstash Redis). They are deleted as soon as the app collects
  them, or after 7 days if it never does. Nothing on the device is ever uploaded. To stop, use
  Settings → Gemini → **Disconnect**.

- **Back up regularly** (Settings → Back up now). On iPhone the share sheet lets you save the
  `.zip` to Files, iCloud Drive or Google Drive. Settings shows when you last backed up.
- **Restore** a `.zip` or `.json` on any device: *Merge* keeps whichever copy of a recipe or log
  entry is newer and never duplicates; *Replace* wipes the device first.
- On iPhone a home-screen app has its own storage, separate from Safari. **Deleting the
  home-screen icon deletes its data**, so back up first. Settings → "Protect from clean-up" asks
  the browser not to evict the data when storage runs low.
- Deleting a recipe keeps its cook-log entries (they keep the dish name).

## Timers on a phone

Tap any time in a step to start a timer. Running timers stay docked above the tab bar on every
screen, survive reloads, and the screen stays awake while they run (Settings → Keep screen awake).
A recipe page also has its own "Keep screen on" switch for cooking without timers.

A web app is paused when it's in the background, especially on iPhone. If you leave the app,
a timer that ended meanwhile shows up as done when you come back ("Timer finished 2 min ago"); it
only rings if it ended within the last minute. To get a system notification
while away, enable **Timer alerts** in Settings. On iPhone this only works once the app is
installed to the home screen.

## How it works

| Concern | Where |
| --- | --- |
| Data model | `src/lib/types.ts` |
| IndexedDB schema, seeding, queries, mutations | `src/lib/db/` (Dexie) |
| Starter recipes | `src/lib/seeds.ts` |
| Recipe text parser (Markdown / plain text) | `src/lib/parser/` |
| Duration detection for timers | `src/lib/parser/durations.ts` |
| Canonical recipe Markdown (round-trips through the parser) | `src/lib/markdown/recipeMarkdown.ts` |
| Timer store, alarm sound, notifications | `src/lib/timers/`, `src/components/timers/` |
| Vault search / sort, editor row logic | `src/lib/recipes/` |
| Calendar / timeline grouping and stats | `src/lib/log/` |
| Photo compression (≤1600 px JPEG + thumbnail) | `src/lib/image.ts` |
| Backup format, zip/JSON/Markdown export, restore | `src/lib/backup/` |
| Gemini relay connection, inbox sync, undo | `src/lib/inbox/`, `src/components/inbox/`, `relay/` |
| Screens | `src/app/*/page.tsx` → `src/components/{recipes,log,import,settings}/` |
| UI kit and design tokens (light/dark) | `src/components/ui/`, `src/app/globals.css` |
| Offline service worker (generated after `next build`) | `scripts/generate-sw.mjs`, `scripts/sw-template.js` |
| Static preview server | `scripts/serve.mjs` |
| Icons (`npm run icons` re-renders the PNGs from `public/icons/icon.svg`) | `scripts/generate-icons.mjs` |

More detail on conventions: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Deploying under a sub-path other than GitHub Pages: build with
`NEXT_PUBLIC_BASE_PATH=/your-path npm run build`.
