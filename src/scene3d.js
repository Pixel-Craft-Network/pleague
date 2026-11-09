import * as THREE from "three";
import { ARENA } from "./physics.js";
import { createBallVisual, createCarVisual, loadModelAssets, TEAM_PALETTE, useBallAsset, useCarAsset } from "./models.js";

const PI2 = Math.PI * 2;
const ARENA_STYLE = {
  neon: {
    sky: 0x08111e, turf: 0x152d37, turfAlt: 0x18343d, line: 0xb7edf1,
    blue: 0x49dff7, orange: 0xff9b57, deck: 0x182536, crowd: 0x688095,
  },
  sunset: {
    sky: 0x1b1118, turf: 0x30232d, turfAlt: 0x382a35, line: 0xe8d7c9,
    blue: 0x63d9ff, orange: 0xff9a59, deck: 0x2a1d27, crowd: 0x9d777b,
  },
  frost: {
    sky: 0x071522, turf: 0x142a3d, turfAlt: 0x19354a, line: 0xc9e7f1,
    blue: 0x89efff, orange: 0xffb27a, deck: 0x1a2b3e, crowd: 0x829cb2,
  },
};

const material = (color, roughness = 0.7, metalness = 0.12, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

function addBox(parent, width, height, depth, position, mat, options = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat);
  mesh.position.set(...position);
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = options.receiveShadow ?? true;
  if (options.rotation) mesh.rotation.set(...options.rotation);
  parent.add(mesh);
  return mesh;
}

function addFlatPlane(parent, width, depth, y, z, mat, x = 0) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addLine(parent, points, mat, loop = false) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const line = loop ? new THREE.LineLoop(geometry, mat) : new THREE.Line(geometry, mat);
  parent.add(line);
  return line;
}

function createFieldLines(group, style) {
  const marking = new THREE.LineBasicMaterial({ color: style.line, transparent: true, opacity: 0.62, depthWrite: false });
  const accentBlue = new THREE.LineBasicMaterial({ color: style.blue, transparent: true, opacity: 0.42, depthWrite: false });
  const accentOrange = new THREE.LineBasicMaterial({ color: style.orange, transparent: true, opacity: 0.42, depthWrite: false });
  const y = 3.8;
  addLine(group, [[-ARENA.halfWidth + 24, y, -ARENA.halfHeight + 20], [ARENA.halfWidth - 24, y, -ARENA.halfHeight + 20], [ARENA.halfWidth - 24, y, ARENA.halfHeight - 20], [-ARENA.halfWidth + 24, y, ARENA.halfHeight - 20]], marking, true);
  addLine(group, [[0, y, -ARENA.halfHeight + 24], [0, y, ARENA.halfHeight - 24]], marking);
  for (const radius of [78]) {
    const points = [];
    for (let i = 0; i <= 80; i += 1) {
      const angle = (i / 80) * PI2;
      points.push([Math.cos(angle) * radius, y, Math.sin(angle) * radius]);
    }
    addLine(group, points, marking);
  }
  for (const side of [-1, 1]) {
    const x1 = side > 0 ? 380 : -ARENA.halfWidth + 24;
    const x2 = side > 0 ? ARENA.halfWidth - 24 : -380;
    const materialForSide = side > 0 ? accentBlue : accentOrange;
    addLine(group, [[x1, y, -132], [x2, y, -132], [x2, y, 132], [x1, y, 132]], materialForSide, true);
    for (const z of [-ARENA.goalHalfHeight, ARENA.goalHalfHeight]) {
      addLine(group, [[side * (ARENA.halfWidth - 6), y, z], [side * (ARENA.halfWidth - 50), y, z * 0.82]], materialForSide);
    }
  }
  for (const x of [-380, 0, 380]) {
    for (const z of [-205, 205]) {
      const point = new THREE.Mesh(new THREE.CircleGeometry(x === 0 ? 3.6 : 2.5, 12), material(0xd7f5f4, 0.45, 0.1, { emissive: 0x5fb8c2, emissiveIntensity: 0.16 }));
      point.rotation.x = -Math.PI / 2;
      point.position.set(x, 3.95, z);
      group.add(point);
    }
  }
}

function createGoal(group, side, style) {
  const goalColor = side > 0 ? style.blue : style.orange;
  const floorMat = material(side > 0 ? 0x102c40 : 0x332426, 0.5, 0.25, { emissive: goalColor, emissiveIntensity: 0.045 });
  const netMat = new THREE.MeshStandardMaterial({ color: goalColor, roughness: 0.7, metalness: 0.35, transparent: true, opacity: 0.24, emissive: goalColor, emissiveIntensity: 0.3 });
  const postMat = new THREE.MeshStandardMaterial({ color: goalColor, roughness: 0.28, metalness: 0.35, emissive: goalColor, emissiveIntensity: 1.0 });
  const depth = ARENA.goalDepth;
  const centerX = side * (ARENA.halfWidth + depth / 2);
  addBox(group, depth, 20, ARENA.goalHalfHeight * 2, [centerX, -7, 0], floorMat);
  addFlatPlane(group, depth, ARENA.goalHalfHeight * 2, 3, 0, floorMat, centerX);

  const tunnelSide = ARENA.goalHalfHeight;
  // Net curtains on the back and tunnel sides.
  const backX = side * (ARENA.halfWidth + depth - 2);
  for (let z = -tunnelSide; z <= tunnelSide; z += 18) {
    addBox(group, 2, 68, 1.35, [backX, 35, z], netMat, { castShadow: false, receiveShadow: false });
  }
  for (let h = 9; h < 72; h += 18) {
    addBox(group, 2, 1.2, tunnelSide * 2, [backX, h, 0], netMat, { castShadow: false, receiveShadow: false });
  }
  for (const zSide of [-1, 1]) {
    for (let x = ARENA.halfWidth + 16; x < ARENA.halfWidth + depth; x += 18) {
      addBox(group, 1.35, 66, 2, [side * x, 34, zSide * (tunnelSide - 1)], netMat, { castShadow: false, receiveShadow: false });
    }
    for (let h = 9; h < 72; h += 18) {
      addBox(group, depth, 1.2, 2, [centerX, h, zSide * (tunnelSide - 1)], netMat, { castShadow: false, receiveShadow: false });
    }
  }

  // Goal posts and crossbar are bright, readable, and physically grounded.
  for (const zSide of [-1, 1]) {
    addBox(group, 12, 74, 12, [side * (ARENA.halfWidth + 2), 37, zSide * tunnelSide], postMat);
    addBox(group, 9, 68, 9, [side * (ARENA.halfWidth + depth - 2), 34, zSide * tunnelSide], postMat);
  }
  addBox(group, 12, 11, tunnelSide * 2 + 8, [side * (ARENA.halfWidth + 2), 74, 0], postMat);
  addBox(group, 8, 8, tunnelSide * 2 + 5, [side * (ARENA.halfWidth + depth - 2), 68, 0], postMat);
  const goalGlow = new THREE.PointLight(goalColor, 135, 380, 2);
  goalGlow.position.set(side * (ARENA.halfWidth + depth * 0.65), 80, 0);
  group.add(goalGlow);
  return goalGlow;
}

function addStands(group, style) {
  const concrete = material(0x293648, 0.82, 0.2);
  const seatGeometry = new THREE.BoxGeometry(24, 8, 15);
  const seatMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0.1, vertexColors: true, emissive: 0x1b2934, emissiveIntensity: 0.25 });
  const seatCount = 2 * 4 * 49 + 2 * 4 * 17;
  const seats = new THREE.InstancedMesh(seatGeometry, seatMaterial, seatCount);
  seats.castShadow = true;
  seats.receiveShadow = true;
  const transform = new THREE.Object3D();
  let count = 0;
  const seatColors = [new THREE.Color(style.crowd), new THREE.Color(style.blue), new THREE.Color(style.orange), new THREE.Color(0xa77bd8), new THREE.Color(0x667c91)];
  for (const side of [-1, 1]) {
    for (let row = 0; row < 4; row += 1) {
      const z = side * (355 + row * 26);
      const y = 16 + row * 15;
      addBox(group, 1320 - row * 40, 12, 24, [0, y - 8, z], concrete);
      for (let col = 0; col < 49; col += 1) {
        const x = -600 + col * 25;
        transform.position.set(x, y, z);
        transform.rotation.set(0, (col % 3 - 1) * 0.025, 0);
        transform.scale.set(1, 1 + ((col + row) % 4) * 0.04, 1);
        transform.updateMatrix();
        seats.setMatrixAt(count, transform.matrix);
        const colorIndex = (col * 7 + row * 3 + (side > 0 ? 2 : 0)) % seatColors.length;
        seats.setColorAt(count, seatColors[colorIndex]);
        count += 1;
      }
    }
  }
  for (const side of [-1, 1]) {
    for (let row = 0; row < 4; row += 1) {
      const x = side * (620 + row * 25);
      const y = 16 + row * 15;
      addBox(group, 22, 12, 600 - row * 38, [x, y - 8, 0], concrete);
      for (let col = 0; col < 17; col += 1) {
        const z = -285 + col * 35;
        transform.position.set(x, y, z);
        transform.rotation.set(0, side * Math.PI / 2, 0);
        transform.scale.set(1, 1, 1);
        transform.updateMatrix();
        seats.setMatrixAt(count, transform.matrix);
        seats.setColorAt(count, seatColors[(col * 3 + row + (side > 0 ? 1 : 0)) % seatColors.length]);
        count += 1;
      }
    }
  }
  seats.count = count;
  seats.instanceMatrix.needsUpdate = true;
  if (seats.instanceColor) seats.instanceColor.needsUpdate = true;
  group.add(seats);

  // Walkways, safety rails, and perimeter LED bands.
  const railMat = metal(0x637b91, 0.28, 0.72);
  const ledBlue = new THREE.MeshStandardMaterial({ color: style.blue, emissive: style.blue, emissiveIntensity: 1.5, roughness: 0.3 });
  const ledOrange = new THREE.MeshStandardMaterial({ color: style.orange, emissive: style.orange, emissiveIntensity: 1.5, roughness: 0.3 });
  for (const side of [-1, 1]) {
    addBox(group, 1320, 5, 5, [0, 77, side * 450], railMat);
    addBox(group, 1320, 2.4, 3, [0, 72, side * 438], side > 0 ? ledBlue : ledOrange, { castShadow: false });
    addBox(group, 5, 5, 720, [side * 720, 77, 0], railMat);
  }
}

function buildArena(name) {
  const style = ARENA_STYLE[name] || ARENA_STYLE.neon;
  const root = new THREE.Group();
  root.name = `arena-${name}`;
  const concrete = material(style.deck, 0.83, 0.22);
  const darkSteel = metal(0x26364a, 0.32, 0.72);
  const board = material(0x26364a, 0.5, 0.48);
  const trimBlue = new THREE.MeshStandardMaterial({ color: style.blue, emissive: style.blue, emissiveIntensity: 1.3, metalness: 0.3, roughness: 0.22 });
  const trimOrange = new THREE.MeshStandardMaterial({ color: style.orange, emissive: style.orange, emissiveIntensity: 1.3, metalness: 0.3, roughness: 0.22 });
  const turf = new THREE.MeshStandardMaterial({ color: 0xffffff, map: makeTurfTexture(style.turf, 13), roughness: 0.94, metalness: 0.02 });
  const turfAlt = new THREE.MeshStandardMaterial({ color: 0xffffff, map: makeTurfTexture(style.turfAlt, 29), roughness: 0.94, metalness: 0.02 });

  addBox(root, 1740, 44, 1120, [0, -53, 0], concrete);
  addBox(root, 1680, 16, 1055, [0, -25, 0], darkSteel);
  addBox(root, ARENA.halfWidth * 2 + 20, 20, ARENA.halfHeight * 2 + 20, [0, -7, 0], concrete);
  addFlatPlane(root, ARENA.halfWidth * 2, ARENA.halfHeight * 2, 3, 0, turf);
  for (let i = 0; i < 12; i += 1) {
    const width = ARENA.halfWidth * 2 / 12;
    addFlatPlane(root, width - 1, ARENA.halfHeight * 2 - 2, 3.2, 0, i % 2 ? turfAlt : turf, -ARENA.halfWidth + width * (i + 0.5));
  }

  // Goal mouths extend into deep, netted tunnels beyond the touchline.
  const goalLights = [createGoal(root, -1, style), createGoal(root, 1, style)];

  // Board walls around the pitch; the end walls are split to leave goal openings.
  for (const side of [-1, 1]) {
    addBox(root, ARENA.halfWidth * 2, 53, 16, [0, 27, side * (ARENA.halfHeight + 4)], board);
    addBox(root, ARENA.halfWidth * 2, 4, 18, [0, 55, side * (ARENA.halfHeight + 4)], side > 0 ? trimBlue : trimOrange);
    for (const zRange of [[-ARENA.halfHeight, -ARENA.goalHalfHeight], [ARENA.goalHalfHeight, ARENA.halfHeight]]) {
      const center = (zRange[0] + zRange[1]) / 2;
      const length = Math.abs(zRange[1] - zRange[0]);
      addBox(root, 18, 58, length, [side * (ARENA.halfWidth + 4), 29, center], board);
    }
    addBox(root, 12, 48, ARENA.goalDepth, [side * (ARENA.halfWidth + ARENA.goalDepth / 2), 24, -ARENA.goalHalfHeight - 2], board);
    addBox(root, 12, 48, ARENA.goalDepth, [side * (ARENA.halfWidth + ARENA.goalDepth / 2), 24, ARENA.goalHalfHeight + 2], board);
  }

  // Outer runway, painted safety markings, and metallic coping.
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xc6d5de, roughness: 0.4, metalness: 0.38, emissive: 0x253847, emissiveIntensity: 0.12 });
  for (const z of [-ARENA.halfHeight - 14, ARENA.halfHeight + 14]) {
    addBox(root, 1450, 3, 4, [0, 6, z], lineMat, { castShadow: false });
  }
  for (const side of [-1, 1]) {
    addBox(root, 4, 3, 700, [side * (ARENA.halfWidth + 17), 6, 0], lineMat, { castShadow: false });
  }
  createFieldLines(root, style);

  // Midfield and goal accent panels make the field readable from the broadcast camera.
  const blueWash = new THREE.Mesh(new THREE.PlaneGeometry(ARENA.halfWidth, ARENA.halfHeight * 2), new THREE.MeshBasicMaterial({ color: style.blue, transparent: true, opacity: 0.035, depthWrite: false }));
  blueWash.rotation.x = -Math.PI / 2;
  blueWash.position.set(-ARENA.halfWidth / 2, 3.15, 0);
  root.add(blueWash);
  const orangeWash = blueWash.clone();
  orangeWash.material = new THREE.MeshBasicMaterial({ color: style.orange, transparent: true, opacity: 0.035, depthWrite: false });
  orangeWash.position.x = ARENA.halfWidth / 2;
  root.add(orangeWash);

  // Boost pads, animated at runtime from the physics pickup state.
  const pads = [];
  const torusGeo = new THREE.TorusGeometry(18, 2.6, 8, 24);
  const padGold = new THREE.MeshStandardMaterial({ color: 0xffca71, emissive: 0xffa93f, emissiveIntensity: 1.15, metalness: 0.48, roughness: 0.22 });
  const padCyan = new THREE.MeshStandardMaterial({ color: 0x64eaff, emissive: 0x28d5ff, emissiveIntensity: 0.95, metalness: 0.42, roughness: 0.23 });
  for (const x of [-390, -195, 195, 390]) {
    for (const z of [-220, 220]) pads.push(makeBoostPad(x, z, false, torusGeo, padCyan, padGold));
  }
  for (const x of [-495, 495]) {
    for (const z of [-245, 245]) pads.push(makeBoostPad(x, z, true, torusGeo, padCyan, padGold));
  }
  for (const pad of pads) root.add(pad.group);

  // Tiered stands, crowd blocks, steel trusses, and an overhead ring.
  addStands(root, style);
  const support = metal(0x384b61, 0.38, 0.7);
  const roof = metal(0x1b2b3c, 0.42, 0.68);
  for (const x of [-690, 690]) {
    for (const z of [-390, 390]) {
      addBox(root, 16, 285, 16, [x, 143, z], support);
      addBox(root, 52, 15, 18, [x, 292, z], roof);
      addBox(root, 14, 12, 140, [x, 300, z - Math.sign(z) * 65], roof);
    }
  }
  const roofRing = new THREE.Mesh(new THREE.TorusGeometry(780, 7, 10, 96), roof);
  roofRing.rotation.x = -Math.PI / 2;
  roofRing.position.y = 338;
  roofRing.castShadow = true;
  root.add(roofRing);
  const ribbon = new THREE.Mesh(new THREE.TorusGeometry(735, 2.5, 6, 96), new THREE.MeshStandardMaterial({ color: 0x6a7f95, metalness: 0.7, roughness: 0.3, emissive: 0x142a3c, emissiveIntensity: 0.35 }));
  ribbon.rotation.x = -Math.PI / 2;
  ribbon.position.y = 298;
  root.add(ribbon);

  // Tall floodlight towers and low-intensity team-colour washes.
  const floodMat = new THREE.MeshBasicMaterial({ color: 0xe8f7ff });
  for (const x of [-670, 670]) {
    for (const z of [-360, 360]) {
      addBox(root, 8, 180, 8, [x, 100, z], support);
      addBox(root, 54, 10, 18, [x, 190, z], darkSteel);
      for (let i = 0; i < 5; i += 1) {
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(6, 2, 5), floodMat);
        lamp.position.set(x - 20 + i * 10, 190, z);
        root.add(lamp);
      }
      const spot = new THREE.SpotLight(0xd8f5ff, 280, 1050, Math.PI / 3.5, 0.65, 1.4);
      spot.position.set(x, 190, z);
      spot.target.position.set(0, 0, 0);
      root.add(spot, spot.target);
    }
  }

  return { group: root, pads, goalLights, style };
}

function makeBoostPad(x, z, big, torusGeo, cyanMaterial, goldMaterial) {
  const group = new THREE.Group();
  group.position.set(x, 3, z);
  group.userData.big = big;
  const diskMat = new THREE.MeshStandardMaterial({ color: 0x24384a, metalness: 0.58, roughness: 0.32, emissive: big ? 0x513e20 : 0x123b49, emissiveIntensity: 0.26 });
  const disk = new THREE.Mesh(new THREE.CylinderGeometry(big ? 17 : 12, big ? 19 : 14, 3, 20), diskMat);
  disk.position.y = 1;
  disk.castShadow = true;
  disk.receiveShadow = true;
  group.add(disk);
  const ring = new THREE.Mesh(torusGeo, (big ? goldMaterial : cyanMaterial).clone());
  ring.rotation.x = -Math.PI / 2;
  ring.scale.setScalar(big ? 1.32 : 0.72);
  ring.position.y = 3;
  group.add(ring);
  const coreMaterial = new THREE.MeshStandardMaterial({ color: big ? 0xffdfa0 : 0xa4f7ff, emissive: big ? 0xffa73e : 0x36dfff, emissiveIntensity: 1.7, roughness: 0.18 });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(big ? 7 : 4.5, 0), coreMaterial);
  core.position.y = big ? 9 : 6;
  core.castShadow = true;
  group.add(core);
  const lamp = new THREE.PointLight(big ? 0xffc46e : 0x5be9ff, big ? 10 : 4, big ? 100 : 54, 2);
  lamp.position.y = big ? 18 : 12;
  group.add(lamp);
  group.userData.ring = ring;
  group.userData.core = core;
  group.userData.lamp = lamp;
  group.userData.material = big ? goldMaterial : cyanMaterial;
  return group;
}

function makePlayerTag(team) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 40;
  const context = canvas.getContext("2d");
  context.fillStyle = "rgba(4,13,22,.88)";
  context.fillRect(0, 3, 128, 34);
  context.fillStyle = team === "blue" ? "#64ebff" : "#ffad69";
  context.fillRect(0, 3, 4, 34);
  context.font = "bold 22px monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#effbff";
  context.fillText("YOU", 68, 20);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true, sizeAttenuation: true }));
  sprite.scale.set(34, 10.6, 1);
  sprite.position.set(0, 48, 0);
  return sprite;
}

function createStadiumEnvironment() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#132235");
  gradient.addColorStop(0.42, "#516273");
  gradient.addColorStop(0.54, "#1c2935");
  gradient.addColorStop(1, "#07101b");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 12; i += 1) {
    const x = 18 + i * 88;
    const width = i % 3 === 0 ? 58 : 34;
    const glow = context.createLinearGradient(x, 0, x + width, 0);
    glow.addColorStop(0, "rgba(255,255,255,0)");
    glow.addColorStop(0.5, i % 2 ? "rgba(129,231,255,.55)" : "rgba(255,193,135,.45)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = glow;
    context.fillRect(x, 92 + (i % 3) * 15, width, 8);
    context.fillRect(x + 8, 330 - (i % 2) * 22, width - 16, 4);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeTurfTexture(color, seed = 1) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  context.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
  context.fillRect(0, 0, 256, 256);
  let value = seed >>> 0;
  const random = () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
  for (let i = 0; i < 1800; i += 1) {
    const x = random() * 256;
    const y = random() * 256;
    const light = random() > 0.53;
    context.fillStyle = light ? "rgba(159,226,210,.12)" : "rgba(1,9,15,.14)";
    context.fillRect(x, y, 1 + random() * 3, 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 3);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function disposeMaterial(mat) {
  if (!mat) return;
  for (const value of Object.values(mat)) if (value?.isTexture) value.dispose();
  mat.dispose();
}

function disposeGroup(group) {
  group.traverse((node) => {
    if (!node.isMesh && !node.isLine && !node.isLineLoop && !node.isInstancedMesh) return;
    node.geometry?.dispose?.();
    if (Array.isArray(node.material)) node.material.forEach(disposeMaterial);
    else disposeMaterial(node.material);
  });
}

export function create3DScene(canvas, initialState) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
  renderer.setSize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const style = ARENA_STYLE[initialState.settings.arena] || ARENA_STYLE.neon;
  scene.environment = createStadiumEnvironment();
  scene.environmentIntensity = 0.42;
  scene.background = new THREE.Color(style.sky);
  scene.fog = new THREE.Fog(style.sky, 1450, 2850);

  const camera = new THREE.PerspectiveCamera(39, 16 / 9, 0.1, 3800);
  camera.position.set(0, 770, 820);
  camera.lookAt(0, 0, 0);

  const hemisphere = new THREE.HemisphereLight(0xb9e7ff, 0x1b2430, 2.2);
  scene.add(hemisphere);
  const ambient = new THREE.AmbientLight(0x8aa6bf, 0.48);
  scene.add(ambient);
  const keyLight = new THREE.DirectionalLight(0xffefd5, 3.15);
  keyLight.position.set(-420, 880, 360);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.left = -880;
  keyLight.shadow.camera.right = 880;
  keyLight.shadow.camera.top = 760;
  keyLight.shadow.camera.bottom = -760;
  keyLight.shadow.camera.near = 50;
  keyLight.shadow.camera.far = 1900;
  keyLight.shadow.bias = -0.00018;
  keyLight.shadow.normalBias = 0.025;
  scene.add(keyLight);

  const arenaSlot = new THREE.Group();
  scene.add(arenaSlot);
  let arenaObjects = null;
  function setArena(name) {
    if (arenaObjects) {
      arenaSlot.remove(arenaObjects.group);
      disposeGroup(arenaObjects.group);
    }
    arenaObjects = buildArena(name);
    arenaSlot.add(arenaObjects.group);
    scene.background = new THREE.Color(arenaObjects.style.sky);
    scene.fog.color.setHex(arenaObjects.style.sky);
  }
  setArena(initialState.settings.arena);

  const ball = createBallVisual();
  scene.add(ball);
  const carVisuals = new Map();
  const particleGeometry = new THREE.BoxGeometry(1, 1, 1);
  const particleMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, emissive: 0x263543, emissiveIntensity: 0.32, roughness: 0.55, metalness: 0.05 });
  const particleInstances = new THREE.InstancedMesh(particleGeometry, particleMaterial, 256);
  particleInstances.count = 0;
  particleInstances.frustumCulled = false;
  scene.add(particleInstances);
  const instance = new THREE.Object3D();
  const cameraLook = new THREE.Vector3();
  const cameraDesired = new THREE.Vector3();
  let carTemplate = null;
  let ballTemplate = null;
  let lastScoreKey = "0-0";
  let screenShake = 0;
  let previousNow = 0;

  function ensureCars(state) {
    const active = new Set(state.cars.map((car) => car.id));
    for (const [id, visual] of carVisuals) {
      if (!active.has(id)) {
        scene.remove(visual);
        visual.traverse((node) => {
          if (node.isSprite) {
            node.material.map?.dispose?.();
            node.material.dispose();
          }
        });
        disposeGroup(visual);
        carVisuals.delete(id);
      }
    }
    for (const car of state.cars) {
      let visual = carVisuals.get(car.id);
      if (!visual) {
        visual = createCarVisual(car.team, car.slot + 1);
        scene.add(visual);
        carVisuals.set(car.id, visual);
      }
      if (Boolean(visual.userData.playerTag) !== Boolean(car.player)) {
        const previousTag = visual.userData.playerTag;
        if (previousTag) {
          visual.remove(previousTag);
          previousTag.material.map?.dispose?.();
          previousTag.material.dispose();
        }
        visual.userData.playerTag = car.player ? makePlayerTag(car.team) : null;
        if (visual.userData.playerTag) visual.add(visual.userData.playerTag);
      }
      if (carTemplate && visual.userData.assetTemplate !== carTemplate) {
        useCarAsset(visual, carTemplate);
        visual.userData.assetTemplate = carTemplate;
      }
    }
  }

  loadModelAssets().then((assets) => {
    carTemplate = assets.car;
    ballTemplate = assets.ball;
    for (const visual of carVisuals.values()) {
      useCarAsset(visual, carTemplate);
      visual.userData.assetTemplate = carTemplate;
    }
    useBallAsset(ball, ballTemplate);
  }).catch((error) => console.warn("Pixel League model load failed; using built-in meshes.", error));

  function resize() {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  }

  function updateCars(state, now, preview) {
    ensureCars(state);
    for (const car of state.cars) {
      const visual = carVisuals.get(car.id);
      const idle = now / 1000;
      const previewX = car.team === "blue" ? -245 : 245;
      const x = preview ? previewX + Math.sin(idle * 0.62 + car.slot) * 24 : car.x;
      const z = preview ? car.y + Math.sin(idle * 0.78 + (car.team === "orange" ? 2 : 0)) * 24 : car.y;
      visual.position.set(x, car.z, z);
      visual.rotation.y = -car.angle + (preview ? Math.sin(idle * 0.48 + car.slot) * 0.045 : 0);
      const wheels = visual.userData.wheels || [];
      for (const wheel of wheels) wheel.rotation.z = -car.wheelSpin;
      const flames = visual.userData.boostMeshes || [];
      for (const flame of flames) {
        flame.visible = Boolean(car.isBoosting);
        if (flame.visible) flame.scale.set(0.75 + Math.sin(state.elapsed * 48 + car.slot) * 0.22, 0.85 + Math.sin(state.elapsed * 39) * 0.2, 0.9);
      }
      if (visual.userData.boostLight) visual.userData.boostLight.intensity = car.isBoosting ? 13 : 0;
    }
  }

  function updatePads(state, now) {
    const count = Math.min(state.pads.length, arenaObjects.pads.length);
    for (let i = 0; i < count; i += 1) {
      const data = state.pads[i];
      const visual = arenaObjects.pads[i];
      const ready = data.cooldown <= 0;
      const pulse = 0.88 + Math.sin(now * 0.004 + data.phase) * 0.12;
      visual.userData.ring.visible = true;
      visual.userData.core.visible = ready;
      visual.userData.lamp.intensity = ready ? (data.big ? 10 : 4) : 0.5;
      visual.userData.ring.material.emissiveIntensity = ready ? 1.15 + pulse * 0.3 : 0.16;
      visual.userData.ring.scale.setScalar((data.big ? 1.32 : 0.72) * pulse);
      visual.userData.core.rotation.y = now * (data.big ? 0.0015 : -0.0019);
      visual.userData.core.scale.setScalar(ready ? 1 : 0.72);
    }
  }

  function updateParticles(state) {
    const particles = state.particles;
    const count = Math.min(particles.length, particleInstances.instanceMatrix.count);
    for (let i = 0; i < count; i += 1) {
      const p = particles[i];
      const life = Math.max(0.15, p.life / p.maxLife);
      const size = Math.max(1.2, p.size * life);
      instance.position.set(p.x, p.z + 3, p.y);
      instance.rotation.set(state.elapsed * 2, state.elapsed * 1.7 + i, state.elapsed * 1.3);
      instance.scale.set(size, size, size);
      instance.updateMatrix();
      particleInstances.setMatrixAt(i, instance.matrix);
      particleInstances.setColorAt(i, new THREE.Color(p.color));
    }
    particleInstances.count = count;
    particleInstances.instanceMatrix.needsUpdate = true;
    if (particleInstances.instanceColor) particleInstances.instanceColor.needsUpdate = true;
  }

  function render(state, now, preview = false) {
    const delta = previousNow ? Math.min(0.05, (now - previousNow) / 1000) : 1 / 60;
    previousNow = now;
    updateCars(state, now, preview);
    updatePads(state, now);

    const idle = now / 1000;
    const ballX = preview ? Math.sin(idle * 0.42) * 78 : state.ball.x;
    const ballZ = preview ? Math.cos(idle * 0.54) * 45 : state.ball.y;
    const ballHeight = preview ? 8 + Math.abs(Math.sin(idle * 1.2)) * 20 : state.ball.z;
    ball.position.set(ballX, 24 + ballHeight, ballZ);
    ball.rotation.set(state.ball.spin * 0.023, preview ? idle * 0.8 : state.ball.spin * 0.034, state.ball.spin * 0.018);
    const speed = preview ? 180 : Math.hypot(state.ball.vx, state.ball.vy);
    const squash = Math.min(0.09, speed / 4500);
    ball.scale.set(1 + squash * 0.14, 1 - squash, 1 + squash * 0.14);
    updateParticles(state);

    const scoreKey = `${state.scores.blue}-${state.scores.orange}`;
    if (scoreKey !== lastScoreKey) {
      lastScoreKey = scoreKey;
      screenShake = 1;
    }
    screenShake = Math.max(0, screenShake - delta * 1.5);
    const targetX = THREE.MathUtils.clamp(ballX * 0.045, -44, 44);
    const targetZ = THREE.MathUtils.clamp(ballZ * 0.035, -26, 26);
    const shake = state.phase === "goal" ? Math.sin(now * 0.055) * 4.5 : Math.sin(now * 0.09) * screenShake * 1.6;
    cameraDesired.set(targetX + shake, 770, 820 + targetZ + shake * 0.5);
    camera.position.lerp(cameraDesired, 1 - Math.exp(-delta * 1.7));
    cameraLook.set(targetX, 0, targetZ);
    camera.lookAt(cameraLook);

    const goalPulse = state.phase === "goal" ? 1.45 + Math.sin(now * 0.02) * 0.4 : 1;
    arenaObjects.goalLights[0].intensity = 135 * (state.lastGoal?.team === "orange" ? goalPulse : 0.58);
    arenaObjects.goalLights[1].intensity = 135 * (state.lastGoal?.team === "blue" ? goalPulse : 0.58);
    renderer.render(scene, camera);
  }

  ensureCars(initialState);
  return {
    render,
    resize,
    setArena,
    dispose() {
      renderer.dispose();
      disposeGroup(arenaSlot);
      scene.clear();
    },
  };
}
