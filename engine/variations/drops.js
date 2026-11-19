export default { id: 13, name: 'Raindrops', desc: 'A pond of random ripple sources, one per cell, with decaying circular waves that expand when animated. Cell randomness moves the drops, Blend sets how far each ring travels, Seed changes the rain.', ownPlane: true, glsl: `
vec2 de_var(vec3 pos){
  float at=ANIM?u_time*0.07:0.0;
  vec3 pr=(rX(u_rx)*rY(u_ry)*rZ(u_rz))*pos;
  pr.xy=warpDomain(pr.xy);
  float cell=max(u_eyecell,0.4);
  vec2 p=pr.xy/cell;
  vec2 base=floor(p);
  float F=u_eyedepth*3.0;
  float decay=(0.6+clamp(u_meyeblend,0.0,1.0)*2.4)/cell;
  float S=0.0, dmin=1e9;
  for(int oy=-1;oy<=1;oy++){ for(int ox=-1;ox<=1;ox++){
    vec2 c=base+vec2(float(ox),float(oy));
    float h1=hs2(c*7.31+3.7), h2_=hs2(c*13.1+91.3), h3=hs2(c*5.9+47.2);
    vec2 ctr=c+0.5+(vec2(h1,h2_)-0.5)*0.6*clamp(u_jitter,0.0,1.5);
    float dc=length(p-ctr), d=dc*cell;
    float win=1.0-smoothstep(0.45,1.0,dc);       // zero before the 3x3 search window ends => no cell-border seams
    S+=win*(0.5+0.5*h3)*cos(F*d-at*3.0+h3*6.28318)*exp(-d*decay);
    dmin=min(dmin,d);
  } }
  float height=u_mflat*0.6*S/(1.0+0.5*abs(S));
  float gh=u_mflat*0.6*(F+decay+2.8/cell)*2.0;
  return reliefOut(pr,height,1.0,0.5+0.5*S/(1.0+abs(S))+dmin*0.1,gh);
}` };
