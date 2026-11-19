export default { id: 9, name: 'Ripple Interference', desc: 'Circular (optionally spiral) waves from several sources interfere into moire eyes and ridged lattices. Sources = Petals. Relief height-field.', ownPlane: true, glsl: `
vec2 de_var(vec3 pos){
  float at=ANIM?u_time*0.07:0.0;
  vec3 pr=(rX(u_rx)*rY(u_ry)*rZ(u_rz))*pos;
  pr.xy=warpDomain(pr.xy);
  vec2 p=pr.xy;
  float N=floor(clamp(u_mpetals,2.0,24.0)+0.5), Rr=u_eyecell*0.8, F=u_eyedepth*3.0;
  float arms=floor(u_eyespin+0.5);   // whole number of spiral arms => no angular seam
  float S=0.0, dm=1e9;
  for(int k=0;k<24;k++){
    if(float(k)>=N) break;
    float a=6.28318*float(k)/N+at*0.1+(hs2(vec2(float(k),1.0))-0.5)*u_jitter*2.0;
    float rr=Rr*(1.0+(hs2(vec2(float(k),2.0))-0.5)*u_jitter*0.8);
    vec2 dv=p-rr*vec2(cos(a),sin(a));
    float d=length(dv);
    S+=cos(F*d+arms*atan(dv.y,dv.x+1e-6)-at*0.8);
    dm=min(dm,d);
  }
  S/=N;
  float height=u_mflat*0.7*(1.0-abs(S));
  float gh=u_mflat*0.7*(F+abs(arms)/0.3);
  return reliefOut(pr,height,1.0,S*0.5+0.5+dm*0.15,gh);
}` };
