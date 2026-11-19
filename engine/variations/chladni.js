export default { id: 10, name: 'Chladni Plate', desc: 'Standing-wave modes of a vibrating plate: cos(m x)cos(n y) - cos(n x)cos(m y). Petals = m, Ring frequency = n. Blend turns the surface into sand-line ridges on the nodal lines. Animation morphs between modes.', ownPlane: true, glsl: `
vec2 de_var(vec3 pos){
  float at=ANIM?u_time*0.07:0.0;
  vec3 pr=(rX(u_rx)*rY(u_ry)*rZ(u_rz))*pos;
  pr.xy=warpDomain(pr.xy);
  float cell=max(u_eyecell,0.4);
  vec2 p=pr.xy/cell;
  float m=floor(clamp(u_mpetals,1.0,24.0)+0.5), n=floor(clamp(u_eyedepth,1.0,24.0)+0.5);
  if(n==m) n+=1.0;
  float a=3.14159265*m, b=3.14159265*n;
  float w=-cos(at*0.4);                                  // -1 at rest (classic minus form), morphs with time
  float S=0.5*(cos(a*p.x)*cos(b*p.y)+w*cos(b*p.x)*cos(a*p.y));
  float bl=clamp(u_meyeblend,0.0,1.0);
  float nodal=1.0-smoothstep(0.0,0.3,abs(S));            // sand collects on the nodal lines
  float height=u_mflat*(0.8*S*(1.0-bl)+0.8*nodal*bl);
  float K=0.8*(1.0-bl)+0.8*bl*(1.5/0.3);
  float gh=u_mflat*K*3.14159265*(m+n)/cell;
  return reliefOut(pr,height,1.0,S*0.5+0.5+(1.0-nodal)*0.2,gh);
}` };
