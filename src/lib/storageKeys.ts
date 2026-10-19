// Every localStorage/sessionStorage key the app uses, in one dependency-free module
// (safe to import from Server Components such as the root layout).

export const STORAGE_KEYS = {
  /** localStorage — device preferences (see lib/prefs.ts). */
  prefs: "culinarylog:prefs:v1",
  /** localStorage — running/paused kitchen timers. */
  timers: "culinarylog:timers:v1",
  /** sessionStorage — parsed recipe handed from the importer to the editor. */
  importDraft: "culinarylog:import-draft:v1",
  /** localStorage — the Gemini relay connection: relay URL, inbox secret, sync status. */
  geminiRelay: "culinarylog:gemini-relay:v1",
  /** localStorage — ids of relay items already imported, so a lost acknowledgement never duplicates. */
  inboxProcessed: "culinarylog:inbox-processed:v1",
} as const;
