# makefun-gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/penawarlawas/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/penawarlawas/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Port Solara** — an original open-world crime game for the browser: a sun-soaked
coastal city explored on foot and by car, with traffic, pedestrians, a five-star
wanted level and a police force that responds, four story missions, combat,
collectibles, a minimap HUD, synthesized music and sound, and localStorage saves.
100% original IP — every name, character, vehicle, building and note is its own.
Built with a vendored three.js (minified, under `game/vendor/`); no build step,
no network requests, plays offline in desktop Chrome with keyboard + mouse.

## Run it

```sh
node serve.ts        # serves game/ at http://localhost:8080
```

Open http://localhost:8080 in desktop Chrome. WASD move/drive, mouse look,
E enter/exit cars, click punch/shoot, Q swap weapon, R reload, Space handbrake,
Shift sprint, Esc pause, M mute. Screenshot scenes: `?shot=chase|street|drive|mission`,
loop self-test: `?selftest=1`.

Hand in the entry (Node 22+):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
