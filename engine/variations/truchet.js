export default { id: 8, name: 'Truchet Weave', desc: 'Randomly flipped quarter-arc tiles form endless interwoven ribbons with ridged edges and an over/under lift. Relief height-field.', ownPlane: true, glsl: `
vec2 de_var(vec3 pos){
  float at=ANIM?u_time*0.07:0.0;
  vec3 pr=(rX(u_rx)*rY(u_ry)*rZ(u_rz))*pos;
  pr.xy=warpDomain(pr.xy);
  float T=max(u_eyecell,0.3);
  vec2 p=pr.xy/T;
  vec2 id=floor(p), f=fract(p)-0.5;
  float hsh=hs2(id*7.7+1.3);
  if(hsh>0.5) f.x=-f.x;
  vec2 c1=vec2(0.5), c2=vec2(-0.5);
  float d1=length(f-c1)-0.5, d2=length(f-c2)-0.5;
  // smooth-min of the two arc distances: no hard crease where the arcs meet
  float k=0.08, hh=clamp(0.5+0.5*(abs(d2)-abs(d1))/k,0.0,1.0);
  float ad=mix(abs(d2),abs(d1),hh)-k*hh*(1.0-hh);
  float w=max(u_twidth,0.04);
  float ribbon=1.0-smoothstep(0.0,w,ad);
  float ridge=0.7+0.3*cos(ad*u_eyedepth*6.0-at*0.5);
  float par=mod(id.x+id.y,2.0);
  float mask=clamp(1.0-2.0*max(abs(f.x),abs(f.y)),0.0,1.0);   // 0 at tile edges: no seams
  float height=u_mflat*ribbon*(ridge+0.45*par*mask*clamp(u_meyeblend,0.0,1.0));
  float trap=ad*3.0+0.25*sin(p.x*1.3+p.y*0.7);
  float gh=u_mflat*(2.0/w+2.0*u_eyedepth+1.8)/T;
  return reliefOut(pr,height,1.0,trap,gh);
}` };
