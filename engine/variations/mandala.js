export default { id: 5, name: 'Mandala Relief', desc: 'Kaleidoscope fold + bounded height-field + jittered squircle eye lobes: flat carved-plaque mandalas.', ownPlane: true, glsl: `
vec2 de_var(vec3 pos){
  float at=ANIM?u_time*0.07:0.0;
  float petals=max(u_mpetals,3.0);
  mat3 Rpre=rX(u_rx)*rY(u_ry)*rZ(u_rz);
  vec3 pr=Rpre*pos;
  float r=length(pr.xy);
  float ang=atan(pr.y,pr.x)+at*0.05;
  float wedge=6.28318/petals, hw=wedge*0.5;
  ang=abs(mod(ang+hw,wedge)-hw);
  vec2 fXY=r*vec2(cos(ang),sin(ang));
  float cellSz=max(u_eyecell,0.3)/max(u_scale,0.1);
  vec2 gp=fXY/cellSz;
  gp.x-=1.4+u_offx; gp.y+=u_offy*0.5;
  if(u_mirror!=0) gp=abs(mod(gp,2.0)-1.0);
  vec2 base=floor(gp), nearestC=vec2(0.0); float nearestEuc=1e9;
  for(int oy=-1;oy<=1;oy++){ for(int ox=-1;ox<=1;ox++){
    vec2 c=base+vec2(float(ox),float(oy))+0.5; float d=length(gp-c);
    if(d<nearestEuc){ nearestEuc=d; nearestC=c; } } }
  vec2 q=gp-nearestC;
  float ch=hs2(nearestC*7.31+3.7), ch2=hs2(nearestC*13.1+91.3), ch3=hs2(nearestC*5.9+47.2);
  float sizeJ=mix(1.0,0.65+ch*0.7,u_jitter);
  float shapeJ=mix(0.0,ch2*1.8,u_jitter);
  float ringJ=mix(1.0,0.6+ch3*0.9,u_jitter);
  float spinJ=(ch-0.5)*2.0*u_jitter;
  vec2 qj=q/sizeJ;
  float euc=length(qj)+1e-5;
  float sqExp=mix(1.7+shapeJ,max(u_eyesq,2.0)+2.0+shapeJ,smoothstep(0.0,0.62,euc));
  float rm=pow(pow(abs(qj.x),sqExp)+pow(abs(qj.y),sqExp),1.0/sqExp);
  float spinAmt=(u_eyespin+sin(at*0.4)*0.3*float(u_anim))*(1.0+spinJ*0.6);
  float spin=spinAmt*(1.0-smoothstep(0.0,0.45,rm))*2.0*clamp(u_meyeblend,0.0,1.0)+at*0.1;
  float cs=cos(spin), sn=sin(spin);
  vec2 rotQ=vec2(qj.x*cs-qj.y*sn,qj.x*sn+qj.y*cs);
  float rings=abs(sin(rm*u_eyedepth*ringJ-at*0.3));
  float fx1=u_fx1+0.3*sin(at*0.41), fy1=u_fy1+0.3*cos(at*0.37);
  float fx2=u_fx2+0.2*sin(at*0.53), fy2=u_fy2+0.2*cos(at*0.29);
  vec2 vz=rotQ*cellSz; float vein=0.0, vamp=0.5;
  for(int i=0;i<6;i++){ if(i>=u_iters) break;
    float wx=cos(fx1*vz.y+sin(fx2*vz.x)), wy=cos(fy1*vz.x+sin(fy2*vz.y));
    vz=vz*1.3+vec2(wx,wy)*0.25; vein+=vamp*sin(vz.x*1.7+vz.y*1.3); vamp*=0.55; }
  vein*=0.5;
  float ringH=(1.0-rings)*0.5;
  float centreBoost=1.0+1.8*exp(-r*0.55);
  float height=(ringH*clamp(u_meyeblend,0.0,1.0)+vein*0.18*(1.0+u_offz*0.5))*u_mflat*centreBoost;
  float slab=mix(0.02,0.22,clamp(u_mflat,0.0,1.0))*sizeJ;
  float d=abs(pr.z-height)-slab;
  float gh=u_mflat*centreBoost*(0.75*u_eyedepth/(cellSz*0.65)+0.18*(1.0+u_offz*0.5)*3.0);
  g_lip=sqrt(1.0+gh*gh);
  float trap=mix(dot(vz,vz)*0.05,rings,clamp(u_meyeblend,0.0,1.0));
  return vec2(d,trap);
}` };
