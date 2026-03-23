# CTO Code Review: Shunt Wizard Recorder

---

## Project Overview

| Item | Value |
|------|-------|
| Framework | Expo 52 + React Native 0.76.8 |
| Language | TypeScript 5.3 (strict mode) |
| Navigation | expo-router 4.0 (file-based) |
| State Mgmt | React Context (i18n), local state + refs |
| Audio | @dr.pogodin/react-native-audio (native, patched) |
| Storage | Scaleway S3, expo-file-system, expo-secure-store |
| Auth | JWT via custom API service |
| Architecture | Layered (screens / components / hooks / utils) |
| Tests | jest-expo configured, no test files found |
| Linting | eslint-config-expo, prettier (tabs, width 4) |

**Immediate red flags from recon:**
- `config/s3-credentials.json` contains live Scaleway keys and is tracked in git
- `.gitignore` does not exclude credential files
- Zero test files exist despite jest being configured
- `aws-sdk` v2 AND `@aws-sdk/*` v3 are both installed (duplicate S3 SDK)
- `react-native-paper` is a dependency but barely used (heavy bundle for little value)

---

## 🔴 CRITICAL (Fix before shipping)

### C1. Plaintext S3 credentials committed to git

**File:** `config/s3-credentials.json`

Live Scaleway access key and secret key are committed in plaintext. Anyone with repo access gets full read/write to the S3 bucket containing medical audio recordings.

**Fix:**
1. Rotate the Scaleway API key immediately
2. `git rm --cached config/s3-credentials.json`
3. Add `config/s3-credentials.json` and `config/s3-credentials.enc.json` to `.gitignore`
4. Scrub from git history with BFG Repo-Cleaner

---

### C2. S3 credentials bundled into the app binary

**Files:** `utils/s3-service.ts:10-12`, `utils/recordings-service.ts:7`

```typescript
const PLAIN_CREDENTIALS = require("../config/s3-credentials.json");
const S3_CREDENTIALS = require("../config/s3-credentials.json");
```

Metro inlines JSON `require()` calls into the JS bundle. Anyone extracting the IPA/APK can read the credentials. This is a medical app handling patient recordings.

**Fix:** Move to server-generated pre-signed URLs. The client requests an upload URL from your backend; the backend holds the S3 credentials. No secrets ever ship in the client.

---

### C3. Upload queue race condition — data loss risk

**File:** `utils/upload-queue.ts:253-388`

`processQueue` reads queue from disk, mutates in memory, writes back. `addToQueue` (from UI thread) can write to the same file concurrently. No locking mechanism exists. A recording added between read and write gets silently overwritten and lost.

**Fix:** Implement an async mutex:
```typescript
let lock = Promise.resolve();
const withLock = <T>(fn: () => Promise<T>): Promise<T> => {
  const result = lock.then(fn);
  lock = result.then(() => {}, () => {});
  return result;
};
// Wrap addToQueue, removeFromQueue, updateQueueItem, processQueue
```

---

### C4. Stale closure in submit.tsx cleanup deletes queued files

**File:** `app/submit.tsx:135-164`

The cleanup effect depends on `[recordingPath, wasUploaded, isQueued]`. When `isQueued` changes to `true`, the effect re-runs, calling the previous cleanup which captured `isQueued=false` — and deletes the recording file that was just queued.

**Fix:** Use refs for mutable flags:
```typescript
const wasUploadedRef = useRef(false);
const isQueuedRef = useRef(false);
useEffect(() => { wasUploadedRef.current = wasUploaded; }, [wasUploaded]);
useEffect(() => { isQueuedRef.current = isQueued; }, [isQueued]);

useEffect(() => {
  return () => {
    if (!wasUploadedRef.current && !isQueuedRef.current && recordingPath) {
      FileSystem.deleteAsync(recordingPath).catch(console.error);
    }
  };
}, [recordingPath]);
```

---

### C5. `useAudioRecording` cleanup captures stale `recording` — never stops

**File:** `hooks/useAudioRecording.ts:64-72`

```typescript
return () => {
  if (recording) recording.stop(); // `recording` is always null (captured at mount)
};
```

The `recordingRef` exists for this purpose but isn't used in cleanup. If the component unmounts during active recording, the native audio stream leaks.

**Fix:**
```typescript
return () => {
  if (durationTimer.current) clearInterval(durationTimer.current);
  if (recordingRef.current) recordingRef.current.stop();
};
```

---

## 🟠 HIGH (Fix in next sprint)

### H1. No error boundary in a medical app

**File:** `app/_layout.tsx`

No React error boundary exists. A rendering crash in any screen kills the entire app with no recovery. A user mid-recording loses their data.

**Fix:** Add an `ErrorBoundary` component wrapping the `<Stack>` that catches errors, logs them, and shows a recovery screen.

---

### H2. ScrollView + `.map()` for recordings list

**File:** `components/RecordingsList.tsx:82-94`

All recording rows are mounted simultaneously. Each row holds `Animated.Value` instances, sound objects, and images. With months of recordings this will degrade significantly.

**Fix:** Replace with `SectionList`:
```typescript
<SectionList
  sections={[
    { title: "THIS WEEK", data: grouped.thisWeek },
    { title: "LAST WEEK", data: grouped.lastWeek },
    { title: "OLDER", data: grouped.older },
  ].filter(s => s.data.length > 0)}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <RecordingRow recording={item} />}
  renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
/>
```

---

### H3. No token expiry check or 401 handling

**Files:** `utils/api-service.ts`, `utils/auth-storage.ts`

`isLoggedIn()` only checks if a token string exists. `handleResponse()` doesn't intercept 401s. Expired tokens cause silent upload failures for up to 500 retries.

**Fix:** Add a 401 interceptor that clears the token and redirects to login. Parse JWT expiry if the backend doesn't support refresh tokens.

---

### H4. Logout does not clear the upload queue

**File:** `utils/api-service.ts:61-64`

Queue processing is stopped and token is cleared, but queue items remain on disk. The next user who logs in inherits the previous user's recordings. In a medical app, this is a privacy violation.

**Fix:** Call `clearQueue()` in `logout()` before clearing the token.

---

### H5. Hardcoded English strings bypass i18n

**Files:** `app/index.tsx:25,34,44`, `components/RecordingRow.tsx:30-48`, `components/Header.tsx:38-39`

"Shunt Diary", "Just now", "Yesterday", "min ago", "You are offline" etc. are hardcoded in English. German users see mixed-language UI.

**Fix:** Add all strings to `locales/en.ts` and `locales/de.ts`, use `t.*` keys.

---

### H6. HTTP base URL with no HTTPS enforcement

**File:** `config/api.ts:6`

```typescript
BASE_URL: "http://localhost:3000",
```

No mechanism prevents this from shipping in production. Auth tokens and study IDs would travel unencrypted.

**Fix:** Add a runtime guard:
```typescript
if (!API_CONFIG.BASE_URL.startsWith('https://') && !__DEV__) {
  throw new Error('Non-HTTPS API URL in production build');
}
```

---

### H7. `stopQueueProcessing()` doesn't cancel in-flight or scheduled work

**File:** `utils/upload-queue.ts:403-409`

Only clears the `setInterval`. Doesn't cancel a running S3 upload or the `setTimeout` callbacks at lines 289 and 385. After logout, a running cycle completes and restarts via `setTimeout`.

**Fix:** Add an `isStopped` flag checked at every stage of `processQueue`:
```typescript
let isStopped = false;
export const stopQueueProcessing = () => { isStopped = true; /* clearInterval... */ };
// In processQueue: if (isStopped) return;
// In initializeQueueProcessing: isStopped = false;
```

---

## 🟡 MEDIUM (Improve soon)

| # | File | Issue | Fix |
|---|------|-------|-----|
| M1 | `upload-queue.ts:303-307` | Backoff is flat 60s (not exponential). Comment is wrong. | Fix formula: `Math.min(2^n * 5000, 300000)` for 5s→10s→...→5min |
| M2 | `upload-queue.ts:144` | Queue ID is timestamp — collisions possible | Use `crypto.randomUUID()` |
| M3 | `recordings-service.ts:58` | UI shows "failed" at 3 attempts, queue retries 500 times | Align thresholds |
| M4 | `s3-service.ts:174-179` | Full S3 error objects logged (bucket, region, signatures) | Gate verbose logging behind `__DEV__` |
| M5 | `RecordingRow.tsx:158` | `status: any` — use `AVPlaybackStatus` from expo-av | Type it properly |
| M6 | `live-waveform.tsx:17` | `recording: any` prop is never used | Remove the prop |
| M7 | `record.tsx:146-162` | 17-line commented-out JSX block | Delete it (git history preserves it) |
| M8 | `record.tsx:80-88` | `handleStopRecording` is dead code — never called | Remove it |
| M9 | `record.tsx:189-258` | 8+ unused styles (`studyIdBadge`, `recordButton`, etc.) | Remove them |
| M10 | `record.tsx:137` | Inline `style={{ marginBottom: 20 }}` in 10Hz render path | Move to StyleSheet |
| M11 | `record.tsx:109-110` | Redundant `!showPhonePosition` check (already guaranteed) | Remove inner check |
| M12 | `settings.tsx:131,147,151` | Empty `onPress={() => {}}` renders clickable rows that do nothing | Remove onPress or add "Coming soon" |
| M13 | `index.tsx:12-17` | `hasRecordings` only checked on mount, not on focus | Use `useFocusEffect` |
| M14 | `recordings-service.ts:37-54` | API failure returns `[]` silently — user thinks recordings are lost | Return error flag alongside data |
| M15 | `s3-service.ts:116-181` | Non-atomic upload (audio + metadata) — orphans on partial failure | Track partial success in queue item |
| M16 | `recordings-service.ts:7` | Imports full S3 credentials just for endpoint/bucket | Create separate non-secret config |

---

## 🟢 LOW / SUGGESTIONS

- Remove `aws-sdk` v2 from dependencies — only v3 (`@aws-sdk/*`) is used
- Remove `react-native-paper` if not actively used (adds ~200KB to bundle)
- Remove unused `storeUserType`/`getUserType` from `auth-storage.ts`
- Remove dead `uploadToS3` function from `s3-service.ts`
- `live-waveform.tsx:23` — `NUM_BARS` computed once at module load, not responsive to rotation
- `RecordingRow.tsx:167` — `sound?.setPositionAsync(0)` is fire-and-forget, add `.catch()`
- `login.tsx:42` — `catch (err: any)` should use `unknown` and narrow
- Dual export pattern (named + default) in Alert, RecordingRow, RecordingsList — pick one
- `guideline.tsx:73-99` — slides array recreated on every render, move outside component or `useMemo`
- `useAuthCheck.ts` — potential infinite loop if `segments` changes before navigation completes. Add a `hasRedirected` ref guard.
- Write tests. Zero test files exist for a medical application.

---

## ✅ WHAT'S DONE WELL

1. **Race condition handling in `useAudioRecording.ts`**: The layered guard system (`isCancelledRef`, `isAutoStoppingRef`, `hasQueuedRef`, `cancelled` state) is thorough and shows deep understanding of React lifecycle edge cases.

2. **Offline-first queue architecture**: The upload queue with retry, backoff, and listener pattern is well-structured for a medical environment with unreliable connectivity.

3. **i18n system**: Clean implementation with typed translations, interpolation, and React Context. Adding a language is a single file.

4. **Wall-clock duration tracking**: Using `Date.now()` instead of accumulated state to avoid React 18 strict mode double-invocation is the correct fix — shows awareness of framework internals.

5. **File structure and separation**: Clear layered architecture (screens / components / hooks / utils / config / locales) that's easy to navigate and reason about.

---

## 📋 PRIORITY ACTION PLAN

| # | Action | Severity | Effort |
|---|--------|----------|--------|
| 1 | **Rotate exposed S3 credentials**, scrub from git history | CRITICAL | 1 hour |
| 2 | **Add credential files to `.gitignore`**, remove from tracking | CRITICAL | 10 min |
| 3 | **Move to server-side pre-signed URLs** — no S3 creds in client | CRITICAL | 1-2 days |
| 4 | **Fix queue race condition** with async mutex | CRITICAL | 2 hours |
| 5 | **Fix submit.tsx cleanup** stale closure (recording deletion bug) | CRITICAL | 30 min |
| 6 | **Fix useAudioRecording cleanup** to use `recordingRef` | CRITICAL | 10 min |
| 7 | **Add error boundary** to root layout | HIGH | 1 hour |
| 8 | **Replace ScrollView with SectionList** in RecordingsList | HIGH | 1 hour |
| 9 | **Add 401 interceptor** + logout on token expiry | HIGH | 2 hours |
| 10 | **Clear queue on logout** to prevent cross-user data leakage | HIGH | 10 min |
