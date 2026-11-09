export const ARENA = Object.freeze({
  halfWidth: 570,
  halfHeight: 305,
  goalDepth: 120,
  goalHalfHeight: 110,
  ballRadius: 20,
  carRadius: 27,
});

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
const wrapAngle = (angle) => {
  while (angle > Math.PI) angle -= TAU;
  while (angle < -Math.PI) angle += TAU;
  return angle;
};

function makeCar(id, team, player, x, y, slot) {
  const direction = team === "blue" ? 1 : -1;
  return {
    id,
    team,
    player,
    slot,
    x,
    y,
    vx: 0,
    vy: 0,
    angle: direction > 0 ? 0 : Math.PI,
    z: 0,
    vz: 0,
    boost: slot === 0 ? 33 : 45,
    speedLimit: 790,
    flipAvailable: false,
    airTime: 0,
    dodgeTimer: 0,
    dodgeSign: 1,
    wheelSpin: 0,
    aiJumpHeld: false,
    lastHitAt: -10,
    get direction() { return this.team === "blue" ? 1 : -1; },
  };
}

function makePads() {
  const pads = [];
  for (const x of [-390, -195, 0, 195, 390]) {
    for (const y of [-220, 220]) {
      if (x === 0) continue;
      pads.push({ x, y, big: false, amount: 12, cooldown: 0, phase: Math.random() * TAU });
    }
  }
  for (const x of [-495, 495]) {
    for (const y of [-245, 245]) {
      pads.push({ x, y, big: true, amount: 100, cooldown: 0, phase: Math.random() * TAU });
    }
  }
  return pads;
}

export function createMatch(settings = {}) {
  const mode = settings.mode === "2v2" ? "2v2" : "1v1";
  const userTeam = settings.team === "orange" ? "orange" : "blue";
  const duration = Number(settings.duration) === 90 ? 90 : 180;
  const difficulty = ["rookie", "pro", "ace"].includes(settings.difficulty) ? settings.difficulty : "pro";
  const arena = ["neon", "sunset", "frost"].includes(settings.arena) ? settings.arena : "neon";
  const cars = [
    makeCar("blue-0", "blue", userTeam === "blue", -390, 0, 0),
    makeCar("orange-0", "orange", userTeam === "orange", 390, 0, 0),
  ];
  if (mode === "2v2") {
    cars.push(makeCar("blue-1", "blue", false, -300, -160, 1));
    cars.push(makeCar("orange-1", "orange", false, 300, 160, 1));
  }

  return {
    settings: { mode, team: userTeam, duration, difficulty, arena },
    cars,
    ball: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, spin: 0, trailClock: 0 },
    pads: makePads(),
    particles: [],
    scores: { blue: 0, orange: 0 },
    timeLeft: duration,
    elapsed: 0,
    overtime: false,
    phase: "kickoff",
    countdown: 3.0,
    phaseTime: 0,
    lastTouch: null,
    lastGoal: null,
    endAfterGoal: false,
    seed: Math.random() * 1000,
  };
}

function spawnParticle(state, particle) {
  state.particles.push({ ...particle, maxLife: particle.life });
}

function burst(state, x, y, z, count = 18, palette = ["#6df4ff", "#fff3b0", "#ff9f53"]) {
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * TAU + Math.random() * 0.22;
    const speed = 90 + Math.random() * 370;
    const life = 0.35 + Math.random() * 0.8;
    spawnParticle(state, {
      x, y, z,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      vz: 65 + Math.random() * 260,
      size: 3 + Math.random() * 6,
      life,
      color: palette[(Math.random() * palette.length) | 0],
      square: Math.random() > 0.45,
    });
  }
}

function updateParticles(state, dt) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const p = state.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      state.particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.vx *= Math.exp(-1.25 * dt);
    p.vy *= Math.exp(-1.25 * dt);
    p.vz -= 430 * dt;
    if (p.z < 0) {
      p.z = 0;
      p.vz = Math.abs(p.vz) * 0.25;
    }
  }
}

function aiInput(car, state, dt) {
  const ball = state.ball;
  const mates = state.cars.filter((other) => other.team === car.team);
  const ownDistance = distance(car.x, car.y, ball.x, ball.y);
  const closestMateDistance = Math.min(...mates.filter((mate) => mate !== car)
    .map((mate) => distance(mate.x, mate.y, ball.x, ball.y)), Infinity);
  const chases = ownDistance <= closestMateDistance + (car.slot ? 32 : 90);
  const direction = car.direction;
  const time = state.elapsed + car.slot * 1.73 + (car.team === "orange" ? 2.2 : 0);
  let targetX;
  let targetY;

  if (chases) {
    const lead = state.settings.difficulty === "rookie" ? 0.10 : 0.22;
    targetX = ball.x + ball.vx * lead - direction * 36;
    targetY = ball.y + ball.vy * lead * 0.7;
    if (ball.z > 90) {
      targetX += ball.vx * 0.12;
      targetY += ball.vy * 0.12;
    }
  } else {
    targetX = -direction * 220 + clamp(ball.x * 0.34, -110, 110);
    targetY = clamp(ball.y * 0.78 + (car.slot ? 65 : -65), -205, 205);
  }

  targetX = clamp(targetX, -ARENA.halfWidth + 55, ARENA.halfWidth - 55);
  targetY = clamp(targetY, -ARENA.halfHeight + 45, ARENA.halfHeight - 45);
  const dx = targetX - car.x;
  const dy = targetY - car.y;
  const targetDistance = Math.hypot(dx, dy);
  const aim = Math.atan2(dy, dx);
  const wobble = state.settings.difficulty === "rookie" ? 0.22 : state.settings.difficulty === "ace" ? 0.025 : 0.075;
  const error = Math.sin(time * 1.6) * wobble;
  const angleError = wrapAngle(aim + error - car.angle);
  const steer = clamp(angleError * 1.75, -1, 1);
  let throttle = targetDistance < 35 ? 0.2 : 1;
  if (Math.abs(angleError) > 2.45 && targetDistance < 220) throttle = -0.45;

  const useBoost = car.boost > 5 && targetDistance > 230 && Math.abs(angleError) < 0.48
    && (state.settings.difficulty !== "rookie" || targetDistance > 440);
  const shouldJump = chases && ownDistance < (state.settings.difficulty === "ace" ? 110 : 82)
    && ball.z > 35 && car.z < 35 && !car.aiJumpHeld;
  const jumpPressed = shouldJump;
  car.aiJumpHeld = chases && ownDistance < 82 && ball.z > 35;

  // The less experienced bot takes a moment to commit and conserves more boost.
  if (state.settings.difficulty === "rookie" && Math.sin(time * 2.7) > 0.84) throttle *= 0.35;
  if (state.settings.difficulty === "ace" && ownDistance < 115 && ball.z < 85 && car.z < 1) {
    if (Math.abs(angleError) < 0.32) throttle = 1;
  }
  return { throttle, steer, boost: useBoost, jumpPressed };
}

function updateCar(car, input, state, dt) {
  const steering = clamp(input.steer ?? 0, -1, 1);
  const jumpPressed = Boolean(input.jumpPressed);
  const forwardX = Math.cos(car.angle);
  const forwardY = Math.sin(car.angle);
  const rightX = -forwardY;
  const rightY = forwardX;
  const speed = Math.hypot(car.vx, car.vy);
  let grounded = car.z <= 0.01;
  const airSteer = grounded ? 1 : 0.68;
  const turnFactor = 0.29 + 0.71 / (1 + speed / 420);
  car.angle += steering * 2.75 * turnFactor * airSteer * dt;

  if (jumpPressed) {
    if (grounded) {
      car.z = 0.5;
      car.vz = 455;
      car.flipAvailable = true;
      car.airTime = 0;
      car.dodgeTimer = 0;
      grounded = false;
    } else if (car.flipAvailable && car.airTime < 1.15) {
      const dodgeX = forwardX + rightX * steering * 0.65;
      const dodgeY = forwardY + rightY * steering * 0.65;
      const magnitude = Math.hypot(dodgeX, dodgeY) || 1;
      car.vx += (dodgeX / magnitude) * 510;
      car.vy += (dodgeY / magnitude) * 510;
      car.vz += 210;
      car.dodgeTimer = 0.30;
      car.dodgeSign = steering < 0 ? -1 : 1;
      car.flipAvailable = false;
      burst(state, car.x - forwardX * 20, car.y - forwardY * 20, car.z, 5, ["#ffffff", "#8feeff", "#ffcc74"]);
    }
  }

  if (!grounded) {
    car.airTime += dt;
    car.z += car.vz * dt;
    car.vz -= 940 * dt;
    car.dodgeTimer = Math.max(0, car.dodgeTimer - dt);
    if (car.z <= 0) {
      car.z = 0;
      car.vz = 0;
      car.flipAvailable = false;
      car.airTime = 0;
    }
  } else {
    car.z = 0;
    car.vz = 0;
    car.airTime = 0;
  }

  const traction = grounded ? 7.5 : 1.05;
  const sideSpeed = car.vx * rightX + car.vy * rightY;
  car.vx -= rightX * sideSpeed * Math.min(1, traction * dt);
  car.vy -= rightY * sideSpeed * Math.min(1, traction * dt);
  const drag = grounded ? 0.22 : 0.035;
  car.vx *= Math.exp(-drag * dt);
  car.vy *= Math.exp(-drag * dt);

  const throttle = clamp(input.throttle || 0, -1, 1);
  const acceleration = throttle < 0 ? 1050 : 1420;
  car.vx += forwardX * throttle * acceleration * dt;
  car.vy += forwardY * throttle * acceleration * dt;

  const boosting = Boolean(input.boost) && car.boost > 0.05;
  car.isBoosting = boosting;
  car.speedLimit = boosting ? 1030 : Math.max(790, car.speedLimit - 520 * dt);
  if (boosting) {
    car.vx += forwardX * 2350 * dt;
    car.vy += forwardY * 2350 * dt;
    car.boost = Math.max(0, car.boost - 34 * dt);
    if (Math.random() < 0.85) {
      const teamColor = car.team === "blue" ? "#66efff" : "#ffab68";
      spawnParticle(state, {
        x: car.x - forwardX * 30 + (Math.random() - 0.5) * 12,
        y: car.y - forwardY * 30 + (Math.random() - 0.5) * 12,
        z: car.z + 8,
        vx: -forwardX * (100 + Math.random() * 150) + car.vx * 0.12,
        vy: -forwardY * (100 + Math.random() * 150) + car.vy * 0.12,
        vz: Math.random() * 45,
        size: 4 + Math.random() * 4,
        life: 0.18 + Math.random() * 0.17,
        color: teamColor,
        square: true,
      });
    }
  }

  const currentSpeed = Math.hypot(car.vx, car.vy);
  if (currentSpeed > car.speedLimit) {
    const ratio = car.speedLimit / currentSpeed;
    car.vx *= ratio;
    car.vy *= ratio;
  }
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  car.wheelSpin += (currentSpeed / 24) * dt;
  containCar(car, state);
  collectPads(car, state);
}

function containCar(car, state) {
  const { halfWidth, halfHeight, goalHalfHeight, goalDepth } = ARENA;
  const inGoalLane = Math.abs(car.y) < goalHalfHeight - 8;
  const limitX = inGoalLane ? halfWidth + goalDepth - 18 : halfWidth - 17;
  if (car.x > limitX) {
    car.x = limitX;
    if (car.vx > 0) car.vx *= -0.38;
  } else if (car.x < -limitX) {
    car.x = -limitX;
    if (car.vx < 0) car.vx *= -0.38;
  }
  const limitY = halfHeight - 17;
  if (car.y > limitY) {
    car.y = limitY;
    if (car.vy > 0) car.vy *= -0.38;
  } else if (car.y < -limitY) {
    car.y = -limitY;
    if (car.vy < 0) car.vy *= -0.38;
  }
}

function collectPads(car, state) {
  for (const pad of state.pads) {
    if (pad.cooldown > 0 || car.boost > (pad.big ? 98 : 89)) continue;
    if (distance(car.x, car.y, pad.x, pad.y) < (pad.big ? 35 : 26)) {
      car.boost = Math.min(100, car.boost + pad.amount);
      pad.cooldown = pad.big ? 10 : 4;
      burst(state, pad.x, pad.y, 0, pad.big ? 12 : 5, pad.big
        ? ["#fff2a4", "#ffb54d", "#ffffff"]
        : ["#74f4ff", "#d9ffff"]);
    }
  }
}

function collideCars(state) {
  const cars = state.cars;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      if (Math.abs(a.z - b.z) > 48) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.001;
      const min = 43;
      if (d >= min) continue;
      const nx = dx / d;
      const ny = dy / d;
      const overlap = min - d;
      a.x -= nx * overlap * 0.5;
      a.y -= ny * overlap * 0.5;
      b.x += nx * overlap * 0.5;
      b.y += ny * overlap * 0.5;
      const relative = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (relative < 0) {
        const impulse = -(1 + 0.48) * relative * 0.5;
        a.vx -= impulse * nx;
        a.vy -= impulse * ny;
        b.vx += impulse * nx;
        b.vy += impulse * ny;
      }
    }
  }
}

function collideBallWithCars(state) {
  const ball = state.ball;
  for (const car of state.cars) {
    if (Math.abs((car.z + 13) - ball.z) > 50) continue;
    const dx = ball.x - car.x;
    const dy = ball.y - car.y;
    const d = Math.hypot(dx, dy) || 0.001;
    const contact = ARENA.carRadius + ARENA.ballRadius;
    if (d >= contact) continue;
    const nx = dx / d;
    const ny = dy / d;
    const overlap = contact - d;
    ball.x += nx * (overlap + 0.5);
    ball.y += ny * (overlap + 0.5);
    const relative = (car.vx - ball.vx) * nx + (car.vy - ball.vy) * ny;
    if (relative > 0 || overlap > 5) {
      const hitStrength = 170 + clamp(relative, 0, 1000) * 0.72;
      ball.vx += nx * hitStrength + car.vx * 0.10;
      ball.vy += ny * hitStrength + car.vy * 0.10;
      if (car.z > 28 || car.vz > 80) {
        ball.vz = Math.max(ball.vz, 125) + Math.max(0, car.vz) * 0.48 + car.z * 0.30;
      } else {
        ball.vz = Math.max(ball.vz, 105 + Math.max(0, relative) * 0.12);
      }
      const ballSpeed = Math.hypot(ball.vx, ball.vy);
      if (ballSpeed > 1350) {
        ball.vx *= 1350 / ballSpeed;
        ball.vy *= 1350 / ballSpeed;
      }
      state.lastTouch = { team: car.team, car: car.id, time: state.elapsed };
      if (state.elapsed - car.lastHitAt > 0.22) {
        burst(state, ball.x, ball.y, ball.z, 5, car.team === "blue"
          ? ["#b9f9ff", "#50cfff"] : ["#ffe1be", "#ff914f"]);
        car.lastHitAt = state.elapsed;
      }
    }
  }
}

function stepBall(state, dt) {
  const ball = state.ball;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  ball.z += ball.vz * dt;
  ball.spin += Math.hypot(ball.vx, ball.vy) * dt * 0.025;
  ball.vx *= Math.exp(-0.20 * dt);
  ball.vy *= Math.exp(-0.20 * dt);
  ball.vz -= 770 * dt;
  if (ball.z < 0) {
    ball.z = 0;
    if (ball.vz < 0) {
      ball.vz = -ball.vz * 0.57;
      if (ball.vz < 58) ball.vz = 0;
      ball.vx *= 0.91;
      ball.vy *= 0.91;
    }
  }
  ball.z = Math.min(ball.z, 260);

  const sideLimit = ARENA.halfHeight - ARENA.ballRadius;
  if (ball.y > sideLimit) {
    ball.y = sideLimit;
    ball.vy = -Math.abs(ball.vy) * 0.82;
  } else if (ball.y < -sideLimit) {
    ball.y = -sideLimit;
    ball.vy = Math.abs(ball.vy) * 0.82;
  }

  const mouth = Math.abs(ball.y) < ARENA.goalHalfHeight - ARENA.ballRadius * 0.35;
  const rightEdge = ARENA.halfWidth + ARENA.goalDepth - ARENA.ballRadius;
  if (ball.x > ARENA.halfWidth - ARENA.ballRadius && !mouth) {
    ball.x = ARENA.halfWidth - ARENA.ballRadius;
    ball.vx = -Math.abs(ball.vx) * 0.82;
  } else if (ball.x < -ARENA.halfWidth + ARENA.ballRadius && !mouth) {
    ball.x = -ARENA.halfWidth + ARENA.ballRadius;
    ball.vx = Math.abs(ball.vx) * 0.82;
  }

  // The mouth is a tunnel with two side walls and a net at the back.
  if (mouth && Math.abs(ball.x) > ARENA.halfWidth) {
    if (ball.x > rightEdge) {
      scoreGoal(state, "blue");
      return;
    }
    if (ball.x < -rightEdge) {
      scoreGoal(state, "orange");
      return;
    }
    if (Math.abs(ball.y) > ARENA.goalHalfHeight - ARENA.ballRadius) {
      ball.y = Math.sign(ball.y) * (ARENA.goalHalfHeight - ARENA.ballRadius);
      ball.vy *= -0.76;
    }
  }

  ball.trailClock -= dt;
  if (Math.hypot(ball.vx, ball.vy) > 430 && ball.trailClock <= 0) {
    ball.trailClock = 0.035;
    spawnParticle(state, {
      x: ball.x, y: ball.y, z: ball.z,
      vx: -ball.vx * 0.035 + (Math.random() - 0.5) * 20,
      vy: -ball.vy * 0.035 + (Math.random() - 0.5) * 20,
      vz: 0,
      size: 7 + Math.random() * 7,
      life: 0.2,
      color: "#efffff",
      square: false,
    });
  }
}

function scoreGoal(state, team) {
  state.scores[team] += 1;
  state.lastGoal = { team, scorer: state.lastTouch?.team === team ? state.lastTouch.car : null };
  state.phase = "goal";
  state.phaseTime = 2.65;
  state.endAfterGoal = state.overtime;
  const palette = team === "blue"
    ? ["#6ceaff", "#a7f7ff", "#fff5b8", "#ffffff"]
    : ["#ff9856", "#ffcb78", "#fff5b8", "#ffffff"];
  burst(state, team === "blue" ? ARENA.halfWidth + 40 : -ARENA.halfWidth - 40, 0, 40, 90, palette);
  state.ball.vx = 0;
  state.ball.vy = 0;
  state.ball.vz = 0;
}

function resetForKickoff(state) {
  state.ball = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, spin: 0, trailClock: 0 };
  state.cars.forEach((car) => {
    const dir = car.direction;
    if (car.slot === 0) {
      car.x = -dir * 390;
      car.y = 0;
    } else {
      car.x = -dir * 300;
      car.y = car.team === "blue" ? -160 : 160;
    }
    car.vx = 0;
    car.vy = 0;
    car.angle = dir > 0 ? 0 : Math.PI;
    car.z = 0;
    car.vz = 0;
    car.boost = 33;
    car.speedLimit = 790;
    car.flipAvailable = false;
    car.airTime = 0;
    car.dodgeTimer = 0;
    car.aiJumpHeld = false;
  });
  state.phase = "kickoff";
  state.countdown = 3.0;
  state.lastTouch = null;
}

export function stepMatch(state, playerInput = {}, dt = 1 / 60) {
  const step = clamp(dt, 0, 1 / 20);
  if (step <= 0) return state;
  state.elapsed += step;
  updateParticles(state, step);
  for (const pad of state.pads) {
    if (pad.cooldown > 0) pad.cooldown = Math.max(0, pad.cooldown - step);
  }

  if (state.phase === "finished") return state;
  if (state.phase === "kickoff") {
    state.countdown -= step;
    if (state.countdown <= 0) state.phase = "live";
    return state;
  }
  if (state.phase === "goal") {
    state.phaseTime -= step;
    if (state.phaseTime <= 0) {
      if (state.endAfterGoal) {
        state.phase = "finished";
      } else {
        resetForKickoff(state);
      }
    }
    return state;
  }

  if (state.phase !== "live") return state;
  if (!state.overtime) {
    state.timeLeft = Math.max(0, state.timeLeft - step);
    if (state.timeLeft <= 0) {
      if (state.scores.blue === state.scores.orange) {
        state.overtime = true;
      } else {
        state.phase = "finished";
        return state;
      }
    }
  }

  for (const car of state.cars) {
    const input = car.player ? playerInput : aiInput(car, state, step);
    updateCar(car, input, state, step);
  }
  collideCars(state);
  collideBallWithCars(state);
  stepBall(state, step);
  return state;
}

export function getMatchResult(state) {
  if (state.scores.blue === state.scores.orange) return "draw";
  return state.scores.blue > state.scores.orange ? "blue" : "orange";
}

export function formatClock(seconds) {
  const total = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export { clamp, wrapAngle };
