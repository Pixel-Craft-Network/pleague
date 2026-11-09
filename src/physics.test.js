import test from "node:test";
import assert from "node:assert/strict";
import { ARENA, createMatch, formatClock, getMatchResult, stepMatch } from "./physics.js";

const FIXED = 1 / 60;
function advance(state, seconds, input = {}) {
  const count = Math.ceil(seconds / FIXED);
  for (let i = 0; i < count; i += 1) stepMatch(state, input, FIXED);
}
function reachLive(state) {
  advance(state, 3.15);
  assert.equal(state.phase, "live");
}

test("match setup creates the selected sides, format, and kickoff", () => {
  const one = createMatch({ mode: "1v1", team: "orange", duration: 90 });
  assert.equal(one.phase, "kickoff");
  assert.equal(one.cars.length, 2);
  assert.equal(one.cars.find((car) => car.player).team, "orange");
  assert.equal(one.timeLeft, 90);

  const doubles = createMatch({ mode: "2v2", team: "blue" });
  assert.equal(doubles.cars.length, 4);
  assert.equal(doubles.cars.filter((car) => car.team === "blue").length, 2);
});

test("kickoff transitions into a live match and the clock then counts down", () => {
  const state = createMatch({ duration: 90 });
  reachLive(state);
  assert.equal(state.phase, "live");
  const startingTime = state.timeLeft;
  advance(state, 1.0);
  assert.ok(state.timeLeft < startingTime);
  assert.ok(state.timeLeft > startingTime - 1.1);
});

test("a jump can be followed by one aerial dodge", () => {
  const state = createMatch();
  reachLive(state);
  const player = state.cars.find((car) => car.player);
  stepMatch(state, { jumpPressed: true }, FIXED);
  assert.ok(player.z > 0);
  assert.ok(player.vz > 0);
  assert.equal(player.flipAvailable, true);

  stepMatch(state, { jumpPressed: true }, FIXED);
  assert.equal(player.flipAvailable, false);
  assert.ok(player.vx > 300, "a forward dodge should add horizontal speed");
});

test("boost is consumed while held", () => {
  const state = createMatch();
  reachLive(state);
  const player = state.cars.find((car) => car.player);
  const startingBoost = player.boost;
  const startingX = player.x;
  advance(state, 0.5, { throttle: 1, boost: true });
  assert.ok(player.boost < startingBoost);
  assert.ok(player.isBoosting);
  assert.notEqual(player.x, startingX);
});

test("a ball fully crossing the right goal awards Sky", () => {
  const state = createMatch();
  reachLive(state);
  state.ball.x = ARENA.halfWidth + ARENA.goalDepth - ARENA.ballRadius - 2;
  state.ball.y = 0;
  state.ball.vx = 500;
  stepMatch(state, {}, FIXED);
  assert.equal(state.scores.blue, 1);
  assert.equal(state.phase, "goal");
  assert.equal(state.lastGoal.team, "blue");
});

test("a match ends on the clock when one team is ahead", () => {
  const state = createMatch();
  state.phase = "live";
  state.timeLeft = 0.001;
  state.scores.blue = 2;
  state.scores.orange = 1;
  stepMatch(state, {}, FIXED);
  assert.equal(state.phase, "finished");
  assert.equal(getMatchResult(state), "blue");
});

test("a tied match goes to golden goal and finishes after the overtime score", () => {
  const state = createMatch();
  state.phase = "live";
  state.timeLeft = 0.001;
  stepMatch(state, {}, FIXED);
  assert.equal(state.overtime, true);
  assert.equal(state.phase, "live");

  state.ball.x = ARENA.halfWidth + ARENA.goalDepth - ARENA.ballRadius - 2;
  state.ball.y = 0;
  state.ball.vx = 500;
  stepMatch(state, {}, FIXED);
  assert.equal(state.phase, "goal");
  assert.equal(state.endAfterGoal, true);
  advance(state, 2.8);
  assert.equal(state.phase, "finished");
  assert.equal(getMatchResult(state), "blue");
});

test("boost pad respawn timers advance once per simulation step", () => {
  const state = createMatch({ mode: "2v2" });
  state.phase = "live";
  state.pads[0].cooldown = 1;
  stepMatch(state, {}, FIXED);
  assert.ok(Math.abs(state.pads[0].cooldown - (1 - FIXED)) < 1e-8);
});

test("a doubles simulation stays numerically stable under live input", () => {
  const state = createMatch({ mode: "2v2", difficulty: "ace", duration: 90 });
  for (let tick = 0; tick < 3600; tick += 1) {
    stepMatch(state, {
      throttle: tick % 420 < 300 ? 1 : -0.2,
      steer: Math.sin(tick / 70),
      boost: tick % 180 < 55,
      jumpPressed: tick % 125 === 0,
    }, FIXED);
  }
  const values = [
    state.ball.x, state.ball.y, state.ball.z, state.ball.vx, state.ball.vy, state.ball.vz,
    ...state.cars.flatMap((car) => [car.x, car.y, car.vx, car.vy, car.angle, car.z, car.boost]),
  ];
  assert.ok(values.every(Number.isFinite));
});

test("clock formatting is stable at minute boundaries", () => {
  assert.equal(formatClock(180), "3:00");
  assert.equal(formatClock(59.1), "1:00");
  assert.equal(formatClock(0), "0:00");
});
