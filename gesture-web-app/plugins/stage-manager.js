const STAGES = [
    { id: 'weave',    prompt: '双手拉开，横向划过，再向下压紧。' },
    { id: 'tension',  prompt: '双手向两侧缓慢拉开，撑起一个空间。' },
    { id: 'balance',  prompt: '调整双手位置，让两侧力量平衡。' },
    { id: 'settle',   prompt: '双手向下压，让空间落地。' },
    { id: 'focus',    prompt: '真实帐篷正在显现。' },
    { id: 'reveal',   prompt: '你刚刚撑起的空间，来自西藏巴青黑牛毛帐篷的张拉营造智慧。' }
];

class StageManager {
    constructor() {
        this.currentIndex = 0;
        this.stageProgress = 0;
        this.pluginMap = {};
        this.lastHandDist = null;
        this.balanceStableFrames = 0;
        this.stableThreshold = 60;
        this.spreadFrames = 0;
        this.spreadThreshold = 35;
        this.lastSettleY = null;
        this.settleFrames = 0;
        this.settleThreshold = 45;
        this.focusFrames = 0;
        this.focusThreshold = 90;
    }

    bind(pluginMap) {
        this.pluginMap = pluginMap;
    }

    reset() {
        this.currentIndex = 0;
        this.stageProgress = 0;
        this.lastHandDist = null;
        this.balanceStableFrames = 0;
        this.spreadFrames = 0;
        this.lastSettleY = null;
        this.settleFrames = 0;
        this.focusFrames = 0;
    }

    getCurrentStage() {
        return STAGES[this.currentIndex] || STAGES[STAGES.length - 1];
    }

    getCurrentPrompt() {
        return this.getCurrentStage().prompt;
    }

    shouldShowHands() {
        const stageId = this.getCurrentStage().id;
        return stageId !== 'focus' && stageId !== 'reveal';
    }

    update(landmarksList, canvas) {
        if (landmarksList.length < 2) {
            this.lastHandDist = null;
            this.lastSettleY = null;
            return;
        }

        const hands = landmarksList.slice(0, 2).map(lm => ({
            x: lm[0].x * canvas.width,
            y: lm[0].y * canvas.height
        }));

        const dist = Math.hypot(hands[0].x - hands[1].x, hands[0].y - hands[1].y);
        const avgY = (hands[0].y + hands[1].y) / 2;

        this._updateStageLogic(hands, dist, avgY, canvas);
    }

    _updateStageLogic(hands, dist, avgY, canvas) {
        const stageId = this.getCurrentStage().id;
        const w = canvas.width;
        const h = canvas.height;

        if (stageId === 'weave') {
            if (this.lastHandDist !== null) {
                const delta = Math.abs(dist - this.lastHandDist);
                if (delta > 12 && dist > w * 0.18) {
                    this.stageProgress = Math.min(1, this.stageProgress + 0.01);
                }
            }
            this.lastHandDist = dist;

            if (this.stageProgress >= 1 && dist > w * 0.45) {
                this._nextStage();
            } else if (this.stageProgress >= 1 && dist <= w * 0.45) {
                this.stageProgress = 0.95;
            }
        }
        else if (stageId === 'tension') {
            if (dist > w * 0.5) {
                this.spreadFrames = Math.min(this.spreadFrames + 1, this.spreadThreshold);
            } else if (dist < w * 0.25) {
                this.spreadFrames = Math.max(0, this.spreadFrames - 1);
            }
            this.stageProgress = this.spreadFrames / this.spreadThreshold;
            if (this.spreadFrames >= this.spreadThreshold) {
                this._nextStage();
            }
        }
        else if (stageId === 'balance') {
            const yDiff = Math.abs(hands[0].y - hands[1].y);
            const balanced = yDiff < h * 0.06 && dist > w * 0.35;

            if (balanced) {
                this.balanceStableFrames = Math.min(this.balanceStableFrames + 1, this.stableThreshold);
            } else {
                this.balanceStableFrames = Math.max(0, this.balanceStableFrames - 2);
            }
            this.stageProgress = this.balanceStableFrames / this.stableThreshold;
            if (this.balanceStableFrames >= this.stableThreshold) {
                this._nextStage();
            }
        }
        else if (stageId === 'settle') {
            if (this.lastSettleY === null) {
                this.lastSettleY = avgY;
            }
            const yDelta = avgY - this.lastSettleY;
            const h = canvas.height;
            if (yDelta > 3) {
                this.settleFrames = Math.min(this.settleFrames + 2, this.settleThreshold);
            } else if (avgY > h * 0.55) {
                this.settleFrames = Math.min(this.settleFrames + 1, this.settleThreshold);
            }
            this.lastSettleY = avgY;
            this.stageProgress = this.settleFrames / this.settleThreshold;
            if (this.settleFrames >= this.settleThreshold) {
                this._nextStage();
            }
        }
        else if (stageId === 'focus') {
            this.focusFrames = Math.min(this.focusFrames + 1, this.focusThreshold);
            this.stageProgress = this.focusFrames / this.focusThreshold;
            if (this.focusFrames >= this.focusThreshold) {
                this._nextStage();
            }
        }
    }

    _nextStage() {
        if (this.currentIndex < STAGES.length - 1) {
            this.currentIndex++;
            this.stageProgress = 0;
            this.balanceStableFrames = 0;
            this.spreadFrames = 0;
            this.settleFrames = 0;
            this.focusFrames = 0;
            this.lastSettleY = null;
            console.log(`[Stage] -> ${STAGES[this.currentIndex].id}`);
        }
    }
}

export const stageManager = new StageManager();
export { STAGES };
