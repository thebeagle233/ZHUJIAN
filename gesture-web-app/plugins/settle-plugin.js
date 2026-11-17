/**
 * 阶段4：落地 - 织物、拉索和四壁完成
 *
 * 用户动作：双手稍微向下压，并保持
 *
 * 视觉：
 *   - 两侧篷布向地面延伸
 *   - 拉索端点向下固定
 *   - 地桩或锚固点出现
 *   - 帐篷底部与现实地面产生接触
 */

class Stake {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.alpha = 0;
    }

    update() {
        this.alpha = Math.min(1, this.alpha + 0.04);
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;

        ctx.fillStyle = 'rgba(40, 30, 20, 0.85)';
        ctx.beginPath();
        ctx.moveTo(this.x - 4, this.y);
        ctx.lineTo(this.x + 4, this.y);
        ctx.lineTo(this.x + 1, this.y + 18);
        ctx.lineTo(this.x - 1, this.y + 18);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = 'rgba(120, 110, 95, 0.9)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

export const settlePlugin = {
    name: 'settle',
    stakes: [],
    initOnce: false,
    settleProgress: 0,
    lastSettleY: null,
    groundY: 0,

    init(canvas) {
        this.stakes = [];
        this.initOnce = false;
        this.settleProgress = 0;
        this.lastSettleY = null;
        this.groundY = canvas.height * 0.92;
    },

    update(landmarksList, canvas, progress = 0) {
        if (!canvas) return;
        if (!this.initOnce) {
            this._initStakes(canvas);
        }

        if (landmarksList.length >= 2) {
            const hands = landmarksList.slice(0, 2).map(lm => lm[0].y * canvas.height);
            const avgY = (hands[0] + hands[1]) / 2;
            if (this.lastSettleY !== null) {
                if (avgY > this.lastSettleY) {
                    this.settleProgress = Math.min(1, this.settleProgress + 0.02);
                }
            }
            this.lastSettleY = avgY;
        } else {
            this.lastSettleY = null;
        }

        this.settleProgress = Math.max(this.settleProgress, progress || 0);

        this.stakes.forEach(s => s.update());
    },

    _initStakes(canvas) {
        this.groundY = canvas.height * 0.92;
        const positions = [0.08, 0.18, 0.32, 0.5, 0.68, 0.82, 0.92];
        positions.forEach(p => {
            this.stakes.push(new Stake(canvas.width * p, this.groundY));
        });
        this.initOnce = true;
    },

    draw(ctx) {
        ctx.save();
        const grad = ctx.createLinearGradient(0, this.groundY - 2, 0, this.groundY + 8);
        grad.addColorStop(0, 'rgba(20, 12, 6, 0)');
        grad.addColorStop(0.5, 'rgba(20, 12, 6, 0.18)');
        grad.addColorStop(1, 'rgba(20, 12, 6, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, this.groundY - 2, ctx.canvas.width, 12);
        ctx.restore();

        this.stakes.forEach(s => s.draw(ctx));
    },

    clear() {
        this.stakes = [];
        this.initOnce = false;
        this.settleProgress = 0;
        this.lastSettleY = null;
    }
};
