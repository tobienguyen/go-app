# Archived: Analyze tab (MoveNet jump tracking)

Shelved during the hackathon (Nov 2026) — on-device pose estimation with
react-native-vision-camera + react-native-fast-tflite wasn't reliable in time.

- `analyze.tsx` — the Analyze tab screen (camera, calibration, jump height)
- `useJumpModel.ts` — old model download hook
- `movenet_lightning.tflite` — the bundled MoveNet Lightning model

To restore: move `analyze.tsx` back to `app/(tabs)/`, the model back to
`assets/models/`, re-add the `analyze` tab in `app/(tabs)/_layout.tsx`, and make
sure `react-native-worklets-core` is installed (VisionCamera frame processors
need it). Jump results were posted to the feed via `createPost`.
