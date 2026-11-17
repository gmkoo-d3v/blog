(function(root){'use strict';
const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function multiply(a,b){const out=Array(16).fill(0);for(let r=0;r<4;r++)for(let c=0;c<4;c++)for(let k=0;k<4;k++)out[4*r+c]+=a[4*r+k]*b[4*k+c];return out;}
function standard(p){for(const k of ['theta','d','a','alpha'])if(!Number.isFinite(p[k]))throw new TypeError('DH parameters must be finite numbers');const t=p.theta*Math.PI/180,al=p.alpha*Math.PI/180,c=Math.cos(t),s=Math.sin(t),ca=Math.cos(al),sa=Math.sin(al);return [c,-s*ca,s*sa,p.a*c,s,c*ca,-c*sa,p.a*s,0,sa,ca,p.d,0,0,0,1];}
function position(m){return [m[3],m[7],m[11]];}
function chain(rows){if(!Array.isArray(rows)||rows.length<1||rows.length>3)throw new RangeError('Use one to three links');let end=identity();const local=[],world=[],frames=[{matrix:end,position:position(end)}];for(const p of rows){const a=standard(p);local.push(a);end=multiply(end,a);world.push(end);frames.push({matrix:end,position:position(end)});}return {local,world,frames,end};}
const api={identity,multiply,standard,position,chain};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DHMath=api;
})(typeof globalThis!=='undefined'?globalThis:this);
