/**
 * 阶段2：张拉 - 双手向外撑开空间
 *
 * 用户动作：双手从身体前方向左右缓慢拉开
 *
 * 视觉：
 *   - 黑色牦牛毛织物被双手撑开
 *   - 织物由密集纤维组成，呈下垂弧线
 *   - 中心聚拢、两侧分散
 *   - 从中央紧密（深色不透明）向边缘松散（半透明）过渡
 *   - 拉索从织物边缘向外延伸
 *   - 顶部脊线、两侧篷布向下展开
 */

class TensionFiber {
    constructor(angle, dist) {
        this.angle = angle;
        this.dist = dist;
        this.thickness = 0.6 + Math.random() * 1.1;
        this.curl = (Math.random() - 0.5) * 0.3;
        this.phase = Math.random() * Math.PI * 2;
        this.alpha = 0;
        this.swayOffset = (Math.random() - 0.5) * 8;
    }

    draw(ctx, centerX, centerY, spreadDist, sway) {
        const x = centerX + Math.cos(this.angle) * this.dist * spreadDist;
        const baseY = centerY + Math.sin(this.angle) * this.dist * spreadDist * 0.7;

        const swayY = baseY + Math.sin(this.phase + sway) * 4;
        const swayX = x + Math.cos(this.phase + sway) * 1.5;

        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.strokeStyle = `hsl(25, 22%, 12%)`;
        ctx.lineWidth = this.thickness;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);

        const midX = (centerX + swayX) / 2;
        const midY = (centerY + swayY) / 2 + this.curl * 6;
        ctx.quadraticCurveTo(midX, midY, swayX, swayY);
        ctx.stroke();

        if (this.thickness > 0.9) {
            for (let i = 0; i < 2; i++) {
                const t = 0.4 + i * 0.3;
                const fx = centerX + (swayX - centerX) * t;
                const fy = centerY + (swayY - centerY) * t;
                const hairAng = (Math.random() - 0.5) * 0.8;
                const hairLen = 1.5 + Math.random() * 2.5;
                ctx.beginPath();
                ctx.moveTo(fx, fy);
                ctx.lineTo(fx + Math.cos(hairAng) * hairLen, fy + Math.sin(hairAng) * hairLen);
                ctx.stroke();
            }
        }
        ctx.restore();
    }
}

class GuyRope {
    constructor(anchorX, anchorY, tentX, tentY) {
        this.anchorX = anchorX;
        this.anchorY = anchorY;
        this.tentX = tentX;
        this.tentY = tentY;
        this.alpha = 0;
        this.sway = 0;
    }

    update(tentX, tentY, sway) {
        this.tentX = tentX;
        this.tentY = tentY;
        this.alpha = Math.min(1, this.alpha + 0.02);
        this.sway = sway;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha * 0.85;
        ctx.strokeStyle = 'hsl(25, 18%, 14%)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(this.tentX, this.tentY);
        const midX = (this.tentX + this.anchorX) / 2;
        const midY = (this.tentY + this.anchorY) / 2 + Math.sin(this.sway) * 2;
        ctx.quadraticCurveTo(midX, midY, this.anchorX, this.anchorY);
        ctx.stroke();
        ctx.restore();
    }
}

export const tensionPlugin = {
    name: 'tension',
    fibers: [],
    leftHand: null,
    rightHand: null,
    guyRopes: [],
    centerX: 0,
    centerY: 0,
    spread: 0,
    targetSpread: 0,
    sway: 0,
    ridgeY: 0,

    init(canvas) {
        this.fibers = [];
        const fiberCount = 280;
        for (let i = 0; i < fiberCount; i++) {
            const angle = (Math.random() * 0.95 + 0.025) * Math.PI;
            const dist = 0.3 + Math.random() * 0.7;
            this.fibers.push(new TensionFiber(angle, dist));
        }

        this.guyRopes = [];
        this.centerX = canvas.width / 2;
        this.centerY = canvas.height * 0.55;
        this.spread = 0;
        this.targetSpread = 0;
        this.ridgeY = 0;
    },

    update(landmarksList, canvas, progress = 0) {
        if (!canvas) return;
        if (this.fibers.length === 0) this.init(canvas);

        this.centerX = canvas.width / 2;
        this.centerY = canvas.height * 0.55;

        if (landmarksList.length >= 2) {
            const hands = landmarksList.slice(0, 2).map(lm => ({
                x: lm[0].x * canvas.width,
                y: lm[0].y * canvas.height
            }));
            this.leftHand = hands[0].x < hands[1].x ? hands[0] : hands[1];
            this.rightHand = hands[0].x < hands[1].x ? hands[1] : hands[0];
        } else {
            this.leftHand = null;
            this.rightHand = null;
        }

        const w = canvas.width;
        const targetDist = this.leftHand && this.rightHand
            ? Math.hypot(this.rightHand.x - this.leftHand.x, this.rightHand.y - this.leftHand.y)
            : w * 0.3;
        this.targetSpread = Math.min(1.2, Math.max(0, (targetDist - w * 0.15) / (w * 0.45)));
        this.spread += (this.targetSpread - this.spread) * 0.06;
        this.sway += 0.04;
        this.ridgeY = this.spread * 60;

        this._updateGuyRopes(canvas);
    },

    _updateGuyRopes(canvas) {
        if (this.spread < 0.5) {
            this.guyRopes = [];
            return;
        }

        const cx = this.centerX;
        const cy = this.centerY;
        const w = canvas.width;
        const h = canvas.height;

        const anchors = [
            { x: w * 0.05, y: h * 0.65, tent: { x: cx - w * 0.25 * this.spread, y: cy - 30 } },
            { x: w * 0.05, y: h * 0.85, tent: { x: cx - w * 0.2 * this.spread, y: cy + 10 } },
            { x: w * 0.95, y: h * 0.65, tent: { x: cx + w * 0.25 * this.spread, y: cy - 30 } },
            { x: w * 0.95, y: h * 0.85, tent: { x: cx + w * 0.2 * this.spread, y: cy + 10 } }
        ];

        if (this.guyRopes.length === 0) {
            anchors.forEach(a => {
                this.guyRopes.push(new GuyRope(a.x, a.y, a.tent.x, a.tent.y));
            });
        } else {
            anchors.forEach((a, i) => {
                if (this.guyRopes[i]) {
                    this.guyRopes[i].update(a.tent.x, a.tent.y, this.sway);
                }
            });
        }
    },

    draw(ctx) {
        if (this.fibers.length === 0) return;

        const cx = this.centerX;
        const cy = this.centerY - this.ridgeY;
        const spreadDist = this.spread * Math.min(window.innerWidth, 1920) * 0.45;

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';

        for (let i = 0; i < this.fibers.length; i++) {
            const f = this.fibers[i];
            f.alpha = Math.min(1, f.alpha + 0.04);
            f.draw(ctx, cx, cy, spreadDist, this.sway);
        }

        this.guyRopes.forEach(r => r.draw(ctx));

        if (this.spread > 0.05) {
            ctx.save();
            ctx.globalAlpha = Math.min(0.6, this.spread * 0.8);
            const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, spreadDist);
            grad.addColorStop(0, 'rgba(15, 10, 5, 0.4)');
            grad.addColorStop(0.5, 'rgba(20, 14, 8, 0.15)');
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.ellipse(cx, cy, spreadDist * 0.7, spreadDist * 0.45, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        if (this.leftHand && this.rightHand) {
            ctx.save();
            ctx.globalAlpha = 0.7;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 4]);
            ctx.beginPath();
            ctx.moveTo(this.leftHand.x, this.leftHand.y);
            ctx.lineTo(this.centerX - spreadDist * 0.5, cy);
            ctx.moveTo(this.rightHand.x, this.rightHand.y);
            ctx.lineTo(this.centerX + spreadDist * 0.5, cy);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }

        ctx.restore();
    },

    clear() {
        this.fibers = [];
        this.guyRopes = [];
        this.leftHand = null;
        this.rightHand = null;
        this.spread = 0;
    }
};
