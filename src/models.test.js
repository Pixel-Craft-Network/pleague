import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

const loader = new OBJLoader();

async function parseModel(path) {
  return loader.parse(await readFile(new URL(path, import.meta.url), "utf8"));
}

test("racer OBJ has separate paint, glass, and aero meshes", async () => {
  const model = await parseModel("../models/rocket-racer.obj");
  const meshes = [];
  model.traverse((node) => { if (node.isMesh) meshes.push(node); });
  const names = new Set(meshes.map((mesh) => mesh.name));
  for (const name of ["chassis", "cabin", "windshield", "side-glass-left", "side-glass-right", "rear-wing"]) {
    assert.ok(names.has(name), `missing ${name} mesh`);
  }
  for (const mesh of meshes) {
    const positions = mesh.geometry.getAttribute("position");
    assert.ok(positions && positions.count >= 3);
    mesh.geometry.computeVertexNormals();
    const normals = mesh.geometry.getAttribute("normal");
    assert.ok(Array.from(normals.array).every(Number.isFinite));
  }
});

test("ball OBJ contains bright and dark panel geometry", async () => {
  const model = await parseModel("../models/pixel-ball.obj");
  const meshes = [];
  model.traverse((node) => { if (node.isMesh) meshes.push(node); });
  const names = new Set(meshes.map((mesh) => mesh.name));
  assert.ok(names.has("bright_panels"));
  assert.ok(names.has("dark_panels"));
  assert.ok(meshes.every((mesh) => mesh.geometry.getAttribute("position").count > 90));
});
