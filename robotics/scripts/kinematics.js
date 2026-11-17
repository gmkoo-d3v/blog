(function(root){
'use strict';
const rad=d=>d*Math.PI/180;
function forward(q1,q2,l1=.4,l2=.3){const a=rad(q1),b=rad(q2),ex=l1*Math.cos(a),ey=l1*Math.sin(a);return {ex,ey,x:ex+l2*Math.cos(a+b),y:ey+l2*Math.sin(a+b)};}
function validateRange(min,max){return Number.isFinite(min)&&Number.isFinite(max)&&min<=max&&min>=-360&&max<=360;}
function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
function radialRange(min,max,l1=.4,l2=.3){if(!validateRange(min,max))throw new RangeError('각도 범위를 확인하세요');const angles=[min,max];for(let k=Math.ceil(min/180);k<=Math.floor(max/180);k++)angles.push(k*180);const radii=angles.map(a=>Math.sqrt(Math.max(0,l1*l1+l2*l2+2*l1*l2*Math.cos(rad(a)))));return {min:Math.min(...radii),max:Math.max(...radii)};}
function sampleWorkspace(aMin,aMax,bMin,bMax,n=180){if(!validateRange(aMin,aMax)||!validateRange(bMin,bMax))throw new RangeError('각도 범위를 확인하세요');const points=[];for(let i=0;i<=n;i++)for(let j=0;j<=n;j++){const p=forward(aMin+(aMax-aMin)*i/n,bMin+(bMax-bMin)*j/n);points.push([p.x,p.y]);}return points;}
const api={rad,forward,validateRange,clamp,radialRange,sampleWorkspace};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RobotMath=api;
})(typeof globalThis!=='undefined'?globalThis:this);
