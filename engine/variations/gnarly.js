export default { id: 0, name: 'Gnarly', desc: 'Nested cos/sin triaxial fold, 8 trig-nest modes. The original JWildfire gnarl engine.', glsl: `
vec2 de_var(vec3 pos){
  float at=ANIM?u_time:0.0;
  float fx1=u_fx1+0.3*sin(at*0.41), fy1=u_fy1+0.3*cos(at*0.37);
  float fx2=u_fx2+0.2*sin(at*0.53), fy2=u_fy2+0.2*cos(at*0.29);
  mat3 R=rX(u_rx)*rY(u_ry+at*0.07)*rZ(u_rz);
  // Lipschitz bound of the warp: per-iteration stretch = |scale| + |off|*grad(w)
  float Gm=(u_gmode==4)?2.0:((u_gmode==6)?6.0:1.0);
  float G=(fx1+fx2*(1.0+fx1))*Gm;
  float fac=abs(u_scale)+clamp(u_safe,0.0,1.0)*max(abs(u_offx),max(abs(u_offy),abs(u_offz)))*G*0.06;
  vec3 z=pos; float dr=1.0,trap=1e9;
  for(int i=0;i<20;i++){ if(i>=u_iters) break; z=R*z;
    float wx,wy,wz;
    if(u_gmode==1){ wx=cos(fx1*z.y+sin(fx2*(z.y+sin(fx1*z.z)))); wy=cos(fy1*z.x+sin(fy2*(z.x+sin(fy1*z.z)))); wz=cos(fx1*z.z+sin(fx2*(z.z+sin(fy1*z.x)))); }
    else if(u_gmode==2){ wx=sin(fx1*z.y+sin(fx2*(z.y+cos(fx1*z.z)))); wy=sin(fy1*z.x+sin(fy2*(z.x+cos(fy1*z.z)))); wz=sin(fx1*z.z+sin(fx2*(z.z+cos(fy1*z.x)))); }
    else if(u_gmode==3){ wx=cos(fx1*z.y+sin(fx2*(z.x+sin(fx1*z.z)))); wy=cos(fy1*z.x+sin(fy2*(z.y+sin(fy1*z.z)))); wz=cos(fx1*z.z+sin(fx2*(z.z+sin(fy1*z.y)))); }
    else if(u_gmode==4){ float sq=fx2*(z.y+cos(fx1*z.z)); sq*=sq; wx=sin(fx1*z.y+sin(sq)); sq=fy2*(z.x+cos(fy1*z.z)); sq*=sq; wy=sin(fy1*z.x+sin(sq)); sq=fx2*(z.z+cos(fy1*z.x)); sq*=sq; wz=sin(fx1*z.z+sin(sq)); }
    else if(u_gmode==5){ wx=cos(fx1*z.y+log(abs(fx2*(z.y+sin(fx1*z.z)))+1.0)); wy=cos(fy1*z.x+log(abs(fy2*(z.x+sin(fy1*z.z)))+1.0)); wz=cos(fx1*z.z+log(abs(fx2*(z.z+sin(fy1*z.x)))+1.0)); }
    else if(u_gmode==6){ wx=cos(fx1*z.y+tan(clamp(fx2*(z.y+sin(fx1*z.z)),-1.5,1.5))); wy=cos(fy1*z.x+tan(clamp(fy2*(z.x+sin(fy1*z.z)),-1.5,1.5))); wz=cos(fx1*z.z+tan(clamp(fx2*(z.z+sin(fy1*z.x)),-1.5,1.5))); }
    else if(u_gmode==7){ wx=sin(fx1*z.y+atan(fx2*z.z)); wy=cos(fy1*z.z+atan(fy2*z.x)); wz=sin(fx1*z.x+atan(fx2*z.y)); }
    else { wx=sin(fx1*z.y)*cos(fx2*z.z); wy=sin(fy1*z.z)*cos(fy2*z.x); wz=sin(fx1*z.x)*cos(fx2*z.y); }
    z=z*u_scale+u_off*vec3(wx,wy,wz); dr=dr*fac+1.0;
    trap=min(trap,dot(z,z)); if(length(z)>10.0) break;
  }
  return vec2((length(z)-1.5)/max(abs(dr),0.001), trap);
}` };
