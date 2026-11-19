export default { id: 7, name: 'Honeycomb Eyes', desc: 'Hexagonal lattice of domed, ringed eyes with per-cell randomness. Squareness morphs round to hex. Relief height-field.', ownPlane: true, glsl: `
vec2 de_var(vec3 pos){
  float at=ANIM?u_time*0.07:0.0;
  vec3 pr=(rX(u_rx)*rY(u_ry)*rZ(u_rz))*pos;
  pr.xy=warpDomain(pr.xy);
  float cell=max(u_eyecell,0.3);
  vec2 p=pr.xy/cell;
  const vec2 hs=vec2(1.0,1.7320508);
  // triangular lattice = two interleaved rectangular lattices (integer + half-integer); nearest centre wins
  vec2 ia=floor(p/hs+0.5), ib=floor(p/hs)+0.5;
  vec2 qA=p-ia*hs, qB=p-ib*hs;
  vec2 q, id;
  if(dot(qA,qA)<dot(qB,qB)){ q=qA; id=ia; } else { q=qB; id=ib; }
  float ch=hs2(id*7.31+3.7), ch3=hs2(id*5.9+47.2);
  float sizeJ=mix(1.0,0.7+ch*0.6,u_jitter), ringJ=mix(1.0,0.6+ch3*0.9,u_jitter);
  q/=sizeJ;
  float spinAmt=floor(u_eyespin*(1.0+(ch-0.5)*u_jitter)+0.5);   // whole number of spiral arms per cell => no angular seam
  float qa=atan(q.y,q.x+1e-6);
  vec2 aq=abs(q);
  float hexd=max(dot(aq,vec2(0.5,0.866025)),aq.x);
  float rm=mix(length(q),hexd,clamp((u_eyesq-1.0)/5.0,0.0,1.0))*2.0;
  // spiral arms: ring phase advances with angle (integer arm count keeps the angular wrap seamless)
  float rings=abs(sin(rm*u_eyedepth*ringJ+spinAmt*qa-at*0.3));
  float dome=pow(clamp(1.0-rm,0.0,1.0),2.0);
  float height=u_mflat*(0.5*(1.0-rings)*clamp(u_meyeblend,0.0,1.0)+0.6*dome);
  float gh=u_mflat*(0.75*u_eyedepth+1.2)*3.4/cell*(1.0+0.7*abs(spinAmt));
  return reliefOut(pr,height,sizeJ,rings+ch*0.3,gh);
}` };
