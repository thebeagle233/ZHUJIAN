import { deformClothPoint } from './cloth-dynamics.js?v=free-cloth-v5';
const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = v => { const t = clamp(v); return t * t * (3 - 2 * t); };
const segment = (p, from, to) => smooth((p - from) / (to - from));

export const CONSTRUCTION_SECONDS = 12.8;
export function constructionPhase(p) {
  if (p < .12) return { name: '展布', prompt: '先将织好的布展开，握住两侧。' };
  if (p < .32) return { name: '扬布', prompt: '向上扬起，让整片轻薄的织物离开原位。' };
  if (p < .45) return { name: '悬展', prompt: '布面在空中舒展，边缘随气流轻轻起伏。' };
  if (p < .57) return { name: '立杆', prompt: '布还悬在上方，撑杆从下方立起。' };
  if (p < .76) return { name: '平衡落布', prompt: '保持双手平衡，让拉绳与篷布一起落下。' };
  if (p < .9) return { name: '协同落地', prompt: '稳住两侧力量，布边与绳端一起接近地面。' };
  return { name: '牵绳', prompt: '牵住边缘，拉绳绷紧，门洞逐渐显露。' };
}

// Explicit staging keeps a complete, airborne sheet visible BEFORE any tent profile.
export function constructionGeometry({ width, height, origin, progress, time = 0, cloth = null, reduced = false }) {
  const p = clamp(progress);
  const expand = segment(p, 0, .18);
  const raise = segment(p, .12, .32);
  const poles = segment(p, .45, .57);
  const drop = segment(p, .57, .76);
  const drape = segment(p, .72, .9);
  const tie = segment(p, .9, 1);
  const cx = mix(origin.cx, width * .5, expand);
  const span = mix(origin.width, Math.min(width * .7, height * 1.28), expand);
  const initialHeight = origin.bottom - origin.top;
  const airTop = mix(origin.top, height * .135, raise);
  const airHeight = mix(initialHeight, height * .22, raise);
  const finalTop = height * .285;
  const ground = height * .775;
  const waveEnvelope = Math.sin(raise * Math.PI * .8) * (1 - drop);
  // One coherent traveling wave, with gentle lag at the free edge; no random jitter.
  const wave = reduced ? 0 : Math.sin(time * .0022) * height * .033 * waveEnvelope;
  const point = (u, v, side = u < .5 ? -1 : 1, region = v < .52 ? 'roof' : 'wall') => {
    const off = (u - .5) * 2;
    let x = cx + off * span / 2 * (1 + (v - .5) * .12 * raise * (1 - drop));
    const slope = Math.pow(Math.max(0, (Math.abs(off) - .19) / .81), .9);
    const targetTop = finalTop + height * .142 * slope;
    const lip = height * (.49 + .025 * Math.sin(u * Math.PI));
    const hem = mix(height * .55, ground, drape);
    const targetY = v <= .52
      ? mix(targetTop, lip, v / .52)
      : mix(lip, hem, (v - .52) / .48);
    const airY = airTop + airHeight * v;
    // Ridge contact happens first; the outer and near edges lag behind it.
    const localDrop = segment(p, .57 + Math.abs(off) * .04 + v * .025, .69 + Math.abs(off) * .04 + v * .025);
    let y = mix(airY, targetY, localDrop);
    y += wave * Math.sin(u * Math.PI * 2.2 + v * 2.3) * (.35 + v * .65);
    // Broad catenary sag relaxes as cloth rests on the frame.
    y += Math.sin(u * Math.PI) * height * .012 * raise * (1 - drop);

    const wall = region === 'wall' ? 1 : 0;
    const wallV = clamp((v - .52) / .48);
    // Door panels separate at the sewn front hem only after landing on the poles.
    x += wall * side * span * (.105 + .025 * wallV) * tie * (1 - Math.abs(off));
    x += wall * off * span * .015 * wallV * drape;
    y += wall * Math.sin(u * Math.PI * 12 + .4) * height * .0018 * wallV * drape;
    return deformClothPoint({x,y},u,v,cloth,width,height,ground);
  };
  return { p, cx, span, ground, poles, drop, drape, tie, raise, point, cloth,
    ropePresence: segment(p, .45, .56),
    ropeLanding: segment(p, .57, .9),
    ropeTaut: segment(p, .63, .97),
    ridge: { x: cx, y: finalTop },
    portalL: { x: cx - span * .105, y: height * .513 },
    portalR: { x: cx + span * .105, y: height * .513 },
  };
}

// Cloth attachments move with the sheet; free rope ends descend with the hem.
export function constructionRopes(g, width, height) {
  return [[.43,0,-1,.105],[0,.52,-1,.043],[.57,0,1,.105],[1,.52,1,.043]].map(([u,v,side,offset])=>{
    const start = g.point(u,v,side);
    const corner = g.point(side < 0 ? 0 : 1,1,side,'wall');
    const target = {x:corner.x+side*width*offset,y:g.ground+3};
    const loose = {x:start.x+side*g.span*.13,y:start.y+height*.12};
    const sideState=g.cloth?.active?g.cloth.sides[side<0?0:1]:null;
    return {start,end:{x:mix(loose.x,target.x,g.ropeLanding),y:mix(loose.y,target.y,g.ropeLanding)},target,taut:sideState?g.ropeTaut*(1-sideState.slack):g.ropeTaut};
  });
}
