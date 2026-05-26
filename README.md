# openpilot steering centering diagnostic

A small all-client-side web app that scans a public openpilot route and estimates
logged steering wheel center from stable straight-driving windows.

It fetches comma's public route file list, requires uploaded rlogs for full-rate
analysis, supports `.zst` and `.bz2`, decompresses in the browser, and decodes
just enough Cap'n Proto to summarize:

- qlog candidate segments, when available, to cheaply pick promising rlog
  segments by speed and steady steering
- `carState` speed, steering angle, steering rate, steering torque, steering
  pressed, standstill, blinker, and yaw-rate fields
- rlog context from `controlsState`, `carControl`, `modelV2.action`,
  deprecated `lateralPlan`, deprecated `liveLocationKalman`, and `livePose`
  when present
- stable straight-driving windows that pass speed-aware yaw-rate, curvature,
  steering-rate, blinker, standstill, driver-steering, sample-gap, duration,
  and angle-range filters
- a window-weighted median steeringAngleDeg estimate, bootstrap interval,
  confidence, spread, speed/curvature/segment sensitivity, signal coverage,
  caveats, and supporting sample log times

The result is meant to package route evidence for human review when a vehicle
appears to need steering wheel centering or steering sensor offset diagnosis. It
does not replace a mechanical alignment check.

## Run locally

```sh
pnpm install
pnpm dev
```

Open the local URL printed by Vite.

## Deploy on Cloudflare Pages

Use these settings:

- Build command: `pnpm build`
- Build output directory: `dist`
- Node version: current LTS or newer

No server-side function is required.

## Deploy on GitHub Pages

For the `ophwug/op-steering-center-tool` project page, the app is built with the
Vite base path `/op-steering-center-tool/`, so the expected URL is:

```text
https://ophwug.github.io/op-steering-center-tool/
```

## Getting a usable route

1. Open [comma Connect](https://connect.comma.ai/) and select the drive.
2. Open **More info** and turn on **Public access**.
3. Copy either the browser URL or the route name.

Accepted inputs look like:

```text
5beb9b58bd12b691|0000010a--a51155e496
https://connect.comma.ai/5beb9b58bd12b691/0000010a--a51155e496/90/105
```

You can turn Public access off again after reading the route.

## Privacy

The app runs in the browser and does not store route data. Private route access,
when needed, uses a JWT stored only in the current browser's local storage.

## Useful commands

```sh
pnpm test
pnpm test:smoke
pnpm build
```

`test:smoke` uses a public demo route, so it needs network access.
