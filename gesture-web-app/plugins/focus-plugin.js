/**
 * 阶段5+6：对焦 - 抽象数字空间变成真实牛毛帐篷
 *
 * 视觉：
 *   - 黑色表面显露更清晰的牦牛毛纤维
 *   - 织物出现窄幅拼接痕迹
 *   - 拉索变成更真实的牛毛绳
 *   - 顶部脊线和开口逐渐明确
 *   - 两侧墙面形成黑牛毛帐篷的真实轮廓
 *   - 整体颜色从数字黑色转向深褐黑色
 *   - 镜头轻微拉远
 *
 * 动态元素：
 *   - 拉索随风微动
 *   - 篷布轻微起伏
 *   - 牦牛毛纤维飘动
 *   - 光线变化
 *   - 雪山背景的云朵飘动
 */

class TentPanel {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.alpha = 0;
    }

    draw(ctx, progress) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        const baseHue = 25;
        const grad = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.h);
        grad.addColorStop(0, `hsl(${baseHue}, 22%, 14%)`);
        grad.addColorStop(0.5, `hsl(${baseHue}, 28%, 10%)`);
        grad.addColorStop(1, `hsl(${baseHue}, 18%, 8%)`);
        ctx.fillStyle = grad;
        ctx.fillRect(this.x, this.y, this.w, this.h);
        ctx.restore();
    }
}

export const focusPlugin = {
    name: 'focus',
    panels: [],
    progress: 0,
    frame: 0,
    guyRopes: [],
    apex: null,
    baseLeft: null,
    baseRight: null,
    camOffsetX: 0,
    camOffsetY: 0,
    skyClouds: [],

    init(canvas) {
        this.progress = 0;
        this.frame = 0;
        this.panels = [];
        this.guyRopes = [];
        this.skyClouds = [];

        const w = canvas.width;
        const h = canvas.height;

        this.panels.push(new TentPanel(w * 0.1, h * 0.45, w * 0.32, h * 0.45));
        this.panels.push(new TentPanel(w * 0.58, h * 0.45, w * 0.32, h * 0.45));
        this.panels.push(new TentPanel(w * 0.42, h * 0.2, w * 0.16, h * 0.25));

        this.apex = { x: w / 2, y: h * 0.2 };
        this.baseLeft = { x: w * 0.1, y: h * 0.9 };
        this.baseRight = { x: w * 0.9, y: h * 0.9 };

        const anchorOffsets = [
            { ax: 0.02, ay: 0.7 }, { ax: 0.05, ay: 0.9 },
            { ax: 0.95, ay: 0.7 }, { ax: 0.98, ay: 0.9 }
        ];
        const tentAttach = [
            { tx: 0.4, ty: 0.25 }, { tx: 0.4, ty: 0.5 },
            { tx: 0.6, ty: 0.25 }, { tx: 0.6, ty: 0.5 }
        ];
        anchorOffsets.forEach((a, i) => {
            this.guyRopes.push({
                anchor: { x: w * a.ax, y: h * a.ay },
                tent: { x: w * tentAttach[i].tx, y: h * tentAttach[i].ty },
                alpha: 0
            });
        });

        for (let i = 0; i < 4; i++) {
            this.skyClouds.push({
                x: w * (0.1 + i * 0.22),
                y: h * (0.1 + Math.random() * 0.15),
                w: 60 + Math.random() * 80,
                speed: 0.2 + Math.random() * 0.3
            });
        }

        this.camOffsetX = 0;
        this.camOffsetY = 0;
    },

    update(landmarksList, canvas, progress = 0) {
        if (!canvas) return;
        if (this.panels.length === 0) this.init(canvas);
        this.frame++;
        this.progress = Math.min(1, (progress || 0));

        const w = canvas.width;
        const h = canvas.height;
        this.camOffsetX = Math.sin(this.frame * 0.005) * 1.5;
        this.camOffsetY = Math.cos(this.frame * 0.004) * 1;

        this.skyClouds.forEach(c => {
            c.x += c.speed;
            if (c.x > w + c.w) c.x = -c.w;
        });

        this.panels.forEach(p => {
            p.alpha = Math.min(1, p.alpha + 0.02);
        });
    },

    draw(ctx) {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        const ease = 1 - Math.pow(1 - this.progress, 3);

        ctx.save();
        ctx.translate(this.camOffsetX, this.camOffsetY);

        if (ease > 0.05) {
            ctx.save();
            ctx.globalAlpha = ease * 0.18;
            ctx.fillStyle = 'rgba(220, 230, 245, 0.5)';
            this.skyClouds.forEach(c => {
                ctx.beginPath();
                ctx.ellipse(c.x, c.y, c.w * 0.6, c.w * 0.18, 0, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.restore();
        }

        if (ease > 0.1) {
            this.panels.forEach(p => {
                p.draw(ctx, this.progress);
            });
        }

        if (ease > 0.2) {
            ctx.save();
            ctx.globalAlpha = ease;
            ctx.strokeStyle = `hsl(25, 20%, 12%)`;
            ctx.lineWidth = 1.6;
            ctx.lineCap = 'round';
            this.guyRopes.forEach((r, i) => {
                r.alpha = Math.min(1, r.alpha + 0.02);
                ctx.globalAlpha = ease * r.alpha * 0.85;
                ctx.beginPath();
                ctx.moveTo(r.tent.x, r.tent.y);
                const midX = (r.tent.x + r.anchor.x) / 2;
                const midY = (r.tent.y + r.anchor.y) / 2 + Math.sin(this.frame * 0.04 + i) * 1.5;
                ctx.quadraticCurveTo(midX, midY, r.anchor.x, r.anchor.y);
                ctx.stroke();
            });
            ctx.restore();
        }

        if (ease > 0.3) {
            ctx.save();
            ctx.globalAlpha = ease * 0.7;
            ctx.strokeStyle = `hsl(25, 25%, 15%)`;
            ctx.lineWidth = 2.2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(this.apex.x, this.apex.y);
            ctx.lineTo(this.baseLeft.x, this.baseLeft.y);
            ctx.moveTo(this.apex.x, this.apex.y);
            ctx.lineTo(this.baseRight.x, this.baseRight.y);
            ctx.stroke();
            ctx.restore();
        }

        if (ease > 0.4) {
            ctx.save();
            ctx.globalAlpha = ease * 0.45;
            ctx.strokeStyle = `hsl(25, 22%, 16%)`;
            ctx.lineWidth = 0.5;
            const breathing = Math.sin(this.frame * 0.02) * 1.2;
            for (let i = 0; i < 14; i++) {
                const t = i / 13;
                const y = h * 0.5 + t * h * 0.4;
                const spreadX = (t * 0.4 + 0.1) * w * 0.8 * (1 - t) + breathing;
                const warp = Math.sin(this.frame * 0.015 + i * 0.5) * 1.5;
                ctx.beginPath();
                ctx.moveTo(w * 0.1, y);
                ctx.quadraticCurveTo(w / 2 + warp, y - 4, w * 0.9, y);
                ctx.stroke();
            }
            ctx.restore();
        }

        if (ease > 0.6) {
            ctx.save();
            ctx.globalAlpha = ease * 0.5;
            ctx.fillStyle = `hsl(35, 25%, 25%)`;
            for (let i = 0; i < 60; i++) {
                const px = Math.random() * w;
                const py = h * 0.5 + Math.random() * h * 0.4;
                const size = 0.4 + Math.random() * 0.8;
                ctx.beginPath();
                ctx.arc(px, py, size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        if (ease > 0.7) {
            ctx.save();
            ctx.globalAlpha = ease * 0.35;
            const apexX = this.apex.x;
            const apexY = this.apex.y;
            ctx.fillStyle = `hsl(40, 30%, 18%)`;
            ctx.beginPath();
            ctx.moveTo(apexX - 8, apexY);
            ctx.lineTo(apexX + 8, apexY);
            ctx.lineTo(apexX, apexY - 14);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        ctx.restore();
    },

    clear() {
        this.panels = [];
        this.guyRopes = [];
        this.skyClouds = [];
        this.progress = 0;
        this.frame = 0;
    }
};
