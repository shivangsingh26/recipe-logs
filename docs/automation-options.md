# Gemini → CulinaryLog: automation options

Researched 19 Oct 2026 for an iPhone user in India. These features change month to month; sources
are listed at the end.

## Decision (19 Oct 2026)

- **Plan:** Google AI Pro. That doesn't change anything: custom MCP apps are limited to the US
  whatever the plan.
- **Built:** option 2. The relay (`relay/`) and the iPhone Shortcut are designed so MCP can be
  added later (option 5).
- **Hosting:** Vercel + Upstash Redis, free tiers. The app stays a static export.
- **Same title:** the existing recipe is updated automatically (cook history kept), with an
  "Updated from Gemini" toast and Undo.
- **Status:**
  - Implemented and tested locally: unit tests, plus a local relay and the app at 390×844.
  - Not yet deployed or tried on a real iPhone.

## Summary

- Only **Gemini custom apps (remote MCP servers)** let "save it" in the Gemini app write
  somewhere by itself. Google's help page limits them to users who are **18+ and in the US**, on
  a personal account, in English, with Keep Activity on. **They are not available in India today,
  whatever the plan.**
- The Gemini iOS app has no Shortcuts action that hands a reply to another app (its actions only
  open Gemini), and iOS has no share target for web apps. On an iPhone today, the closest thing to
  automatic is: tap **Copy** in Gemini, then an **iOS Shortcut** sends the recipe to a small
  **relay inbox**, and CulinaryLog picks it up the next time it opens.
- **Recommendation:** build the relay and the Shortcut now (option 2). Shape the relay so a
  `save_recipe` MCP endpoint can be added to it when custom apps reach India (option 5). Keep
  Paste & save as the fallback.

## Baseline (today)

The Gem replies with the recipe in a code block, then: Copy → switch to CulinaryLog → Import →
**Paste & save** → iOS "Paste" bubble. That is about 4 taps plus an app switch. It works offline,
and nothing leaves the phone except what Gemini already has.

## Comparison

| | 1. Gemini MCP app | 2. Shortcut → relay | 3. Google Workspace bridge | 4. In-app AI | 5. Hybrid (2 now, 1 later) |
| --- | --- | --- | --- | --- | --- |
| Works in India today | **No** (US only) | **Yes** | Partly, fragile | Yes | Yes (the option 2 part) |
| Taps after "save it" | 1 (confirm the write) | 1 (Copy), then Back Tap or nothing | 2 (Share & export → Export to Docs), plus Google sign-ins | 0–1, inside CulinaryLog | 1 |
| You stay in the Gemini app | Yes | Yes | Yes | **No** | Yes |
| Privacy | Recipe goes to your relay; Google warns Gemini may also share chat context with the app | Recipe goes to your relay and is deleted once delivered | Stays in your Google account | Chat goes from the phone straight to Google's API | As 2, then 1 |
| Cost | Free tiers | Free tiers (Vercel Hobby, Upstash free) | Free | Free tier, rate-limited | Free tiers |
| Security | An OAuth server you must get right | One random secret, kept in the app and the Shortcut | Google OAuth with a restricted Drive scope | API key stored on the phone | As 2, then 1 |
| Effort | High (OAuth) | Medium | High, and brittle | Medium–high | Medium now |
| Offline | Gemini needs a network anyway; the app imports later | The Shortcut fails, so use Paste & save; queued recipes arrive when the app is next online | Imports when online | Chat unavailable; the rest works | As 2 |

## 1. Gemini custom MCP app

- **Availability.** Custom apps started rolling out on 29 Jun 2026. Google's requirements: "Be 18
  or over and in the US", a personal Google account, English only, and Keep Activity on. No plan
  tier is listed. The 13 Oct 2026 release notes say most connected apps are still US English, with
  only *select partner* apps in India. Custom apps are not among them.
- **Setup.** Custom apps can only be added on the web (gemini.google.com → Settings → Connected
  Apps → paste the MCP server URL). After that they work in the mobile apps too, and typing `@`
  picks one.
- **Server requirements.** The server must "follow the standard MCP specifications". Auth is OAuth,
  either through Dynamic Client Registration or with a client ID and secret entered under
  "Advanced features". Google doesn't name a transport. Streamable HTTP is the current MCP
  standard, and Gemini Enterprise rejects the older SSE transport.
- **On the phone.** "Gemini requires manual confirmation for any write actions", so "save it"
  becomes one confirmation tap. Google's page doesn't say whether Gems (which are becoming
  "skills", per the 30 Sep 2026 notes) can call custom apps.
- **Build.** A Vercel Function using `mcp-handler` 2.3.0 / `@modelcontextprotocol/sdk` 1.32.1,
  with a `save_recipe({ markdown })` tool (`list_recipes` / `get_recipe` would need the phone to
  sync recipes up to the relay, so leave them out). Most of the work is a minimal OAuth
  authorization server: Dynamic Client Registration, PKCE, and a consent page that asks for your
  CulinaryLog connection code. It can be tested locally with an MCP client, but not with the
  real Gemini app from India.

## 2. iOS Shortcut → relay inbox

- **Why a Shortcut.** Gemini's iOS Shortcuts actions only open the app (type, dictate, Live, share
  an image). None of them returns a reply. So the Shortcut takes the recipe from the clipboard,
  or from the share sheet if you select text and tap Share.
- **Flow.** Say "save it", then tap **Copy** on the code block. Then any one of these runs the
  Shortcut:
  - **Back Tap**: double-tap the back of the phone (Settings → Accessibility → Touch → Back Tap).
  - The **Action button** or a **Control Center** control.
  - A personal automation, **"When Gemini is closed" → Run Immediately** (iOS 17+). This makes it
    fully automatic after the Copy.

  The Shortcut checks that the clipboard looks like a recipe (it has an Ingredients heading),
  POSTs it to the relay with your secret, and shows a "Saved Chana Masala" notification.
  CulinaryLog pulls the inbox when it opens or comes to the foreground, saves the recipe through
  the existing parser and title-match logic, and acknowledges it. The relay then deletes it.
- **Caveats.**
  - iOS may ask "Allow Paste" the first time. If it keeps asking, Settings → Apps → Shortcuts →
    Paste from Other Apps → Allow should stop it. Verify this on the device.
  - You build the Shortcut once (about 5 actions; the app shows the steps and the values to
    paste), or install a signed `.shortcut` that asks for the secret on import, if signing it on
    this Mac works.
- **Cost.** Vercel Hobby (free, for personal non-commercial use) plus Upstash Redis free (256 MB,
  500K commands a month). Expected use is well under 10K commands a month.

## 3. Google Workspace bridge (Docs / Keep / Tasks)

- **Writing side.** Gemini on the iPhone can "Share & export → Export to Docs". Its Keep and Tasks
  apps write notes and tasks, but Gemini writes those items itself, so a full recipe may not
  survive word for word (unverified).
- **Reading side.** This is where it breaks.
  - The **Keep API is Workspace-only**, with no access for personal accounts.
  - Docs exported from Gemini land in Drive, and reading them needs the restricted
    `drive.readonly` scope, or a file picker per recipe (not automatic).
  - OAuth inside an iPhone home-screen app is unreliable. Google sign-in popups lose
    `window.opener` in iOS web views, and redirects can drop you into Safari, whose storage is
    separate from the app's.
  - Without a server, tokens last about an hour, so you'd sign in again often.
- **Verdict.** It's private, but brittle, and has the most taps. Not recommended.

## 4. In-app AI (Gemini API, your own key)

- **Availability.** The Gemini API and AI Studio list India as a supported region. The free tier
  is rate-limited, and its limits change. On the free tier, Google may use your prompts to improve
  its products.
- **How it works.** CulinaryLog gets a chat screen that calls the API straight from the phone
  (`@google/genai` 2.30.0 works in browsers), with the key stored on the device. Saving needs no
  copying: the model returns structured output that maps to `RecipeDraft`.
- **What you lose.** The Gemini app itself: its history, Gems/skills, Live voice and personal
  context. You'd brainstorm in CulinaryLog instead. That misses the goal of saying "save it" in
  Gemini.

## 5. Hybrid

The relay has two front doors into one inbox: the Shortcut's `POST /api/inbox` now, and an MCP
`/mcp` endpoint later. Both use the same app sync, the same validation and the same secret, with
the OAuth consent page accepting the app's connection code. When custom apps reach India (or if
your account becomes eligible), adding `/mcp` turns "save it" into a single confirmation tap.

## Also considered

- **Opening a link into the app.** Links from Gemini open in Safari, whose storage is separate from
  the home-screen app's, so a URL hand-off never reaches your data.
- **ntfy.sh or a similar public pub/sub service as the relay.** It needs no deploy, but it's a
  third-party server, the topic name is the only secret, messages are small and only kept briefly,
  and there's no delete-on-delivery. Rejected.
- **Web Push carrying the recipe.** It needs a server anyway, only works for home-screen apps on
  iOS 16.4+, and the payload is about 4 KB. The Shortcut already shows a "saved" notification, so
  push adds little. Skip it for now.

## Recommendation and proposed design

Build option 2 now, structured as option 5.

- **Hosting.** A separate tiny Vercel project in `relay/`: plain Vercel Functions with Web
  `Request`/`Response` handlers, no Next.js, and Upstash Redis through the Vercel Marketplace
  (`@upstash/redis` 1.39.0, TTLs built in). The app stays a pure static export on GitHub Pages,
  using the workflow already in `.github/workflows/deploy.yml`.
  - Putting functions inside the app's own Vercel project would mean leaving the Next.js
    preset. That mixed setup is unverified, so it isn't proposed.
  - Cloudflare Workers + KV is an equally free alternative.
- **Endpoints.**
  - `POST /api/pair` registers the app's inbox. It needs a one-time pairing code from the
    deployment, so strangers can't create inboxes.
  - `POST /api/inbox` is where the Shortcut sends recipes.
  - `GET /api/inbox` is where the app pulls them.
  - `POST /api/inbox/ack` tells the relay a recipe was saved, so the relay deletes it.
  - `/mcp` comes later.
- **Auth.** The app generates a 256-bit secret, and the relay stores only its SHA-256. You can
  rotate the secret from Settings, after which the Shortcut needs the new one.
- **Limits.**
  - Request bodies up to 64 KB.
  - Rate limits per inbox and per IP.
  - At most 50 pending recipes.
  - A recipe is deleted as soon as the app acknowledges it, or after 7 days if never picked up.
  - CORS allows only the app's origin. CORS doesn't matter for the Shortcut; the secret is what
    protects the inbox.
- **Payload.** The canonical recipe Markdown the Gem already produces. The relay checks its size
  and that it looks like a recipe. The phone runs it through `unwrapAssistantReply` →
  `parseRecipeText` → `normalizeRecipeDraft` again before saving.
- **App.**
  - Settings → **Connect Gemini**: paste the connection code once, copy the secret into the
    Shortcut, rotate it, or disconnect.
  - Sync runs on open, on focus and when the phone comes back online.
  - Each saved recipe shows a toast with **Undo**.
  - A recipe whose title already exists updates that recipe, keeping its cook history.
  - Paste & save is unchanged.
- **Privacy wording.** "Recipes sent from Gemini pass through your relay and are deleted once
  delivered." The README's "never leaves the device" line gets this exception.
- **Tests.**
  - Vitest for the relay handlers (with an in-memory store) and for the app's inbox client.
  - A local end-to-end run: the relay running locally, a `curl` playing the Shortcut, and the app
    picking the recipe up, checked in a browser at 390×844.

## Decisions needed

1. Your Gemini plan, and whether gemini.google.com → Settings → Connected Apps shows an "Add custom
   app" option for you.
2. Which option to build.
3. Hosting (Vercel + Upstash?), and whether to create those accounts and resources when we get to
   deploying.
4. What happens when an incoming recipe's title already exists. Recommended: update automatically
   (this keeps cook history) and show an "Updated from Gemini" notice with Undo. The alternative is
   an Inbox screen where you review each one.

## Sources

- Google, [Connect & manage custom apps for Gemini Apps](https://support.google.com/gemini/answer/17209137):
  eligibility, setup, auth, write confirmations.
- Google, [Gemini Apps release notes](https://gemini.google/release-notes/): 13 Oct 2026 connected
  apps (India: select apps only); 30 Sep 2026 skills replacing Gems; 19 May 2026 Spark.
- Tempreon, [How to add a remote MCP server to the Gemini app](https://tempreon.com/guides/add-mcp-server-to-gemini)
  (verified 1 Oct 2026): rollout date, Enterprise transport rules.
- MacStories, [Gemini for iOS … basic Shortcuts actions](https://www.macstories.net/news/gemini-for-ios-gets-lock-screen-widgets-control-center-integration-basic-shortcuts-actions/)
  and Matthew Cassinelli, [Gemini Action Button shortcuts](https://matthewcassinelli.com/replace-siri-gemini-action-button-shortcuts).
- Apple, [Shortcuts personal automations](https://support.apple.com/guide/shortcuts/apd690170742/ios).
- Google, [Export responses from Gemini Apps](https://support.google.com/gemini/answer/14184041);
  MacMagazine, [exporting to Docs on iPhone](https://macmagazine.com.br/post/2026/09/15/como-exportar-uma-resposta-do-gemini-para-o-google-docs-iphone-ipad-mac-e-web/) (Sep 2026).
- Google Workspace Updates, [Keep API is for Workspace customers only](https://workspaceupdates.googleblog.com/2021/05/keep-audit-logs-and-api.html).
- Apple Developer Forums, [GIS OAuth popup loses window.opener](https://developer.apple.com/forums/thread/759487);
  [firebase-js-sdk #77](https://github.com/firebase/firebase-js-sdk/issues/77) (home-screen apps
  and OAuth).
- Google, [Gemini API available regions](https://ai.google.dev/gemini-api/docs/available-regions)
  (India listed; updated 28 Apr 2026).
- Upstash, [free tier: 256 MB, 500K commands/month](https://upstash.com/blog/upstash-vs-aws-elasticache-serverless-redis-pricing-and-performance-2026).
- npm registry, checked 19 Oct 2026: `@modelcontextprotocol/sdk` 1.32.1, `mcp-handler` 2.3.0,
  `@upstash/redis` 1.39.0, `@upstash/ratelimit` 2.2.0, `@google/genai` 2.30.0.
