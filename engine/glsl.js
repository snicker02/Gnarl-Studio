import { FLOATS, INTS } from './uniforms.js';
import gnarly from './variations/gnarly.js';
import sine from './variations/sine.js';
import fbm from './variations/fbm.js';
import eye from './variations/eye.js';
import scroll from './variations/scroll.js';
import mandala from './variations/mandala.js';
import spiral from './variations/spiral.js';
import honeycomb from './variations/honeycomb.js';
import truchet from './variations/truchet.js';
import ripple from './variations/ripple.js';
import chladni from './variations/chladni.js';
import quasi from './variations/quasi.js';
import drum from './variations/drum.js';
import drops from './variations/drops.js';

export const VARIATIONS = [gnarly, sine, fbm, eye, scroll, mandala, spiral, honeycomb, truchet, ripple, chladni, quasi, drum, drops];
export const VS = 'attribute vec2 a_pos; void main(){ gl_Position=vec4(a_pos,0.0,1.0); }';

const HEADER = () => `precision highp float;
uniform vec2 u_res, u_origin, u_jit;
uniform vec3 u_cam_pos, u_cam_target, u_c0, u_c1, u_c2, u_c3, u_bg0, u_bg1;
${FLOATS.map(k => `uniform float u_${k};`).join('\n')}
${INTS.map(k => `uniform int u_${k};`).join('\n')}
uniform sampler2D u_tex;
#define u_off vec3(u_offx,u_offy,u_offz)
#define ANIM (u_anim!=0)
`;

const COMMON = `
// sin-free hash for per-cell constants: sin() of large arguments is implemented with very different accuracy on different GPUs, which can flip whole cells between frames
float hq(vec2 p){ vec3 q=fract(vec3(p.xyx)*0.1031); q+=dot(q,q.yzx+33.33); return fract((q.x+q.y)*q.z); }
float h2(vec2 p){ return hq(p); }
float hs2(vec2 p){ return h2(p+vec2(u_seed*17.13,u_seed*5.71)); }
float h3(vec3 p){ vec3 q=fract(p*0.1031); q+=dot(q,q.zyx+31.32); return fract((q.x+q.y)*q.z); }
vec3 cospal(float t,vec3 a,vec3 b,vec3 c,vec3 d){ return a+b*cos(6.28318*(c*t+d)); }
mat3 rX(float a){ float c=cos(a),s=sin(a); return mat3(1,0,0,0,c,-s,0,s,c); }
mat3 rY(float a){ float c=cos(a),s=sin(a); return mat3(c,0,s,0,1,0,-s,0,c); }
mat3 rZ(float a){ float c=cos(a),s=sin(a); return mat3(c,-s,0,s,c,0,0,0,1); }
float vnoise(vec3 p){
  vec3 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
  float a=h3(i),b=h3(i+vec3(1,0,0)),c=h3(i+vec3(0,1,0)),d=h3(i+vec3(1,1,0));
  float e=h3(i+vec3(0,0,1)),ff=h3(i+vec3(1,0,1)),g=h3(i+vec3(0,1,1)),hh=h3(i+vec3(1,1,1));
  return mix(mix(mix(a,b,f.x),mix(c,d,f.x),f.y),mix(mix(e,ff,f.x),mix(g,hh,f.x),f.y),f.z);
}
float fbm3(vec3 p,int oct){ float v=0.0,amp=0.5; for(int i=0;i<8;i++){ if(i>=oct) break; v+=amp*vnoise(p); p*=2.0; amp*=0.5; } return v; }
`;

// Global symmetry fold: an isometry of the xy-plane, so it never expands distances.
const PREP = `
float g_st=1.0;    // stretch of the relief domain mapping (zoom * warp), folded into the Lipschitz bound
// Shared domain for relief variations: pan (Offset X/Y) -> zoom (Scale) -> gnarl-style warp (Warp amount, Iterations, Freq X1..Y2)
vec2 warpDomain(vec2 p){
  float at=ANIM?u_time*0.05:0.0;
  float zoom=max(u_scale*0.5,0.05);
  p=(p+vec2(u_offx-1.0,u_offy-1.0)*0.5)*zoom;
  g_st=max(zoom,1.0);
  if(u_warp>0.0){
    float amp=u_warp*0.25;
    for(int i=0;i<6;i++){
      if(i>=u_iters) break;
      vec2 w=vec2(cos(u_fx1*p.y+sin(u_fx2*(p.y+at))), cos(u_fy1*p.x+sin(u_fy2*(p.x+at))));
      p+=amp*w;
      g_st*=1.0+amp*max(abs(u_fx1)+abs(u_fx2),abs(u_fy1)+abs(u_fy2));
      amp*=0.55;
    }
  }
  return p;
}
float g_lip=1.0;   // per-variation Lipschitz (stretch) bound, set inside de_var
// shared relief output: thin slab around a bounded height h(x,y) in the plate's own (rotated) frame -- pass the ROTATED point so tilting never makes h depend on depth; gradH bounds |grad h| so the slab SDF stays Lipschitz-safe
vec2 reliefOut(vec3 pr,float h,float sizeJ,float trap,float gradH){
  float gg=gradH*g_st;
  g_lip=sqrt(1.0+gg*gg);
  return vec2(abs(pr.z-h)-mix(0.02,0.22,clamp(u_mflat,0.0,1.0))*sizeJ,trap);
}
float lipEff(float l){ return mix(1.0,max(1.0,l),clamp(u_safe,0.0,1.0)); }
vec3 prep(vec3 p){
  if(u_sym>=2){
    float n=float(u_sym), r=length(p.xy), a=atan(p.y,p.x), w=6.28318/n;
    a=abs(mod(a+w*0.5,w)-w*0.5);
    p.xy=r*vec2(cos(a),sin(a));
  }
  return p;
}`;

function mapFn(v, plane) {
  const body = (plane && !v.ownPlane)
    ? `vec2 r=de_var(vec3(pos.xy,0.0));
  float trapH=clamp(r.y,0.0,8.0);
  float height=sin(trapH*u_planedepth)*u_mflat*0.4;
  float slab=mix(0.015,0.18,clamp(u_mflat,0.0,1.0));
  r.x=abs(pos.z-height)-slab;
  float gh=u_mflat*0.4*u_planedepth*2.0; g_lip=max(g_lip,sqrt(1.0+gh*gh));`
    : `vec2 r=de_var(pos);`;
  return `vec2 map(vec3 pos){
  pos=prep(pos);
  ${body}
  r.x*=u_stepscale/lipEff(g_lip); return r;
}`;
}

const SHADE = `
float g_pa=0.0;
float fp(float t){ return u_ortho!=0 ? u_orthoScale/u_res.y : t*g_pa; }

vec3 nrm(vec3 p,float e){
  vec2 k=vec2(1.0,-1.0);
  return normalize(k.xyy*map(p+k.xyy*e).x+k.yyx*map(p+k.yyx*e).x+k.yxy*map(p+k.yxy*e).x+k.xxx*map(p+k.xxx*e).x);
}
float shdw(vec3 ro,vec3 rd,float mn,float mx,float k){
  float res=1.0,t=mn,ph=1e10;
  for(int i=0;i<64;i++){
    if(t>=mx) break;
    float h=map(ro+rd*t).x;
    if(h<0.0004) return 0.0;
    float y=h*h/(2.0*ph), dd=sqrt(max(h*h-y*y,0.0));
    res=min(res,k*dd/max(1e-4,t-y)); ph=h; t+=clamp(h,0.004,0.35);
  }
  return clamp(res,0.0,1.0);
}
float calcAO(vec3 p,vec3 n){
  float s=0.0,w=1.0;
  for(int i=1;i<=5;i++){ float d=float(i)*u_aor*0.2; s+=w*(d-map(p+n*d).x); w*=0.5; }
  return clamp(1.0-u_ao*s,0.0,1.0);
}
vec3 gradCustom(float t){
  float k=abs(fract(t)*2.0-1.0)*3.0;
  if(k<1.0) return mix(u_c0,u_c1,k);
  if(k<2.0) return mix(u_c1,u_c2,k-1.0);
  return mix(u_c2,u_c3,k-2.0);
}
vec3 palette(float t){
  if(u_pal==0) return cospal(t,vec3(.5),vec3(.5),vec3(1),vec3(0,.33,.67));
  if(u_pal==1) return cospal(t,vec3(.5),vec3(.5),vec3(2,1,0),vec3(.5,.2,.25));
  if(u_pal==2) return cospal(t,vec3(0,.1,.3),vec3(.5),vec3(1),vec3(0,.1,.3));
  if(u_pal==3) return cospal(t,vec3(.1,.5,.3),vec3(.2,.4,.2),vec3(2,1,1),vec3(0,.25,.25));
  if(u_pal==4) return cospal(t,vec3(.15,.1,.05),vec3(.6,.5,.3),vec3(1,.7,.4),vec3(0,.15,.2));
  if(u_pal==5) return cospal(t,vec3(.5),vec3(.5),vec3(1),vec3(.3,.2,.2));
  if(u_pal==6) return cospal(t,vec3(.3,.05,0),vec3(.6,.4,.2),vec3(1,.8,.5),vec3(.05,.1,.15));
  if(u_pal==7) return cospal(t,vec3(0,.2,.4),vec3(.5,.4,.3),vec3(.8,1,1.2),vec3(.1,.2,0));
  if(u_pal==8) return cospal(t,vec3(.4,.1,.3),vec3(.4,.4,.2),vec3(1.5,1,.5),vec3(.3,0,.1));
  return gradCustom(t);
}
// One material function used for both surface and glow, so image modes can never leak palette colour.
// Textures are uploaded power-of-two with REPEAT wrap and Y pre-flipped at upload (no fract/flip hacks here).
vec3 matCol(vec3 p,float trap){
  float t=trap*u_ccyc+u_cshift;
  vec3 col=palette(t);
  if(u_useimg==1){
    vec3 rc=texture2D(u_tex,vec2(t*0.5+0.5,u_imgrow)).rgb;
    rc=pow(rc,vec3(2.2));
    col=mix(col,rc,clamp(u_imgblend,0.0,1.0));
  } else if(u_useimg==2){
    vec2 uv=vec2(p.x*0.25*u_imgscale/u_imgaspect,p.y*0.25*u_imgscale)+0.5;
    vec3 ic=pow(texture2D(u_tex,uv).rgb,vec3(2.2));
    col=mix(col,ic,clamp(u_imgblend,0.0,1.0));
  }
  return col;
}
vec3 bgAt(vec3 rd){ return mix(u_bg0,u_bg1,smoothstep(-0.2,0.9,rd.y)); }
vec3 tonemap(vec3 c){
  if(u_tonemap==0) return c*(2.51*c+0.03)/(c*(2.43*c+0.59)+0.14);
  if(u_tonemap==1){ c=max(vec3(0.0),c-0.004); return (c*(6.2*c+0.5))/(c*(6.2*c+1.7)+0.06); } // filmic (gamma baked in; undone below)
  if(u_tonemap==2) return c/(1.0+c);
  return clamp(c,0.0,1.0);
}

void main(){
  vec2 fc=gl_FragCoord.xy+u_origin;
  vec2 uv=(fc+u_jit-u_res*0.5)/u_res.y;
  vec3 ro=u_cam_pos, ta=u_cam_target;
  vec3 fw=normalize(ta-ro), rt=normalize(cross(fw,vec3(0,1,0))), up=cross(rt,fw);
  float fl=1.0/tan(u_camFov*0.5);
  g_pa=1.0/(fl*u_res.y);
  vec3 rd;
  if(u_ortho!=0){ ro+=(rt*uv.x+up*uv.y)*u_orthoScale; rd=fw; }
  else rd=normalize(fw*fl+rt*uv.x+up*uv.y);

  float la=(u_orbitLight!=0)?u_laz+u_time*0.28:u_laz;
  vec3 ld=normalize(vec3(cos(la)*cos(u_lel),sin(u_lel),sin(la)*cos(u_lel)));
  vec3 ld2=normalize(vec3(cos(u_l2az)*cos(u_l2el),sin(u_l2el),sin(u_l2az)*cos(u_l2el)));

  float t=0.01, tmax=24.0, trap=0.0, thr=u_eps, dl=1e9, tl=0.0; bool hit=false;
  for(int i=0;i<400;i++){
    if(i>=u_steps) break;
    vec2 res=map(ro+rd*t); float d=res.x;
    thr=u_eps*0.25+fp(t)*0.5*u_detail;
    dl=d; tl=res.y;
    if(d<thr){ hit=true; trap=res.y; break; }
    if(t>tmax) break;
    t+=clamp(d,thr*0.5,0.6);
  }
  // ran out of steps right beside a surface: count it as a hit instead of punching a black hole
  if(!hit && t<tmax && dl<thr*6.0){ hit=true; trap=tl; }
  vec3 col;
  if(hit){
    vec3 p=ro+rd*t, n=nrm(p,max(thr,0.0004));
    vec3 alb=matCol(p,trap);
    float occ=calcAO(p,n);
    float diff=max(0.0,dot(n,ld));
    float sh=(u_shadows!=0)?shdw(p+n*thr*2.0,ld,0.01,6.0,u_soft):1.0;
    float diff2=max(0.0,dot(n,ld2))*u_l2int;
    vec3 h=normalize(ld-rd); float gp=2.0/(u_rough*u_rough+0.01)-2.0;
    float sf=pow(max(0.0,dot(n,h)),gp)*u_spec;
    vec3 specCol=mix(vec3(1.0,0.95,0.9),alb,u_metal);
    float ndv=max(0.0,dot(n,-rd));
    vec3 amb=mix(u_bg0*0.5,u_bg1*2.0+vec3(0.05),0.5+0.5*n.y)*u_sky;
    float sss=pow(max(0.0,-dot(rd,n)),3.0)*u_sss;
    float rimT=pow(1.0-ndv,3.0)*u_rim;
    vec3 dcol=alb*(1.0-0.85*u_metal);
    col=dcol*(diff*sh*u_lint*occ+diff2*occ+amb*occ*0.5+vec3(u_fill)*occ+sss)
       +sf*sh*occ*specCol*u_lint
       +rimT*occ*mix(vec3(1.0),alb,0.5);
    col=mix(col,bgAt(rd),1.0-exp(-t*u_fog));
  } else {
    col=bgAt(rd);
    col+=u_glow*0.04*vec3(.5,.3,.8)*pow(max(0.0,dot(rd,ld)),6.0);
  }
  float tg=clamp(t-0.1,0.01,tmax);
  vec3 gp0=ro+rd*tg; vec2 g0=map(gp0);
  col+=exp(-max(0.0,g0.x)*5.5)*u_glow*0.3*matCol(gp0,g0.y*0.5);

  col*=u_exposure;
  col=tonemap(col);
  if(u_tonemap!=1) col=pow(clamp(col,0.0,1.0),vec3(0.4545));
  col=clamp(col,0.0,1.0);
  float lum=dot(col,vec3(0.299,0.587,0.114));
  col=mix(vec3(lum),col,u_sat);
  col=(col-0.5)*u_contrast+0.5;
  vec2 vq=(fc/u_res)-0.5; vq.x*=u_res.x/u_res.y;
  col*=1.0-u_vig*smoothstep(0.25,0.95,length(vq));
  col+=(h2(floor(gl_FragCoord.xy+u_origin))-0.5)*u_grain*0.08;
  gl_FragColor=vec4(clamp(col,0.0,1.0),1.0);
}`;

const cache = new Map();
export function buildFragment(fold, plane) {
  const key = fold + ':' + (plane ? 1 : 0);
  if (cache.has(key)) return cache.get(key);
  const v = VARIATIONS[fold];
  const src = HEADER() + COMMON + PREP + '\n' + v.glsl + '\n' + mapFn(v, plane) + SHADE;
  cache.set(key, src);
  return src;
}
