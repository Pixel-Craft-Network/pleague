import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import carModelUrl from "../models/rocket-racer.obj?url";
import ballModelUrl from "../models/pixel-ball.obj?url";

export const TEAM_PALETTE = {
  blue: { paint: 0x1cc5ec, bright: 0x91f5ff, trim: 0x10243b, light: 0xd5fcff, flame: 0x57eaff },
  orange: { paint: 0xf17b38, bright: 0xffc27b, trim: 0x3b2630, light: 0xfff0cc, flame: 0xff9b4e },
};

const metal = (color, roughness = 0.34, metalness = 0.36) => new THREE.MeshStandardMaterial({ color, roughness, metalness });

function markShadows(root) {
  root.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
  });
}

function makeWheel(team) {
  const colors = TEAM_PALETTE[team];
  const pivot = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 7, 14, 1), metal(0x10151e, 0.88, 0.06));
  tire.rotation.x = Math.PI / 2;
  tire.castShadow = true;
  pivot.add(tire);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(5.7, 5.7, 7.4, 10, 1), metal(0xa6b8c2, 0.28, 0.76));
  rim.rotation.x = Math.PI / 2;
  pivot.add(rim);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 7.8, 8), new THREE.MeshStandardMaterial({
    color: colors.bright,
    emissive: colors.paint,
    emissiveIntensity: 0.28,
    metalness: 0.55,
    roughness: 0.22,
  }));
  hub.rotation.x = Math.PI / 2;
  pivot.add(hub);
  return pivot;
}

function makeFallbackShell(team, number) {
  const palette = TEAM_PALETTE[team];
  const shell = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({
    color: palette.paint,
    metalness: 0.52,
    roughness: 0.27,
    clearcoat: 0.82,
    clearcoatRoughness: 0.2,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: palette.trim,
    metalness: 0.42,
    roughness: 0.14,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
  });
  const accent = new THREE.MeshStandardMaterial({ color: palette.bright, metalness: 0.28, roughness: 0.28, emissive: palette.paint, emissiveIntensity: 0.15 });
  const addBox = (size, position, material, bevel = false) => {
    const geometry = bevel ? new THREE.BoxGeometry(...size, 2, 2, 1) : new THREE.BoxGeometry(...size);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    shell.add(mesh);
    return mesh;
  };
  addBox([58, 12, 34], [0, 11, 0], paint, true);
  addBox([19, 7, 29], [21, 11, 0], paint);
  addBox([25, 13, 22], [-2, 20, 0], glass, true);
  addBox([23, 1.2, 3], [-3, 27, 0], accent);
  addBox([10, 2, 37], [-27, 24, 0], paint);
  addBox([4, 8, 42], [-27, 20, 0], paint);
  addBox([6, 3, 38], [30, 8, 0], metal(0x18202b, 0.48, 0.52));
  const numberPlate = new THREE.Mesh(new THREE.BoxGeometry(7, 0.6, 7), new THREE.MeshStandardMaterial({
    color: number % 2 ? 0xf2fbff : palette.bright,
    metalness: 0.18,
    roughness: 0.36,
  }));
  numberPlate.position.set(-4, 27.3, 0);
  shell.add(numberPlate);
  return shell;
}

export function createCarVisual(team, number = 1) {
  const palette = TEAM_PALETTE[team];
  const root = new THREE.Group();
  const shell = makeFallbackShell(team, number);
  root.add(shell);
  root.userData.shell = shell;
  root.userData.team = team;
  root.userData.wheels = [];
  root.userData.boostMeshes = [];
  root.userData.number = number;
  const racingStripe = new THREE.Mesh(new THREE.BoxGeometry(20, 0.55, 4.2), new THREE.MeshStandardMaterial({ color: palette.bright, metalness: 0.42, roughness: 0.24, emissive: palette.paint, emissiveIntensity: 0.22 }));
  racingStripe.position.set(8, 15.7, 0);
  racingStripe.castShadow = true;
  root.add(racingStripe);
  const roofPlate = new THREE.Mesh(new THREE.BoxGeometry(10, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0xf4f8f2, metalness: 0.18, roughness: 0.42 }));
  roofPlate.position.set(-3, 27.35, 0);
  root.add(roofPlate);
  for (const side of [-1, 1]) {
    const doorTrim = new THREE.Mesh(new THREE.BoxGeometry(21, 1.2, 0.7), metal(0x9bb3bf, 0.34, 0.64));
    doorTrim.position.set(-4, 9, side * 19.2);
    root.add(doorTrim);
  }

  for (const axle of [-1, 1]) {
    for (const side of [-1, 1]) {
      const wheel = makeWheel(team);
      wheel.position.set(axle * 20, 13, side * 17);
      root.add(wheel);
      root.userData.wheels.push(wheel);
    }
  }

  const headlightMaterial = new THREE.MeshStandardMaterial({ color: palette.light, emissive: palette.light, emissiveIntensity: 1.8, roughness: 0.2 });
  const taillightMaterial = new THREE.MeshStandardMaterial({ color: 0xff574d, emissive: 0xf12c24, emissiveIntensity: 1.2, roughness: 0.22 });
  for (const side of [-1, 1]) {
    const headlight = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 7), headlightMaterial);
    headlight.position.set(31, 8, side * 9);
    root.add(headlight);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 6), taillightMaterial);
    tail.position.set(-30, 8, side * 9);
    root.add(tail);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(5.3, 22, 8), new THREE.MeshBasicMaterial({
      color: palette.flame,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
    }));
    flame.rotation.z = Math.PI / 2;
    flame.position.set(-37, 8, side * 7);
    flame.visible = false;
    root.add(flame);
    root.userData.boostMeshes.push(flame);
  }
  const glow = new THREE.PointLight(palette.flame, 0, 85, 2);
  glow.position.set(-29, 10, 0);
  root.add(glow);
  root.userData.boostLight = glow;

  markShadows(root);
  return root;
}

function makeBallFallback() {
  const geometry = new THREE.IcosahedronGeometry(20, 2).toNonIndexed();
  const positions = geometry.getAttribute("position");
  const colors = new Float32Array(positions.count * 3);
  const light = new THREE.Color(0xf4f7f6);
  const dark = new THREE.Color(0x233344);
  for (let face = 0; face < positions.count / 3; face += 1) {
    const panel = face % 9 === 0 || face % 13 === 4;
    const color = panel ? dark : light;
    for (let vertex = 0; vertex < 3; vertex += 1) color.toArray(colors, (face * 3 + vertex) * 3);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.31, metalness: 0.06, flatShading: true }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createBallVisual() {
  const root = new THREE.Group();
  const shell = makeBallFallback();
  root.add(shell);
  root.userData.shell = shell;
  root.userData.isBall = true;
  return root;
}

function cloneCarAsset(template, team) {
  const palette = TEAM_PALETTE[team];
  const paint = new THREE.MeshPhysicalMaterial({ color: palette.paint, metalness: 0.56, roughness: 0.25, clearcoat: 0.9, clearcoatRoughness: 0.15, side: THREE.DoubleSide });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x12283d, metalness: 0.52, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.08, side: THREE.DoubleSide });
  const detail = new THREE.MeshStandardMaterial({ color: palette.bright, metalness: 0.4, roughness: 0.24, emissive: palette.paint, emissiveIntensity: 0.2, side: THREE.DoubleSide });
  const instance = template.clone(true);
  instance.traverse((node) => {
    if (!node.isMesh) return;
    const name = node.name.toLowerCase();
    node.material = name.includes("windshield") || name.includes("glass") ? glass : name.includes("wing") ? detail : paint;
    node.geometry = node.geometry.clone();
    node.geometry.computeVertexNormals();
    node.castShadow = true;
    node.receiveShadow = true;
  });
  return instance;
}

function cloneBallAsset(template) {
  const light = new THREE.MeshStandardMaterial({ color: 0xe9f0ef, roughness: 0.33, metalness: 0.04 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a2b3d, roughness: 0.45, metalness: 0.1 });
  const instance = template.clone(true);
  instance.traverse((node) => {
    if (!node.isMesh) return;
    node.material = node.name.toLowerCase().includes("dark") ? dark : light;
    node.geometry.computeVertexNormals();
    node.castShadow = true;
    node.receiveShadow = true;
  });
  return instance;
}

export function useCarAsset(carVisual, template) {
  const previous = carVisual.userData.shell;
  if (previous) {
    carVisual.remove(previous);
    previous.traverse((node) => {
      if (node.isMesh) {
        node.geometry.dispose();
        if (Array.isArray(node.material)) node.material.forEach((material) => material.dispose());
        else node.material.dispose();
      }
    });
  }
  const shell = cloneCarAsset(template, carVisual.userData.team);
  carVisual.userData.shell = shell;
  carVisual.add(shell);
}

export function useBallAsset(ballVisual, template) {
  const previous = ballVisual.userData.shell;
  if (previous) {
    ballVisual.remove(previous);
    previous.traverse((node) => {
      if (node.isMesh) {
        node.geometry.dispose();
        if (Array.isArray(node.material)) node.material.forEach((material) => material.dispose());
        else node.material.dispose();
      }
    });
  }
  const shell = cloneBallAsset(template);
  ballVisual.userData.shell = shell;
  ballVisual.add(shell);
}

export async function loadModelAssets() {
  const loader = new OBJLoader();
  const [car, ball] = await Promise.all([
    loader.loadAsync(carModelUrl),
    loader.loadAsync(ballModelUrl),
  ]);
  return { car, ball };
}
