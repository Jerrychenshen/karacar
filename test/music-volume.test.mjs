import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../public/music-volume.js', import.meta.url), 'utf8');
function setup(saved = null, denied = false) {
  let last, callback, stored = saved;
  const writes = [], calls = [];
  const storage = { getItem() { if (denied) throw Error('denied'); return stored; }, setItem(k,v) { if (denied) throw Error('quota'); writes.push([k,v]); stored = v; } };
  const context = { window: {} }; vm.runInNewContext(source, context);
  const make = () => context.window.createMusicVolume({storage, notify: s => last = s, schedule: f => { callback = f; return 1; }, cancel: () => { callback = null; }});
  const control = make(); control.render();
  const player = { volume: 100, muted: false, setVolume(v) { calls.push(['volume',v]); this.volume = v; }, getVolume() { return this.volume; }, isMuted() { return this.muted; }, unMute() { calls.push(['unmute']); this.muted = false; } };
  return { control, player, calls, writes, make, get last() { return last; }, flush() { callback?.(); } };
}
test('validate, clamp, persist only local key, reload; reject nonfinite/invalid values', () => {
  const h=setup(); h.control.choose(-10); assert.equal(h.last.value,0);
  h.control.choose(110); assert.equal(h.last.value,100);
  h.control.choose(31.6); assert.equal(h.last.value,32);
  for(const v of [NaN,Infinity,'7',null,undefined]) h.control.choose(v);
  assert.equal(h.last.value,32); assert.equal(h.writes.length,3);
  assert.ok(h.writes.every(([k])=>k==='kc.musicVolume'));
  h.make().render(); assert.equal(h.last.value,32);
  for(const raw of ['null','"40"','{}','bad']) {const x=setup(raw);assert.equal(x.last.value,100);}
  assert.equal(setup('200').last.value,100); assert.equal(setup('-2').last.value,0);
});
test('choice before ready is saved and applied at ready; bounded delayed readback', () => {
  const h=setup(); h.control.choose(24); assert.equal(h.last.status,'pending'); assert.equal(h.calls.length,0);
  h.control.ready(h.player); assert.equal(h.player.volume,24); h.flush(); assert.equal(h.last.status,'readback');
});
test('storage denial and quota errors retain memory preference', () => {
  const h=setup(null,true); h.control.choose(18); h.control.ready(h.player);h.flush();assert.equal(h.last.value,18);assert.equal(h.last.status,'readback');
});
test('unsaved ready adopts sensible player setting, saved setting takes priority', () => {
  const h=setup();h.player.volume=47;h.control.ready(h.player);assert.equal(h.last.value,47);
  const x=setup('21');x.player.volume=47;x.control.ready(x.player);assert.equal(x.player.volume,21);
  const y=setup();y.player.volume=NaN;y.control.ready(y.player);assert.equal(y.last.value,100);
});
test('zero silences without mute; positive gesture unmutes, passive apply/render never does', () => {
  const h=setup('20');h.player.muted=true;h.control.ready(h.player);h.flush();assert.equal(h.last.status,'muted');
  h.control.render();h.control.apply();assert.equal(h.player.muted,true);
  h.control.choose(0);h.flush();assert.equal(h.player.volume,0);assert.equal(h.player.muted,true);
  h.control.choose(10);h.flush();assert.equal(h.player.muted,false);assert.equal(h.last.status,'readback');
  const x=setup();x.player.muted=true;x.control.choose(12);x.control.ready(x.player);assert.equal(x.player.muted,false);
});
test('ignored commands, API errors and invalid readback report unconfirmed', () => {
  const h=setup('20');h.player.setVolume=()=>{};h.control.ready(h.player);h.flush();assert.equal(h.last.status,'unsupported');
  h.player.setVolume=()=>{throw Error('not ready');};assert.doesNotThrow(()=>h.control.apply());assert.equal(h.last.status,'unsupported');
  h.player.setVolume=()=>{};h.player.getVolume=()=>undefined;h.control.apply();h.flush();assert.equal(h.last.status,'unsupported');
});
test('real app load path reapplies preference before/after every video load including switch/fallback', async () => {
  const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const load=app.slice(app.indexOf('  function loadVideo(id)'),app.indexOf('  // Player time mapped'));
  const h=setup('23');h.control.ready(h.player);
  const events=[];h.player.setVolume=v=>{events.push('volume');h.player.volume=v;};
  h.player.loadVideoById=id=>{events.push(id);h.player.volume=100;};
  const ctx={playerReady:true,player:h.player,musicVolume:h.control};vm.createContext(ctx);vm.runInContext(load,ctx);
  ctx.loadVideo('song');assert.equal(h.player.volume,23);assert.deepEqual(events,['volume','song','volume']);
  const song={id:'original',duration:200};
  Object.assign(ctx,{S:{current:song,inst:false},WeakMap,URLSearchParams,Date,localStorage:{getItem:()=>null},document:{querySelector:()=>null},setInterval:()=>1,clearInterval(){},nowMs:()=>10000,clock:{},lastAutoResume:0,$:()=>({classList:{toggle(){}}}),icon:()=>'',esc:x=>x});
  vm.runInContext(app.slice(app.indexOf('  const altCache ='),app.indexOf("  $('#vocal-fab').addEventListener")),ctx);
  ctx.startAlt(song,{id:'backing',duration:200});assert.equal(events.at(-2).videoId,'backing');assert.equal(h.player.volume,23);
  ctx.restoreOriginal();assert.equal(events.at(-2).videoId,'original');assert.equal(h.player.volume,23);
  ctx.startAlt(song,{id:'backing',duration:200});ctx.failAlt('YouTube 150');assert.equal(events.at(-2).videoId,'original');assert.equal(h.player.volume,23);
});
test('app pending song applies saved gain on ready before load, then state changes reapply', () => {
  const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const h=setup('16'); const order=[];let options;
  h.player.setVolume=v=>{order.push('volume');h.player.volume=v;};
  h.player.loadVideoById=v=>{order.push(v);h.player.volume=100;};
  const ctx={musicVolume:h.control,window:{YT:{}},YT:{Player:function(id,opts){options=opts;return h.player;}},location:{origin:'https://test.invalid'},onPlayerState(){},onPlayerError(){}};
  vm.createContext(ctx);
  const code=app.slice(app.indexOf('  function createPlayer()'),app.indexOf('  // Player time mapped'));
  vm.runInContext('let player=null, playerReady=false, pendingVideo=null;'+code,ctx);
  ctx.loadVideo('pending-song');assert.equal(order.length,0);
  options.events.onReady();assert.equal(h.player.volume,16);assert.equal(order[0],'volume');assert.ok(order.indexOf('pending-song')>0);
  const state=app.slice(app.indexOf('  function onPlayerState(e)'),app.indexOf('  function onPlayerError(e)'));
  Object.assign(ctx,{S:{playing:false},updatePlayButtons(){},renderTabs(){}});vm.runInContext(state,ctx);
  h.player.volume=100;ctx.onPlayerState({data:3});assert.equal(h.player.volume,16);
});
