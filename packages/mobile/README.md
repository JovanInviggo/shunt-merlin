# ShuntWizard Recorder

Medical audio recording app for shunt monitoring. Records 30-second audio clips, adds anatomical position metadata, and uploads to S3 with offline queue support.

## Tech Stack

- **Expo 52** + React Native 0.76 + TypeScript
- **expo-router** (file-based routing)
- **@dr.pogodin/react-native-audio** — native PCM capture → WAV
- **expo-av** — playback
- **Scaleway S3** — storage (S3-compatible)
- **expo-secure-store** — auth token + credentials

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 18+ |
| Yarn | 1.x |
| Xcode | 15+ (iOS builds) |
| CocoaPods | latest |
| **Java (Android)** | **17–24** (Java 25 not yet supported by this stack; use Android Studio’s JBR or `brew install openjdk@17`) |

## Setup

```bash
yarn install
```

For iOS, install native dependencies:

```bash
npx expo prebuild --clean
cd ios && pod install && cd ..
```

## Running

```bash
yarn start          # Metro dev server
yarn ios            # Build + launch on iOS Simulator
yarn android        # Build + launch on Android emulator
```

> **Note:** The app uses native audio modules not available in Expo Go. A development build is required (`yarn ios` / `yarn android`).

**Android:** If the build fails with `Unsupported class file major version 69`, you’re on Java 25, which this stack doesn’t support yet. Use Java 17–24, e.g.:
```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 17)   # or 21, 23
yarn android
```
If no Java 17 is installed: `brew install openjdk@17` or use Android Studio’s bundled JDK: `export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`.

## Testing

### Unit & Integration Tests

```bash
yarn test                    # Run all tests once
yarn test --watchAll=false   # CI mode (no watch)
yarn test --watch            # Watch mode
yarn test <pattern>          # Run matching test files
```

**Current coverage:** 16 test suites, 208 tests.

Test files live in `__tests__/`. Every utility function, hook, component, and screen has corresponding tests. See `CLAUDE.md` for the testing policy.

### E2E Tests (Maestro)

End-to-end flows run against a development build on the iOS Simulator.

**Prerequisites:**

```bash
# Java (required by Maestro)
brew install openjdk
export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"  # add to ~/.zshrc

# Maestro CLI
brew tap mobile-dev-inc/tap && brew install maestro
```

**Run a single flow:**

```bash
maestro test .maestro/01-happy-path.yaml
```

**Run all flows in sequence:**

```bash
maestro test .maestro/
```

**Flows:**

| File | What it covers |
|---|---|
| `01-happy-path.yaml` | Login → record 30s → recording appears in list |
| `02-low-signal.yaml` | Low signal overlay → retry → fresh recording screen |
| `03-offline-queue.yaml` | Record offline → queue indicator → go online → queue drains |
| `04-logout.yaml` | Settings → logout → redirected to login |

See `.maestro/README.md` for full details and device-specific notes.

## Project Structure

```
app/              # Screens (expo-router file-based)
components/       # Shared UI components
hooks/            # useAudioRecording, useAudioPlayer, useAuthCheck
utils/            # Pure utilities + services (upload-queue, api, s3, auth)
locales/          # i18n (en, de)
config/           # API base URL, S3 credentials
__tests__/        # All test files
.maestro/         # E2E flow files + scripts
```

## Build Profiles

| Profile | App ID |
|---|---|
| `development` | `com.carealytix.ShuntRecorderDevelopment` |
| `staging` | `com.carealytix.ShuntRecorderStaging` |
| `production` | `com.carealytix.ShuntRecorder` |

Build with EAS:

```bash
eas build --profile development --platform ios
```
