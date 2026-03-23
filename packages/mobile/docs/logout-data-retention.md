# Logout & Data Retention — Issues and Solutions

## Background

`apiService.logout()` currently does:
1. Calls `stopQueueProcessing()` — stops the 30s upload interval
2. Invalidates the refresh token on the server (best-effort, swallows network errors)
3. Clears `accessToken` from memory
4. Calls `clearAuthToken()` — wipes refresh token + studyId + userType from SecureStore

What it does **not** touch:
- `documentDirectory/upload-queue.json` and `documentDirectory/queued_audio/` — queue and audio copies survive logout
- `cacheDirectory/recording_<id>.wav` — downloaded playback cache survives logout
- Nothing is deleted from S3

---

## Issue 1 — Cross-user data bleed (High severity)

**Root cause:** `getMergedRecordings()` merges the API list (scoped to the authenticated user) with *all*
queue items on disk regardless of `studyId`. `QueueItem.metadata.studyId` is stored but never filtered on.

```ts
// recordings-service.ts — current code
const queueRecordings = queueItems
  .filter((item) => !apiTimestamps.has(item.metadata.timestamp))
  .map(queueItemToRecording);
// ↑ no studyId filter
```

**Scenario:** Patient A records offline. Hands device to Patient B who logs in. Patient B sees Patient A's
unuploaded recordings on the home screen with a yellow "uploading" dot, and can navigate into their overview.

**Fix (2 lines in `getMergedRecordings`):**
```ts
const currentStudyId = await getAuthStudyId();

const queueRecordings = queueItems
  .filter((item) => !apiTimestamps.has(item.metadata.timestamp))
  .filter((item) => !currentStudyId || item.metadata.studyId === currentStudyId)
  .map(queueItemToRecording);
```

This is a safe guard even without fixing the logout cleanup below.

---

## Issue 2 — Queue not cleared on logout (High severity)

**Root cause:** The logout handler wired in `_layout.tsx` only calls `stopQueueProcessing()`.
`clearQueue()` exists and does the right thing (deletes audio files + resets the JSON), but is never called.

```ts
// _layout.tsx — current
apiService.setLogoutHandler(stopQueueProcessing);

// should be
apiService.setLogoutHandler(async () => {
  stopQueueProcessing();
  await clearQueue();
});
```

Note: `setLogoutHandler` currently accepts `() => void`, so the signature would need to accommodate `async`.
The simplest approach: fire-and-forget inside the handler since logout is already awaited by
`apiService.logout()`.

---

## Issue 3 — In-flight upload survives logout (Medium severity)

**Root cause:** `stopQueueProcessing()` cancels the `setInterval`, but two things escape it:

1. **A running `processQueue()` async call** — if one is in progress when logout fires, it completes.
   The `isProcessing = true` guard means the interval being cleared doesn't stop the already-running function.

2. **The `setTimeout(processQueue, 10000)` in the `finally` block** — this reference is never saved,
   so it cannot be cancelled. If there are remaining queue items, `processQueue` fires again 10 seconds
   after logout.

That second `processQueue` run hits the API with a null `accessToken`, gets a 401, triggers refresh,
refresh fails, which calls `logout()` again — meaning `clearAuthToken()`, `stopQueueProcessing()`,
and `router.replace("/login")` all fire a second time. The navigation double-redirect is benign today
but fragile.

**Fix:** Introduce an `isQueueActive` flag checked inside `processQueue` itself:
```ts
let isQueueActive = false;

export const stopQueueProcessing = () => {
  isQueueActive = false;
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
};

export const initializeQueueProcessing = () => {
  isQueueActive = true;
  // ...existing init...
};

const processQueue = async () => {
  if (!isQueueActive) return; // check after every await too
  // ...
  // in finally:
  if (isQueueActive && remainingQueue.length > 0) {
    setTimeout(processQueue, 10000);
  }
};
```

---

## Issue 4 — Audio cache never cleaned up (Low severity, disk growth)

**Root cause:** `cacheDirectory/recording_<id>.wav` files accumulate indefinitely. iOS/Android will
eventually evict them under storage pressure, but there's no bound on how much space gets used.

The cache isn't a privacy risk between users (IDs are backend-generated; a different user's session
can't look up another user's download URL due to auth). But a heavy user of the app will accumulate
many cached files.

**Options:**
- **Do nothing** — rely on OS eviction. This is the current implicit approach and is defensible for a
  medical app where offline access matters.
- **Clear on logout** — one glob delete of `cacheDirectory/recording_*.wav`. Adds ~50ms to logout.
- **LRU with a cap** — keep the N most recently accessed files. Overkill unless storage complaints arise.

---

## Issue 5 — MAX_RETRIES = 500 means orphaned files live for hours (Low severity)

**Root cause:** With backoff capped at 1 minute, 500 retries means a file can sit on disk for ~500 minutes
(~8 hours) before being auto-cleaned. During that window the audio file consumes storage and shows as
"failed" in the UI with no way for the user to dismiss it.

The original intent of 500 was probably "try forever until connectivity returns." But combined with
the 1-minute cap it doesn't achieve that — it just delays cleanup.

**Better approaches:**
- **Separate "retry indefinitely" from "give up after persistent failure"**: keep retrying on network
  errors (keep high MAX_RETRIES), but fail fast on 4xx errors (auth failure, bad request) — those
  will never succeed regardless of retries.
- **Add a max-age on queue init**: purge any item where
  `Date.now() - lastAttempt > 7 * 24 * 60 * 60 * 1000` (7 days). Delete the audio file and remove
  from queue. This prevents truly abandoned items from accumulating.

---

## Issue 6 — Delete Account is a TODO stub (Low severity, but critical path)

`handleDeleteAccount` in `settings.tsx` has only `console.log("Delete account pressed - not implemented yet")`.
If this is a GDPR-applicable product, completing this is a legal requirement.

What it needs to do:
- `clearQueue()` — remove local audio files
- Delete audio cache files (`cacheDirectory/recording_*.wav`)
- Call a backend endpoint to delete the account, all recordings, and all S3 objects
- `apiService.logout()`

---

## Summary

| # | Issue | Effort | Impact |
|---|-------|--------|--------|
| 1 | Filter queue by studyId in `getMergedRecordings` | 2 lines | Eliminates cross-user data bleed |
| 2 | Call `clearQueue()` on logout | 1 line in `setLogoutHandler` | Cleans disk on logout |
| 3 | Add `isQueueActive` flag to `processQueue` | ~10 lines | Stops ghost uploads after logout |
| 4 | Clear audio cache on logout | ~5 lines | Prevents cache accumulation |
| 5 | Improve MAX_RETRIES strategy | ~15 lines | Better UX for permanently failed uploads |
| 6 | Complete Delete Account | Larger | Required for data compliance |

Items **1 and 2** are worth doing immediately — each is a few lines and closes real gaps.
Items 3–5 are quality improvements.
Item 6 depends on whether the backend supports account/data deletion yet.
