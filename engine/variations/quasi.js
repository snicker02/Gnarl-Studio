export default { id: 11, name: 'Quasicrystal Waves', desc: 'Sum of plane waves at evenly spaced angles (Petals = wave count; 5, 7, 8 give quasicrystal tilings). Squareness = terrace levels, Blend = terracing amount.', ownPlane: true, glsl: `
vec2 de_var(vec3 pos){
  float at=ANIM?u_time*0.07:0.0;
  vec3 pr=(rX(u_rx)*rY(u_ry)*rZ(u_rz))*pos;
  pr.xy=warpDomain(pr.xy);
  vec2 p=pr.xy;
  float N=floor(clamp(u_mpetals,2.0,24.0)+0.5);
  float F=u_eyedepth*2.4/max(u_eyecell,0.4);
  float S=0.0;
  for(int k=0;k<24;k++){
    if(float(k)>=N) break;
    float ang=3.14159265*float(k)/N;
    S+=cos(F*dot(p,vec2(cos(ang),sin(ang)))+at*(2.0+0.7*float(k)));
  }
  S/=N;
  float hh=0.5+0.5*S;
  float L=max(floor(u_eyesq+0.5),1.0)+1.0;
  float s=hh*L;
  float q=(floor(s)+smoothstep(0.3,0.7,fract(s)))/L;       // soft terraces
  float bl=clamp(u_meyeblend,0.0,1.0);
  float height=u_mflat*mix(hh,q,bl);
  float gh=u_mflat*0.5*F*(1.0+2.75*bl);
  return reliefOut(pr,height,1.0,hh+bl*floor(s)*0.07,gh);
}` };
