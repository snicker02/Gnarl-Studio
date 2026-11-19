export default { id: 1, name: 'Sine Warp', desc: 'Recursive sin(sin(z)) iteration: flowing folds and tendrils.', glsl: `
vec2 de_var(vec3 pos){
  float at=ANIM?u_time*0.12:0.0;
  mat3 R=rX(u_rx)*rY(u_ry+at*0.05)*rZ(u_rz);
  float fac=abs(u_scale)*(1.0+clamp(u_safe,0.0,1.0)*(max(abs(u_fx1),abs(u_fy1))+max(abs(u_fx2),abs(u_fy2)))*0.5);
  vec3 z=pos; float dr=1.0,trap=1e9;
  for(int i=0;i<20;i++){ if(i>=u_iters) break; z=R*z;
    z=sin(z*vec3(u_fx1,u_fy1,u_fx1)+sin(z.yzx*vec3(u_fx2,u_fy2,u_fx2)+at*0.18));
    z=z*u_scale+u_off*0.45; dr=dr*fac+1.0;
    trap=min(trap,length(z)); if(length(z)>6.0) break;
  }
  return vec2((length(z)-1.2)/max(abs(dr),0.001), trap);
}` };
