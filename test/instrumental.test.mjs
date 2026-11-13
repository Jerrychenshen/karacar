import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {cleanTitle,instrumentalIdentity,instrumentalQueries,instrumentalRejection,findInstrumental} from '../server.js';
const target={title:'李佳薇 Jess Lee〈甲乙丙丁 Strangers〉Official Lyric Video',channel:'Sony Music China索尼音樂中國',duration:211,id:'YacpC7sUXMM'};
const row=(title,duration=211,channel='Karaoke uploader',id='candidate01')=>({title,duration,channel,id});
test('brackets identify song and artist, retain full English subtitle',()=>{
 for(const [a,b] of [['〈','〉'],['《','》'],['【','】'],['「','」'],['『','』'],['[',']']])assert.deepEqual(cleanTitle(`李佳薇 Jess Lee${a}甲乙丙丁 Strangers${b}Official Lyric Video`,target.channel),{track:'甲乙丙丁 Strangers',artist:'李佳薇 Jess Lee'});
 assert.deepEqual(instrumentalQueries(target),['李佳薇 Jess Lee 甲乙丙丁 Strangers 伴奏','李佳薇 Jess Lee 甲乙丙丁 Strangers instrumental karaoke','李佳薇 甲乙丙丁 伴奏','李佳薇 甲乙丙丁 instrumental karaoke']);
});
for(const [title,candidate] of [
 ['Rick Astley - Never Gonna Give You Up (Official Music Video)','Rick Astley - Never Gonna Give You Up (Karaoke)'],
 ['BIGBANG - BANG BANG BANG','BIGBANG - BANG BANG BANG instrumental'],
 ['Jolin Tsai - Love Love Love','Jolin Tsai - Love Love Love karaoke'],
 ['周杰倫 Jay Chou【Mojito】Official MV','周杰伦 - Mojito 伴奏'],
 ['某歌手 - 愛 Love','某歌手 - 愛 Love 伴奏'],
 ['某歌手 - 我的 Love Love Love','某歌手 - 我的 Love Love Love 伴奏'],
 ['Artist - Don’t Stop!','Artist - Don\'t Stop (Instrumental)'],
 ['周杰倫 - 晴天','周杰伦 - 晴天 伴奏']])test(`preserve ${title}`,async()=>{
 const args={...target,title,channel:'Uploader'};
 assert.equal(instrumentalIdentity(args).tracks.length,1);
 assert.ok(instrumentalQueries(args)[0].includes(cleanTitle(title).track));
 assert.equal(instrumentalRejection(args,row(candidate)),null);
 assert.ok((await findInstrumental(args,async()=>[row(candidate)])).alt);
});
test('verified prior Chinese bilingual title keeps its matching fallback',()=>{
 const args={...target,title:'周杰倫 Jay Chou【晴天 Sunny Day】-Official Music Video',duration:319};
 assert.equal(instrumentalRejection(args,row('周杰伦 Jay Chou 《晴天》 Pinyin Karaoke Version Instrumental Music 拼音卡拉OK伴奏 KTV with Pinyin Lyrics 4k',319)),null);
 assert.equal(instrumentalIdentity(args).tracks[0],'晴天 Sunny Day');
});
test('reject unsafe versions, identity and duration false positives',()=>{
 for(const title of ['张学友 郑中基 许志安 - 甲乙丙丁 伴奏','李佳薇 - 甲乙丙丁 合唱版伴奏','李佳薇 - 甲乙丙丁 粵語 伴奏','李佳薇 - 甲乙丙丁 粵伴奏+4','李佳薇 - 甲乙丙丁 廣東話 karaoke','李佳薇 - 甲乙丙丁 台語版 伴奏','李佳薇 - 甲乙丙丁 cover karaoke','李佳薇 - 甲乙丙丁 LIVE instrumental','李佳薇 - 甲乙丙丁 remix 伴奏','DJ 李佳薇 - 甲乙丙丁 伴奏','李佳薇 - 甲乙丙丁 吉他伴奏','李佳薇 - 甲乙丙丁 男版伴奏','李佳薇 - 甲乙丙丁 (可轉伴奏和人聲視頻)','李佳薇 - 甲乙丙丁 Official Lyric Video','李佳薇 - 新甲乙丙丁 伴奏','李佳薇 - 静音恋人 伴奏','甲乙丙丁 Strangers 伴奏'])assert.ok(instrumentalRejection(target,row(title)),title);
 for(const duration of [0,190,232])assert.equal(instrumentalRejection(target,row('李佳薇 - 甲乙丙丁 伴奏',duration)),'duration');
 assert.equal(instrumentalRejection(target,row('李佳薇 - 甲乙丙丁 伴奏',191)),null);
 assert.equal(instrumentalRejection(target,row('李佳薇 - 甲乙丙丁 伴奏',231)),null);
 assert.equal(instrumentalRejection(target,row('李佳薇 - 甲乙丙丁 伴奏',211,'',target.id)),'same-id');
 assert.ok(instrumentalRejection({...target,title:'某歌手 - 我的 Love Love Love'},row('某歌手 - 我的 伴奏')));
 assert.ok(instrumentalRejection({...target,title:'BIGBANG - BANG BANG BANG'},row('BIGBANG - BANG karaoke')));
 assert.ok(instrumentalRejection({...target,title:'Rick Astley - Never Gonna Give You Up'},row('Rick Astley - Never Gonna Give You Upper karaoke')));
});
test('observed official metadata distinguishes original and duet accompaniment',()=>{
 assert.equal(instrumentalRejection(target,row('甲乙丙丁Strangers (伴奏)',211,'李佳薇 Jess Lee 官方音樂頻道')),null);
 assert.equal(instrumentalRejection(target,row('甲乙丙丁Strangers (合唱版伴奏)',211,'李佳薇 Jess Lee 官方音樂頻道')),'version-or-language');
});
test('bounded queries, deduplication, ranking, fail closed',async()=>{
 let queries=[];
 const result=await findInstrumental(target,async q=>{queries.push(q);return queries.length<3?[row('张学友 - 甲乙丙丁 伴奏')]:[row('李佳薇 - 甲乙丙丁 伴奏',228,'','long'),row('李佳薇 - 甲乙丙丁 karaoke',211,'','closest')];});
 assert.equal(queries.length,4);assert.equal(result.alt.id,'closest');
 queries=[];assert.equal((await findInstrumental(target,async q=>{queries.push(q);return [];})).alt,null);assert.equal(queries.length,4);
 let n=0;await assert.rejects(findInstrumental({title:'Artist - Song',duration:200},async()=>{n++;throw Error('offline');}));assert.equal(n,2);
});
test('frontend ignores persisted legacy misses/promises, coalesces requests and expires misses',async()=>{
 const src=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const a=src.indexOf('  const altCache ='),b=src.indexOf('  function updateVocalFab()',a);
 let calls=0,now=1000,fail=false;
 const context=vm.createContext({URLSearchParams,WeakMap,Promise,setTimeout:()=>1,Date:{now:()=>now},api:async()=>{calls++;if(fail)throw Error('offline');return {alt:null};},S:{current:null},updateVocalFab:()=>{}});
 vm.runInContext(src.slice(a,b)+';globalThis.findAlt=findAlt;',context);
 const song={...target,alt:null,_altP:{}};
 await Promise.all([context.findAlt(song),context.findAlt(song)]);assert.equal(calls,1);assert.equal(song._altP,undefined);
 await context.findAlt(song);assert.equal(calls,1);
 now+=300001;await context.findAlt(song);assert.equal(calls,2);
 fail=true;now+=300001;await context.findAlt(song);assert.equal(song.alt,undefined);
 fail=false;await context.findAlt(song);assert.equal(calls,4);
});
