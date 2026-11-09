# Pixel League

A self-contained arena car-soccer game with a cinematic, stylized 3D presentation. The cars and ball are editable low-poly OBJ assets; the arena, goals, stands, boost stations, lights, and effects are assembled procedurally with Three.js.

## Run locally

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. To make a static production build:

```sh
npm run build
npm run preview
```

## Play

- **WASD** or **arrow keys** — accelerate, reverse, and steer
- **Space** — jump; press again in the air to dodge/flip in your steering direction
- **Shift** — burn boost
- **Escape / P** — pause; **F** — fullscreen; **M** — mute/unmute
- Collect the glowing boost pads. Matches include kickoffs, goals, a full match clock, sudden-death overtime when tied, and a result/rematch screen.
- Choose Duel (1v1) or Doubles (2v2), one of three arenas, match length, bot skill, and your team. Touch devices get a virtual steering/drive stick and hold buttons for boost and jump.

## Models and rendering

`models/rocket-racer.obj` is the player car shell; `models/pixel-ball.obj` contains the ball's separate light and dark panel groups. The renderer adds team paint, glass, wheels, lamps, boost exhaust, mesh shadows, a tiered stadium, goal nets, animated pickup models, crowd blocks, fog, tone mapping, and stadium lighting. The match remains lightweight and runs locally in the browser.

## Publishing automation

- **CI** runs the test suite, syntax checks, and a production build for pushes and pull requests.
- **GitHub Pages** publishes automatically from `main` (or on manual dispatch). The Vite base path is configured for this repository.
- **Releases** tagged `v*` build and attach a zip of the playable static site.
- **Dependabot** checks npm packages and GitHub Actions monthly.

For Pages, enable **Settings → Pages → Build and deployment → GitHub Actions** once. Then pushes to `main` deploy automatically.

## About the physics

Pixel League is an original car-soccer game, not Rocket League. It has custom ground handling, boost, jump/dodge, ball bounce and height, goal tunnels, pickup cooldowns, and opponent AI, but its simulation is still a 2.5D arcade approximation rather than Rocket League's proprietary full 3D physics or online multiplayer.

## Checks

```sh
npm test
npm run check
npm run build
```
