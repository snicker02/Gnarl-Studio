export default { id: 4, name: 'Scroll Tile', desc: 'Tiling rolled spiral surfaces: snail-scroll forms across the plane. Mirror makes it seamless.', glsl: `
vec2 de_var(vec3 pos){
  float at=ANIM?u_time*0.09:0.0;
  float tile=u_scrtile; vec3 p=pos;
  vec2 id2=floor(p.xy/tile+0.5);
  vec2 local=p.xy-id2*tile;
  if(u_mirror!=0){ local=abs(local)-(tile*0.5); local=abs(local); }
  else { float flp=(mod(id2.x+id2.y,2.0)<0.5)?1.0:-1.0; local*=flp; }
  float r=length(local), theta=atan(local.y,local.x);
  float roll=u_scrroll+sin(at*0.3)*0.8*float(u_anim);
  float sT=theta+roll*log(max(r,0.01));
  vec2 sc=r*vec2(cos(sT),sin(sT));
  float zSurf=sin(r*u_fx1*2.0+sT*u_fy1*0.5+at*0.2)*u_scrwave+sin(r*u_fx2*3.0-at*0.15)*u_scrwave*0.4;
  vec3 z=vec3(sc,p.z+zSurf*0.3);
  mat3 R=rX(u_rx)*rY(u_ry+at*0.06)*rZ(u_rz);
  float dr=1.0,trap=1e9;
  for(int i=0;i<20;i++){ if(i>=u_iters) break; z=R*z;
    float wx=cos(u_fx1*z.y+sin(u_fx2*(z.y+sin(u_fx1*z.z))));
    float wy=cos(u_fy1*z.x+sin(u_fy2*(z.x+sin(u_fy1*z.z))));
    float wz=sin(u_fx1*z.z+cos(u_fy2*z.x));
    z=z*u_scale*0.5+u_off*0.3*vec3(wx,wy,wz);
    dr=dr*abs(u_scale*0.5)+1.0;
    trap=min(trap,r*0.4+length(z)*0.1);
    if(length(z)>8.0) break;
  }
  float d=(length(z)-1.0)/max(abs(dr),0.001);
  d+=0.02*sin(sT*4.0+r*u_fx2*2.0-at*0.3);
  float rr=max(r,0.15);
  g_lip=sqrt(1.0+roll*roll) + 0.3*u_scrwave*(2.0*abs(u_fx1)+1.2*abs(u_fx2)+0.5*abs(u_fy1)*sqrt(1.0+roll*roll)/rr) + 0.02*(4.0*abs(roll)/rr+2.0*abs(u_fx2));
  return vec2(d,trap);
}` };
