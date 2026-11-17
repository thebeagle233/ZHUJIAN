/**
 * 帐篷场景 — 完全简化，只用2D Canvas绘制
 */
class TentScene {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.size = { width: 800, height: 600 };

        this.stageId = 'idle';
        this.spread = 0;
        this.balanceTilt = 0;
        this.settleY = 0;
        this.time = 0;

        this.warpLines = [];
        this.weftLines = [];
        this.weaveBuilt = false;

        this.fabricPoints = [];
        this.fabricBuilt = false;
    }

    init(canvas, size) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.size = size;
    }

    // ============ 阶段1：编织 ============
    buildWeave(hands, size) {
        if (!this.weaveBuilt) {
            this.weaveBuilt = true;
            this.warpLines = [];
            this.weftLines = [];
            for (let i = 0; i < 8; i++) {
                this.warpLines.push({ visible: false, points: [] });
            }
        }

        if (hands.length < 2) {
            this.warpLines.forEach(w => w.visible = false);
            return;
        }

        const w = size.width;
        const h = size.height;
        const hx1 = hands[0].screenX;
        const hy1 = hands[0].screenY;
        const hx2 = hands[1].screenX;
        const hy2 = hands[1].screenY;

        this.warpLines.forEach((line, i) => {
            const t = i / 7;
            const x = hx1 + (hx2 - hx1) * t;
            const y = hy1 + (hy2 - hy1) * t;
            line.points = [];
            for (let j = 0; j <= 8; j++) {
                line.points.push({ x, y: y + j * 25 });
            }
            line.visible = true;
        });

        this.lastWeftX = this.lastWeftX || hx1;
        if (Math.abs(hx1 - this.lastWeftX) > 40 && this.weftLines.length < 4) {
            const midY = (hy1 + hy2) / 2;
            const pts = [];
            for (let j = 0; j <= 15; j++) {
                const t = j / 15;
                pts.push({
                    x: hx1 + (hx2 - hx1) * t,
                    y: midY + Math.sin(t * Math.PI) * 5
                });
            }
            this.weftLines.push(pts);
        }
        this.lastWeftX = hx1;
    }

    // ============ 阶段2：张拉 — 柔性布 ============
    buildFabric() {
        if (this.fabricBuilt) return;
        this.fabricBuilt = true;
        this.warpLines = [];
        this.weftLines = [];

        const w = this.size.width;
        const h = this.size.height;
        const cx = w / 2;
        const cy = h * 0.4;

        this.fabricPoints = [];
        for (let i = 0; i <= 8; i++) {
            for (let j = 0; j <= 6; j++) {
                this.fabricPoints.push({
                    x: cx + (i - 4) * 60,
                    y: cy + j * 50,
                    origX: cx + (i - 4) * 60,
                    origY: cy + j * 50
                });
            }
        }
    }

    updateFabric(spread, tilt) {
        if (this.fabricPoints.length === 0) return;

        const cx = this.size.width / 2;
        const cy = this.size.height * 0.4;
        const t = this.time * 0.5;

        this.fabricPoints.forEach((p, i) => {
            const row = Math.floor(i / 7);
            const col = i % 7;
            const nx = cx + (col - 3) * (60 + spread * 80);
            const ny = cy + row * (50 + spread * 30);

            const dist = Math.sqrt(Math.pow(nx - cx, 2) + Math.pow(ny - cy, 2));
            const sag = dist * (1 - spread) * 0.15;
            const wave = Math.sin(t + col * 0.5) * 5 * (1 - spread);

            p.x += (nx - p.x) * 0.1;
            p.y += (ny + sag + wave - p.y) * 0.1;
            p.y += tilt * (col - 3) * 0.5;
        });
    }

    // ============ 渲染 ============
    render() {
        if (!this.ctx) return;
        const ctx = this.ctx;
        const w = this.size.width;
        const h = this.size.height;

        ctx.clearRect(0, 0, w, h);

        if (this.stageId === 'weave') {
            this.warpLines.forEach(line => {
                if (!line.visible || line.points.length === 0) return;
                ctx.beginPath();
                ctx.strokeStyle = '#2a1a0e';
                ctx.lineWidth = 2;
                line.points.forEach((pt, i) => {
                    if (i === 0) ctx.moveTo(pt.x, pt.y);
                    else ctx.lineTo(pt.x, pt.y);
                });
                ctx.stroke();
            });

            this.weftLines.forEach(line => {
                ctx.beginPath();
                ctx.strokeStyle = '#8b0000';
                ctx.lineWidth = 3;
                line.forEach((pt, i) => {
                    if (i === 0) ctx.moveTo(pt.x, pt.y);
                    else ctx.lineTo(pt.x, pt.y);
                });
                ctx.stroke();
            });
        }
        else if (this.stageId === 'tension' || this.stageId === 'balance') {
            if (this.fabricPoints.length === 0) return;

            ctx.fillStyle = 'rgba(42, 26, 14, 0.75)';
            ctx.beginPath();
            const rows = 7;
            const cols = 9;
            for (let r = 0; r < rows - 1; r++) {
                for (let c = 0; c < cols - 1; c++) {
                    const i = r * cols + c;
                    const p0 = this.fabricPoints[i];
                    const p1 = this.fabricPoints[i + 1];
                    const p2 = this.fabricPoints[i + cols + 1];
                    const p3 = this.fabricPoints[i + cols];
                    ctx.moveTo(p0.x, p0.y);
                    ctx.lineTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.lineTo(p3.x, p3.y);
                    ctx.closePath();
                }
            }
            ctx.fill();

            ctx.strokeStyle = '#1a0a00';
            ctx.lineWidth = 1;
            for (let r = 0; r < rows; r++) {
                ctx.beginPath();
                for (let c = 0; c < cols; c++) {
                    const p = this.fabricPoints[r * cols + c];
                    if (c === 0) ctx.moveTo(p.x, p.y);
                    else ctx.lineTo(p.x, p.y);
                }
                ctx.stroke();
            }
            for (let c = 0; c < cols; c++) {
                ctx.beginPath();
                for (let r = 0; r < rows; r++) {
                    const p = this.fabricPoints[r * cols + c];
                    if (r === 0) ctx.moveTo(p.x, p.y);
                    else ctx.lineTo(p.x, p.y);
                }
                ctx.stroke();
            }

            const poleHeight = this.spread * 200;
            const cx = w / 2;
            const cy = h * 0.6;

            ctx.fillStyle = '#4a3728';
            ctx.fillRect(cx - 6, cy - poleHeight, 12, poleHeight);

            const corners = [[-120, -120], [120, -120], [-120, 120], [120, 120]];
            corners.forEach(([dx, dz]) => {
                const px = cx + dx;
                const py = cy;
                ctx.fillRect(px - 4, py - poleHeight, 8, poleHeight);
            });

            if (this.spread > 0.3) {
                ctx.strokeStyle = '#1a0a00';
                ctx.lineWidth = 2;
                const ropeEnds = [[0, h * 0.9], [w, h * 0.9], [0, h * 0.7], [w, h * 0.7]];
                ropeEnds.forEach(([ex, ey]) => {
                    ctx.beginPath();
                    ctx.moveTo(cx, cy - poleHeight);
                    const cp1x = cx + (ex - cx) * 0.5;
                    const cp1y = cy - poleHeight * 0.3;
                    ctx.quadraticCurveTo(cp1x, cp1y, ex, ey);
                    ctx.stroke();
                });
            }
        }
        else if (this.stageId === 'settle' || this.stageId === 'focus') {
            const cx = w / 2;
            const cy = h * 0.5;
            const settleOffset = this.settleY * 80;

            ctx.fillStyle = 'rgba(42, 26, 14, 0.85)';

            ctx.beginPath();
            ctx.moveTo(cx, cy - 120 - settleOffset);
            ctx.lineTo(cx + 150, cy - 30 - settleOffset);
            ctx.lineTo(cx + 150, cy + 80 - settleOffset);
            ctx.lineTo(cx, cy + 100 - settleOffset);
            ctx.lineTo(cx - 150, cy + 80 - settleOffset);
            ctx.lineTo(cx - 150, cy - 30 - settleOffset);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#4a3728';
            ctx.fillRect(cx - 8, cy + 100 - settleOffset - 200, 16, 200);

            const corners = [[-140, -20], [140, -20], [-140, 80], [140, 80]];
            corners.forEach(([dx, dy]) => {
                ctx.fillRect(cx + dx - 6, cy + dy - settleOffset - 150, 12, 150);
            });

            ctx.fillStyle = '#5a4a3a';
            const stakes = [[0, h * 0.85], [w * 0.15, h * 0.8], [w * 0.85, h * 0.8]];
            stakes.forEach(([sx, sy]) => {
                ctx.fillRect(sx - 10, sy - 25, 20, 25);
            });
        }
    }

    setSpread(v) { this.spread = v; }
    setBalanceTilt(v) { this.balanceTilt = v; }
    setSettle(v) { this.settleY = v; }
    setAlpha(v) { }
    setFocus(v) { }
    setStage(id) { this.stageId = id; }

    update(dt, time) {
        this.time = time;
        if (this.stageId === 'tension') {
            this.buildFabric();
            this.updateFabric(this.spread, this.balanceTilt);
        } else if (this.stageId === 'balance') {
            this.buildFabric();
            this.updateFabric(0.85, this.balanceTilt);
        }
    }

    resize(size) {
        this.size = size;
    }
}

const tentScene = new TentScene();
export default tentScene;