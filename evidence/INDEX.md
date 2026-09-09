# Review evidence

- [Original Daytona gameplay](baseline-daytona.mp4) and [baseline profile](baseline-daytona-profile.json).
- [Full Miami night lap with game audio](miami-night.mp4) and [final measured profile](miami-night-profile.json).
- [Actual garage customization](owner-garage.mp4) and [downloaded owner-build photo](owner-build-photo.png).
- [Baseline garage](baseline-garage.png) / [upgraded garage](upgraded-garage.png): Glacier paint, ice-blue RGB, front-three-quarter garage view. Orbit phase/render resolution differ; comparable settings, not pixel-aligned frames. New wheel finish is bronze.
- [Engine/gameplay A/B](gameplay-mix-ab.mp3): eight seconds original Daytona, one second silence, eight seconds upgraded Miami. Both excerpts start four seconds into the videos. Actual mixes, not isolated or RPM-matched engine recordings; no loudness normalization. Human audition pending.
- [Recorded Miami loudness](miami-mix-loudness.txt), [audio audit](audio/decoded-audio-audit.json), [existing engine audition](audio/existing-engine-short-audition.mp3).
- [Simulation matrix](simulation-results.json), [secret-pattern scan](secret-scan.json).
- Vehicle neutral views/turntable and editable source: `../artwork/vehicle/`; proportion notes: `../docs/vehicle-reference.md`.

Canvas videos do not include the DOM HUD. UI was inspected in actual browser screenshots in the task conversation. Latest cockpit: `captures/frame-1788989362550.png` (landscape emulation, WebGL 2). Raw WebMs and profiles are retained locally under captures; WebMs are git-ignored because of size. First failed Miami run: `gameplay-1788988334642.webm`; its shoulder collision failure led to the documented fix.

Final benchmark: `profile-1788989065356.json`. Earlier CPU/nested telemetry captures retained mutable references and are invalid for those fields; see REVIEW.md. Final benchmark uses copied snapshots. The final cockpit camera adjustment followed that benchmark and was checked separately.
