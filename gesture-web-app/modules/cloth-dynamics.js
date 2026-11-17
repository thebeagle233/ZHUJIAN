const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const sideState=()=>({dx:0,dy:0,slack:0,collapse:0,stress:0,vx:0,vy:0,vs:0,vc:0,held:true,missing:0});
const spring=(obj,key,velocity,target,dt,k=65,damping=15)=>{
  obj[velocity]+=(k*(target-obj[key])-damping*obj[velocity])*dt;
  obj[key]+=obj[velocity]*dt;
};

// A damped deformation model. Each side carries its own movement and support state.
export class ClothDynamics {
  constructor(){this.reset();}
  reset(){this.initialized=false;this.reference=[];this.lastHands=[];this.sides=[sideState(),sideState()];this.collapse=0;this.collapseVelocity=0;this.stability=1;}
  assign(input){
    if(input.controls)return input.controls.map(p=>({...p}));
    const hands=(input.hands||[]).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)).slice(0,2).sort((a,b)=>a.x-b.x);
    if(hands.length===2)return hands;
    if(hands.length===0)return [null,null];
    const h=hands[0];
    const refs=this.lastHands.length===2?this.lastHands:this.reference;
    const nearest=refs.length===2 && Math.hypot(h.x-refs[1].x,h.y-refs[1].y)<Math.hypot(h.x-refs[0].x,h.y-refs[0].y)?1:0;
    return nearest===0?[h,null]:[null,h];
  }
  update(input,dt){
    dt=clamp(dt,0,.05);
    const hands=this.assign(input);
    if(!this.initialized){
      if(!hands[0]||!hands[1]||hands.some(h=>h.held===false))return this.snapshot();
      this.reference=hands.map(h=>({x:h.x,y:h.y}));this.lastHands=hands.map(h=>({...h}));this.initialized=true;
    }
    const targets=hands.map((hand,i)=>{
      const s=this.sides[i];
      const visible=Boolean(hand&&hand.held!==false);
      s.missing=visible?0:s.missing+dt;
      if(visible)this.lastHands[i]={...hand};
      // Explicit release responds at once; tracking dropouts get a short grace period.
      s.held=visible||(!input.controls&&s.missing<.35);
      const h=hand||this.lastHands[i]||this.reference[i];
      const dx=clamp(h.x-this.reference[i].x,-.3,.3),dy=clamp(h.y-this.reference[i].y,-.32,.32);
      const outward=dx*(i===0?-1:1);
      const slack=s.held?clamp(Math.max(0,(-outward-.035)/.17)+Math.max(0,(dy-.10)/.24)*.7):1;
      const stress=s.held?clamp(Math.max(0,(outward-.21)/.15)+Math.max(0,(-dy-.25)/.17)):0;
      return {dx,dy,slack,stress,collapse:clamp((slack-.5)/.5)};
    });
    const substeps=Math.max(1,Math.ceil(dt/.012));
    for(let step=0;step<substeps;step++){
      const h=dt/substeps;
      this.sides.forEach((s,i)=>{
        const t=targets[i];spring(s,'dx','vx',t.dx,h,90,19);spring(s,'dy','vy',t.dy,h,90,19);
        spring(s,'slack','vs',t.slack,h,45,13);spring(s,'collapse','vc',t.collapse,h,30,11);
        s.slack=clamp(s.slack);s.collapse=clamp(s.collapse);s.stress=t.stress;
      });
      const sharedFailure=clamp((Math.min(...this.sides.map(s=>s.slack))-.48)/.52);
      this.collapseVelocity+=(24*(sharedFailure-this.collapse)-10*this.collapseVelocity)*h;
      this.collapse=clamp(this.collapse+this.collapseVelocity*h);
    }
    const support=this.sides.map(s=>1-s.slack);
    const motion=clamp(input.motion||0,0,1);
    this.stability=clamp(Math.min(...support)*.65+(support[0]+support[1])*.175-this.collapse*.5-Math.max(...this.sides.map(s=>s.stress))*.2-motion*.09);
    return this.snapshot();
  }
  snapshot(){
    const maxLocal=Math.max(...this.sides.map(s=>s.collapse));
    const state=this.collapse>.55?'collapsed':maxLocal>.3?'slumped':Math.max(...this.sides.map(s=>s.slack))>.25?'slack':Math.max(...this.sides.map(s=>s.stress))>.5?'strained':'supported';
    return {active:this.initialized,sides:this.sides.map(({dx,dy,slack,collapse,stress,held})=>({dx,dy,slack,collapse,stress,held})),collapse:this.collapse,stability:this.stability,state};
  }
}

// Smooth weights affect the material locally. No fixed centre or see-saw rotation.
export function deformClothPoint(point,u,v,cloth,width,height,ground){
  if(!cloth?.active)return point;
  const t=clamp(u),wR=t*t*(3-2*t),wL=1-wR;
  const [left,right]=cloth.sides;
  const depth=.68+.32*Math.cos((v-.52)*Math.PI*.7);
  let x=point.x+width*(left.dx*wL+right.dx*wR)*depth;
  let y=point.y+height*(left.dy*wL+right.dy*wR)*depth;
  const sag=(left.slack*wL*wL+right.slack*wR*wR)*height*.11;
  y+=sag*(.45+.55*Math.sin(Math.PI*clamp(v)));
  const local=left.collapse*Math.pow(wL,1.4)+right.collapse*Math.pow(wR,1.4);
  const fall=clamp(local*.75+cloth.collapse*.8);
  const heapY=ground-height*(.035*(1-v)+.008*Math.sin(u*Math.PI*8));
  y=y+(heapY-y)*fall;
  x+=(left.collapse*wL-right.collapse*wR)*width*.045;
  // The ground provides contact, not a pivot. Some folds remain above it.
  y=Math.min(y,ground+height*.007*Math.sin(u*Math.PI*10));
  return {x,y};
}
