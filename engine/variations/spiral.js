export default { id: 6, name: 'Log-Spiral Eyes', desc: 'Log-polar lattice of squircle eyes: cells grow outward along interwoven spiral arms, like a sunflower of eyes. Relief height-field.', ownPlane: true, glsl: `
vec2 de_var(vec3 pos){
  float at=ANIM?u_time*0.07:0.0;
  vec3 pr=(rX(u_rx)*rY(u_ry)*rZ(u_rz))*pos;
  pr.xy=warpDomain(pr.xy);
  float r=max(length(pr.xy),1e-3);
  float th=atan(pr.y,pr.x+1e-6)+at*0.05;
  float N=max(floor(u_mpetals+0.5),3.0), s=N/6.28318;
  float u=log(r/max(u_eyecell,0.2))*s;
  float v=th*s+u_spiral*u;
  vec2 gp=vec2(u,v), id=floor(gp), q=fract(gp)-0.5;
  id.y=mod(id.y,N);                       // seam-free: the angular cut shifts v by exactly N cells
  float ch=hs2(id*7.31+3.7), ch2=hs2(id*13.1+91.3), ch3=hs2(id*5.9+47.2);
  float sizeJ=mix(1.0,0.7+ch*0.6,u_jitter), shapeJ=mix(0.0,ch2*1.6,u_jitter), ringJ=mix(1.0,0.6+ch3*0.9,u_jitter);
  q/=sizeJ;
  float euc=length(q)+1e-5;
  float e=mix(1.7+shapeJ,max(u_eyesq,2.0)+2.0+shapeJ,smoothstep(0.0,0.62,euc));
  float rm=pow(pow(abs(q.x),e)+pow(abs(q.y),e),1.0/e);
  float spinAmt=(u_eyespin+sin(at*0.4)*0.3*float(u_anim))*(1.0+(ch-0.5)*u_jitter);
  float spin=spinAmt*(1.0-smoothstep(0.0,0.45,rm))*2.0*clamp(u_meyeblend,0.0,1.0);
  float cs=cos(spin), sn=sin(spin);
  vec2 rq=vec2(q.x*cs-q.y*sn,q.x*sn+q.y*cs);
  float rings=abs(sin(rm*u_eyedepth*ringJ-at*0.3));
  float fade=smoothstep(0.03,0.3,r);
  float boost=1.0+1.0*exp(-r*0.5);
  float height=u_mflat*(0.5*(1.0-rings)*clamp(u_meyeblend,0.0,1.0)+0.12*sin(rq.x*9.0+rq.y*7.0))*fade*boost+u_mflat*0.8*(1.0-fade);
  float gh=u_mflat*(0.75*u_eyedepth+1.5)*1.5*s/max(r,0.25)*(1.0+0.5*abs(spinAmt));
  return reliefOut(pr,height,sizeJ,rings+ch*0.25,gh);
}` };
