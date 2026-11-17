(function(root){'use strict';
const rad=d=>d*Math.PI/180,zero=v=>v===0?0:v;
function evaluate(q1Deg,q2Deg,qdot1,qdot2){if(![q1Deg,q2Deg,qdot1,qdot2].every(Number.isFinite))throw new TypeError('Angles and velocities must be finite');const qRad=[rad(q1Deg),rad(q2Deg)],s1=Math.sin(qRad[0]),c1=Math.cos(qRad[0]),s12=Math.sin(qRad[0]+qRad[1]),c12=Math.cos(qRad[0]+qRad[1]);const J=[[-.4*s1-.3*s12,-.3*s12],[.4*c1+.3*c12,.3*c12]].map(row=>row.map(zero));const contributions=[[J[0][0]*qdot1,J[1][0]*qdot1],[J[0][1]*qdot2,J[1][1]*qdot2]];return {qRad,trig:{s1,c1,s12,c12},J,contributions,velocity:[contributions[0][0]+contributions[1][0],contributions[0][1]+contributions[1][1]],position:[.4*c1+.3*c12,.4*s1+.3*s12],elbow:[.4*c1,.4*s1]};}
function wrapDegrees(d){return ((d+180)%360+360)%360-180;}
function step(q1,q2,v1,v2,dt=.1){if(!Number.isFinite(dt)||dt<=0)throw new RangeError('dt must be positive');const before=evaluate(q1,q2,v1,v2),nextDegrees=[wrapDegrees(q1+v1*dt*180/Math.PI),wrapDegrees(q2+v2*dt*180/Math.PI)],after=evaluate(...nextDegrees,v1,v2);return {before,after,nextDegrees,predicted:before.position.map((p,i)=>p+before.velocity[i]*dt),actual:after.position,dt};}
const api={evaluate,step,wrapDegrees};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.JacobianMath=api;
})(typeof globalThis!=='undefined'?globalThis:this);
