/**
 * 阶段3：平衡 - 用户调整左右张力
 *
 * 用户动作：调整双手高度，使左右力量平衡
 *
 * 视觉：
 *   - 当左右手高度差过大时，帐篷倾斜
 *   - 当左右手高度一致时，帐篷稳定
 *   - 篷布平静下来，结构轮廓稳定
 *   - 画面产生轻微的呼吸感
 */

class BalanceIndicator {
    constructor() {
        this.alpha = 0;
        this.tiltAngle = 0;
        this.breathingPhase = 0;
        this.stabilityScore = 0;
    }

    draw(ctx, canvas, hands, stabilityScore) {
        this.alpha = Math.min(1, this.alpha + 0.04);
        this.breathingPhase += 0.025;

        if (hands && hands.length >= 2) {
            const yDiff = hands[0].y - hands[1].y;
            this.tiltAngle = yDiff * 0.0008;
        }

        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height * 0.45);
        ctx.rotate(this.tiltAngle);

        const breathing = Math.sin(this.breathingPhase) * 2;
        const w = canvas.width * 0.6;
        const h = canvas.height * 0.5;

        ctx.globalAlpha = this.alpha * 0.18;
        ctx.fillStyle = 'rgba(15, 10, 5, 0.6)';
        ctx.beginPath();
        ctx.moveTo(-w / 2, h / 3);
        ctx.quadraticCurveTo(-w / 4, -h / 3 + breathing, 0, -h / 2 + breathing);
        ctx.quadraticCurveTo(w / 4, -h / 3 + breathing, w / 2, h / 3);
        ctx.lineTo(w / 2, h / 2);
        ctx.lineTo(-w / 2, h / 2);
        ctx.closePath();
        ctx.fill();

        ctx.globalAlpha = this.alpha * 0.12;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 6; i++) {
            const yy = -h / 3 + (i / 5) * h;
            const ww = w * (0.3 + (i / 5) * 0.5);
            ctx.beginPath();
            ctx.moveTo(-ww / 2, yy + breathing);
            ctx.quadraticCurveTo(0, yy - 10 + breathing, ww / 2, yy + breathing);
            ctx.stroke();
        }

        ctx.restore();
    }
}

export const balancePlugin = {
    name: 'balance',
    indicator: null,
    lastHands: null,
    balanceFrames: 0,

    init(canvas) {
        this.indicator = new BalanceIndicator();
        this.lastHands = null;
        this.balanceFrames = 0;
    },

    update(landmarksList, canvas, progress = 0) {
        if (!canvas) return;
        if (!this.indicator) this.init(canvas);

        if (landmarksList.length >= 2) {
            this.lastHands = landmarksList.slice(0, 2).map(lm => ({
                x: lm[0].x * canvas.width,
                y: lm[0].y * canvas.height
            }));
        }
    },

    draw(ctx) {
        if (!this.indicator) return;
        this.indicator.draw(ctx, { width: ctx.canvas.width, height: ctx.canvas.height }, this.lastHands, 0);
    },

    clear() {
        this.indicator = null;
        this.lastHands = null;
        this.balanceFrames = 0;
    }
};
