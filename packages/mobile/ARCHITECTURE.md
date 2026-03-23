# Shunt Wizard Recorder - Architecture & Technical Documentation

## What This App Does

Shunt Wizard Recorder is a medical audio recording application designed for healthcare professionals. It allows users to:

1. **Record audio samples** (30 seconds, auto-stop) from specific anatomical positions during shunt monitoring
2. **Tag recordings** with study IDs, anatomical positions, and clinical notes
3. **View real-time waveforms** during recording
4. **Browse recordings history** grouped by time period with playback
5. **Upload securely** to Scaleway S3 with offline queue support

---

## App Flow

```
┌─────────────────┐
│  App Launch     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     Not logged in?     ┌──────────────────┐
│  Check Auth     │ ───────────────────────▶│  /login          │
└────────┬────────┘                         │  Enter Study ID  │
         │                                  └────────┬─────────┘
         │ Logged in                                 │
         │                                  POST /auth/login
         │                                           │
         ▼                                           │
┌─────────────────┐◀─────────────────────────────────┘
│  /index         │
│  Home Screen    │
│  - Recordings   │
│    list         │
│  - New recording│
│    button       │
└────────┬────────┘
         │ "+ New recording"
         ▼
┌─────────────────┐
│  /record        │
│  - Phone        │
│    position     │
│    overlay      │
└────────┬────────┘
         │ "Start Recording"
         ▼
┌─────────────────┐
│  Countdown      │
│  5 → 4 → 3 →    │
│  2 → 1          │
└────────┬────────┘
         │ Vibrate + start
         ▼
┌─────────────────┐
│  Recording      │
│  - Progress     │
│    timer        │
│  - Live waveform│
│  00:00 → 00:30  │
└────────┬────────┘
         │ Auto-stop at 30s + vibrate
         ▼
┌─────────────────┐
│  "Recording     │
│   Complete"     │
│   (7s display)  │
└────────┬────────┘
         │ addToQueue + router.replace("/")
         ▼
┌─────────────────┐     Background      ┌─────────────────┐
│  Upload Queue   │ ──────────────────▶ │  Scaleway S3    │
│  /index shown   │     (30s interval)  │  - .wav files   │
└────────┬────────┘                     │  - .json metadata│
         │                              └────────┬────────┘
         │                                       │
         ▼                                       │
┌─────────────────┐                              │
│  /index         │◀─ POST /recordings ──────────┘
│  (shows new     │   (notify API)
│   recording)    │
└─────────────────┘
```

---

## Technology Choices Explained

### Why Expo + React Native?
- **Cross-platform**: Single codebase for iOS and Android
- **Expo ecosystem**: Managed native modules, easy builds via EAS
- **File-based routing**: expo-router provides intuitive navigation

### Why @dr.pogodin/react-native-audio?
- **Raw PCM access**: Provides direct access to audio chunks (needed for waveforms)
- **Low-level control**: Better than expo-audio for real-time processing
- **Trade-off**: Requires native build (no Expo Go support)

### Why Offline-First Queue?
- **Medical environments**: Network may be unreliable
- **Data integrity**: No lost recordings due to connectivity issues
- **User experience**: Record continuously without waiting for uploads

---

## Backend API

The app connects to a backend server for authentication and recordings management.

### Configuration

**File**: `config/api.ts`

Base URL is resolved at build time from `EAS_BUILD_PROFILE` env variable (see `app.config.js`):
- `local` → `http://localhost:3000`
- `development` → `https://dev-api.shuntwizard.com`
- `production` → `https://api.shuntwizard.com`

### Authentication

**Login Endpoint**: `POST /auth/login`

Request:
```json
{
  "studyId": "user-entered-value"
}
```

Response:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "type": "participant",
  "studyId": "user-entered-value"
}
```

### Recordings

**Create Recording**: `POST /recordings`
Called after successful S3 upload.

Request:
```json
{
  "s3Key": "STUDY001/2024-02-02T14:51:00.000Z",
  "studyId": "STUDY001"
}
```

**List Recordings**: `GET /recordings`

Response:
```json
[
  {
    "id": "uuid",
    "s3Key": "STUDY001/2024-02-02T14:51:00.000Z",
    "studyId": "STUDY001",
    "createdAt": "2024-02-02T14:51:00.000Z"
  }
]
```

### Token Storage

- `accessToken` — in-memory only (never persisted)
- `refreshToken` — `expo-secure-store` (survives restarts; rotated on each refresh)

**File**: `utils/auth-storage.ts`

```typescript
// Available functions:
storeRefreshToken(token)  // Persist refresh token (SecureStore)
getRefreshToken()         // Retrieve refresh token
isLoggedIn()              // Check if refresh token exists
storeAuthStudyId(id)      // Store study ID from login
getAuthStudyId()          // Retrieve stored study ID
storeUserType(type)       // Store user type
getUserType()             // Retrieve user type
clearAuthToken()          // Logout (clear all stored auth data)
```

### API Service

**File**: `utils/api-service.ts`

```typescript
// Available methods:
apiService.login(studyId)        // Login and store token
apiService.logout()              // Clear token + stop queue processing
apiService.get<T>(endpoint)      // Authenticated GET request
apiService.post<T>(endpoint, body) // Authenticated POST request
```

All requests automatically include the `Authorization: Bearer <token>` header when logged in.

---

## Core Components Explained

### 1. Audio Recording System

**File**: `hooks/useAudioRecording.ts`

```
                    ┌─────────────────────┐
                    │  Microphone Input   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  Native Audio       │
                    │  @dr.pogodin/       │
                    │  react-native-audio │
                    └──────────┬──────────┘
                               │
                    PCM 16-bit chunks (4096 bytes)
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
         ▼                     ▼                     ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Audio Chunks   │  │  Chunk Listeners│  │  Duration Timer │
│  (Buffer array) │  │  (for waveform) │  │  (wall clock)   │
└────────┬────────┘  └─────────────────┘  └────────┬────────┘
         │                                         │
         │ On stop                                 │ Check maxDuration
         ▼                                         ▼
┌─────────────────┐                      ┌─────────────────┐
│  wav-encoder    │                      │  Auto-stop      │
│  PCM -> WAV     │                      │  + onAutoStop   │
└────────┬────────┘                      │  callback       │
         │                               └─────────────────┘
         ▼
┌─────────────────┐
│  Cache Directory│
│  recording_*.wav│
└─────────────────┘
```

**Key settings**:
- Sample rate: 44,100 Hz
- Format: 16-bit PCM
- Channels: Mono
- Chunk size: 4,096 bytes

**Options**:
```typescript
useAudioRecording({
  maxDuration: 30,           // Auto-stop after 30 seconds
  onAutoStop: (path) => {},  // Called when auto-stopped
  qualityCheckAt: 5,         // Seconds into recording to run quality check
  onQualityCheck: (result) => {},  // Called with AudioQualityResult (silent)
})
```

**Returns**:
```typescript
{
  isRecording: boolean,
  duration: number,
  recordingPath: string | null,
  startRecording: () => Promise<void>,
  cancelRecording: () => Promise<void>,  // Stop without saving
  addChunkListener: (listener) => unsubscribe,
  pauseTimer: () => void,   // Pause recording mid-session
  resumeTimer: () => void,  // Resume paused recording
}
```

### 2. Upload Queue System

**File**: `utils/upload-queue.ts`

The queue system ensures no recording is lost due to network issues.

```
Queue Item Structure:
{
  id: "2024-02-02T14:51:00.000Z",  // Timestamp as unique ID
  audioPath: "/path/to/audio.wav",
  metadata: {
    studyId: "STUDY123",
    location: "",
    notes: "",
    timestamp: "2024-02-02T14:51:00.000Z",
    platform: "ios",
    osVersion: "18.0",
    audioQualityFlags?: {         // From silent quality check at 5s
      wouldHaveBeenFlagged: bool,
      medianPeak: number,
      maxWindowPeak: number,
      artifactRatio: number,
      hasArtifacts: bool,
      windowPeaks: number[]
    }
  },
  attempts: 0,                   // Retry counter
  lastAttempt: 0                 // For backoff calculation
}
```

**Processing flow**:
```
Every 30 seconds:
  │
  ├─▶ Is network available?
  │     └─ No ──▶ Skip, wait for next interval
  │     └─ Yes ─▶ Continue
  │
  ├─▶ Is queue empty?
  │     └─ Yes ──▶ Skip
  │     └─ No ──▶ Continue
  │
  ├─▶ Get first item
  │
  ├─▶ Is in backoff period?
  │     │   Backoff = min(2^attempts * 60 seconds, 1 minute)
  │     └─ Yes ──▶ Skip this item
  │     └─ No ──▶ Continue
  │
  ├─▶ Upload to S3
  │     ├─ Upload .wav file
  │     └─ Upload .json metadata
  │
  ├─▶ S3 Success?
  │     └─ No ──▶ Increment attempts, update lastAttempt
  │     └─ Yes ─▶ Continue
  │
  ├─▶ POST /recordings to API
  │     └─ No ──▶ Increment attempts (retry both S3 + API)
  │     └─ Yes ─▶ Continue
  │
  └─▶ Remove from queue, delete local file
```

**Key functions**:
```typescript
addToQueue(audioPath, metadata)    // Add recording to queue
getQueue()                         // Get all queue items
clearQueue()                       // Delete all queued items
removeFromQueue(id)                // Remove specific item
triggerProcessQueue()              // Manually trigger processing
stopQueueProcessing()              // Stop the interval (on logout)
initializeQueueProcessing()        // Start the interval (on app load)
subscribeToQueueChanges(callback)  // Listen for queue updates
```

### 3. Recordings Service

**File**: `utils/recordings-service.ts`

Merges recordings from API with local queue items for a unified view.

```typescript
// Types
interface Recording {
  id: string;
  timestamp: string;
  studyId: string;
  s3Key?: string;      // Present if uploaded
  localPath?: string;  // Present if in queue
  status: "uploading" | "uploaded" | "failed";
  attempts?: number;
}

// Functions
getMergedRecordings()              // API + queue, deduplicated
fetchRecordingsFromApi()           // Just API recordings
groupRecordingsByPeriod(recordings) // Group by This Week/Last Week/Older
getS3AudioUrl(s3Key)               // Construct playback URL
subscribeToRecordingsChanges(cb)   // Real-time updates
```

**Deduplication logic**:
- If a recording exists in both API and queue (same timestamp), show API version
- This handles the transition when a queued item finishes uploading

### 4. Waveform Visualization

Two separate implementations for different use cases:

**Live Waveform** (`components/live-waveform.tsx`)
- Subscribes to audio chunks during recording
- Calculates amplitude from PCM data
- Renders scrolling bar chart in real-time
- Color changes: Blue (normal) → Red (high amplitude)

**Static Waveform** (`components/StaticWaveform.tsx`)
- Decodes complete WAV file
- Pre-calculates all bar heights
- Shows playback progress (blue = played, gray = unplayed)

### 5. S3 Security

The app **never holds S3 credentials**. Upload uses presigned URLs issued by the backend:

```
upload-queue
    │
    ▼
GET /s3/presigned-upload-url?filename=…
    │
    ▼ Backend signs URL with S3 credentials
    │
PUT directly to S3 (audio .wav)
PUT directly to S3 (metadata .json)
    │
    ▼
POST /recordings (notify API of s3Key)
```

---

## UI Components

### Alert (`components/Alert.tsx`)

MUI-style alert component with multiple variants.

```typescript
interface AlertProps {
  severity: "success" | "error" | "warning" | "info";
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  variant?: "filled" | "outlined" | "standard";
}
```

**Usage**:
```tsx
<Alert severity="success" title="Uploaded">
  Recording uploaded successfully.
</Alert>

<Alert severity="error" onClose={() => setShow(false)}>
  Upload failed. Will retry automatically.
</Alert>
```

### RecordingRow (`components/RecordingRow.tsx`)

Expandable row for displaying a single recording.

**Features**:
- Relative timestamp ("Just now", "Yesterday, 17:45", etc.)
- Status indicator dot (green/yellow/red)
- Expandable with animation
- Audio playback with waveform
- Plays from local file or S3 URL

### RecordingsList (`components/RecordingsList.tsx`)

Scrollable list of recordings grouped by time period.

**Features**:
- Sections: THIS WEEK, LAST WEEK, OLDER
- Pull-to-refresh
- Real-time updates via queue subscription
- Empty state handling

### Overlay (`components/Overlay.tsx`)

Reusable modal overlay component.

```typescript
interface OverlayProps {
  visible: boolean;
  onClose?: () => void;
  closeOnBackdropPress?: boolean;
  position?: "center" | "bottom";
  backdropColor?: string;
  backdropOpacity?: number;
  avoidKeyboard?: boolean;
  useSafeArea?: boolean;
  children: React.ReactNode;
}
```

### Timer Components

**CountdownTimer** (`components/timers/CountdownTimer.tsx`)
- Pie-chart style countdown
- Used before recording starts (5→4→3→2→1)
- Calls `onComplete` when finished

**ProgressTimer** (`components/timers/ProgressTimer.tsx`)
- Ring/stroke style progress
- Shows elapsed time during recording
- Displays MM:SS format

---

## Screen-by-Screen Breakdown

### /index (Home Screen)

**Purpose**: Display recordings history and navigate to new recording

**State**:
- `hasRecordings`: boolean | null - determines which view to show

**Views**:
1. **Loading**: Empty view while checking
2. **Empty state**: Wave image + explanatory text
3. **Recordings list**: Grouped by time period

**Components**:
- RecordingsList (when recordings exist)
- "+ New recording" button
- "Clear upload queue" button (dev mode only)

### /login (Login Screen)

**Purpose**: Authenticate user with Study ID

**Flow**:
1. User enters Study ID
2. POST to `/auth/login`
3. Success: Store token, studyId → navigate to /index
4. Failure: Show error message

### /record (Recording Screen)

**Purpose**: Guide user through recording process

**Phases**:
1. **Phone position overlay**: Animated slide-in, shows correct phone placement
2. **Countdown**: 5-second chunked animated countdown
3. **Recording**: Live waveform + progress timer; quality check at 5s (silent)
4. **Auto-stop**: After 30s, haptic vibrate × 3, "Recording Complete" shown for 7 seconds
5. **Queue**: `addToQueue(path, metadata)` with `audioQualityFlags`, then `router.replace("/")`

**State**:
- `showPhonePosition`: boolean - controls overlay
- `cancelled`: boolean - prevents re-mount issues
- `recordingComplete`: boolean - shows completion message + blocks duplicate queuing
- `currentStudyId`: string - from auth storage
- `qualityResultRef`: ref holding silent quality check result

**Critical behavior**:
- Uses `router.replace("/")` not `push` to prevent back navigation issues
- `cancelled` state prevents CountdownTimer from re-mounting on cancel
- `hasQueuedRef` prevents duplicate queue additions

### /settings (Settings Screen)

**Purpose**: App settings and account management

**Sections**:
- **Account**: Study ID, Language (tap to toggle EN/DE)
- **Legal**: Consents, Legal Disclosure
- Version display
- Logout button

---

## Recording Positions

The app captures audio at 5 specific anatomical positions:

| Value | German Label | English Label |
|-------|--------------|---------------|
| `anastomose` | Anastomose | Anastomosis |
| `anastomose_3cm` | Anastomose +3cm | Anastomosis +3cm |
| `anastomose_8cm` | Anastomose +8cm / "Mitte" | Anastomosis +8cm (middle) |
| `proximal` | Proximal | Proximal |
| `engstelle` | Engstelle | Stenosis |

---

## S3 Storage Structure

```
bucket-name/
├── STUDY001/
│   ├── 2024-02-02T14:51:00.000Z.wav   # Audio recording
│   ├── 2024-02-02T14:51:00.000Z.json  # Metadata
│   ├── 2024-02-02T15:20:00.000Z.wav
│   └── 2024-02-02T15:20:00.000Z.json
├── STUDY002/
│   └── ...
```

**Audio playback**: Short-lived presigned download URLs issued by the backend at `GET /recordings/:id/download-url`. Cached locally in `cacheDirectory/recording_<id>.wav` after first download.

---

## Localization (i18n)

### Supported Languages
- **German** (`de`) - Default
- **English** (`en`)

### File Structure
```
locales/
├── en.ts          # English translations
├── de.ts          # German translations
├── i18n.tsx       # Provider and hook
└── index.ts       # Exports
```

### Translation Sections
```typescript
{
  common: { ... },      // Shared strings
  login: { ... },       // Login screen
  passphrase: { ... },  // Passphrase screen
  record: { ... },      // Recording screen
  submit: { ... },      // Submit screen
  form: { ... },        // Form labels
  positions: { ... },   // Anatomical positions
  queue: { ... },       // Queue indicator
  guideline: { ... },   // Onboarding slides
  recordings: { ... },  // Recordings list
  settings: { ... },    // Settings screen
}
```

### Usage
```typescript
import { useI18n, interpolate } from "../locales";

function MyComponent() {
  const { t, language, setLanguage } = useI18n();

  return (
    <View>
      <Text>{t.login.title}</Text>
      <Text>{interpolate(t.queue.uploading, { count: 3 })}</Text>
      <Button onPress={() => setLanguage("de")} title="Deutsch" />
    </View>
  );
}
```

---

## Build & Deployment

### Development Build

```bash
# Generate native projects
npx expo prebuild --clean

# Run on iOS simulator
yarn ios

# Run on Android emulator
yarn android
```

### Production Build (EAS)

```bash
# Build for Android
eas build --profile production --platform android

# Build for iOS
eas build --profile production --platform ios
```

### Build Profiles

| Profile | Bundle ID | API |
|---------|-----------|-----|
| local | com.carealytix.ShuntWizardLocal | http://localhost:3000 |
| development | com.carealytix.ShuntWizardDevelopment | https://dev-api.shuntwizard.com |
| production | com.carealytix.ShuntWizard | https://api.shuntwizard.com |

---

## Error Handling

### Network Failures
- Recordings never lost (queued locally)
- Automatic retry with exponential backoff
- Queue indicator shows pending count

### Recording Cancel
- `cancelRecording()` stops without saving
- Sets `isCancelledRef` to block in-flight callbacks
- `cancelled` state prevents UI re-mount issues

### S3 Upload Failures
- Item stays in queue for retry
- Both S3 upload and API notification retry together
- After 500 attempts, item removed

### Queue Running After Logout
- `apiService.logout()` calls `stopQueueProcessing()`
- Interval is cleared, no more background processing

---

## Troubleshooting Guide

| Error | Cause | Solution |
|-------|-------|----------|
| "ReactNativeAudio could not be found" | Running in Expo Go | `npx expo prebuild --clean && yarn ios` |
| "react-native-worklets/plugin" | Missing dependency | `yarn add react-native-worklets` |
| "ReactAppDependencyProvider" | Stale iOS build | `npx expo prebuild --clean` |
| Recording uploads after cancel | Re-mount issue | Fixed with `cancelled` state |
| Queue runs after logout | Missing cleanup | Fixed with `stopQueueProcessing()` |
| Duplicate uploads | Multiple callbacks | Fixed with `hasQueuedRef` guard |

---

## Dependencies Overview

### Critical
- `@dr.pogodin/react-native-audio` - Recording (raw PCM access)
- `expo-av` - Playback
- `expo-file-system` - File operations + queue persistence
- `expo-secure-store` - Refresh token + study ID storage

### UI
- `react-native-svg` - Timer/waveform components
- `react-native-safe-area-context` - Safe areas
- `@expo/vector-icons` - Icons
- `expo-router` - Navigation
- `@expo-google-fonts/source-sans-pro` - Typography

### Utilities
- `wav-encoder` / `wav-decoder` / `wav` - Audio format conversion
- `@react-native-community/netinfo` - Network status
- `expo-haptics` - Haptic feedback
- `patch-package` - Dependency patching
- `react-native-reanimated` - Animations
