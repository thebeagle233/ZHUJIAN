import { constructionPhase } from './modules/cloth-motion.js?v=free-cloth-v5';
import { GestureEngine } from './modules/gesture-engine.js';
import { ExperienceState, STAGES } from './modules/experience-state.js?v=free-cloth-v5';
import { TentRenderer } from './modules/tent-renderer.js?v=free-cloth-v5';

const $ = (selector) => document.querySelector(selector);
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const DEMO_STAGE_RATES = {
  weave: .58,
  tension: .58,
  balance: .62,
  settle: .82,
};

const RESULT_HISTORY = '巴青牛毛帐篷编制技艺流传于藏北牧区，2021 年列入第五批国家级非物质文化遗产代表性项目名录。传统帐篷通常由多幅“日雅”粗氆氇缝合而成，制作需经过剪毛、梳毛、捻线、卷线、铺线、编织等工序，再通过拉绳、撑杆和木橛调整张力。它不是固定在地上的房子，而是牧民随草场迁徙时，一次次被重新撑起的家。';
const RESULT_VARIANTS = [
  ['逆风而立的帐篷', 87, '向外生长'],
  ['缓慢生长的帐篷', 92, '稳定张拉'],
  ['向光展开的帐篷', 84, '舒展成形'],
  ['稳稳落地的帐篷', 95, '力量平衡'],
  ['被风塑形的帐篷', 78, '轻微倾斜'],
  ['低伏于地的帐篷', 81, '贴地展开'],
  ['正在呼吸的帐篷', 89, '柔性悬停'],
  ['向外扩展的帐篷', 86, '边界展开'],
].map(([type, stability, structure]) => ({ type, stability, structure }));

const root = $('.experience');
const video = $('#camera');
const canvas = $('#experience-canvas');
const startCameraButton = $('#start-camera');
const startDemoButton = $('#start-demo');
const backHomeButton = $('#back-home');
const status = $('#camera-status');
const statusText = status.querySelector('span');
const phaseItems = [...document.querySelectorAll('#phase-list li')];
const phaseLine = $('#phase-line-progress');
const stageIndex = $('#stage-index');
const stageName = $('#stage-name');
const stagePrompt = $('#stage-prompt');
const holdMeter = $('#hold-meter-fill');
const feedback = $('#stage-feedback');
const errorPanel = $('#error-panel');
const errorCopy = $('#error-copy');
const reveal = $('#reveal');
const processSheet = $('#process-sheet');
const resultTitle = $('#result-title');
const resultType = $('#result-type');
const resultStability = $('#result-stability');
const resultStructure = $('#result-structure');
const resultSource = $('#result-source');
const resultHistory = $('#result-history');
const sharePage = $('#share-page');
const shareProcessVideo = $('#share-process-video');
const sharePlay = $('#share-play');
const shareResultType = $('#share-result-type');
const shareStability = $('#share-stability');
const shareStructure = $('#share-structure');
const shareSource = $('#share-source');
const shareHistory = $('#share-history');
const layoutOptions = [...document.querySelectorAll('[data-layout-option]')];
const directoryItems = [...document.querySelectorAll('.directory-item')];
const directoryFeedback = $('#directory-feedback');
const landscapeResultHint = $('#landscape-result-hint');

function setLayout(layout) {
  document.body.dataset.layout = layout;
  layoutOptions.forEach((option) => {
    const active = option.dataset.layoutOption === layout;
    option.classList.toggle('is-active', active);
    option.setAttribute('aria-pressed', String(active));
  });
  try { localStorage.setItem('gesture-app-layout', layout); } catch (error) { console.warn(error); }
  if (layout === 'landscape') requestAnimationFrame(() => renderer.resize());
}

function openDirectoryItem(item) {
  const title = item.querySelector('.item-title')?.textContent || '';
  if (item.dataset.project !== 'tent') {
    if (directoryFeedback) {
      directoryFeedback.textContent = `${title} · 即将开放`;
      directoryFeedback.style.color = '#9d7c3f';
    }
    return;
  }
  directoryItems.forEach((entry) => entry.classList.toggle('is-active', entry === item));
  if (directoryFeedback) directoryFeedback.textContent = '点击项目进入体验';
  returnHome();
  setLayout('landscape');
}

layoutOptions.forEach((option) => {
  option.addEventListener('click', () => {
    if (option.dataset.layoutOption === 'directory' && root.classList.contains('has-started')) returnHome();
    setLayout(option.dataset.layoutOption);
  });
});

directoryItems.forEach((item) => {
  item.addEventListener('click', () => openDirectoryItem(item));
  item.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openDirectoryItem(item);
    }
  });
});

$('#shell-brand')?.addEventListener('click', (event) => {
  event.preventDefault();
  if (root.classList.contains('has-started')) returnHome();
  setLayout('directory');
});

try {
  const requestedLayout = new URLSearchParams(location.search).get('layout');
  const savedLayout = localStorage.getItem('gesture-app-layout');
  setLayout(requestedLayout === 'landscape' || requestedLayout === 'directory'
    ? requestedLayout
    : savedLayout === 'landscape' ? 'landscape' : 'directory');
} catch (error) {
  setLayout('directory');
}

const renderer = new TentRenderer(canvas);
const gestures = new GestureEngine();
let handLandmarker = null;
let mediaStream = null;
let running = false;
let demoMode = false;
let reviewingTension = false;
let reviewPaused = false;
let lastFrame = performance.now();
let lastDetection = 0;
let latestInput = emptyInput();
let animationFrame = 0;
let landscapeHintTimer = null;
let resultCounterFrame = null;
let lastResultIndex = -1;
let processRecorder = null;
let processVideoChunks = [];
let processVideoUrl = '';

function pickResultVariant() {
  const randomBuffer = new Uint32Array(1);
  const randomValue = window.crypto?.getRandomValues
    ? window.crypto.getRandomValues(randomBuffer)[0] / 4294967296
    : Math.random();
  let index = Math.floor(randomValue * RESULT_VARIANTS.length);
  if (RESULT_VARIANTS.length > 1 && index === lastResultIndex) {
    index = (index + 1) % RESULT_VARIANTS.length;
  }
  lastResultIndex = index;
  return RESULT_VARIANTS[index];
}

function clearLandscapeHint() {
  window.clearTimeout(landscapeHintTimer);
  landscapeHintTimer = null;
  landscapeResultHint?.classList.remove('is-visible');
}

function scheduleLandscapeHint() {
  clearLandscapeHint();
  landscapeHintTimer = window.setTimeout(() => {
    landscapeResultHint?.classList.add('is-visible');
  }, 2000);
}

function beginResultGeneration() {
  const result = pickResultVariant();
  resultType.textContent = `「${result.type}」`;
  resultStability.textContent = '58%';
  resultStructure.textContent = result.structure;
  resultSource.textContent = '灵感来自藏族牛毛帐篷营造技艺';
  resultHistory.textContent = RESULT_HISTORY;
  if (resultCounterFrame) cancelAnimationFrame(resultCounterFrame);
  const startedAt = performance.now();
  const countUp = (now) => {
    const progress = clamp((now - startedAt) / 2800);
    const eased = 1 - Math.pow(1 - progress, 3);
    resultStability.textContent = `${Math.round(58 + (result.stability - 58) * eased)}%`;
    if (progress < 1) resultCounterFrame = requestAnimationFrame(countUp);
  };
  resultCounterFrame = requestAnimationFrame(countUp);
}

function startProcessRecording(stream) {
  if (!window.MediaRecorder || !stream) return;
  if (processVideoUrl) {
    URL.revokeObjectURL(processVideoUrl);
    processVideoUrl = '';
  }
  processVideoChunks = [];
  try {
    processRecorder = new MediaRecorder(stream);
    processRecorder.addEventListener('dataavailable', (event) => {
      if (event.data?.size) processVideoChunks.push(event.data);
    });
    processRecorder.start(1000);
  } catch (error) {
    processRecorder = null;
    console.warn('Process recording is unavailable:', error);
  }
}

function stopProcessRecording() {
  return new Promise((resolve) => {
    if (!processRecorder || processRecorder.state === 'inactive') {
      resolve(processVideoUrl);
      return;
    }
    processRecorder.addEventListener('stop', () => {
      if (processVideoUrl) URL.revokeObjectURL(processVideoUrl);
      const mimeType = processRecorder?.mimeType || 'video/webm';
      const blob = new Blob(processVideoChunks, { type: mimeType });
      processVideoUrl = blob.size ? URL.createObjectURL(blob) : '';
      resolve(processVideoUrl);
    }, { once: true });
    processRecorder.stop();
  });
}

function openSharePage(videoUrl = '') {
  shareResultType.textContent = resultType?.textContent || '';
  shareStability.textContent = resultStability?.textContent || '';
  shareStructure.textContent = resultStructure?.textContent || '';
  shareSource.textContent = resultSource?.textContent || '';
  shareHistory.textContent = resultHistory?.textContent || RESULT_HISTORY;
  if (videoUrl) {
    shareProcessVideo.src = videoUrl;
    shareProcessVideo.load();
    shareProcessVideo.play().then(() => sharePlay.classList.add('is-playing')).catch(() => {});
  } else {
    shareProcessVideo.removeAttribute('src');
    shareProcessVideo.load();
  }
  sharePage.removeAttribute('aria-hidden');
  root.classList.add('is-share-open');
}

function closeSharePage() {
  root.classList.remove('is-share-open');
  sharePage.setAttribute('aria-hidden', 'true');
  shareProcessVideo.pause();
  sharePlay.classList.remove('is-playing');
}

function emptyInput() {
  return {
    hands: [], landmarks: [], handCount: 0, distance: 0,
    averageY: .56, centerX: .5, heightDifference: 0,
    motion: 0, events: [], dt: 1 / 60,
  };
}

function setLandscapeProgress(progress = 0, isWindHold = false) {
  const amount = clamp(progress);
  const revealAmount = clamp(amount / .34);
  const sceneReveal = 1 - Math.pow(1 - revealAmount, 3);
  const farAmount = clamp((amount - .28) / .72);
  const farMix = 1 - Math.pow(1 - farAmount, 3);
  root.style.setProperty('--landscape-reveal', sceneReveal.toFixed(4));
  root.style.setProperty('--landscape-near', (1 - farMix).toFixed(4));
  root.style.setProperty('--landscape-far', farMix.toFixed(4));
  root.style.setProperty('--landscape-near-scale', (1.02 - farMix * .22).toFixed(4));
  root.style.setProperty('--landscape-scale', (1.13 - farMix * .13).toFixed(4));
  root.style.setProperty('--canvas-scale', (1 - sceneReveal * .16).toFixed(4));
  root.style.setProperty('--canvas-blur', `${(sceneReveal * 6).toFixed(2)}px`);
  root.style.setProperty('--canvas-saturation', (1 - sceneReveal * .62).toFixed(4));
  root.style.setProperty('--canvas-brightness', (1 + sceneReveal * .2).toFixed(4));
  root.style.setProperty('--peel-opacity', (Math.sin(amount * Math.PI) * .34).toFixed(4));
  root.classList.toggle('is-wind-hold', isWindHold);
}

const state = new ExperienceState({
  onStageChange: updateStageUI,
  onFeedback: () => {
    renderer.pulse();
    feedback.classList.remove('pulse');
    void feedback.offsetWidth;
    feedback.classList.add('pulse');
  },
});

class DemoDriver {
  constructor() { this.reset(); }
  reset() { this.stage = ''; this.marks = new Set(); this.balanceElapsed=0; this.balanceFinished=false; this.lastSampleTime=0; }

  balanceSample(input, snapshot, now) {
    if(snapshot.progress<.8 || this.balanceFinished)return;
    const dt=this.lastSampleTime?clamp((now-this.lastSampleTime)/1000,0,.05):0;
    this.balanceElapsed+=dt;
    const t=this.balanceElapsed;
    const keys=[
      [0,[.17,.50,1],[.83,.50,1],'先牵住两侧，感受布面的松紧。'],
      [.5,[.17,.50,1],[.83,.50,1],'演示：左手提起，右手保持原位。'],
      [1.4,[.13,.34,1],[.83,.50,1],'演示：左侧提起，右侧保持原位。'],
      [2.1,[.17,.50,1],[.83,.50,1],'演示：两侧可以分别上下、左右移动。'],
      [3,[.22,.61,1],[.89,.38,1],'演示：一侧放低，另一侧向外提起。'],
      [3.6,[.17,.50,1],[.83,.50,1],'演示：收拢左侧，让拉绳变松。'],
      [4.3,[.42,.65,1],[.83,.50,1],'左侧牵引不足，布面开始局部塌落。'],
      [5.5,[.42,.65,1],[.83,.50,1],'左侧松垂，右侧仍然受到牵引。'],
      [5.6,[.14,.70,0],[.86,.70,0],'演示：松开两侧，观察布面塌落。'],
      [8.1,[.14,.70,0],[.86,.70,0],'牵引消失，布面已经塌下。'],
      [8.2,[.12,.44,1],[.88,.44,1],'重新向外提起两侧，布面可以再次展开。'],
      [9.8,[.12,.44,1],[.88,.44,1],'重新牵住后，布面正在恢复。'],
      [10.5,[.17,.50,1],[.83,.50,1],'稳住两侧力量，继续完成落地。'],
      [11.2,[.17,.50,1],[.83,.50,1],'稳住两侧力量，继续完成落地。'],
    ];
    if(t>=keys.at(-1)[0]){
      this.balanceFinished=true;input.endDemonstration=true;return;
    }
    let index=0;while(index<keys.length-2 && t>=keys[index+1][0])index++;
    const a=keys[index],b=keys[index+1];
    let progress=clamp((t-a[0])/(b[0]-a[0]));progress=progress*progress*(3-2*progress);
    input.controls=[0,1].map(i=>({x:a[i+1][0]+(b[i+1][0]-a[i+1][0])*progress,y:a[i+1][1]+(b[i+1][1]-a[i+1][1])*progress,held:a[i+1][2]===1}));
    input.hands=input.controls.map(c=>({...c,speed:.08}));
    input.handCount=input.controls.filter(c=>c.held).length;
    input.distance=Math.hypot(input.hands[1].x-input.hands[0].x,input.hands[1].y-input.hands[0].y);
    input.averageY=(input.hands[0].y+input.hands[1].y)/2;
    input.heightDifference=input.hands[0].y-input.hands[1].y;
    input.automatic=false;input.holdConstruction=true;input.demoHands=true;
    input.demonstration=a[3];
  }

  sample(snapshot, now) {
    if (snapshot.id !== this.stage) {
      this.stage = snapshot.id;
      this.marks.clear();
    }
    const elapsed = (now - snapshot.stageStarted) * (DEMO_STAGE_RATES[snapshot.id] ?? .82);
    const input = emptyInput();
    input.automatic = true;
    input.handCount = ['focus', 'dissolve', 'landscape', 'reveal'].includes(snapshot.id) ? 0 : 2;
    input.hands = [{ x: .32, y: .54, speed: .08 }, { x: .68, y: .54, speed: .08 }];
    input.distance = .36;

    if (snapshot.id === 'weave') {
      const cycle = Math.floor(elapsed / 1450);
      const phase = elapsed % 1450;
      const sweep = clamp((phase - 220) / 610);
      const press = clamp((phase - 910) / 280);
      input.hands[0] = { x: .28, y: .48 + press * .065, speed: .08 };
      input.hands[1] = { x: .34 + sweep * .38, y: .48 + press * .065, speed: phase < 850 ? .33 : .08 };
      input.distance = Math.abs(input.hands[1].x - input.hands[0].x);
      input.averageY = (input.hands[0].y + input.hands[1].y) / 2;
      if (phase > 800 && !this.marks.has(`s${cycle}`)) {
        input.events.push('sweep');
        this.marks.add(`s${cycle}`);
      }
      if (phase > 1210 && !this.marks.has(`p${cycle}`)) {
        input.events.push('press');
        this.marks.add(`p${cycle}`);
      }
    } else if (snapshot.id === 'tension') {
      const p = snapshot.progress;
      const spread = clamp(p / .25);
      const raise = clamp((p - .12) / .2);
      const drop = clamp((p - .57) / .19);
      const y = .54 - raise * .27 + drop * .23;
      input.hands = [
        { x: .5 - (.19 + spread * .15), y, speed: .08 },
        { x: .5 + (.19 + spread * .15), y, speed: .08 },
      ];
      input.distance = input.hands[1].x - input.hands[0].x;
      input.averageY = y;
      input.motion = p < .9 ? .12 : .02;
    } else if (snapshot.id === 'balance') {
      const decay = Math.max(0, 1 - elapsed / 1900);
      const offset = Math.sin(elapsed * .008) * .095 * decay;
      input.hands = [
        { x: .225, y: .52 + offset, speed: decay * .38 + .02 },
        { x: .775, y: .52 - offset, speed: decay * .38 + .02 },
      ];
      input.distance = Math.hypot(.55, offset * 2);
      input.averageY = .52;
      input.heightDifference = offset * 2;
      input.motion = decay * .45 + .02;
    } else if (snapshot.id === 'settle') {
      const down = clamp((elapsed - 220) / 950) * .075;
      input.hands = [{ x: .225, y: .5 + down, speed: .06 }, { x: .775, y: .5 + down, speed: .06 }];
      input.distance = .55;
      input.averageY = .5 + down;
      input.motion = down < .07 ? .12 : .02;
    }
    if(snapshot.id==='tension')this.balanceSample(input,snapshot,now);
    this.lastSampleTime=now;
    return input;
  }
}

const demo = new DemoDriver();

function updateStageUI(snapshot) {
  const enteringLandscape = snapshot.id === 'landscape' && !root.classList.contains('is-landscape');
  const visibleIndex = Math.min(snapshot.index, 4);
  stageIndex.textContent = `${String(visibleIndex + 1).padStart(2, '0')} / 05`;
  stageName.textContent = snapshot.name;
  stagePrompt.textContent = snapshot.prompt;
  phaseLine.style.height = `${clamp(visibleIndex / 4) * 100}%`;
  phaseItems.forEach((item, index) => {
    item.classList.toggle('is-active', index === visibleIndex && snapshot.id !== 'reveal');
    item.classList.toggle('is-past', index < visibleIndex || snapshot.id === 'reveal');
  });
  root.classList.toggle('is-focused', snapshot.id === 'focus');
  root.classList.toggle('is-dissolving', snapshot.id === 'dissolve');
  root.classList.toggle('is-landscape', snapshot.id === 'landscape');
  root.classList.toggle('is-wind-hold', snapshot.id === 'landscape');
  root.classList.toggle('is-revealed', snapshot.id === 'reveal');
  if (snapshot.id === 'focus') setLandscapeProgress(0);
  if (snapshot.id === 'landscape') {
    setLandscapeProgress(1, true);
    if (enteringLandscape) scheduleLandscapeHint();
  } else {
    clearLandscapeHint();
  }
  if (snapshot.id === 'reveal') {
    beginResultGeneration();
    reveal.removeAttribute('aria-hidden');
    setStatus('空间已完成', false);
  }
}

landscapeResultHint?.addEventListener('click', () => {
  clearLandscapeHint();
  state.transition('reveal', performance.now());
});

function setStatus(text, live = true) {
  statusText.textContent = text;
  status.classList.toggle('is-live', live);
}

function startExperience({ demo: useDemo }) {
  if (resultCounterFrame) cancelAnimationFrame(resultCounterFrame);
  demoMode = useDemo;
  running = true;
  root.classList.add('has-started', 'is-running');
  root.classList.toggle('is-demo', demoMode);
  root.classList.remove('is-revealed', 'is-focused', 'is-dissolving', 'is-landscape', 'is-wind-hold');
  clearLandscapeHint();
  setLandscapeProgress(0);
  errorPanel.classList.remove('is-visible');
  processSheet.classList.remove('is-open');
  gestures.reset();
  demo.reset();
  state.reset(performance.now());
  latestInput = emptyInput();
  lastFrame = performance.now();
  if (demoMode) setStatus('演示模式 · 模拟双手', true);
  if (!animationFrame) animationFrame = requestAnimationFrame(frame);
}

async function loadHandTracking() {
  if (handLandmarker) return handLandmarker;
  setStatus('正在准备手势识别', true);
  const { FilesetResolver, HandLandmarker } = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/vision_bundle.mjs');
  const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm');
  const options = {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numHands: 2,
    minHandDetectionConfidence: .55,
    minHandPresenceConfidence: .5,
    minTrackingConfidence: .5,
  };
  try {
    handLandmarker = await HandLandmarker.createFromOptions(vision, options);
  } catch (gpuError) {
    console.warn('GPU hand tracking unavailable, retrying on CPU.', gpuError);
    options.baseOptions.delegate = 'CPU';
    handLandmarker = await HandLandmarker.createFromOptions(vision, options);
  }
  return handLandmarker;
}

async function startCameraExperience() {
  if (!navigator.mediaDevices?.getUserMedia) {
    showCameraError('当前浏览器不支持摄像头访问。你仍可以使用演示模式查看完整交互。');
    return;
  }
  startCameraButton.disabled = true;
  startCameraButton.querySelector('span:last-child').textContent = '正在开启…';
  try {
    const [stream] = await Promise.all([
      navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      }),
      loadHandTracking(),
    ]);
    mediaStream = stream;
    video.srcObject = mediaStream;
    await video.play();
    startProcessRecording(mediaStream);
    startExperience({ demo: false });
    setStatus('摄像头在线 · 寻找双手', true);
  } catch (error) {
    console.error(error);
    const permissionDenied = error?.name === 'NotAllowedError';
    showCameraError(permissionDenied
      ? '摄像头权限被拒绝。请在浏览器地址栏的权限设置中允许访问后重试，或先使用演示模式。'
      : `手势识别没有成功启动：${error?.message || '未知错误'}。`);
  } finally {
    startCameraButton.disabled = false;
    startCameraButton.querySelector('span:last-child').textContent = '开启摄像头体验';
  }
}

function showCameraError(message) {
  errorCopy.textContent = message;
  errorPanel.classList.add('is-visible');
}

function updateGestureInput(now) {
  if (demoMode) return demo.sample(state.snapshot(), now);
  if (!handLandmarker || video.readyState < 2 || now - lastDetection < 28) return latestInput;
  lastDetection = now;
  gestures.setViewport(video.videoWidth || 1280, video.videoHeight || 720, renderer.width, renderer.height);
  try {
    const result = handLandmarker.detectForVideo(video, now);
    const input = gestures.update(result.landmarks || [], now);
    setStatus(input.handCount >= 2 ? '双手已识别' : input.handCount === 1 ? '已识别一只手' : '摄像头在线 · 寻找双手', true);
    return input;
  } catch (error) {
    console.warn('Skipped one hand-tracking frame.', error);
    return latestInput;
  }
}

function frame(now) {
  animationFrame = requestAnimationFrame(frame);
  if (!running) return;
  const dt = clamp((now - lastFrame) / 1000, .008, .05);
  lastFrame = now;
  if (reviewingTension && reviewPaused) demo.lastSampleTime = now;
  else latestInput = updateGestureInput(now);
  // Keep the completed second step on screen while reviewing its material and form.
  if (reviewingTension) latestInput = { ...latestInput, reviewHold: true };
  const snapshot = reviewingTension && reviewPaused
    ? state.snapshot() : state.update(latestInput, dt, now);
  if (reviewingTension) {
    $('#review-progress').value = String(snapshot.progress * 100);
    $('#review-phase').textContent = constructionPhase(snapshot.progress).name;
    if (snapshot.progress >= 1 && !reviewPaused) {
      reviewPaused = true;
      $('#review-pause').textContent = '播放';
    }
  }
  if (snapshot.id === 'dissolve') setLandscapeProgress(snapshot.progress);
  else if (snapshot.id === 'landscape') setLandscapeProgress(1, true);
  stagePrompt.textContent = latestInput.demonstration || snapshot.prompt;
  holdMeter.style.width = `${clamp(snapshot.holdProgress) * 100}%`;
  renderer.render(snapshot, latestInput, now);
}

function restartExperience() {
  clearLandscapeHint();
  root.classList.remove('is-revealed', 'is-focused', 'is-dissolving', 'is-landscape', 'is-wind-hold');
  setLandscapeProgress(0);
  processSheet.classList.remove('is-open');
  gestures.reset();
  demo.reset();
  state.reset(performance.now());
  reveal.setAttribute('aria-hidden', 'true');
  if (!running) startExperience({ demo: true });
}

function returnHome() {
  reviewingTension = false;
  $('#review-controls').hidden = true;
  clearLandscapeHint();
  if (resultCounterFrame) cancelAnimationFrame(resultCounterFrame);
  closeSharePage();
  void stopProcessRecording();
  running = false;
  demoMode = false;
  stopStream();
  video.srcObject = null;
  gestures.reset();
  demo.reset();
  latestInput = emptyInput();
  state.reset(performance.now());
  setLandscapeProgress(0);
  renderer.clear();
  root.classList.remove(
    'has-started', 'is-running', 'is-demo', 'is-revealed', 'is-focused',
    'is-dissolving', 'is-landscape', 'is-wind-hold', 'is-share-open',
  );
  reveal.setAttribute('aria-hidden', 'true');
  processSheet.classList.remove('is-open');
  errorPanel.classList.remove('is-visible');
  setStatus('等待开始', false);
}

function stopStream() {
  mediaStream?.getTracks().forEach((track) => track.stop());
  mediaStream = null;
}

startCameraButton.addEventListener('click', startCameraExperience);
startDemoButton.addEventListener('click', () => startExperience({ demo: true }));
$('#error-demo').addEventListener('click', () => startExperience({ demo: true }));
backHomeButton.addEventListener('click', returnHome);
$('#share-result').addEventListener('click', async () => {
  const videoUrl = await stopProcessRecording();
  openSharePage(videoUrl);
});
$('#share-page-back').addEventListener('click', closeSharePage);
$('#share-copy-link').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    const btn = $('#share-copy-link');
    const originalText = btn.textContent;
    btn.textContent = '链接已复制';
    setTimeout(() => btn.textContent = originalText, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
  }
});
sharePlay.addEventListener('click', () => {
  if (!shareProcessVideo.src) return;
  if (shareProcessVideo.paused) {
    shareProcessVideo.play().catch(() => {});
    sharePlay.classList.add('is-playing');
  } else {
    shareProcessVideo.pause();
    sharePlay.classList.remove('is-playing');
  }
});
$('#show-process').addEventListener('click', () => processSheet.classList.add('is-open'));
$('#sheet-back').addEventListener('click', () => processSheet.classList.remove('is-open'));

window.addEventListener('resize', () => renderer.resize());
window.addEventListener('pagehide', () => {
  void stopProcessRecording();
  stopStream();
});
window.addEventListener('keydown', (event) => {
  if (event.code === 'Space' && running) {
    event.preventDefault();
    if (reviewingTension) return;
    state.advance(performance.now());
  }
});

const params = new URLSearchParams(location.search);
if (params.get('demo') === '1') {
  setLayout('landscape');
  startExperience({ demo: true });
  const requestedStage = params.get('stage');
  const target = STAGES.find((item) => item.id === requestedStage);
  if (target) state.transition(target.id, performance.now());
}
if (params.get('review') === 'tension') {
  reviewingTension = true;
  setLayout('landscape');
  startExperience({ demo: true });
  state.transition('tension', performance.now());
  $('#review-controls').hidden = false;
}
$('#review-replay').addEventListener('click', () => {
  reviewPaused = false;
  $('#review-pause').textContent = '暂停';
  demo.reset();
  // Reset through weave so the normal stage transition creates a fresh session.
  state.reset(performance.now());
  state.transition('tension', performance.now());
});
$('#review-pause').addEventListener('click', () => {
  reviewPaused = !reviewPaused;
  $('#review-pause').textContent = reviewPaused ? '播放' : '暂停';
});
$('#review-progress').addEventListener('input', (event) => {
  reviewPaused = true;
  $('#review-pause').textContent = '播放';
  const progress=Number(event.target.value)/100;
  if(progress<.8){demo.balanceElapsed=0;demo.balanceFinished=false;state.clothDynamics.reset();}
  state.seekTension(progress);
});
$('#review-continue').addEventListener('click', () => {
  reviewingTension = false;
  $('#review-controls').hidden = true;
  reviewPaused = false;
});
if (params.get('sheet') === '1') {
  setLayout('landscape');
  processSheet.classList.add('is-open');
}

