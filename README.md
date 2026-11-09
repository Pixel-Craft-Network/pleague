# Pixel League

A self-contained, single-file arena car-soccer game with a cinematic, stylized 3D presentation. The whole game — markup, styles, and JavaScript including the Three.js renderer and the OBJ car/ball models — lives in **`index.html`**. There is no build step, no dependency install, and no server: open the file and play.

## Run it

- **Double-click `index.html`** (works over `file://`), or
- serve the folder with any static host — GitHub Pages, Netlify, nginx, `python3 -m http.server`, anything. No backend is required or used.

## Play

- **WASD** or **arrow keys** — accelerate, reverse, and steer
- **Space** — jump; press again in the air to dodge/flip in your steering direction
- **Shift** — burn boost
- **Escape / P** — pause · **F** — fullscreen · **M** — mute/unmute · **R** — restart
- Collect the glowing boost pads. Matches include kickoffs, goals, a full match clock, sudden-death overtime when tied, and a result/rematch screen.
- Choose Duel (1v1) or Doubles (2v2), one of three arenas, match length, bot skill, and your team. Touch devices get a virtual stick plus boost/jump buttons.
- Settings, sound preference, and screen state persist in `localStorage`.

## What's inside `index.html`

Everything is inlined, so the file works offline and from any static path:

- **Markup** — the menu, HUD (scoreboard, boost meter, boost segments), pause/result/help modals, and touch controls.
- **Styles** — the full neon arcade art direction, inlined in a single `<style>` block (no external fonts, images, or CSS files).
- **JavaScript** — a minified bundle built from the original `src/` modules (physics simulation, 3D scene assembly, OBJ/canvas model handling, sound kit, UI wiring) concatenated with the Three.js library it uses (`three` r187, MIT license, © three.js authors — license header retained in the bundle).
- **Models** — `models/rocket-racer.obj` (car shell) and `models/pixel-ball.obj` (ball panels) embedded as text and parsed at startup with the Three.js OBJ loader. The renderer still adds team paint, glass, wheels, lamps, boost exhaust, stands, nets, pickups, and effects procedurally.
- **Textures** — stadium environment and turf are generated on a `<canvas>` at runtime; nothing is fetched from the network.

Fixed-timestep simulation runs at 60 Hz with an input accumulator; rendering uses the Three.js WebGL renderer with ACES tone mapping and a broadcast-style camera.

## Editing

`index.html` is intentionally a single artifact. You can edit the markup and the inlined CSS directly. The minified game bundle is one long script block near the end of `<body>` — it is hand-maintainable for small tweaks, but for big changes the practical route is to port the change into the bundle directly or regenerate the bundle from a source checkout of the original multi-file project and re-inline it (bundle with any ESM bundler at `--format=iife --target=es2022 --loader:.obj=text`, then replace the `<script>…</script>` block in `index.html`).

## Deploying

Any static host works. For GitHub Pages, enable **Settings → Pages → Build and deployment → GitHub Actions**; the included `.github/workflows/pages.yml` publishes the repository root (i.e. this `index.html`) with no build step on every push to `main`.

## Notes on scope

Pixel League is an original car-soccer game, not Rocket League. Car physics, boost, jump/dodge, ball bounce and height, goal tunnels, pickup cooldowns, and bot AI are a custom 2.5D arcade approximation simulated on the ground plane with vertical jumps — not full 3D collision, not Rocket League's proprietary physics, and not online multiplayer.
