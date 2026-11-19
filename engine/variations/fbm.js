export default { id: 2, name: 'FBM Warp', desc: 'Stacked 3D value-noise displacement: cloud-like organic drift.', glsl: `
vec2 de_var(vec3 pos){
  float at=ANIM?u_time*0.07:0.0;
  mat3 R=rX(u_rx)*rY(u_ry+at*0.04)*rZ(u_rz);
  float mf=max(abs(u_fx1),max(abs(u_fx2),abs(u_fy1)))*max(1.0,abs(u_fy2)*0.5);
  float fac=abs(u_scale)*(1.0+clamp(u_safe,0.0,1.0)*0.6*max(abs(u_offx),max(abs(u_offy),abs(u_offz)))*mf);
  vec3 z=pos; float dr=1.0,trap=1e9;
  for(int i=0;i<20;i++){ if(i>=u_iters) break; z=R*z;
    float f1=fbm3(z*u_fx1+vec3(at*0.1,0.0,0.0),4)-0.5;
    float f2=fbm3(z*u_fx2+vec3(0.0,at*0.1,at*0.08),4)-0.5;
    float f3=fbm3(z*u_fy1+vec3(0.0,0.0,at*0.09),4)-0.5;
    z+=vec3(f1,f2,f3*(u_fy2*0.5))*u_off*0.6; z=z*u_scale;
    dr=dr*fac+1.0; trap=min(trap,length(z)); if(length(z)>6.0) break;
  }
  return vec2((length(z)-1.2)/max(abs(dr),0.001), trap);
}` };
