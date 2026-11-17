const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const mix = (a, b, t) => a + (b - a) * t;
const ease = (t) => 1 - Math.pow(1 - clamp(t), 3);

export class TentRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.flash = 0;
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  pulse() { this.flash = 1; }
  clear() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.flash = 0;
  }
  point(normalized) { return { x: normalized.x * this.width, y: normalized.y * this.height }; }

  render(state, input, time) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    this.drawAtmosphere(state, time);

    if (state.id === 'weave') {
      this.drawWeaving(state, input, time);
    } else if (!['reveal', 'landscape'].includes(state.id)) {
      this.drawShelter(state, input, time);
    }

    this.drawHandSkeleton(input);
    if (this.flash > .01) {
      ctx.save();
      ctx.globalAlpha = this.flash * .15;
      ctx.fillStyle = '#f3efd9';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.restore();
      this.flash *= .9;
    }
  }

  drawAtmosphere(state, time) {
    const ctx = this.ctx;
    const active = state.id !== 'weave' ? .12 : .04;
    const gradient = ctx.createRadialGradient(
      this.width * .5, this.height * .48, this.width * .04,
      this.width * .5, this.height * .48, this.width * .68,
    );
    gradient.addColorStop(0, `rgba(221, 225, 191, ${active})`);
    gradient.addColorStop(1, 'rgba(4, 7, 3, .2)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);

    if (state.id === 'focus' || state.id === 'dissolve') {
      const glow = ctx.createRadialGradient(
        this.width * .5, this.height * .62, 0,
        this.width * .5, this.height * .62, this.width * .27,
      );
        const focusProgress = state.id === 'dissolve' ? 1 : state.progress;
        glow.addColorStop(0, `rgba(213, 158, 77, ${focusProgress * .13})`);
      glow.addColorStop(1, 'rgba(213, 158, 77, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  getHands(input) {
    if (input.hands?.length >= 2) return input.hands.slice(0, 2).map((hand) => this.point(hand));
    return [
      { x: this.width * .31, y: this.height * .55 },
      { x: this.width * .69, y: this.height * .55 },
    ];
  }

  drawWeaving(state, input, time) {
    const ctx = this.ctx;
    const [left, right] = this.getHands(input);
    const width = clamp(right.x - left.x, this.width * .18, this.width * .62);
    const cx = (left.x + right.x) / 2;
    const cy = clamp((left.y + right.y) / 2, this.height * .34, this.height * .7);
    const top = cy - Math.min(this.height * .24, width * .36);
    const bottom = cy + Math.min(this.height * .23, width * .33);
    const edgeLeft = cx - width / 2;
    const edgeRight = cx + width / 2;
    const warpCount = Math.max(24, Math.floor(width / 10));

    ctx.save();
    ctx.lineCap = 'round';

    // Loom-like upper and lower anchor lines.
    ctx.strokeStyle = 'rgba(202, 187, 154, .34)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(edgeLeft - 18, top);
    ctx.lineTo(edgeRight + 18, top);
    ctx.moveTo(edgeLeft - 13, bottom);
    ctx.lineTo(edgeRight + 13, bottom);
    ctx.stroke();

    // Uneven yak-hair warp threads.
    for (let i = 0; i <= warpCount; i++) {
      const p = i / warpCount;
      const x = mix(edgeLeft, edgeRight, p);
      const lift = state.sweepReady && i % 2 === 0 ? -8 : state.sweepReady ? 6 : 0;
      const drift = Math.sin(i * 1.91 + time * .0007) * 2.4;
      ctx.strokeStyle = i % 5 === 0 ? 'rgba(28, 23, 20, .96)' : 'rgba(45, 39, 33, .86)';
      ctx.lineWidth = .65 + ((i * 7) % 5) * .12;
      ctx.beginPath();
      ctx.moveTo(x + drift * .25, top + lift);
      ctx.bezierCurveTo(x - drift, mix(top, bottom, .35), x + drift, mix(top, bottom, .68), x - drift * .2, bottom);
      ctx.stroke();
    }

    // Completed bands: several imperfect strands form each weft row.
    const colors = ['#9c493f', '#253f51', '#bd8735'];
    for (let row = 0; row < state.weaveRows; row++) {
      const y = bottom - 24 - row * 21;
      for (let strand = 0; strand < 5; strand++) {
        ctx.strokeStyle = colors[row % colors.length] + (strand === 2 ? 'f0' : 'b5');
        ctx.lineWidth = 1 + (strand % 2) * .45;
        ctx.beginPath();
        for (let i = 0; i <= 18; i++) {
          const p = i / 18;
          const x = mix(edgeLeft, edgeRight, p);
          const wave = Math.sin(i * 1.8 + row * 3) * 1.5 + strand * 1.2;
          if (i === 0) ctx.moveTo(x, y + wave);
          else ctx.lineTo(x, y + wave);
        }
        ctx.stroke();
      }
    }

    // A moving weft line previews the user's horizontal sweep.
    if (state.sweepReady) {
      const y = bottom - 24 - state.weaveRows * 21;
      const g = ctx.createLinearGradient(edgeLeft, y, edgeRight, y);
      g.addColorStop(0, 'rgba(65, 96, 92, .25)');
      g.addColorStop(.5, 'rgba(73, 119, 117, .98)');
      g.addColorStop(1, 'rgba(65, 96, 92, .25)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(edgeLeft, y);
      ctx.lineTo(edgeRight, y);
      ctx.stroke();
    }

    this.drawFabricPanels(state, cx, bottom + 16, width, time);
    this.drawHandAnchors([left, right], time);
    ctx.restore();
  }

  drawFabricPanels(state, cx, y, width, time) {
    const ctx = this.ctx;
    const count = Math.max(0, state.weaveRows);
    const panelWidth = Math.min(82, width * .22);
    const panelHeight = Math.min(this.height * .16, 130);
    for (let panel = 0; panel < count; panel++) {
      const offset = (panel - (count - 1) / 2) * panelWidth * .9;
      const left = cx + offset - panelWidth / 2;
      const wave = Math.sin(time * .0012 + panel * 2) * 2;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.quadraticCurveTo(left + panelWidth * .46, y + 8 + wave, left + panelWidth, y);
      ctx.lineTo(left + panelWidth - 3, y + panelHeight);
      ctx.quadraticCurveTo(left + panelWidth * .5, y + panelHeight + 9 - wave, left + 2, y + panelHeight);
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = 'rgba(30, 28, 25, .88)';
      ctx.fillRect(left, y, panelWidth, panelHeight + 12);
      for (let i = 0; i < panelWidth; i += 3) {
        ctx.strokeStyle = i % 12 === 0 ? 'rgba(143,128,106,.2)' : 'rgba(5,5,4,.28)';
        ctx.lineWidth = .7;
        ctx.beginPath();
        ctx.moveTo(left + i, y);
        ctx.lineTo(left + i + Math.sin(i * .9) * 2, y + panelHeight + 12);
        ctx.stroke();
      }
      ctx.restore();
      if (panel > 0) {
        const seamX = left + panelWidth * .04;
        ctx.strokeStyle = 'rgba(193,169,128,.46)';
        ctx.setLineDash([2, 5]);
        ctx.beginPath();
        ctx.moveTo(seamX, y + 4);
        ctx.lineTo(seamX, y + panelHeight - 3);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  drawShelter(state, input, time) {
    const ctx = this.ctx;
    const [leftHand, rightHand] = this.getHands(input);
    const stageSpread = state.id === 'tension' ? ease(state.progress) : 1;
    const focus = state.id === 'focus' ? ease(state.progress) : state.id === 'dissolve' ? 1 : state.id === 'settle' ? .24 : 0;
    const settle = state.id === 'settle' ? ease(state.progress) : ['focus', 'dissolve'].includes(state.id) ? 1 : 0;
    const liveTilt = state.id === 'balance' && input.handCount >= 2 ? clamp(input.heightDifference * 2.2, -.22, .22) : 0;
    const motion = state.id === 'balance' ? clamp(input.motion / 1.2) : .08;
    const wind = Math.sin(time * .0011) * (2 + 10 * motion) + liveTilt * this.height * .22;

    const cx = input.handCount >= 2 ? clamp((leftHand.x + rightHand.x) / 2, this.width * .34, this.width * .66) : this.width * .5;
    const span = mix(this.width * .22, Math.min(this.width * .83, this.height * 1.28), stageSpread);
    const ground = mix(this.height * .68, this.height * .9, settle);
    const flatY = mix((leftHand.y + rightHand.y) / 2, this.height * .55, .45);
    const roofY = mix(flatY, this.height * .24, stageSpread);
    const eaveY = mix(flatY + 6, this.height * .53, stageSpread);
    const ridgeHalf = span * .19;
    const left = cx - span / 2;
    const right = cx + span / 2;

    const points = {
      ridgeL: { x: cx - ridgeHalf, y: roofY + wind * .12 },
      ridgeR: { x: cx + ridgeHalf, y: roofY - wind * .12 },
      eaveL: { x: left, y: eaveY + wind * .38 },
      eaveR: { x: right, y: eaveY - wind * .38 },
      groundL: { x: left - span * .035, y: ground },
      groundR: { x: right + span * .035, y: ground },
    };

    // Ropes are drawn behind the cloth and become more physical during focus.
    this.drawRopes(points, stageSpread, settle, focus, time);

    const roof = new Path2D();
    roof.moveTo(points.eaveL.x, points.eaveL.y);
    roof.quadraticCurveTo(mix(points.eaveL.x, points.ridgeL.x, .55), roofY + 12 + wind, points.ridgeL.x, points.ridgeL.y);
    roof.bezierCurveTo(cx - ridgeHalf * .3, roofY - 3, cx + ridgeHalf * .3, roofY - 3, points.ridgeR.x, points.ridgeR.y);
    roof.quadraticCurveTo(mix(points.ridgeR.x, points.eaveR.x, .55), roofY + 15 - wind, points.eaveR.x, points.eaveR.y);
    roof.quadraticCurveTo(cx, eaveY + span * .07, points.eaveL.x, points.eaveL.y);
    roof.closePath();
    this.paintCloth(roof, { bounds: [left, roofY - 10, span, eaveY - roofY + span * .09], opacity: .48 + stageSpread * .34, focus, time, direction: 'roof' });

    // Side walls leave a central opening so the user remains visible inside the space.
    const openingHalf = span * mix(.16, .11, focus);
    const wallLeft = new Path2D();
    wallLeft.moveTo(points.eaveL.x, points.eaveL.y);
    wallLeft.quadraticCurveTo(cx - openingHalf * 1.35, eaveY + wind * .18, cx - openingHalf, eaveY + span * .07);
    wallLeft.lineTo(cx - openingHalf * 1.12, ground);
    wallLeft.quadraticCurveTo(mix(cx - openingHalf, points.groundL.x, .5), ground - 6, points.groundL.x, points.groundL.y);
    wallLeft.closePath();
    this.paintCloth(wallLeft, { bounds: [points.groundL.x, eaveY, cx - openingHalf - points.groundL.x, ground - eaveY], opacity: .62 + focus * .27, focus, time, direction: 'wall' });

    const wallRight = new Path2D();
    wallRight.moveTo(cx + openingHalf, eaveY + span * .07);
    wallRight.quadraticCurveTo(cx + openingHalf * 1.35, eaveY - wind * .18, points.eaveR.x, points.eaveR.y);
    wallRight.lineTo(points.groundR.x, points.groundR.y);
    wallRight.quadraticCurveTo(mix(points.groundR.x, cx + openingHalf, .5), ground - 6, cx + openingHalf * 1.12, ground);
    wallRight.closePath();
    this.paintCloth(wallRight, { bounds: [cx + openingHalf, eaveY, points.groundR.x - cx - openingHalf, ground - eaveY], opacity: .62 + focus * .27, focus, time, direction: 'wall' });

    this.drawSeams(points, span, focus, time);
    this.drawPoles(points, settle, focus);
    this.drawHandAnchors([leftHand, rightHand], time, Math.max(0, 1 - focus * 1.8));

    if (state.id === 'balance') this.drawBalanceField(points, state.progress);
    if (settle > .05) this.drawGroundAnchors(points, settle, focus);
  }

  paintCloth(path, { bounds, opacity, focus, time, direction }) {
    const ctx = this.ctx;
    const [x, y, w, h] = bounds;
    ctx.save();
    ctx.clip(path);
    const gradient = direction === 'roof'
      ? ctx.createLinearGradient(x, y, x, y + h)
      : ctx.createLinearGradient(x, y, x + w, y);
    gradient.addColorStop(0, `rgba(18, 16, 14, ${opacity})`);
    gradient.addColorStop(.48, `rgba(38, 33, 29, ${opacity})`);
    gradient.addColorStop(1, `rgba(9, 9, 8, ${opacity})`);
    ctx.fillStyle = gradient;
    ctx.fill(path);

    const count = Math.max(22, Math.floor((direction === 'roof' ? w : h) / 7));
    for (let i = 0; i < count; i++) {
      const p = i / Math.max(1, count - 1);
      const irregular = Math.sin(i * 8.17) * 2.2 + Math.sin(time * .0009 + i) * (1 + focus);
      ctx.strokeStyle = i % 6 === 0
        ? `rgba(162, 137, 106, ${.08 + focus * .11})`
        : `rgba(2, 2, 2, ${.12 + focus * .15})`;
      ctx.lineWidth = .5 + (i % 4) * .15;
      ctx.beginPath();
      if (direction === 'roof') {
        const sx = x + w * p;
        ctx.moveTo(sx, y - 5);
        ctx.bezierCurveTo(sx + irregular, y + h * .35, sx - irregular, y + h * .7, sx + irregular * .4, y + h + 6);
      } else {
        const sy = y + h * p;
        ctx.moveTo(x - 4, sy);
        ctx.bezierCurveTo(x + w * .35, sy + irregular, x + w * .72, sy - irregular, x + w + 4, sy + irregular * .3);
      }
      ctx.stroke();
    }

    if (focus > .05) {
      for (let i = 0; i < 70; i++) {
        const px = x + ((i * 41) % 101) / 101 * w;
        const py = y + ((i * 67) % 97) / 97 * h;
        const length = 2 + (i % 5) * focus;
        ctx.strokeStyle = `rgba(186, 167, 139, ${focus * .12})`;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.quadraticCurveTo(px + length, py - 2, px + length * 1.5, py + 1);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawRopes(points, spread, settle, focus, time) {
    const ctx = this.ctx;
    const ground = points.groundL.y;
    const anchors = [
      [points.ridgeL, { x: points.groundL.x - this.width * .11, y: ground + 3 }],
      [points.eaveL, { x: points.groundL.x - this.width * .045, y: ground + 3 }],
      [points.ridgeR, { x: points.groundR.x + this.width * .11, y: ground + 3 }],
      [points.eaveR, { x: points.groundR.x + this.width * .045, y: ground + 3 }],
    ];
    ctx.save();
    ctx.globalAlpha = clamp((spread - .18) * 1.5) * (.55 + settle * .45);
    ctx.strokeStyle = focus > .4 ? 'rgba(47, 38, 29, .95)' : 'rgba(224, 220, 200, .55)';
    ctx.lineWidth = 1 + focus * .8;
    anchors.forEach(([start, end], index) => {
      const slack = (1 - spread) * 42 + Math.sin(time * .0015 + index) * (1.5 - focus);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.quadraticCurveTo((start.x + end.x) / 2, (start.y + end.y) / 2 + slack, end.x, end.y);
      ctx.stroke();
    });
    ctx.restore();
  }

  drawSeams(points, span, focus, time) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = .16 + focus * .52;
    ctx.strokeStyle = 'rgba(183, 157, 120, .8)';
    ctx.lineWidth = .65 + focus * .45;
    ctx.setLineDash([3, 7]);
    for (let i = 1; i < 6; i++) {
      const p = i / 6;
      const x = mix(points.eaveL.x, points.eaveR.x, p);
      const roofCenterY = mix(points.ridgeL.y, points.eaveL.y, Math.abs(p - .5) * 1.65);
      ctx.beginPath();
      ctx.moveTo(x, roofCenterY + Math.sin(time * .001 + i) * 1.2);
      ctx.lineTo(x + (p - .5) * span * .12, points.eaveL.y + span * .055);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  drawPoles(points, settle, focus) {
    if (settle < .2) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = clamp((settle - .2) * 1.4);
    ctx.strokeStyle = `rgba(94, 67, 40, ${.72 + focus * .2})`;
    ctx.lineWidth = 3 + focus * 2;
    ctx.beginPath();
    ctx.moveTo(points.ridgeL.x, points.ridgeL.y - 20);
    ctx.lineTo(points.ridgeL.x, points.eaveL.y + 20);
    ctx.moveTo(points.ridgeR.x, points.ridgeR.y - 20);
    ctx.lineTo(points.ridgeR.x, points.eaveR.y + 20);
    ctx.stroke();
    ctx.restore();
  }

  drawGroundAnchors(points, settle, focus) {
    const ctx = this.ctx;
    const xs = [points.groundL.x - this.width * .11, points.groundL.x - this.width * .045, points.groundR.x + this.width * .045, points.groundR.x + this.width * .11];
    ctx.save();
    ctx.globalAlpha = settle;
    xs.forEach((x, i) => {
      const y = points.groundL.y + 3;
      ctx.fillStyle = focus > .5 ? 'rgba(74, 64, 51, .88)' : 'rgba(229, 222, 198, .68)';
      ctx.beginPath();
      ctx.ellipse(x, y, 7 + (i % 2) * 3, 3, -.2, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  drawBalanceField(points, score) {
    const ctx = this.ctx;
    const y = points.eaveL.y - 18;
    ctx.save();
    ctx.globalAlpha = .16 + score * .25;
    ctx.setLineDash([1, 8]);
    ctx.strokeStyle = 'rgba(231, 235, 205, .85)';
    ctx.beginPath();
    ctx.moveTo(points.eaveL.x, y);
    ctx.lineTo(points.eaveR.x, y);
    ctx.stroke();
    ctx.setLineDash([]);
    const radius = 3 + score * 5;
    ctx.fillStyle = 'rgba(222, 230, 184, .9)';
    ctx.beginPath();
    ctx.arc((points.eaveL.x + points.eaveR.x) / 2, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawHandAnchors(hands, time, opacity = 1) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = opacity;
    hands.forEach((hand, index) => {
      const pulse = 8 + Math.sin(time * .003 + index * 2) * 2;
      const gradient = ctx.createRadialGradient(hand.x, hand.y, 0, hand.x, hand.y, pulse * 3);
      gradient.addColorStop(0, 'rgba(235, 237, 211, .7)');
      gradient.addColorStop(.2, 'rgba(213, 221, 173, .2)');
      gradient.addColorStop(1, 'rgba(213, 221, 173, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(hand.x, hand.y, pulse * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(241, 241, 222, .9)';
      ctx.beginPath();
      ctx.arc(hand.x, hand.y, 2.3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  drawHandSkeleton(input) {
    const ctx = this.ctx;
    const connections = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[0,9],[9,10],[10,11],[11,12],[0,13],[13,14],[14,15],[15,16],[0,17],[17,18],[18,19],[19,20],[5,9],[9,13],[13,17]];
    ctx.save();
    ctx.strokeStyle = 'rgba(221, 230, 185, .62)';
    ctx.fillStyle = 'rgba(239, 243, 217, .84)';
    ctx.lineWidth = 1;
    input.landmarks?.forEach((hand) => {
      connections.forEach(([a, b]) => {
        ctx.beginPath();
        ctx.moveTo(hand[a].x * this.width, hand[a].y * this.height);
        ctx.lineTo(hand[b].x * this.width, hand[b].y * this.height);
        ctx.stroke();
      });
      hand.forEach((point, index) => {
        ctx.beginPath();
        ctx.arc(point.x * this.width, point.y * this.height, index % 4 === 0 ? 2.2 : 1.3, 0, Math.PI * 2);
        ctx.fill();
      });
    });
    ctx.restore();
  }
}
