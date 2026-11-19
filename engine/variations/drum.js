export default { id: 12, name: 'Drum Modes', desc: 'Vibrating circular membrane: cos(F r) cos(m theta) with radial decay. Petals = angular modes m, Ring frequency = radial rings. Spiral twist blends standing modes into travelling spiral waves; Blend = nodal-line ridges.', ownPlane: true, glsl: `
vec2 de_var(vec3 pos){
  float at=ANIM?u_time*0.07:0.0;
  vec3 pr=(rX(u_rx)*rY(u_ry)*rZ(u_rz))*pos;
  pr.xy=warpDomain(pr.xy);
  float cell=max(u_eyecell,0.4);
  vec2 p=pr.xy/cell;
  float r=length(p)+1e-4;
  float th=atan(p.y,p.x+1e-6);
  float m=floor(clamp(u_mpetals,1.0,24.0)+0.5);
  float F=u_eyedepth*1.2;
  float env=smoothstep(0.0,0.4,r)/sqrt(1.0+r*1.2);
  float standing=cos(F*r-at*0.8)*cos(m*th);
  float sg=(u_spiral>=0.0)?1.0:-1.0;
  float travel=cos(F*r+sg*m*th-at*0.8);
  float S=env*mix(standing,travel,clamp(abs(u_spiral)/3.0,0.0,1.0));
  float bl=clamp(u_meyeblend,0.0,1.0);
  float nodal=1.0-smoothstep(0.0,0.3,abs(S));
  float height=u_mflat*(0.9*S*(1.0-bl)+0.8*nodal*bl);
  float K=0.9*(1.0-bl)+0.8*bl*(1.5/0.3);
  float gh=u_mflat*K*(F+m/max(r,0.3)+1.0)/cell;
  return reliefOut(pr,height,1.0,S*1.6+0.5+(1.0-nodal)*0.2,gh);
}` };
