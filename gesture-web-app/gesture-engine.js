const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

function palmCenter(landmarks) {
  const ids = [0, 5, 9, 13, 17];
  return ids.reduce((point, id) => ({
    x: point.x + landmarks[id].x / ids.length,
    y: point.y + landmarks[id].y / ids.length,
    z: point.z + (landmarks[id].z || 0) / ids.length,
  }), { x: 0, y: 0, z: 0 });
}

/**
 * Converts MediaPipe landmarks into stable, screen-aligned interaction metrics.
 * The camera is mirrored in CSS, so x is mirrored here as well.
 */
export class GestureEngine {
  constructor() {
    this.previous = [];
    this.previousTime = 0;
    this.sweep = null;
    this.pressArmed = false;
    this.pressArmedAt = 0;
    this.pressBaseline = 0;
    this.cooldownUntil = 0;
    this.viewport = { sourceWidth: 1280, sourceHeight: 720, width: 1280, height: 720 };
  }

  setViewport(sourceWidth, sourceHeight, width, height) {
    this.viewport = { sourceWidth, sourceHeight, width, height };
  }

  reset() {
    this.previous = [];
    this.previousTime = 0;
    this.sweep = null;
    this.pressArmed = false;
    this.pressArmedAt = 0;
    this.cooldownUntil = 0;
  }

  toScreen(point) {
    const { sourceWidth, sourceHeight, width, height } = this.viewport;
    const scale = Math.max(width / sourceWidth, height / sourceHeight);
    const drawnWidth = sourceWidth * scale;
    const drawnHeight = sourceHeight * scale;
    const cropX = (drawnWidth - width) / 2;
    const cropY = (drawnHeight - height) / 2;
    const visibleX = (point.x * drawnWidth - cropX) / width;
    const visibleY = (point.y * drawnHeight - cropY) / height;
    return { x: 1 - visibleX, y: visibleY, z: point.z || 0 };
  }

  update(landmarksList, timestamp) {
    const dt = this.previousTime ? clamp((timestamp - this.previousTime) / 1000, .008, .1) : 1 / 60;
    this.previousTime = timestamp;

    const landmarkSets = landmarksList.map((set) => set.map((point) => this.toScreen(point)));
    const palms = landmarkSets
      .map((set) => palmCenter(set))
      .sort((a, b) => a.x - b.x)
      .map((palm, index) => {
        const old = this.previous[index] || palm;
        const vx = (palm.x - old.x) / dt;
        const vy = (palm.y - old.y) / dt;
        return { ...palm, vx, vy, speed: Math.hypot(vx, vy) };
      });

    this.previous = palms.map(({ x, y, z }) => ({ x, y, z }));
    const events = [];

    if (palms.length >= 2) {
      this.detectSweepAndPress(palms, timestamp, events);
    } else {
      this.sweep = null;
      this.pressArmed = false;
    }

    const left = palms[0];
    const right = palms[1];
    const distance = left && right ? Math.hypot(right.x - left.x, right.y - left.y) : 0;
    const averageY = left && right ? (left.y + right.y) / 2 : .58;
    const centerX = left && right ? (left.x + right.x) / 2 : .5;
    const heightDifference = left && right ? left.y - right.y : 0;
    const motion = left && right ? (left.speed + right.speed) / 2 : 0;

    return {
      hands: palms,
      landmarks: landmarkSets,
      handCount: palms.length,
      distance,
      averageY,
      centerX,
      heightDifference,
      motion,
      events,
      dt,
    };
  }

  detectSweepAndPress(hands, timestamp, events) {
    const [left, right] = hands;
    const candidates = [left, right]
      .map((hand, index) => ({ ...hand, handIndex: index }))
      .sort((a, b) => b.speed - a.speed);
    const mover = candidates[0];
    const anchor = candidates[1];

    if (!this.pressArmed && timestamp > this.cooldownUntil) {
      const isHorizontal = Math.abs(mover.vx) > .24 && Math.abs(mover.vx) > Math.abs(mover.vy) * 1.35;
      const anchorIsQuiet = anchor.speed < .48;

      if (isHorizontal && anchorIsQuiet) {
        const direction = Math.sign(mover.vx);
        if (!this.sweep || this.sweep.direction !== direction || this.sweep.handIndex !== mover.handIndex) {
          this.sweep = { handIndex: mover.handIndex, direction, distance: 0, lastX: mover.x, startedAt: timestamp };
        }
        this.sweep.distance += Math.abs(mover.x - this.sweep.lastX);
        this.sweep.lastX = mover.x;

        if (this.sweep.distance > .16 && timestamp - this.sweep.startedAt > 180) {
          events.push('sweep');
          this.pressArmed = true;
          this.pressArmedAt = timestamp;
          this.pressBaseline = (left.y + right.y) / 2;
          this.sweep = null;
        }
      }
    }

    if (this.pressArmed) {
      const averageY = (left.y + right.y) / 2;
      const movedDown = averageY - this.pressBaseline;
      const downwardIntent = left.vy > -.08 && right.vy > -.08;
      if (movedDown > .052 && downwardIntent) {
        events.push('press');
        this.pressArmed = false;
        this.cooldownUntil = timestamp + 720;
      } else if (movedDown < -.07 || timestamp - this.pressArmedAt > 3600) {
        this.pressArmed = false;
      }
    }
  }
}
