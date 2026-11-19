// Single source of truth for uniforms: GLSL declarations AND pushes are generated from these lists.
export const FLOATS = ['scale','offx','offy','offz','rx','ry','rz','fx1','fy1','fx2','fy2','planedepth','seed','jitter',
  'eyecell','eyedepth','eyespin','eyesq','scrtile','scrroll','scrwave','mpetals','mflat','meyeblend',
  'eps','detail','stepscale','laz','lel','lint','l2az','l2el','l2int','fill','sky','rim','soft','ao','aor','fog',
  'ccyc','cshift','spec','rough','metal','sss','glow','imgblend','imgscale','imgrow','imgaspect',
  'exposure','contrast','sat','vig','grain','camFov','orthoScale','safe','spiral','twidth','warp','time'];
export const INTS = ['iters','gmode','sym','mirror','steps','shadows','orbitLight','pal','useimg','tonemap','anim','ortho'];
export const COLORS = ['c0','c1','c2','c3','bg0','bg1'];
export const hex3 = h => [parseInt(h.slice(1,3),16)/255, parseInt(h.slice(3,5),16)/255, parseInt(h.slice(5,7),16)/255];
// colours are authored in sRGB; convert to linear so gradients/tonemap behave
export const lin3 = h => hex3(h).map(v => Math.pow(v, 2.2));
