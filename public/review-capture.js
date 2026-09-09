// Development-only capture of the actual game canvas and final audio output.
if (['127.0.0.1','localhost'].includes(location.hostname) && new URLSearchParams(location.search).has('review')) {
 const originalConnect=AudioNode.prototype.connect;
 let tap;
 AudioNode.prototype.connect=function(destination,...args){
   if(destination instanceof AudioDestinationNode){
     tap ||= this.context.createMediaStreamDestination();
     originalConnect.call(this,tap);
   }
   return originalConnect.call(this,destination,...args);
 };
 addEventListener('DOMContentLoaded',()=>{
  let recorder, chunks=[], samples=[];
  const panel=document.createElement('div'); panel.style.cssText='position:fixed;bottom:8px;left:50%;z-index:10000;display:flex;gap:8px;background:#111d;padding:6px;color:white;font:12px Arial';
  const rec=document.createElement('button'),snap=document.createElement('button');rec.textContent='QA: RECORD';snap.textContent='QA: FRAME';
  for(const b of [rec,snap])b.style.cssText='background:#b91231;color:white;padding:8px;border:0;cursor:pointer';panel.append(rec,snap);document.body.append(panel);
  const upload=(file,data)=>fetch('http://127.0.0.1:4190/'+file,{method:'POST',body:data});
  rec.onclick=()=>{
   if(recorder?.state==='recording'){recorder.stop();return;}
   const stream=document.querySelector('#world').captureStream(30);if(tap)for(const t of tap.stream.getAudioTracks())stream.addTrack(t);
   recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9,opus',videoBitsPerSecond:5000000});chunks=[];samples=[];
   recorder.ondataavailable=e=>chunks.push(e.data);
   recorder.onstop=async()=>{const id=Date.now();await upload('gameplay-'+id+'.webm',new Blob(chunks,{type:recorder.mimeType}));await upload('profile-'+id+'.json',new Blob([JSON.stringify(samples)]));rec.textContent='QA: RECORD';};
   recorder.start(1000);rec.textContent='QA: STOP';
  };
  snap.onclick=()=>requestAnimationFrame(()=>document.querySelector('#world').toBlob(b=>b&&upload('frame-'+Date.now()+'.png',b)));
  setInterval(()=>{if(recorder?.state==='recording'&&window.__tour){const t=window.__tour;samples.push({at:performance.now(),build:t.build,screen:t.screen,paused:t.paused,raceTime:t.raceTime,frameMs:t.frameMs,lastFrameMs:t.lastFrameMs,frameProfile:t.frameProfile,viewport:t.viewport,drawingBuffer:t.drawingBuffer,textures:t.textures,pixelRatio:t.pixelRatio,cpu:t.cpu,drawCalls:t.drawCalls,triangles:t.triangles,player:t.player,audio:t.audio,backend:t.backend,checkpoints:t.checkpoints});}},100);
 });
}
