import { constructionGeometry, constructionRopes } from './cloth-motion.js?v=free-cloth-v5';
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
    this.fabricImage = new Image();
    this.fabricImage.onload = () => {
      this.photoWeaveTile = null;
      this.weavePattern = null;
      this.fabricSheetKey = null;
    };
    this.fabricImage.src = new URL('../assets/yak-hair-thin-v3.webp', import.meta.url).href;
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

    if(input.demoHands)this.drawDemoHands(input);
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

  // A small, opaque plain-weave tile. Generate once, then reuse every frame.
  getWeaveTexture() {
    if (this.fabricImage?.complete && this.fabricImage.naturalWidth) {
      if (!this.photoWeaveTile) {
        const tile = document.createElement('canvas');
        tile.width = tile.height = 768;
        const ctx = tile.getContext('2d');
        ctx.drawImage(this.fabricImage, 0, 0, 768, 768);
        // Tiny neutral pinholes transmit light; the hair strands remain opaque.
        const pixels = ctx.getImageData(0, 0, 768, 768);
        for (let i = 0; i < pixels.data.length; i += 4) {
          const r = pixels.data[i], g = pixels.data[i + 1], b = pixels.data[i + 2];
          const luma = (r + g + b) / 3;
          const neutral = Math.max(r, g, b) - Math.min(r, g, b);
          if (luma > 52 && neutral < 17) pixels.data[i + 3] = 125;
        }
        ctx.putImageData(pixels, 0, 0);
        this.photoWeaveTile = tile;
      }
      return this.photoWeaveTile;
    }
    if (this.weaveTexture) return this.weaveTexture;
    const tile = document.createElement('canvas');
    tile.width = tile.height = 96;
    const ctx = tile.getContext('2d');
    ctx.scale(2, 2);
    ctx.fillStyle = '#211e1a';
    ctx.fillRect(0, 0, 48, 48);

    const yarn = (x, y, vertical, over, seed) => {
      const shade = ctx.createLinearGradient(
        x - (vertical ? 2.3 : 0), y - (vertical ? 0 : 2.3),
        x + (vertical ? 2.3 : 0), y + (vertical ? 0 : 2.3),
      );
      shade.addColorStop(0, over ? '#29251f' : '#211e19');
      shade.addColorStop(.38, over ? '#51493d' : '#39332b');
      shade.addColorStop(.68, over ? '#3c352d' : '#2d2822');
      shade.addColorStop(1, '#1b1916');
      ctx.strokeStyle = shade;
      ctx.lineWidth = 4.4 + Math.sin(seed * 2.7) * .25;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(x - (vertical ? 0 : 3.2), y - (vertical ? 3.2 : 0));
      ctx.lineTo(x + (vertical ? 0 : 3.2), y + (vertical ? 3.2 : 0));
      ctx.stroke();

      // Fine fibres follow each yarn; small irregularities avoid a plastic grid.
      for (let f = 0; f < 3; f++) {
        const offset = (f - 1) * .9 + Math.sin(seed + f) * .2;
        ctx.strokeStyle = f === 1 ? 'rgba(161,143,116,.22)' : 'rgba(11,10,9,.3)';
        ctx.lineWidth = .22;
        ctx.beginPath();
        ctx.moveTo(x + (vertical ? offset : -3), y + (vertical ? -3 : offset));
        ctx.quadraticCurveTo(
          x + (vertical ? offset + .35 : 0),
          y + (vertical ? 0 : offset + .35),
          x + (vertical ? offset : 3), y + (vertical ? 3 : offset),
        );
        ctx.stroke();
      }
    };

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const x = col * 6 + 3;
        const y = row * 6 + 3;
        const warpOver = (row + col) % 2 === 0;
        yarn(x, y, !warpOver, false, row * 8 + col);
        yarn(x, y, warpOver, true, row * 8 + col + 31);
      }
    }
    // Sparse short hairs, not a fur-like fringe.
    ctx.lineWidth = .18;
    for (let i = 0; i < 42; i++) {
      const x = (i * 17.37) % 48;
      const y = (i * 29.21) % 48;
      ctx.strokeStyle = i % 3 ? 'rgba(151,134,108,.18)' : 'rgba(8,7,6,.35)';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + .6, y - .8, x + 1.7, y - .35);
      ctx.stroke();
    }
    this.weaveTexture = tile;
    return tile;
  }

  drawWeaving(state, input, time) {
    const ctx = this.ctx;
    const [handA, handB] = this.getHands(input);
    const width = clamp(Math.abs(handB.x - handA.x), this.width * .18, this.width * .62);
    const cx = (handA.x + handB.x) / 2;
    const cy = clamp((handA.y + handB.y) / 2, this.height * .34, this.height * .7);
    const top = cy - Math.min(this.height * .24, width * .36);
    const bottom = cy + Math.min(this.height * .23, width * .33);
    const height = bottom - top;
    const edgeLeft = cx - width / 2;
    const edgeRight = cx + width / 2;
    this.lastWovenPanel = { cx, top, bottom, width };
    const rows = clamp(state.weaveRows, 0, 3);

    // The existing three presses each weave a dense band, rather than one thin line.
    if (this.weaveSession !== state.stageStarted || rows < (this.weaveTargetRows || 0)) {
      this.weaveSession = state.stageStarted;
      this.weaveDisplayRows = 0;
      this.weaveTime = time;
      this.weaveSweepStarted = null;
      this.weaveWasReady = false;
    }
    const dt = Math.max(0, Math.min(64, time - (this.weaveTime ?? time)));
    this.weaveTime = time;
    this.weaveTargetRows = rows;
    this.weaveDisplayRows += (rows - this.weaveDisplayRows) * (1 - Math.exp(-dt / 115));
    if (Math.abs(rows - this.weaveDisplayRows) < .003) this.weaveDisplayRows = rows;
    const reducedMotion = this.reducedMotion ??= Boolean(
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    );
    if (reducedMotion) this.weaveDisplayRows = rows;
    const progress = this.weaveDisplayRows / 3;
    const frontier = bottom - height * progress;

    // Fixed weave topology: the exposed warp lines align with the texture below.
    const warpCount = Math.max(32, Math.min(144, Math.round(width / 4.7)));
    const pitch = width / warpCount;
    const yarnWidth = Math.max(.6, pitch * .32);
    const sway = reducedMotion ? 0 : Math.sin(time * .0008) * .35;

    ctx.save();
    ctx.lineCap = 'round';

    // Quiet end ties keep the threads legible without adding a realistic loom.
    ctx.strokeStyle = 'rgba(199,184,155,.28)';
    ctx.lineWidth = .85;
    ctx.beginPath();
    ctx.moveTo(edgeLeft - 8, top);
    ctx.lineTo(edgeRight + 8, top);
    ctx.stroke();

    for (let i = 0; i < warpCount; i++) {
      const x = edgeLeft + (i + .5) * pitch;
      const drift = Math.sin(i * 1.91) * .55 + sway;
      const yarnShade = ctx.createLinearGradient(x - yarnWidth, top, x + yarnWidth, top);
      yarnShade.addColorStop(0, 'rgba(20,18,15,.96)');
      yarnShade.addColorStop(.42, 'rgba(104,92,74,.94)');
      yarnShade.addColorStop(1, 'rgba(35,30,25,.98)');
      ctx.strokeStyle = yarnShade;
      ctx.lineWidth = yarnWidth;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.bezierCurveTo(x + drift, top + height * .3, x - drift, bottom - height * .2, x, bottom);
      ctx.stroke();

      // Just a few wisps on the exposed section; denser fibres are cached in the cloth.
      ctx.strokeStyle = 'rgba(156,139,111,.28)';
      ctx.lineWidth = .35;
      for (let f = 0; f < 3; f++) {
        const y = top + (frontier - top) * (.17 + f * .27);
        if (y > frontier - 3) continue;
        ctx.beginPath();
        ctx.moveTo(x, y + 1);
        ctx.quadraticCurveTo(x + yarnWidth, y - 1, x + yarnWidth * 1.3, y - 2.5);
        ctx.stroke();
      }
    }

    if (progress > .001) {
      // One continuous cloth surface, with a subtly irregular fell and soft bottom edge.
      const cloth = new Path2D();
      const ripple = (p) => Math.sin(p * Math.PI * 14) * .55;
      cloth.moveTo(edgeLeft, frontier + ripple(0));
      for (let i = 1; i <= 48; i++) {
        const p = i / 48;
        cloth.lineTo(edgeLeft + width * p, frontier + ripple(p));
      }
      cloth.lineTo(edgeRight - .8, bottom - 1);
      cloth.quadraticCurveTo(cx + width * .24, bottom + 2.6, cx, bottom + 1);
      cloth.quadraticCurveTo(cx - width * .24, bottom + 3, edgeLeft + .8, bottom - 1);
      cloth.closePath();

      ctx.save();
      ctx.shadowColor = 'rgba(6,5,4,.22)';
      ctx.shadowBlur = 7;
      ctx.shadowOffsetY = 2;
      ctx.fillStyle = 'rgba(39,34,28,.7)';
      ctx.fill(cloth);
      ctx.restore();

      ctx.save();
      ctx.clip(cloth);
      this.weavePattern ??= ctx.createPattern(this.getWeaveTexture(), 'repeat');
      // Tile has 2 physical pixels per design pixel and a six-pixel yarn spacing.
      const scale = pitch / 12;
      ctx.save();
      ctx.translate(edgeLeft, top);
      ctx.scale(scale, scale);
      ctx.fillStyle = this.weavePattern || '#302a23';
      ctx.fillRect(-6 / scale, -6 / scale, (width + 12) / scale, (height + 12) / scale);
      ctx.restore();

      // Broad, low-contrast shading gives weight without turning the cloth into a render prop.
      const light = ctx.createLinearGradient(edgeLeft, top, edgeRight, bottom);
      light.addColorStop(0, 'rgba(191,164,126,.10)');
      light.addColorStop(.42, 'rgba(0,0,0,0)');
      light.addColorStop(1, 'rgba(5,4,3,.22)');
      ctx.fillStyle = light;
      ctx.fillRect(edgeLeft - 2, top - 2, width + 4, height + 6);
      ctx.restore();

      ctx.strokeStyle = 'rgba(126,107,81,.48)';
      ctx.lineWidth = Math.max(.75, pitch * .3);
      ctx.beginPath();
      ctx.moveTo(edgeLeft, frontier);
      for (let i = 1; i <= 48; i++) {
        const p = i / 48;
        ctx.lineTo(edgeLeft + width * p, frontier + ripple(p));
      }
      ctx.stroke();
    }

    if (state.sweepReady && !this.weaveWasReady) this.weaveSweepStarted = time;
    this.weaveWasReady = Boolean(state.sweepReady);
    if (state.sweepReady && rows < 3) {
      // Let the new weft visibly travel across the warp before the downward press.
      const travel = reducedMotion ? 1 : ease((time - this.weaveSweepStarted) / 460);
      const reverse = rows % 2 === 1;
      const tip = reverse ? edgeRight - width * travel : edgeLeft + width * travel;
      const y = Math.max(top + pitch, frontier - pitch * 1.4);
      const start = reverse ? edgeRight : edgeLeft;
      const from = Math.min(start, tip);
      const to = Math.max(start, tip);
      for (let i = 0; i < warpCount; i++) {
        const x1 = Math.max(from, edgeLeft + i * pitch);
        const x2 = Math.min(to, edgeLeft + (i + 1) * pitch);
        if (x2 <= x1) continue;
        ctx.strokeStyle = (i + rows) % 2 ? '#4d4335' : '#968269';
        ctx.lineWidth = Math.max(1, pitch * .65);
        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.quadraticCurveTo((x1 + x2) / 2, y + ((i + rows) % 2 ? .6 : -.6), x2, y);
        ctx.stroke();
      }
      // Short free end, using the same yarn rather than a glowing UI stripe.
      ctx.strokeStyle = '#8d7b62';
      ctx.lineWidth = Math.max(1, pitch * .55);
      ctx.beginPath();
      ctx.moveTo(tip, y);
      ctx.quadraticCurveTo(tip + (reverse ? -7 : 7), y - 2, tip + (reverse ? -12 : 12), y + 1);
      ctx.stroke();
    }

    this.drawHandAnchors([handA, handB], time);
    ctx.restore();
  }

  // The same woven sheet is deformed in UV space: no replacement image or camera turn.
  drawFabricTriangle(texture, source, dest) {
    const ctx = this.ctx;
    const [s0, s1, s2] = source;
    const [p0, p1, p2] = dest;
    const area=(p1.x-p0.x)*(p2.y-p0.y)-(p2.x-p0.x)*(p1.y-p0.y);
    if(Math.abs(area)<.05)return;
    const det = (s1.x - s0.x) * (s2.y - s0.y) - (s2.x - s0.x) * (s1.y - s0.y);
    const a = ((p1.x - p0.x) * (s2.y - s0.y) - (p2.x - p0.x) * (s1.y - s0.y)) / det;
    const b = ((p1.y - p0.y) * (s2.y - s0.y) - (p2.y - p0.y) * (s1.y - s0.y)) / det;
    const c = ((p2.x - p0.x) * (s1.x - s0.x) - (p1.x - p0.x) * (s2.x - s0.x)) / det;
    const d = ((p2.y - p0.y) * (s1.x - s0.x) - (p1.y - p0.y) * (s2.x - s0.x)) / det;
    // Slight overlap prevents hairline cracks between neighboring triangles.
    const mid = { x: (p0.x + p1.x + p2.x) / 3, y: (p0.y + p1.y + p2.y) / 3 };
    ctx.save();
    ctx.beginPath();
    dest.forEach((p, i) => {
      const dx = p.x - mid.x, dy = p.y - mid.y;
      const length = Math.max(1, Math.hypot(dx, dy));
      const x = p.x + dx / length * .4, y = p.y + dy / length * .4;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    });
    ctx.closePath();
    ctx.clip();
    ctx.transform(a, b, c, d, p0.x - a * s0.x - c * s0.y, p0.y - b * s0.x - d * s0.y);
    const minX = Math.min(...source.map(p => p.x)), minY = Math.min(...source.map(p => p.y));
    const sw = Math.max(...source.map(p => p.x)) - minX, sh = Math.max(...source.map(p => p.y)) - minY;
    ctx.drawImage(texture, minX, minY, sw, sh, minX, minY, sw, sh);
    ctx.restore();
  }

  drawShelter(state, input, time) {
    const ctx = this.ctx;
    const reduced = this.reducedMotion ??= Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    if (state.id === 'tension' && this.shelterSession !== state.stageStarted) {
      this.shelterSession = state.stageStarted;
      this.shelterStart = this.lastWovenPanel || {
        cx: this.width * .5, top: this.height * .37,
        bottom: this.height * .66, width: this.width * .44,
      };
      this.shelterViewport = { width: this.width, height: this.height };
    }
    const source = this.shelterStart || { cx: this.width * .5, top: this.height * .37, bottom: this.height * .66, width: this.width * .44 };
    const sx = this.width / (this.shelterViewport?.width || this.width);
    const sy = this.height / (this.shelterViewport?.height || this.height);
    const origin = { cx: source.cx * sx, width: source.width * sx, top: source.top * sy, bottom: source.bottom * sy };
    const g = constructionGeometry({ width: this.width, height: this.height, origin,
      progress: state.id === 'tension' ? state.progress : 1, time, cloth:state.cloth, reduced });
    const { point, cx, span, poles, drop, drape, tie, ground } = g;
    const focus = state.id === 'focus' ? ease(state.progress) : state.id === 'dissolve' ? 1 : 0;

    // A soft grounding shadow and a dark interior sit behind the frame, never in the air.
    if (poles > 0) {
      ctx.save();
      ctx.globalAlpha = poles;
      const shadow = ctx.createRadialGradient(cx, ground, 0, cx, ground, span * .55);
      shadow.addColorStop(0, 'rgba(5,8,3,.18)');
      shadow.addColorStop(1, 'rgba(5,8,3,0)');
      ctx.fillStyle = shadow;
      ctx.beginPath();
      ctx.ellipse(cx, ground, span * .57, this.height * .032, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (tie > .01) {
      ctx.save();
      ctx.globalAlpha = tie * .9;
      const inner = ctx.createLinearGradient(cx, this.height * .49, cx, ground);
      inner.addColorStop(0, '#080a06');
      inner.addColorStop(1, '#202419');
      ctx.fillStyle = inner;
      ctx.fillRect(cx - span * .14, this.height * .51, span * .28, ground - this.height * .51);
      ctx.restore();
    }
    // Poles physically rotate upright while the cloth is still suspended above them.
    // Plain, slender shafts retain the simplified visual language of the interaction.
    const pole = (base, head, side, weight) => {
      const length = base.y - head.y;
      const angle = poles * Math.PI / 2;
      const tip = { x: base.x + side * length * Math.cos(angle), y: base.y - length * Math.sin(angle) };
      ctx.lineCap = 'round';
      ctx.lineWidth = weight;
      ctx.strokeStyle = '#766448';
      ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
      ctx.lineWidth = Math.max(.6, weight * .23);
      ctx.strokeStyle = 'rgba(219,200,154,.5)';
      ctx.beginPath(); ctx.moveTo(base.x - 1, base.y); ctx.lineTo(tip.x - 1, tip.y); ctx.stroke();
      return tip;
    };
    if (poles > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(poles * 7);
      const w = Math.max(2, Math.min(5, span * .005));
      pole({ x: cx, y: ground - this.height * .035 }, g.ridge, 1, w * .65);
      const a = pole({ x: g.portalL.x, y: ground }, g.portalL, -1, w);
      const b = pole({ x: g.portalR.x, y: ground }, g.portalR, 1, w);
      if (poles > .82) {
        ctx.globalAlpha *= clamp((poles - .82) / .18);
        ctx.strokeStyle = '#897451'; ctx.lineWidth = w * .85;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.restore();
    }

    // The photographic thin weave is cached once and carried with the moving vertices.
    const warpCount = Math.max(32, Math.min(144, Math.round(origin.width / 4.7)));
    const textureScale = (origin.width / warpCount) / 12;
    const tw = origin.width / textureScale;
    const th = (origin.bottom - origin.top) / textureScale;
    const key = `${Math.round(tw)}:${Math.round(th)}:${Boolean(this.photoWeaveTile)}`;
    if (this.fabricSheetKey !== key) {
      this.fabricSheetKey = key;
      this.fabricSheet = document.createElement('canvas');
      this.fabricSheet.width = Math.max(2, Math.round(tw));
      this.fabricSheet.height = Math.max(2, Math.round(th));
      const sheet = this.fabricSheet.getContext('2d');
      sheet.fillStyle = sheet.createPattern(this.getWeaveTexture(), 'repeat');
      sheet.fillRect(0, 0, this.fabricSheet.width, this.fabricSheet.height);
    }
    const texture = this.fabricSheet;
    const surfacePath = (side, v0, v1, region) => {
      const path = new Path2D();
      const start = side < 0 ? 0 : .5;
      for (let i = 0; i <= 40; i++) {
        const p = point(start + i / 80, v0, side, region);
        if (i) path.lineTo(p.x, p.y); else path.moveTo(p.x, p.y);
      }
      for (let i = 40; i >= 0; i--) {
        const p = point(start + i / 80, v1, side, region); path.lineTo(p.x, p.y);
      }
      path.closePath(); return path;
    };
    ctx.save();
    for (const side of [-1, 1]) {
      for (const region of ['roof', 'wall']) {
        const from = region === 'roof' ? 0 : .52;
        const to = region === 'roof' ? .52 : 1;
        const surface = surfacePath(side, from, to, region);
        // A light base preserves pinholes without making the whole cloth look like glass.
        ctx.fillStyle = 'rgba(24,23,19,.65)'; ctx.fill(surface);
        const rows = 6, columns = 16;
        for (let row = 0; row < rows; row++) {
          const v0 = mix(from, to, row / rows), v1 = mix(from, to, (row + 1) / rows);
          for (let col = 0; col < columns; col++) {
            const u0 = (side < 0 ? 0 : .5) + col / columns * .5, u1 = u0 + .5 / columns;
            const uv = [{ x: u0 * texture.width, y: v0 * texture.height }, { x: u1 * texture.width, y: v0 * texture.height }, { x: u1 * texture.width, y: v1 * texture.height }, { x: u0 * texture.width, y: v1 * texture.height }];
            const p = [point(u0,v0,side,region),point(u1,v0,side,region),point(u1,v1,side,region),point(u0,v1,side,region)];
            this.drawFabricTriangle(texture,[uv[0],uv[1],uv[2]],[p[0],p[1],p[2]]);
            this.drawFabricTriangle(texture,[uv[0],uv[2],uv[3]],[p[0],p[2],p[3]]);
          }
        }
        ctx.save(); ctx.clip(surface);
        // Broad highlights and soft fold shadows, never puffy individual yarns.
        const light = ctx.createLinearGradient(0, this.height * .1, 0, ground);
        light.addColorStop(0, 'rgba(210,199,175,.08)');
        light.addColorStop(.45, 'rgba(0,0,0,0)');
        light.addColorStop(1, `rgba(0,0,0,${region === 'wall' ? .2 : .06})`);
        ctx.fillStyle = light; ctx.fill(surface);
        if (drop > 0 && region === 'roof') {
          const roofLight = ctx.createLinearGradient(cx,this.height*.28,cx,this.height*.515);
          roofLight.addColorStop(0,`rgba(192,177,145,${.075*drop})`);
          roofLight.addColorStop(.3,'rgba(0,0,0,0)');
          roofLight.addColorStop(1,`rgba(0,0,0,${.32*drop})`);
          ctx.fillStyle=roofLight;ctx.fill(surface);
        }
        if (drape > 0 && region === 'wall') {
          for (let fold = 1; fold < 7; fold++) {
            const u = (side < 0 ? 0 : .5) + fold / 14;
            const a = point(u,.52,side,region), b = point(u,1,side,region);
            const band = span * .022;
            const shade = ctx.createLinearGradient(b.x-band,0,b.x+band,0);
            shade.addColorStop(0,'rgba(0,0,0,0)'); shade.addColorStop(.47,`rgba(0,0,0,${.12*drape})`);
            shade.addColorStop(.72,`rgba(215,194,156,${.035*drape})`); shade.addColorStop(1,'rgba(0,0,0,0)');
            ctx.fillStyle=shade;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x-band,b.y+4);ctx.lineTo(b.x+band,b.y+4);ctx.closePath();ctx.fill();
          }
        }
        ctx.restore();
        // Barely-there hems: a thin sheet rather than a thick blanket border.
        ctx.strokeStyle='rgba(141,126,102,.24)';ctx.lineWidth=.55;ctx.stroke(surface);
      }
    }
    ctx.restore();
    // Panel seams remain tied to the fabric and bend with it even while airborne.
    ctx.save(); ctx.lineWidth=.55;ctx.strokeStyle='rgba(169,147,111,.22)';
    for (const u of [1/6,2/6,4/6,5/6]) {
      ctx.beginPath();
      for (let i=0;i<=36;i++) {
        const p=point(u,i/36,u<.5?-1:1); if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);
      }ctx.stroke();
    }
    ctx.restore();
    if(g.ropePresence>0) this.drawRopes(constructionRopes(g,this.width,this.height),g.ropePresence,g.ropeLanding,g.ropeTaut);

    this.drawHandAnchors([point(0,.52,-1),point(1,.52,1)],time,(1-focus*.85)*.75);
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

  drawRopes(ropes, presence, landing, taut) {
    const ctx=this.ctx;
    const ropeWidth=clamp(this.width/520,1.5,2.8);
    ctx.save();ctx.globalAlpha=presence*.96;ctx.lineCap='round';ctx.lineJoin='round';
    for(const [index,{start,end,taut:localTaut}] of ropes.entries()) {
      const length=Math.max(1,Math.hypot(end.x-start.x,end.y-start.y));
      const normal={x:-(end.y-start.y)/length,y:(end.x-start.x)/length};
      const slack=(1-(localTaut??taut))*Math.min(this.height*.065,length*.15);
      const at=t=>({x:mix(start.x,end.x,t),y:mix(start.y,end.y,t)+4*t*(1-t)*slack});
      // A dark core gives the cord body; two uneven helical strands carry the fibres.
      ctx.strokeStyle='#302b22';ctx.lineWidth=ropeWidth+1;
      ctx.beginPath();ctx.moveTo(start.x,start.y);ctx.quadraticCurveTo((start.x+end.x)/2,(start.y+end.y)/2+slack*2,end.x,end.y);ctx.stroke();
      const count=Math.max(22,Math.min(140,Math.ceil(length/3)));
      for(let strand=0;strand<2;strand++) {
        ctx.strokeStyle=strand ? '#786b54':'#a29579';
        ctx.lineWidth=ropeWidth*.51;
        ctx.beginPath();
        for(let i=0;i<=count;i++) {
          const t=i/count,p=at(t),twist=Math.sin(t*length*.56+strand*Math.PI+index)*ropeWidth*.28;
          const x=p.x+normal.x*twist,y=p.y+normal.y*twist;
          if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);
        }ctx.stroke();
      }
      // Sparse short hairs and wrapped ties replace the former glowing white lines.
      ctx.lineWidth=.35;ctx.strokeStyle='rgba(205,190,151,.6)';
      for(let i=1;i<length/18;i++) {
        const t=i*18/length,p=at(t),side=i%2?1:-1;
        ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.quadraticCurveTo(p.x+normal.x*side*2,p.y+normal.y*side*2,p.x+normal.x*side*3+1,p.y+normal.y*side*3-1);ctx.stroke();
      }
      ctx.lineWidth=.7;ctx.strokeStyle='#ac9a76';
      for(let coil=0;coil<3;coil++) {
        const p=at(coil*2.1/length);
        ctx.beginPath();ctx.moveTo(p.x-normal.x*2,p.y-normal.y*2);ctx.lineTo(p.x+normal.x*2,p.y+normal.y*2);ctx.stroke();
      }
      if(landing>.94) {
        ctx.save();ctx.globalAlpha*=clamp((landing-.94)/.06);
        ctx.strokeStyle='#6e6046';ctx.lineWidth=2.7;
        ctx.beginPath();ctx.moveTo(end.x-1.5,end.y+3);ctx.lineTo(end.x+1.8,end.y-6);ctx.stroke();
        ctx.strokeStyle='#b09d74';ctx.lineWidth=.75;
        ctx.beginPath();ctx.ellipse(end.x,end.y-1,2.5,1.3,-.2,0,Math.PI*2);ctx.stroke();ctx.restore();
      }
    }
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

  drawDemoHands(input) {
    const ctx=this.ctx;
    const scale=clamp(this.width/1250,.72,1);
    input.hands?.forEach((hand,index)=>{
      ctx.save();ctx.translate(hand.x*this.width,hand.y*this.height);ctx.scale(scale,scale);
      ctx.globalAlpha=hand.held===false?.22:.85;
      ctx.fillStyle='rgba(239,237,215,.88)';ctx.strokeStyle='rgba(245,243,224,.9)';ctx.lineWidth=.8;
      ctx.beginPath();ctx.moveTo(-7,13);ctx.lineTo(-15,-1);ctx.quadraticCurveTo(-16,-6,-12,-5);
      ctx.lineTo(-6,1);ctx.lineTo(-6,-16);ctx.quadraticCurveTo(-5,-21,-2,-17);ctx.lineTo(-1,-4);
      ctx.lineTo(-1,-22);ctx.quadraticCurveTo(1,-27,4,-22);ctx.lineTo(4,-4);
      ctx.lineTo(5,-18);ctx.quadraticCurveTo(8,-23,10,-17);ctx.lineTo(10,-2);
      ctx.lineTo(11,-12);ctx.quadraticCurveTo(15,-16,15,-10);ctx.lineTo(15,5);
      ctx.quadraticCurveTo(14,11,8,15);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.font='10px sans-serif';ctx.textAlign='center';ctx.fillStyle='#f2efe5';ctx.fillText(index===0?'左手':'右手',1,29);
      ctx.restore();
    });
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

