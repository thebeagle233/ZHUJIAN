/**
 * 手部追踪器：简化版，不依赖 THREE
 */
class HandTracker {
    constructor() {
        this.hands = [];
    }

    init(scene) { }

    update(landmarksList, size) {
        const w = size.width;
        const h = size.height;
        this.hands = [];

        landmarksList.slice(0, 2).forEach((lm) => {
            const wrist = lm[0];
            const x = (wrist.x - 0.5) * 6;
            const y = -(wrist.y - 0.5) * 3.5 + 0.5;
            this.hands.push({ x, y, screenX: wrist.x * w, screenY: wrist.y * h });
        });

        return this.hands;
    }
}

export const handTracker = new HandTracker();