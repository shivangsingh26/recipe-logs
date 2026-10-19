# CulinaryLog — architecture

A local-first, installable PWA. The app has no server: Next.js builds a fully static site
(`output: "export"` → `out/`), every screen is a client component, and all data lives in
the browser's IndexedDB on the device. Backups are explicit exports. The one optional add-on is
the Gemini relay (`relay/`, see below), which only carries incoming recipes.

## Stack

| Concern | Choice | Notes |
| --- | --- | --- |
| Framework | Next.js 16 App Router, static export | `trailingSlash: true`; optional `NEXT_PUBLIC_BASE_PATH` for sub-path hosting |
| UI | React 19, Tailwind CSS v4 | CSS-first config in `src/app/globals.css`; lucide-react icons |
| Data | Dexie 4 over IndexedDB | `src/lib/db/*`; reactive reads via `useLiveQuery` |
| Zip | fflate | backup archives |
| Tests | Vitest (+ fake-indexeddb) | `src/**/*.test.ts` |

> This Next.js version differs from older docs. The bundled docs in
> `node_modules/next/dist/docs/` are the source of truth (see `AGENTS.md`).

## Routes

Static export cannot pre-build one page per recipe id, so ids travel in the query string.
Components that read `useSearchParams()` must sit inside a `<Suspense>` boundary.

| URL | Screen |
| --- | --- |
| `/` | Recipe vault: search, category filters, sort |
| `/recipe/?id=<id>` | Recipe detail: checkable ingredients, steps with inline timers, notes, cook history |
| `/recipe/edit/` · `?id=<id>` · `?from=import` | New recipe · edit · review an imported draft |
| `/log/` (`?new=1` opens the log sheet) | Cook log: calendar + timeline, "Log dish" |
| `/import/` (`?text=` `?title=` `?url=` prefill) | Paste/parse a recipe |
| `/settings/` | Backup/export/restore, preferences, storage, install help |

## Data model (`src/lib/types.ts`)

- **Recipe** — title, description, `categories[]`, prep/cook minutes, servings,
  per-serving `macros` (`null` = unknown), `ingredients[]` / `steps[]` (`{ id, text, group? }`),
  notes, source, favorite, optional `seedKey` (starter recipes), timestamps.
- **CookLog** — local date key `YYYY-MM-DD`, `mealType`, `recipeId | null`, `dishName`
  (snapshot, always set), notes/tweaks, `photoId | null`.
- **Photo** — compressed JPEG `data` (≤1600 px) + `thumb` (≤480 px) as ArrayBuffers, owned by one log.
- **CookState** — per-recipe ticked ingredients / finished steps (survives reloads).

Dates are local calendar keys, never UTC timestamps, so a dish cooked at 23:30 stays on
that day. Use `src/lib/dates.ts` for all date maths.

## Data layer (`src/lib/db`, import from `@/lib/db`)

Reads (reactive; `undefined` = loading, `null` = not found):
`useRecipes()`, `useRecipe(id)`, `useAllLogs()`, `useLogsInRange(start, end)`,
`useLogsForRecipe(id)`, `useLog(id)`, `useRecipeStats()` (count / last date / cover photo per recipe),
`useCategories()` (vocabulary), `useUsedCategories()`, `usePhotoUrl(photoId, "thumb" | "full")`,
`useCookState(recipeId)`.

Writes: `createRecipe(draft)`, `updateRecipe(id, draft)`, `setFavorite`, `duplicateRecipe`,
`deleteRecipe(id)` → snapshot for `undoDeleteRecipe`, `restoreStarterRecipes()`,
`createLog(input, photo?)`, `updateLog(id, input, photo?)` (`undefined` keeps, `null` removes),
`deleteLog(id)` → snapshot for `undoDeleteLog`, `toggleIngredientChecked`, `toggleStepDone`,
`resetCookState`.

Sanitisers (`normalizeRecipeDraft`, `normalizeLogInput`, `draftFromRecipe`, `emptyRecipeDraft`)
accept untrusted shapes (parsed text, backup files) and always return valid records.

The database seeds the two starter recipes in Dexie's `populate` hook, i.e. exactly once per
device. Deleting a recipe keeps its log entries (dish name preserved) but unlinks them.

## Other shared modules (`src/lib`)

| Module | Purpose |
| --- | --- |
| `prefs.ts` | `usePrefs()` / `setPrefs()` — theme, timer sound/vibrate, keep-awake, week start, last backup (localStorage) |
| `theme.ts` | theme resolution + no-flash init script |
| `categories.ts` | default categories, dedupe/canonicalise, heuristic suggestions |
| `format.ts` | `formatMinutes`, `formatClock`, `formatDurationLabel`, `slugify`, … |
| `dates.ts` | date keys, month grids, "Today/Yesterday" labels, default meal for the time |
| `drafts.ts` | importer → editor hand-off (`stashDraft` / `peekDraft` / `clearDraft`) |
| `wakeLock.ts` | `useWakeLock(active)` keeps the screen on while cooking |
| `navigation.ts` | `useBack(fallbackHref)` — history back, or a parent route when launched cold |
| `basePath.ts` | `withBasePath()` for raw asset URLs (service worker, manifest) |
| `storageKeys.ts` | every localStorage/sessionStorage key |
| `inbox/` | Gemini relay: `connection` (relay URL + inbox secret in localStorage), `client` (HTTP, untrusted-input checks), `sync` (import, title-match update, undo), `runner` (when to sync), `status` (copy) |

## Gemini relay (optional)

An iPhone Shortcut posts a recipe copied in Gemini to the relay, a separate tiny Vercel project
in `relay/` with its own `package.json`, tests and README. It is excluded from the app's
tsconfig, ESLint and Vitest. The app collects recipes from the relay.

1. **Pairing.** Settings → Gemini takes the relay's connection code (`https://relay/#pair=CODE`).
   The app generates a 256-bit inbox secret and calls `POST /api/pair`. The relay stores only
   the secret's SHA-256. The Shortcut sends the same secret as `Authorization: Bearer`.
2. **Sync.** `<InboxSync>` (in `AppProviders`) runs `inboxRunner.run()` on app start,
   `visibilitychange` → visible, and `online`. One run at a time, shared across tabs by Web Locks,
   at most every 15 s unless forced.
3. **Import.** Each item goes through `parseRecipeText` → `createRecipe`, or `updateRecipe` when
   `findRecipeByTitle` matches. Untitled recipes never match, and the vault's spelling of the
   title is kept. A toast with Undo follows: undo deletes a created recipe, or restores the
   `snapshotRecipe` taken before an update. Text that parses to nothing gets an "Open" action
   into Import.
4. **Acknowledge.** Imported ids are acknowledged (`POST /api/inbox/ack`) and the relay deletes
   them. Ids are also remembered locally (`inboxProcessed`), so a lost acknowledgement never
   imports twice.

Offline, the run is skipped and the recipes wait on the relay (7-day TTL). Paste & save doesn't
depend on any of this.

## UI kit (`src/components/ui`)

`Button` / `ButtonLink` / `buttonClasses`, `IconButton` (requires `label`), `Card` (+ `cardInteractive`),
`SectionLabel`, `Chip` (toggle), `Badge`, `MealBadge` / `MealDot` / `MEAL_STYLES`, `Field`,
`TextInput`, `TextArea` (auto-grow), `NumberInput` (decimal keypad, `number | null`),
`Switch`, `SegmentedControl`, `Sheet` (native `<dialog>` bottom sheet), `useToast()`,
`useConfirm()`, `PageHeader` (sticky, safe-area aware), `Fab`, `EmptyState`, `Skeleton`, `Spinner`.

### Design tokens

Colours are CSS variables that switch with the theme, exposed as Tailwind colours:
`canvas` (page), `surface`, `surface-2`, `surface-3`, `line`, `line-strong`, `ink` (text),
`muted` (secondary text), `subtle` (placeholders/decoration only), `accent`, `accent-hover`,
`on-accent`, `accent-soft`, `on-accent-soft`, `danger(-soft)`, `success(-soft)`, `warning(-soft)`,
`meal-{breakfast,lunch,snack,dinner}`, `macro-{kcal,protein,carbs,fat}`; shadows `shadow-card`,
`shadow-float`; fonts `font-sans` (system UI), `font-serif` (New York on iOS — recipe titles and
large headings). Prefer tokens over raw colours and over `dark:` variants.

Layout helpers: `pb-nav` (page bottom padding clearing the tab bar, timer dock and home
indicator), `bottom-above-nav` (floating elements), `pt-safe` / `pb-safe`, `scrollbar-none`.
`--nav-h` and `--dock-h` CSS variables describe the tab bar and the timer dock heights.

### Mobile conventions

- Design at 390×844 first; the content column caps at `max-w-2xl` on larger screens.
- Touch targets ≥ 44 px; inputs use 16 px text (no iOS focus zoom).
- Full-screen forms hide the tab bar (`/recipe/edit/`) and use a sticky bottom action bar.
- Destructive actions confirm (`useConfirm`) or offer Undo via a toast.
