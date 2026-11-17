const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export const STAGES = [
  { id: 'weave', name: '编织', prompt: '双手拉开，横向划过，再向下压紧。' },
  { id: 'tension', name: '张拉', prompt: '双手向两侧缓慢拉开，撑起一个空间。' },
  { id: 'balance', name: '平衡', prompt: '调整双手位置，让两侧力量平衡。' },
  { id: 'settle', name: '落地', prompt: '双手轻轻向下压，并保持一秒。' },
  { id: 'focus', name: '对焦', prompt: '让空间慢慢显露它真实的样子。' },
  { id: 'dissolve', name: '远景', prompt: '让空间慢慢退回草原。' },
  { id: 'landscape', name: '风息', prompt: '风正在穿过草甸与篷布。' },
  { id: 'reveal', name: '完成', prompt: '' },
];

export class ExperienceState {
  constructor({ onStageChange, onFeedback } = {}) {
    this.onStageChange = onStageChange;
    this.onFeedback = onFeedback;
    this.reset();
  }

  reset(now = performance.now()) {
    this.stageIndex = 0;
    this.stage = STAGES[0];
    this.stageStarted = now;
    this.stageProgress = 0;
    this.holdProgress = 0;
    this.weaveRows = 0;
    this.sweepReady = false;
    this.spreadPeak = 0;
    this.settleBaseline = null;
    this.settleHold = 0;
    this.balanceHold = 0;
    this.prompt = this.stage.prompt;
    this.onStageChange?.(this.snapshot());
  }

  snapshot() {
    return {
      id: this.stage.id,
      name: this.stage.name,
      index: this.stageIndex,
      progress: this.stageProgress,
      holdProgress: this.holdProgress,
      prompt: this.prompt,
      weaveRows: this.weaveRows,
      spreadPeak: this.spreadPeak,
      stageStarted: this.stageStarted,
    };
  }

  transition(id, now) {
    const nextIndex = STAGES.findIndex((stage) => stage.id === id);
    if (nextIndex < 0 || nextIndex === this.stageIndex) return;
    this.stageIndex = nextIndex;
    this.stage = STAGES[nextIndex];
    this.stageStarted = now;
    this.stageProgress = 0;
    this.holdProgress = 0;
    this.prompt = this.stage.prompt;
    this.settleBaseline = null;
    this.settleHold = 0;
    this.balanceHold = 0;
    this.onStageChange?.(this.snapshot());
  }

  update(input, dt, now) {
    switch (this.stage.id) {
      case 'weave': this.updateWeave(input, now); break;
      case 'tension': this.updateTension(input, dt, now); break;
      case 'balance': this.updateBalance(input, dt, now); break;
      case 'settle': this.updateSettle(input, dt, now); break;
      case 'focus': this.updateFocus(dt, now); break;
      case 'dissolve': this.updateDissolve(now); break;
      case 'landscape': this.updateLandscape(now); break;
      default: break;
    }
    return this.snapshot();
  }

  updateWeave(input, now) {
    if (input.handCount < 2) {
      this.prompt = '抬起双手，让它们同时进入画面。';
      this.stageProgress = this.weaveRows / 3;
      return;
    }
    if (input.distance < .25) {
      this.prompt = '先将双手缓慢向左右拉开。';
      return;
    }

    if (input.events.includes('sweep')) {
      this.sweepReady = true;
      this.prompt = '很好。现在双手一起向下，把这一行压紧。';
      this.onFeedback?.();
    }
    if (input.events.includes('press') && this.sweepReady) {
      this.weaveRows = Math.min(3, this.weaveRows + 1);
      this.sweepReady = false;
      this.stageProgress = this.weaveRows / 3;
      this.prompt = this.weaveRows < 3
        ? `第 ${this.weaveRows} 行已经压紧，再横向穿过一次。`
        : '窄幅织物正在彼此连接。';
      this.onFeedback?.();
      if (this.weaveRows >= 3) window.setTimeout(() => this.transition('tension', performance.now()), 620);
    } else {
      this.stageProgress = this.weaveRows / 3 + (this.sweepReady ? .18 : 0);
    }
  }

  updateTension(input, dt, now) {
    if (input.handCount < 2) {
      this.prompt = '再次伸出双手，握住织物的两侧。';
      return;
    }
    const spread = clamp((input.distance - .23) / .34);
    this.spreadPeak = Math.max(this.spreadPeak, spread);
    this.stageProgress += (this.spreadPeak - this.stageProgress) * Math.min(1, dt * 5.5);
    this.prompt = this.stageProgress < .45
      ? '双手继续向两侧缓慢拉开。'
      : this.stageProgress < .82
        ? '保持缓慢，让软布开始围合空间。'
        : '空间已经撑开，感受两侧的力量。';
    if (this.stageProgress > .84) {
      this.holdProgress = clamp(this.holdProgress + dt / .65);
      if (this.holdProgress >= 1) this.transition('balance', now);
    } else {
      this.holdProgress = clamp(this.holdProgress - dt * 1.5);
    }
  }

  updateBalance(input, dt, now) {
    if (input.handCount < 2) {
      this.prompt = '保持双手可见，帐篷仍在等待两侧的力量。';
      this.holdProgress = 0;
      return;
    }
    const heightPenalty = clamp(Math.abs(input.heightDifference) / .115);
    const distancePenalty = clamp(Math.abs(input.distance - .55) / .3);
    const motionPenalty = clamp(input.motion / .62);
    const score = clamp(1 - heightPenalty * .58 - distancePenalty * .16 - motionPenalty * .26);
    this.stageProgress += (score - this.stageProgress) * Math.min(1, dt * 4.4);

    if (Math.abs(input.heightDifference) > .09) {
      this.prompt = input.heightDifference > 0 ? '左手稍低，轻轻抬高一点。' : '右手稍低，轻轻抬高一点。';
    } else if (input.motion > .48) {
      this.prompt = '动作放慢，让篷布的波动逐渐停下来。';
    } else if (score > .72) {
      this.prompt = '两侧正在趋于平衡，保持片刻。';
    } else {
      this.prompt = '微调双手的高度与距离。';
    }

    if (score > .72 && input.motion < .48) {
      this.balanceHold += dt;
    } else {
      this.balanceHold = Math.max(0, this.balanceHold - dt * 1.8);
    }
    this.holdProgress = clamp(this.balanceHold / 1.35);
    if (this.balanceHold >= 1.35) {
      this.onFeedback?.();
      this.transition('settle', now);
    }
  }

  updateSettle(input, dt, now) {
    if (input.handCount < 2) {
      this.prompt = '双手回到画面中，准备让空间落地。';
      return;
    }
    if (this.settleBaseline === null) this.settleBaseline = input.averageY;
    const downward = input.averageY - this.settleBaseline;
    this.stageProgress = clamp(downward / .095);
    if (downward > .058) {
      this.settleHold += dt;
      this.prompt = '保持一下，让拉索固定在此刻的地面。';
    } else {
      this.settleHold = Math.max(0, this.settleHold - dt * 1.25);
      this.prompt = '双手一起轻轻向下压。';
    }
    this.holdProgress = clamp(this.settleHold / .9);
    if (this.settleHold >= .9) {
      this.onFeedback?.();
      this.transition('focus', now);
    }
  }

  updateFocus(dt, now) {
    this.stageProgress = clamp((now - this.stageStarted) / 4000);
    this.holdProgress = this.stageProgress;
    if (this.stageProgress < .34) this.prompt = '牦牛毛纤维正在显露。';
    else if (this.stageProgress < .72) this.prompt = '拼接、拉索与脊线正在对焦。';
    else this.prompt = '一张软布，成为了一座可以容纳人的空间。';
    if (this.stageProgress >= 1) this.transition('dissolve', now);
  }

  updateDissolve(now) {
    this.stageProgress = clamp((now - this.stageStarted) / 5000);
    this.holdProgress = this.stageProgress;
    if (this.stageProgress < .28) this.prompt = '空间正在缓缓退向远景。';
    else if (this.stageProgress < .76) this.prompt = '纤维与拉索正在回到草原。';
    else this.prompt = '雪山、草甸与帐篷重新汇合。';
    if (this.stageProgress >= 1) this.transition('landscape', now);
  }

  updateLandscape(now) {
    this.stageProgress = clamp((now - this.stageStarted) / 5000);
    this.holdProgress = this.stageProgress;
    this.prompt = '风正在穿过草甸与篷布。';
    if (this.stageProgress >= 1) this.transition('reveal', now);
  }

  advance(now = performance.now()) {
    if (this.stage.id === 'weave') {
      this.weaveRows = Math.min(3, this.weaveRows + 1);
      this.stageProgress = this.weaveRows / 3;
      if (this.weaveRows >= 3) this.transition('tension', now);
      return;
    }
    const next = STAGES[Math.min(STAGES.length - 1, this.stageIndex + 1)];
    this.transition(next.id, now);
  }
}
