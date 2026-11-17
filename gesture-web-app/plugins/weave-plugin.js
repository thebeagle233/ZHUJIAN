/**
 * 阶段1：编织 - 多根毛线交织，形成窄幅织物
 *
 * 用户动作：
 *   1. 张开经线：双手缓慢向左右分开
 *   2. 穿过纬线：单手横向划过
 *   3. 压紧一行：双手同时向下
 *
 * 视觉：
 *   - 在两手之间绘制一组平行的经线（深褐/近黑）
 *   - 横向移动时，在经线之间画纬线
 *   - 每次向下移动，新增一行织物
 *   - 多幅窄幅织物并排显示
 *   - 织物之间自动连接，形成缝合线
 */

class YarnLine {
    constructor(x1, y1, x2, y2, color) {
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
        this.color = color;
        this.thickness = 1.2 + Math.random() * 0.6;
        this.alpha = 0;
    }

    update(x1, y1, x2, y2) {
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
        this.alpha = Math.min(1, this.alpha + 0.05);
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha * 0.92;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.thickness;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(this.x1, this.y1);
        const midX = (this.x1 + this.x2) / 2;
        const midY = (this.y1 + this.y2) / 2;
        ctx.quadraticCurveTo(midX, midY - 1, this.x2, this.y2);
        ctx.stroke();

        for (let i = 0; i < 3; i++) {
            const t = 0.3 + i * 0.2;
            const px = this.x1 + (this.x2 - this.x1) * t;
            const py = this.y1 + (this.y2 - this.y1) * t;
            const ang = (Math.random() - 0.5) * 1.4;
            const len = 2 + Math.random() * 3;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px + Math.cos(ang) * len, py + Math.sin(ang) * len);
            ctx.stroke();
        }
        ctx.restore();
    }
}

class WeavePanel {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.warpCount = 18;
        this.weftCount = 0;
        this.maxWefts = 30;
        this.warps = [];
        this.wefts = [];
        this.alpha = 0;
        this.targetAlpha = 1;
        this.seam = [];
    }

    buildWarps() {
        for (let i = 0; i < this.warpCount; i++) {
            const t = i / (this.warpCount - 1);
            const x = this.x + t * this.width;
            const shade = Math.random() * 0.3;
            this.warps.push(new YarnLine(
                x, this.y,
                x, this.y + this.height,
                `hsl(25, ${20 + shade * 25}%, ${10 + shade * 8}%)`
            ));
        }
        this.wefts.push(new YarnLine(
            this.x, this.y - 6,
            this.x + this.width, this.y - 6,
            `hsl(8, 35%, 22%)`
        ));
    }

    addWeft(yPos, isWeaveUp) {
        if (this.wefts.length >= this.maxWefts) return;
        const colorIdx = Math.floor(Math.random() * 4);
        const palette = [
            'hsl(2, 45%, 24%)',
            'hsl(220, 35%, 22%)',
            'hsl(35, 50%, 32%)',
            'hsl(150, 25%, 18%)'
        ];
        const line = new YarnLine(
            this.x, yPos,
            this.x + this.width, yPos,
            palette[colorIdx]
        );
        line.alpha = 0.85;
        this.wefts.push(line);
        this.weftCount++;
    }

    addSeamPoint(x, y) {
        this.seam.push({ x, y, alpha: 0 });
    }

    update() {
        this.alpha += (this.targetAlpha - this.alpha) * 0.05;
        this.warps.forEach(w => {
            w.update(w.x1, w.y1, w.x2, w.y2);
        });
        this.seam.forEach(s => {
            s.alpha = Math.min(1, s.alpha + 0.04);
        });
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        this.warps.forEach(w => w.draw(ctx));
        this.wefts.forEach(w => w.draw(ctx));

        if (this.seam.length > 1) {
            ctx.strokeStyle = 'rgba(20, 12, 6, 0.7)';
            ctx.lineWidth = 1.4;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            this.seam.forEach((p, i) => {
                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            });
            ctx.stroke();
            ctx.setLineDash([]);
        }
        ctx.restore();
    }
}

export const weavePlugin = {
    name: 'weave',
    panels: [],
    lastHandPositions: null,
    lastHandsY: null,
    weftRowCount: 0,
    panelSpacing: 0,
    lastAddWeftTime: 0,

    init(canvas) {
        this.panels = [];
        this.lastHandPositions = null;
        this.lastHandsY = null;
        this.weftRowCount = 0;
        this.panelSpacing = Math.min(canvas.width * 0.18, 180);
    },

    update(landmarksList, canvas, progress = 0) {
        if (!canvas) return;
        if (this.panels.length === 0) {
            this._initPanels(canvas);
        }

        if (landmarksList.length < 2) {
            this.lastHandPositions = null;
            return;
        }

        const hands = landmarksList.slice(0, 2).map(lm => ({
            x: lm[0].x * canvas.width,
            y: lm[0].y * canvas.height
        }));
        const leftHand = hands[0].x < hands[1].x ? hands[0] : hands[1];
        const rightHand = hands[0].x < hands[1].x ? hands[1] : hands[0];

        const dist = Math.hypot(rightHand.x - leftHand.x, rightHand.y - leftHand.y);
        const now = performance.now();

        if (this.lastHandPositions) {
            const prevLeft = this.lastHandPositions.left;
            const prevRight = this.lastHandPositions.right;
            const dyLeft = leftHand.y - prevLeft.y;
            const dyRight = rightHand.y - prevRight.y;

            if (Math.abs(dyLeft) < 2 && Math.abs(dyRight) < 2 && dist > canvas.width * 0.3) {
                if (now - this.lastAddWeftTime > 350) {
                    this._addWeftRow(leftHand, rightHand, canvas);
                    this.lastAddWeftTime = now;
                }
            }

            if (dyLeft > 4 && dyRight > 4) {
                this.weftRowCount = Math.max(0, this.weftRowCount - 1);
                this._removeLastWeft();
            }
        }

        this.lastHandPositions = { left: leftHand, right: rightHand };

        this.panels.forEach(panel => {
            const targetW = dist;
            const newWidth = Math.max(canvas.width * 0.15, targetW * 0.7);
            const targetX = (leftHand.x + rightHand.x) / 2 - newWidth / 2;
            const targetY = (leftHand.y + rightHand.y) / 2 - panel.height / 2;

            panel.x += (targetX - panel.x) * 0.08;
            panel.y += (targetY - panel.y) * 0.08;
            panel.width += (newWidth - panel.width) * 0.08;
            panel.update();

            if (Math.random() < 0.04) {
                const seamX = panel.x + (Math.random() * 0.8 + 0.1) * panel.width;
                const seamY = panel.y + (Math.random() * 0.8 + 0.1) * panel.height;
                panel.addSeamPoint(seamX, seamY);
            }
        });
    },

    _initPanels(canvas) {
        const baseY = canvas.height * 0.55;
        const panelHeight = canvas.height * 0.45;
        const panelCount = 3;

        for (let i = 0; i < panelCount; i++) {
            const panel = new WeavePanel(
                canvas.width * 0.1 + i * (canvas.width * 0.8 / panelCount),
                baseY,
                canvas.width * 0.22,
                panelHeight
            );
            panel.buildWarps();
            this.panels.push(panel);
        }
    },

    _addWeftRow(leftHand, rightHand, canvas) {
        const centerY = (leftHand.y + rightHand.y) / 2;
        const basePanel = this.panels[0];
        const relativeY = centerY - basePanel.y;
        if (relativeY > 0 && relativeY < basePanel.height) {
            const isUp = this.weftRowCount % 2 === 0;
            this.panels.forEach(panel => {
                panel.addWeft(panel.y + relativeY, isUp);
            });
            this.weftRowCount++;
        }
    },

    _removeLastWeft() {
        this.panels.forEach(panel => {
            if (panel.wefts.length > 1) {
                panel.wefts.pop();
                panel.weftCount--;
            }
        });
    },

    draw(ctx) {
        this.panels.forEach(panel => panel.draw(ctx));
    },

    clear() {
        this.panels = [];
        this.lastHandPositions = null;
        this.lastHandsY = null;
        this.weftRowCount = 0;
    }
};
