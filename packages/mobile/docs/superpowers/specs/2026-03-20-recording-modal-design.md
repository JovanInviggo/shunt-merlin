# Recording Screen — Modal Overlay Design

## Overview

Convert the recording screen from a full-screen stack route into a native iOS modal sheet. The home screen stays mounted and visible behind the modal (~8% peeking at the top), giving the recording UI an overlay feel rather than a page navigation feel.

## Scope

- `packages/mobile/app/_layout.tsx`
- `packages/mobile/app/record.tsx`
- `packages/mobile/components/guidelines/PhonePosition.tsx`

No changes to recording logic, upload queue, cancel flow, or any other files.

## Design Decisions

- **Presentation**: `presentation: 'modal'` on the record `Stack.Screen`. iOS natively slides the sheet up and exposes ~8% of the home screen at the top. No manual height calculation needed.
- **Height**: ~92% of screen height (native iOS modal default).
- **Both phases inside the modal**: The PhonePosition step (phone placement guide) and the recording phase (countdown → recording → done) both live inside the same modal sheet.
- **No backdrop dim**: The native modal presentation handles the visual separation. No custom overlay needed.

## Changes

### `_layout.tsx`
Add `presentation: 'modal'` to the record `Stack.Screen`:
```tsx
<Stack.Screen name="record" options={{ headerShown: false, presentation: 'modal' }} />
```

### `record.tsx`
1. Add a handle bar at the top of the sheet — a small centered pill (36×4, `rgba(0,0,0,0.15)`, `borderRadius: 2`).
2. Remove `"top"` from `SafeAreaView` edges — the modal does not start at the top of the screen so top safe area inset is not needed. Keep `["left", "right", "bottom"]`.
3. No changes to any state, logic, refs, or navigation calls.

### `PhonePosition.tsx`
1. Remove `"top"` from `SafeAreaView` edges — same reason as above.
2. Add a handle bar at the top matching the one in `record.tsx`.
3. No changes to button handlers, layout, or content.

## What Does Not Change

- `router.push('/record')` in `index.tsx` — unchanged, modal presentation is handled by the Stack config.
- `router.replace('/')` in `record.tsx` — unchanged, dismisses the modal and returns to home.
- All recording logic: `useAudioRecording`, `addToQueue`, `handleAutoStop`, quality checks, vibration, DEV buttons.
- Cancel flow and alert dialog.
- `LowSignalOverlay`.
- `useKeepAwake`.

## Testing

- Modal slides up smoothly from home screen on tap of "+ New recording"
- Home screen title visible above the modal sheet
- Handle bar visible at top of both PhonePosition and recording phases
- Safe area bottom padding still applied correctly (no content clipped at bottom)
- Cancel and auto-complete both dismiss the modal and return to home
- All existing unit tests pass without modification
