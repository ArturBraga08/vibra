/* Lê apenas moov/MDHD/STTS de MP4/MOV. Não decodifica nem estima FPS de captura. */
(function(root){
'use strict';
function boxes(v,start,end){const out=[];for(let p=start;p+8<=end;){let size=v.getUint32(p),head=8;const type=String.fromCharCode(...new Uint8Array(v.buffer,v.byteOffset+p+4,4));if(size===1){if(p+16>end)throw Error('MP4 truncado');size=v.getUint32(p+8)*4294967296+v.getUint32(p+12);head=16;}if(size===0)size=end-p;if(!Number.isSafeInteger(size)||size<head||p+size>end)throw Error('Átomo MP4 inválido');out.push({type,start:p+head,end:p+size});p+=size;}return out;}
function child(v,b,type){return boxes(v,b.start,b.end).find(x=>x.type===type);}
function parseMoov(buffer){const v=new DataView(buffer),rootBox={start:0,end:v.byteLength};
 for(const trak of boxes(v,0,v.byteLength).filter(b=>b.type==='trak')){
 const mdia=child(v,trak,'mdia');if(!mdia)continue;const h=child(v,mdia,'hdlr');if(!h||h.start+12>h.end)continue;const handler=String.fromCharCode(...new Uint8Array(buffer,h.start+8,4));if(handler!=='vide')continue;
 const m=child(v,mdia,'mdhd'),minf=child(v,mdia,'minf');if(!m||!minf)continue;const stbl=child(v,minf,'stbl');if(!stbl)continue;const stts=child(v,stbl,'stts');if(!stts)continue;
 const offset=v.getUint8(m.start)===1?20:12;if(m.start+offset+4>m.end)throw Error('mdhd truncado');const timescale=v.getUint32(m.start+offset);if(stts.start+8>stts.end)throw Error('stts truncado');const entries=v.getUint32(stts.start+4);if(entries>1000000||stts.start+8+entries*8>stts.end)throw Error('Tabela temporal inválida');
 let samples=0,ticks=0;const deltas=new Map(),runs=[];for(let j=0;j<entries;j++){const count=v.getUint32(stts.start+8+j*8),delta=v.getUint32(stts.start+12+j*8);if(count){runs.push({start:ticks/timescale,count,dt:delta/timescale});deltas.set(delta,(deltas.get(delta)||0)+count);}samples+=count;ticks+=count*delta;}
 if(samples>0&&ticks>0&&timescale>0){
 const ranked=[...deltas].sort((a,b)=>a[0]-b[0]);let acc=0,median=ranked[0][0];for(const [delta,count] of ranked){acc+=count;if(acc>=samples/2){median=delta;break;}}
 let nominalFps=timescale/median;if(Math.abs(nominalFps-Math.round(nominalFps))<.01)nominalFps=Math.round(nominalFps);
 const tolerance=Math.max(2,median*.05),variable=ranked.some(([delta])=>Math.abs(delta-median)>tolerance);
 let longest={start:0,end:0},runStart=0;for(const run of runs){if(run.dt>1.5/nominalFps){if(run.start-runStart>longest.end-longest.start)longest={start:runStart,end:run.start};runStart=run.start+run.count*run.dt;}}
 if(ticks/timescale-runStart>longest.end-longest.start)longest={start:runStart,end:ticks/timescale};
 return {fps:samples*timescale/ticks,nominalFps,samples,duration:ticks/timescale,variable,runs,longestRegular:longest,method:'MP4 stts/mdhd',captureFpsKnown:false};
 }
 }return null;}
async function probe(file){for(let pos=0,atoms=0;pos+8<=file.size&&atoms<10000;atoms++){
 const head=new DataView(await file.slice(pos,Math.min(pos+16,file.size)).arrayBuffer());let size=head.getUint32(0),bytes=8;const type=String.fromCharCode(...new Uint8Array(head.buffer,4,4));if(size===1){if(head.byteLength<16)return null;size=head.getUint32(8)*4294967296+head.getUint32(12);bytes=16;}if(size===0)size=file.size-pos;if(!Number.isSafeInteger(size)||size<bytes||pos+size>file.size)return null;if(type==='moov'){if(size>32*1024*1024)return null;return parseMoov(await file.slice(pos+bytes,pos+size).arrayBuffer());}pos+=size;
 }return null;}
function validateSegment(timing,start,count,fps){
 if(!timing)return {ok:true,verified:false};const end=start+(count-1)/fps;
 if(start<0||end>=timing.duration)return {ok:false,reason:'O trecho ultrapassa o vídeo.'};
 if(fps>timing.nominalFps*1.05)return {ok:false,reason:`A taxa solicitada supera os intervalos usuais do arquivo (${timing.nominalFps.toFixed(3)} FPS).`};
 for(const run of timing.runs||[]){if(run.dt>1.5/fps&&run.start<end&&run.start+run.count*run.dt>start)return {ok:false,reason:'Este trecho contém uma lacuna temporal longa. Use “Escolher trecho regular” ou altere o início.'};}
 return {ok:true,verified:true,resampled:true};
}
root.VibraProbe={probe,parseMoov,validateSegment};if(typeof module!=='undefined')module.exports=root.VibraProbe;
})(typeof self!=='undefined'?self:globalThis);
