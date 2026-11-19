export default { id: 3, name: 'Eye Vortex', desc: 'Radius-dependent squircle-Voronoi with a log-spiral swirl: interwoven concentric eyes.', glsl: `
vec2 de_var(vec3 pos){
  float at=ANIM?u_time*0.08:0.0;
  float cellSz=u_eyecell;
  vec2 p=pos.xy/cellSz;
  float sqMin=1.7, sqMax=max(u_eyesq,2.0)+2.0;
  float spinAmt=u_eyespin+sin(at*0.4)*0.5*float(u_anim);
  float ringFreq=u_eyedepth;
  if(u_mirror!=0) p=abs(mod(p,2.0)-1.0);
  vec2 base=floor(p), nearestC=vec2(0.0); float nearestEuc=1e9;
  for(int oy=-1;oy<=1;oy++){ for(int ox=-1;ox<=1;ox++){
    vec2 c=base+vec2(float(ox),float(oy))+0.5; float d=length(p-c);
    if(d<nearestEuc){ nearestEuc=d; nearestC=c; } } }
  float ch=hs2(nearestC*7.31+3.7), ch3=hs2(nearestC*5.9+47.2);
  float sizeJ=mix(1.0,0.75+ch*0.5,u_jitter), ringJ=mix(1.0,0.7+ch3*0.7,u_jitter);
  vec2 q=(p-nearestC)/sizeJ;
  float euc=length(q)+1e-5;
  float sqExp=mix(sqMin,sqMax,smoothstep(0.0,0.62,euc));
  float rm=pow(pow(abs(q.x),sqExp)+pow(abs(q.y),sqExp),1.0/sqExp);
  float spin=spinAmt*(1.0-smoothstep(0.0,0.45,rm))*3.0+at*0.15;
  float cs=cos(spin), sn=sin(spin);
  vec2 rotQ=vec2(q.x*cs-q.y*sn,q.x*sn+q.y*cs);
  float rf=ringFreq*ringJ;
  float rings=abs(sin(rm*rf-at*0.3));
  float zWave=sin(pos.z*u_fx1+rm*u_fx2+at*0.15)*0.35;
  mat3 R=rX(u_rx)*rY(u_ry+at*0.05)*rZ(u_rz);
  vec3 z=vec3(rotQ*cellSz,pos.z+zWave); float dr=1.0,trap=1e9;
  for(int i=0;i<20;i++){ if(i>=u_iters) break; z=R*z;
    float wx=cos(u_fy1*z.y+sin(u_fy2*(z.y+sin(u_fy1*z.z))));
    float wy=cos(u_fx1*z.x+sin(u_fx2*(z.x+sin(u_fx1*z.z))));
    float wz=sin(u_fy1*z.z+cos(u_fx2*z.x));
    z=z*u_scale*0.55+u_off*0.35*vec3(wx,wy,wz);
    dr=dr*abs(u_scale*0.55)+1.0;
    trap=min(trap,rings+length(z)*0.15);
    if(length(z)>8.0) break;
  }
  float d=(length(z)-1.0)/max(abs(dr),0.001);
  d+=0.015*sin(rm*rf*2.0*cellSz-at*0.4);
  // stretch bound: swirl shear + z-wave gradient + ring carving
  g_lip=sqrt(1.0+pow(2.25*spinAmt,2.0)) + 0.35*(abs(u_fx1)+abs(u_fx2)/cellSz) + 0.03*rf;
  return vec2(d,trap);
}` };
