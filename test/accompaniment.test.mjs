import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {instrumentalIdentity,instrumentalRejection,findInstrumental} from '../server.js';
const matrix=JSON.parse(fs.readFileSync(new URL('./accompaniment-fixtures.json',import.meta.url)));
for(const item of matrix) test(`exact original metadata: ${item.label}`,async()=>{
 const rows=[...new Map(item.candidates.flatMap(c=>c.results).map(r=>[r.id,r])).values()];
 let call=0; const out=await findInstrumental(item.song,async()=>item.candidates[(call++) % item.candidates.length].results);
 assert.ok(out.alt,JSON.stringify(instrumentalIdentity(item.song)));
 assert.equal(instrumentalRejection(item.song,out.alt),null);
 if(item.label==='eric-mv') {
  assert.equal(instrumentalRejection(item.song,rows.find(r=>r.id==='3mb6wBKtVUs')),'duration');
  assert.ok(out.candidates.some(r=>r.id==='3mb6wBKtVUs'&&!r.qualified));
 }
 if(item.label==='sunny-mv') assert.equal(instrumentalRejection(item.song,rows.find(r=>r.id==='ukQMwrq19B8')),'duration');
});
test('no failures cached as misses, including partial search errors',async()=>{
 const args=matrix[0].song;
 await assert.rejects(findInstrumental(args,async()=>{throw Error('timeout')}));
 let n=0; await assert.rejects(findInstrumental(args,async()=>{if(++n===1)throw Error('429');return []}));
 assert.equal((await findInstrumental(args,async()=>[])).alt,null);
});
const src=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
function harness(){
 let interval,loads=[],time=96,state=1,id='original',now=1000;
 const song={id:'original',duration:260};
 const ctx={S:{current:song,inst:false,instScale:1},WeakMap,URLSearchParams,Date:{now:()=>now},toast(){},localStorage:{getItem:()=>null},document:{querySelector:()=>null},playerReady:true,
  player:{getVideoData:()=>({video_id:id}),getCurrentTime:()=>time,getPlayerState:()=>state},nowMs:()=>time*1000,clock:{},lastAutoResume:0,loadVideo:x=>{loads.push(x);id=x.videoId;time=0},clearInterval:()=>{interval=null},setTimeout:()=>1,setInterval:f=>{interval=f;return 1},api:async()=>({alt:null}),$:()=>({innerHTML:'',classList:{toggle(){}}}),icon:()=>'',esc:x=>x,t:x=>x};
 vm.createContext(ctx);vm.runInContext(src.slice(src.indexOf('  const altCache ='),src.indexOf("  $('#vocal-fab').addEventListener('click', toggleVocal);"))+';globalThis.h={startAlt,restoreOriginal,failAlt,cancelAlt,findAlt,toggleVocal};'+src.slice(src.indexOf('  function onPlayerError(e)'),src.indexOf('  function play(song,')),ctx);
 return {ctx,song,loads,set:(t,s=1,i=id)=>{time=t;state=s;id=i},advance:n=>{now+=n},tick:()=>interval?.()};
}
test('loading is not success; correct ID plus progression confirms; restore saved position after 150/101/153/timeout',()=>{
 for(const code of ['YouTube 150','YouTube 101','YouTube 153','加载超时']){
  const h=harness();h.ctx.h.startAlt(h.song,{id:'alternative',duration:259});
  assert.match(h.song.altState,/加载/);h.set(10,1,'wrong');h.tick();assert.match(h.song.altState,/加载/);
  if(code!=='加载超时'){h.set(10,1,'alternative');h.tick();h.set(11);h.tick();assert.match(h.song.altState,/播放中/);}
  h.set(0,-1);if(code.startsWith('YouTube'))h.ctx.onPlayerError({data:Number(code.split(' ')[1])});else {h.advance(16000);h.tick();}assert.equal(h.loads.at(-1).videoId,'original');assert.equal(h.loads.at(-1).startSeconds,96);
  assert.match(h.song.altState,new RegExp(code));assert.equal(h.ctx.S.inst,false);
  h.ctx.h.startAlt(h.song,{id:'alternative',duration:259});assert.match(h.song.altState,/加载/);
 }
});
test('song change cancels stale progression and async toggles',async()=>{
 const h=harness();let resolve;h.ctx.api=()=>new Promise(r=>resolve=r);
 const pending=h.ctx.h.toggleVocal();h.ctx.h.cancelAlt();h.ctx.S.current={id:'new'};resolve({alt:{id:'alternative'}});await pending;assert.equal(h.loads.length,0);
});

test('original failure stays visible with an empty queue; manual restore during loading uses saved position',()=>{
 const h=harness();h.ctx.onPlayerError({data:153});assert.match(h.song.altState,/153/);
 h.ctx.h.startAlt(h.song,{id:'alternative',duration:260});h.set(0,-1);h.ctx.h.restoreOriginal();assert.equal(h.loads.at(-1).startSeconds,96);
});
