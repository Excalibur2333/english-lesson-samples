/* 闭环一课样本 · The Big Red Apple —— 纯静态，无外网依赖 */
(function () {
'use strict';
var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var AU = function (id) { return 'assets/audio/' + id + '.mp3'; };
var IM = function (n) { return 'assets/img/p' + n + '.webp'; };
var TH = function (n) { return 'assets/img/t' + n + '.webp'; };
var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
var esc = function (s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); };
function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

/* ---------- 课文 ---------- */
var STORY = [
  { img: 1, lines: [['s01', 'Pip is a little mouse.'], ['s02', 'One day, Pip sees a big red apple.'], ['s03', '“I want to take it home!” says Pip.'], ['s04', 'Pip pushes and pushes. But the apple is too big.']] },
  { img: 2, lines: [['s05', 'A rabbit hops by.'], ['s06', '“Can you help me?” asks Pip.'], ['s07', '“Yes, I can!” says the rabbit.'], ['s08', 'They push and push. But the apple is too big.']] },
  { img: 3, lines: [['s09', 'A fox runs by.'], ['s06', '“Can you help me?” asks Pip.'], ['s10', '“Yes, I can!” says the fox.'], ['s08', 'They push and push. But the apple is too big.']] },
  { img: 4, lines: [['s11', 'A bear walks by.'], ['s06', '“Can you help me?” asks Pip.'], ['s12', '“Yes, I can!” says the bear.'], ['s13', 'They push and push. Look! The apple rolls and rolls, all the way to Pip’s home.']] },
  { img: 5, lines: [['s14', '“Thank you, my friends!” says Pip.'], ['s15', '“Let’s eat the apple together!”'], ['s16', 'The apple is too big for one mouse. But it is just right for four friends!']] }
];
var PAGE6 = [['x01', 'The next day, Pip sees a big yellow pumpkin.'], ['x02', '“Can you help me?” asks Pip.'], ['x03', '“Yes, we can!” say his friends.']];
function markPat(t) {
  return esc(t).replace(/Can you help me\?/g, '<span class="pat">Can you help me?</span>')
    .replace(/Yes, (I|we) can!/g, '<span class="pat">Yes, $1 can!</span>')
    .replace(/too big/g, '<span class="pat">too big</span>');
}

/* ---------- 步骤 ---------- */
var STEPS = [
  { id: 'listen1', g: '听', name: '泛听', no: 1 },
  { id: 'listen2', g: '听', name: '精听', no: 2 },
  { id: 'speak1', g: '说', name: '跟读', no: 3 },
  { id: 'speak2', g: '说', name: '看图复述', no: 4 },
  { id: 'read', g: '读', name: '阅读', no: 5 },
  { id: 'write', g: '写', name: '句型替换', no: 6 },
  { id: 'game', g: '玩', name: '闯关', no: 7 },
  { id: 'board', g: '看板', name: '学情看板', no: 8 }
];
var GROUPS = ['听', '说', '读', '写', '玩', '看板'];
function stepOf(id) { for (var i = 0; i < STEPS.length; i++) if (STEPS[i].id === id) return STEPS[i]; return null; }

/* ---------- 作答记录（看板和「问老师」都从这里算） ---------- */
var R = { items: {}, order: [], asks: [], done: {}, timeOn: {}, t0: Date.now(), videoSec: 0, teachSec: 0, teachSeen: false, readTaps: {}, game: null, myPage: null };
function item(key, meta) {
  if (!R.items[key]) { R.items[key] = { key: key, tries: [], firstOk: null, done: false }; R.order.push(key); }
  var it = R.items[key];
  if (meta) for (var k in meta) it[k] = meta[k];
  return it;
}
function attempt(key, meta, answer, ok) {
  var it = item(key, meta);
  it.tries.push({ a: answer, ok: ok });
  if (it.firstOk === null) it.firstOk = ok;
  if (ok) it.done = true;
  return it;
}
function credit(it) {
  if (typeof it.val === 'number') return it.val;
  if (it.firstOk) return 1;
  if (!it.done) return 0;
  var n = 0; while (n < it.tries.length && !it.tries[n].ok) n++;   // 第几次才第一次做对；之后再玩、再做不影响分数
  return n <= 1 ? 0.6 : 0.4;
}
function triesText(it) {
  if (it.note) return it.note;
  if (!it.tries.length) return '还没作答';
  return it.tries.map(function (t) { return esc(t.a) + (t.ok ? ' ✓' : ' ✗'); }).join(' → ');
}

/* ---------- 声音 ---------- */
var player = new Audio(); player.preload = 'auto';
var seqId = 0, pendingRes = null;
function pauseMedia() {
  var v = $('#vid'); if (v && !v.paused) v.pause();
  var l = $('#loopAudio'); if (l && !l.paused) l.pause();
  if (myAudio) { try { myAudio.pause(); } catch (e) {} }
}
function halt() {
  seqId++;
  try { player.pause(); } catch (e) {}
  player.onended = player.onerror = null;
  if (pendingRes) { var r = pendingRes; pendingRes = null; r(); }
  pauseMedia();
}
function _play(id, rate) {
  return new Promise(function (res) {
    try { player.pause(); } catch (e) {}
    player.src = AU(id);
    player.playbackRate = rate || 1;
    var done = function () { player.onended = player.onerror = null; pendingRes = null; res(); };
    pendingRes = res;
    player.onended = done; player.onerror = done;
    var p = player.play(); if (p && p.catch) p.catch(done);
  });
}
function play(id, rate) { halt(); return _play(id, rate); }
function playSeq(ids, onstep, rate) {
  halt(); var my = seqId; var i = 0;
  function next() {
    if (my !== seqId) return Promise.resolve(false);
    if (i >= ids.length) { if (onstep) onstep(-1); return Promise.resolve(true); }
    if (onstep) onstep(i);
    return _play(ids[i++], rate).then(function () { if (my !== seqId) return false; return wait(300).then(next); });
  }
  return next();
}
var myAudio = null;

/* 短提示音（Web Audio，失败就静音） */
var actx = null;
function beep(ok) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    var o = actx.createOscillator(), g = actx.createGain();
    o.type = 'sine'; o.frequency.value = ok ? 880 : 220;
    if (ok) o.frequency.setValueAtTime(1175, actx.currentTime + 0.09);
    g.gain.value = 0.08; g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.25);
    o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + 0.26);
  } catch (e) {}
}

/* ---------- 录音（拿不到麦克风就走自评退路） ---------- */
var Rec = {
  ok: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder && window.isSecureContext !== false),
  mr: null, stream: null, timer: null,
  start: function (maxMs, onStart) {
    var self = this;
    return navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      return new Promise(function (resolve, reject) {
        var mr;
        try { mr = new MediaRecorder(stream); } catch (e) { stream.getTracks().forEach(function (t) { t.stop(); }); return reject(e); }
        var chunks = [], t0 = Date.now();
        self.mr = mr; self.stream = stream;
        mr.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        mr.onstop = function () {
          clearTimeout(self.timer);
          stream.getTracks().forEach(function (t) { t.stop(); });
          self.mr = null; self.stream = null;
          var blob = new Blob(chunks, { type: mr.mimeType || (chunks[0] && chunks[0].type) || 'audio/webm' });
          if (!blob.size) return reject(new Error('empty'));
          resolve({ url: URL.createObjectURL(blob), dur: (Date.now() - t0) / 1000 });
        };
        mr.onerror = function (e) { reject(e.error || new Error('rec')); };
        mr.start();
        if (onStart) onStart();
        self.timer = setTimeout(function () { self.stop(); }, maxMs);
      });
    });
  },
  stop: function () { if (this.mr && this.mr.state !== 'inactive') { try { this.mr.stop(); } catch (e) {} } },
  cancel: function () {
    clearTimeout(this.timer);
    if (this.mr) { try { this.mr.onstop = null; this.mr.stop(); } catch (e) {} this.mr = null; }
    if (this.stream) { this.stream.getTracks().forEach(function (t) { t.stop(); }); this.stream = null; }
  }
};

/* 录音控件：o = {models:[音频id], max:毫秒, after:html, onRecorded(res)} */
function recorderUI(box, o) {
  var res = null, recording = false;
  box.innerHTML =
    '<div class="rowb" style="justify-content:center">' +
    (o.models ? '<button class="btn sm" data-a="model">▶ 听原声</button>' : '') +
    '<button class="btn sm hide" data-a="mine">▶ 听我的</button></div>' +
    '<button class="recbtn" data-a="rec" aria-label="录音">🎙</button>' +
    '<div class="rectip" data-r="tip"></div>' +
    '<button class="btn sm" data-a="nomic" style="display:block;margin:6px auto 0;font-weight:500;font-size:13px">录不了？我大声' + (o.verb || '读') + '过了</button>';
  var tip = $('[data-r=tip]', box), recBtn = $('[data-a=rec]', box), mineBtn = $('[data-a=mine]', box);
  function setTip(t) { tip.textContent = t; }
  if (!Rec.ok) { recBtn.style.opacity = .4; setTip('这里拿不到麦克风：先大声' + (o.verb || '读') + '一遍，再点下面的按钮'); }
  else setTip('点一下开始录音，' + (o.verb || '读') + '完再点一下');
  function finish(r) { res = r; if (o.onRecorded) o.onRecorded(r); }
  box.addEventListener('click', function (e) {
    var b = e.target.closest('[data-a]'); if (!b) return;
    var a = b.getAttribute('data-a');
    if (a === 'model') { playSeq(o.models); }
    if (a === 'mine' && res && res.url) { halt(); myAudio = new Audio(res.url); myAudio.play(); }
    if (a === 'nomic') { Rec.cancel(); recording = false; recBtn.classList.remove('on'); setTip('好，记下了：这一次是自己' + (o.verb || '读') + '的（没有录音）'); finish({ mode: 'self', dur: 0 }); }
    if (a === 'rec') {
      if (!Rec.ok) { setTip('这台设备（或这个浏览器）不让网页用麦克风。大声' + (o.verb || '读') + '一遍，再点下面的按钮。'); return; }
      if (recording) { Rec.stop(); return; }
      halt(); setTip('正在请求麦克风…（如果弹出询问，请点允许）');
      Rec.start(o.max || 8000, function () { recording = true; recBtn.classList.add('on'); recBtn.textContent = '■'; setTip('录音中… ' + (o.verb || '读') + '完点一下停止'); })
        .then(function (r) {
          recording = false; recBtn.classList.remove('on'); recBtn.textContent = '🎙';
          r.mode = 'rec'; mineBtn.classList.remove('hide');
          setTip('录好了（' + r.dur.toFixed(1) + ' 秒）。点「听我的」，和原声比一比；不满意可以再录');
          finish(r);
        })
        .catch(function () {
          recording = false; recBtn.classList.remove('on'); recBtn.textContent = '🎙';
          setTip('没拿到麦克风（没给权限或设备不支持）。大声' + (o.verb || '读') + '一遍，再点下面的按钮');
        });
    }
  });
}

/* ---------- 导航 ---------- */
var cur = 'home', enterAt = Date.now(), onLeave = null;
var stage = $('#stage');
function go(id) {
  halt(); Rec.cancel();
  if (onLeave) { try { onLeave(); } catch (e) {} onLeave = null; }
  R.timeOn[cur] = (R.timeOn[cur] || 0) + (Date.now() - enterAt);
  cur = id; enterAt = Date.now();
  closeSheet();
  (SCREENS[id] || SCREENS.home)();
  drawTop();
  window.scrollTo(0, 0);
}
function drawTop() {
  var st = stepOf(cur);
  $('#topTitle').textContent = st ? ('第 ' + st.no + ' 步 / 共 8 步 · ' + st.name) : '闭环一课样本 · The Big Red Apple';
  $('#btnHome').style.visibility = cur === 'home' ? 'hidden' : 'visible';
  $('#chips').innerHTML = GROUPS.map(function (g) {
    var ss = STEPS.filter(function (s) { return s.g === g; });
    var done = ss.every(function (s) { return R.done[s.id]; });
    var on = st && st.g === g;
    return '<button class="chip' + (on ? ' on' : done ? ' done' : '') + '" data-g="' + g + '">' + (done && !on ? '✓ ' : '') + g + '</button>';
  }).join('');
  $('#fab').classList.toggle('hide', !st || cur === 'board');
}
$('#chips').addEventListener('click', function (e) {
  var b = e.target.closest('[data-g]'); if (!b) return;
  var ss = STEPS.filter(function (s) { return s.g === b.getAttribute('data-g'); });
  var t = ss.filter(function (s) { return !R.done[s.id]; })[0] || ss[0];
  go(t.id);
});
$('#btnHome').addEventListener('click', function () { go('home'); });
$('#btnMap').addEventListener('click', function () { openSheet('<h2>这个样本对应你方案里的哪几条</h2>' + mapRows(), true); });
$('#fab').addEventListener('click', openAsk);
function finishStep(id) { R.done[id] = true; drawTop(); }
function nextCard(text, nextId, btnLabel, extra) {
  var d = document.createElement('div'); d.className = 'card';
  d.innerHTML = '<div class="fb ok" style="margin-top:0">' + text + '</div>' + (extra || '') + '<button class="btn pri">' + btnLabel + ' ›</button>';
  $('.btn.pri', d).addEventListener('click', function () { go(nextId); });
  stage.appendChild(d);
  setTimeout(function () { d.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60);
}
function head(st, title, tags, quote, lead) {
  return '<h2>' + title + '</h2><div>' + tags.map(function (t) { return '<span class="tag">' + t + '</span>'; }).join('') + '</div>' +
    (quote ? '<div class="quote">方案原句：' + quote + '</div>' : '') + (lead ? '<p>' + lead + '</p>' : '');
}

/* ---------- 对照方案 ---------- */
var MAP = [
  ['老师只是服务，教学由系统主要完成。孩子有卡点的时候老师再答疑就行。', '（微信原话）整节课没有老师讲课：讲解由系统的短片完成，每一步由系统带着做。每一步右下角都有「问老师」，点开能看到系统把孩子卡在哪、答错了什么一起交给老师。', 'listen2'],
  ['听力素材与后期阅读素材同源复用、听过即读懂，实现零阻力进阶', '第 5 步读的就是第 1、2 步听过的同一篇，一个字没改；最后多出一页没听过的，用来练 Predict。泛听默认不放字幕：孩子先用耳朵听懂，到第 5 步才整篇读字。', 'read'],
  ['初级段：短篇童话故事（简单情节、重复句型）', '原创童话 The Big Red Apple，约 140 词。四个重复句各出现三遍：Can you help me? / Yes, I can! / They push and push. / But the apple is too big.', 'home'],
  ['泛听：后台循环磨耳朵，积累语感体量', '第 1 步：看不带字幕的动画短片听大意（想对字幕可以切换）；下面有「磨耳朵」循环播放条。', 'listen1'],
  ['精听：AI分句停顿、挖空、复读、跟读、错题巩固、精修细节', '第 2 步：系统先用 45 秒短片讲这一课的三句话，再一句一停、挖空选词、复读、慢速；第一次选错的句子，最后会再来一遍。', 'listen2'],
  ['听中带说、输入带动输出，听力积累达到阶段阈值，自动解锁对应层级口语任务', '第 2 步做完才提示「口语任务解锁」，接着进第 3 步开口。', 'speak1'],
  ['Level 2 看图描述+短句复述……输出形式：绘本画面描述、3-5句故事复述、简单人机问答', '第 4 步：看四幅图，用四句话复述故事，再口头回答系统问的一个问题。第 3 步的两句跟读属于你方案里的 Level 1（短句模仿），放在前面当热身。', 'speak2'],
  ['图片预测剧情（Predict）；读后口头复述（Retell）；新旧知识关联（Connect）', '第 5 步：看新一页的图先猜再读；把句子排回顺序后，只看 First / Then / Next / At last 口头复述；把 can 连到「谁能帮我」。', 'read'],
  ['入门写作：单词仿写、单句翻译、句型替换、短文改写', '第 6 步只做了其中一项「句型替换」：换动物、换动作，自己打出一句新的。单词仿写、单句翻译、短文改写这个样本没做。', 'write'],
  ['语法不单独开课，全部融入写作与句型训练落地', '第 6 步写句子时才用到「它 + 动词加 s」，写错了当场提示；没有单独的语法课（第 2 步的短片里只用十来秒点了一下 hops / runs / walks 的尾巴）。', 'write'],
  ['AI游戏化闯关、积分徽章、趣味交互，解决坚持问题', '第 7 步「把苹果推回家」：答对了要自己动手把苹果推一格，朋友一个个来帮忙；限时、三颗心、连对加分，答错的题排到最后再考。', 'game'],
  ['全维度学情数据看板：听、说、读、写、语法、策略掌握度可视化', '第 8 步：六个维度都按这一次的真实操作当场算，每个分数下面写着依据。听、读、写、语法看对错；说看完成情况和自评；策略主要记「用没用过」，还谈不上掌握度。', 'board'],
  ['输入海量打底、精修突破、读写闭环、输出拔高', '这一课的顺序就是：泛听（输入）→ 精听（精修）→ 跟读复述（输出）→ 阅读加仿写（读写闭环）→ 闯关（巩固）。', 'home']
];
function mapRows() {
  return MAP.map(function (m) {
    return '<div class="mrow"><q>' + m[0] + '</q><span>' + m[1] + (m[2] !== 'home' ? ' <a data-go="' + m[2] + '">去看这一步</a>' : '') + '</span></div>';
  }).join('');
}
document.addEventListener('click', function (e) {
  var a = e.target.closest('[data-go]'); if (a) { e.preventDefault(); go(a.getAttribute('data-go')); }
});

/* ---------- 底部弹层 ---------- */
function openSheet(html) {
  halt();
  $('#overlay').innerHTML = '<div class="mask"></div><div class="sheet"><button class="x">关闭 ✕</button>' + html + '</div>';
  $('.mask').addEventListener('click', closeSheet);
  $('.sheet .x').addEventListener('click', closeSheet);
}
function closeSheet() { $('#overlay').innerHTML = ''; }

/* ---------- 问老师（预置演示） ---------- */
var ASK = {
  listen1: { qs: ['我没听懂这个故事', '说得太快了', '有个词我没听懂'], reply: '先不用听懂每个词。再看一遍，只盯一件事：谁来了以后，苹果才动的？看懂这个就算过。觉得快没关系，下一步精听会一句一句停下来。' },
  listen2: { qs: ['这个词我听不出来', '两个词听起来一样', '一句太长我跟不上'], reply: '点「慢速」再听这一句，只注意空格那个词。big 的嘴是扁的，bag 的嘴张得大。听三遍还分不出，我们约个时间对着口型练一次。' },
  speak1: { qs: ['我不知道读得对不对', 'help 我读不好', '我不敢读'], reply: '你的录音我会听。help 先慢慢来：he—l—p，舌尖顶一下上牙后面再合嘴。读错没关系，先大声。' },
  speak2: { qs: ['我不知道怎么开头', '说到一半忘词了', '我只能说两句'], reply: '看着第一幅图，先说 First, Pip sees a big red apple. 一幅图说一句就够，四幅图就是四句。忘了的词先跳过，接着说下一幅。' },
  read: { qs: ['有个词我不会读', '我猜的和故事不一样', '句子顺序我排不对'], reply: '不会读的词，点一下那句话听声音，再自己读一遍。猜得不一样不要紧，Predict 练的是先看图再猜。排顺序时想一想：谁最后才来的？' },
  write: { qs: ['为什么要加 s', '这个词我不会拼', '我觉得写对了，还说不对'], reply: '一只动物（它）做一个动作，动词后面要加 s：A rabbit hops by. A cat jumps by. 你写的句子我看到了，照着原句再改一次，改完我再看。' },
  game: { qs: ['时间太短了', '有一题我不会', '我想再玩一次'], reply: '不会的那题系统已经记下了，会排到最后再考你一次。时间不够就先不管分数，把句子看清楚再点。' }
};
function fmtSec(ms) { var s = Math.round(ms / 1000); return s < 60 ? s + ' 秒' : Math.floor(s / 60) + ' 分 ' + (s % 60) + ' 秒'; }
function stepRecordHtml(id) {
  var its = R.order.map(function (k) { return R.items[k]; }).filter(function (i) { return i.step === id; });
  var t = (R.timeOn[id] || 0) + (cur === id ? Date.now() - enterAt : 0);
  var li = its.length ? its.map(function (i) { return '<li>' + i.label + '：' + triesText(i) + '</li>'; }).join('') : '<li>这一步还没有作答记录</li>';
  if (id === 'listen1') li += '<li>动画看了 ' + Math.round(R.videoSec) + ' 秒</li>';
  if (id === 'listen2') li += '<li>讲解短片看了 ' + Math.round(R.teachSec) + ' 秒</li>';
  if (id === 'read') { var n = Object.keys(R.readTaps).length; li += '<li>阅读时点读（要声音帮忙）的句子：' + (n ? n + ' 句' : '0 句') + '</li>'; }
  return '<ul>' + li + '</ul><div>这一步已用时：' + fmtSec(t) + '</div>';
}
function openAsk() {
  var st = stepOf(cur); if (!st) return;
  var a = ASK[cur];
  var html = '<h2>🙋 问老师</h2><p class="sub">不用自己讲清楚卡在哪。系统会把这一步的记录一起交给老师。</p>' +
    '<div class="tcard"><h3>系统交给老师的记录（按刚才的真实操作生成）</h3>' +
    '<div>学员：演示学员 · 本课：The Big Red Apple</div><div>卡在：第 ' + st.no + ' 步 ' + st.name + '</div>' + stepRecordHtml(cur) + '</div>' +
    '<h3 style="margin-top:12px">你想问什么？</h3><div class="opts" id="askQs">' +
    a.qs.map(function (q, i) { return '<button class="opt l" data-q="' + i + '">' + q + '</button>'; }).join('') + '</div><div id="askOut"></div>';
  openSheet(html);
  $('#askQs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-q]'); if (!b) return;
    var q = a.qs[+b.getAttribute('data-q')];
    R.asks.push({ step: cur, no: st.no, name: st.name, q: q });
    $('#askQs').classList.add('hide');
    $('#askOut').innerHTML = '<div class="bubble me"><b>你</b>' + q + '</div>' +
      '<div class="bubble"><b>老师（预置回复）</b>' + a.reply + '</div>' +
      '<p class="note">样本演示：这里没有真的发给老师，上面是预先写好的回复。正式版里，老师端收到的就是上面那张记录卡加这句提问，答完孩子回到这一步继续。这次求助已经记进学情看板。</p>' +
      '<button class="btn pri" id="askBack">回到这一步继续</button>';
    $('#askBack').addEventListener('click', closeSheet);
  });
}

/* ================= 各步骤 ================= */
var SCREENS = {};

/* ---------- 首页 ---------- */
SCREENS.home = function () {
  var routes = [
    ['听', '泛听 → 精听', '看动画听大意；系统讲三句话，再一句一停地抠细节', ['listen1', 'listen2']],
    ['说', '跟读 → 看图复述 → 小问答', '听过的句子开口说，再用四句话把故事讲出来', ['speak1', 'speak2']],
    ['读', '同一篇转成阅读', 'Predict 先猜 → Retell 复述 → Connect 连到自己', ['read']],
    ['写', '句型替换', '换动物、换动作，写出你自己的一页', ['write']],
    ['玩', '闯关：把苹果推回家', '限时、三颗心，考的就是这一课', ['game']],
    ['过关', '学情看板', '听、说、读、写、语法、策略，按这次的作答算', ['board']]
  ];
  stage.innerHTML =
    '<details class="map"><summary>这个样本对应你方案里的哪几条</summary><div class="in">' + mapRows() + '</div></details>' +
    '<div class="hero"><img src="' + IM(1) + '" alt="Pip pushes a big red apple"><div class="cap">' +
    '<span class="tag">听力 · 初级段</span><span class="tag">口语 · Level 2</span><span class="tag">阅读 · 启蒙绘本阶段策略</span><span class="tag">写作 · 入门写作</span>' +
    '<h1>今天的一课：<span class="eng">The Big Red Apple</span></h1>' +
    '<p class="sub">同一篇童话走完一圈：听 → 说 → 读 → 写 → 闯关 → 过关。全程由系统带着走，卡住了点右下角的「问老师」。</p></div></div>' +
    '<div class="four"><div><b>文字</b>课文和要点</div><div><b>视频</b>动画+讲解</div><div><b>练习</b>听说读写</div><div><b>游戏</b>推苹果回家</div></div>' +
    '<button class="btn pri" id="start">' + (Object.keys(R.done).length ? '接着上这一课' : '开始今天的一课（约 8 分钟）') + ' ›</button>' +
    '<div class="card" style="margin-top:12px"><h3>孩子的一天 · 这一课怎么走</h3><ul class="route">' +
    routes.map(function (r, i) {
      var done = r[3].every(function (s) { return R.done[s]; });
      return '<li class="' + (done ? 'done' : '') + '" data-go="' + r[3][0] + '"><div class="n">' + (done ? '✓' : r[0]) + '</div><div><b>' + r[1] + '</b><small>' + r[2] + '</small></div></li>';
    }).join('') + '</ul>' +
    '<p class="note">正式版按顺序解锁（听够了才开口，读过了才动笔）。样本里可以点顶上的圆钮跳着看。</p></div>' +
    '<div class="card"><h3>这一课学完，孩子能做到（文字）</h3>' +
    '<p class="sub" style="margin:0">· 听：听懂「谁来帮忙、苹果动了没有」，听出 help、big<br>· 说：读准 Can you help me? 用四句话复述故事<br>· 读：自己读下这一篇；会看图先猜（Predict）<br>· 写：照 A rabbit hops by. 换词写出一句新的（动词加 s）</p></div>' +
    '<details class="map"><summary>课文全文（给老师和家长看）</summary><div class="in"><p class="note" style="margin:0 0 8px">孩子上课时不先看这一页：先听（第 1、2 步），到第 5 步才读字。</p><div class="story eng">' +
    STORY.map(function (p) { return '<p>' + p.lines.map(function (l) { return markPat(l[1]); }).join(' ') + '</p>'; }).join('') + '</div>' +
    '<p class="sub">原创童话，约 140 词。标黄的是这一课反复出现的句型。</p></div></details>';
  $('#start').addEventListener('click', function () {
    var t = STEPS.filter(function (s) { return !R.done[s.id]; })[0] || STEPS[0];
    go(t.id);
  });
};

/* ---------- 1 泛听 ---------- */
SCREENS.listen1 = function () {
  stage.innerHTML = head(null, '第 1 步 · 泛听：看动画，听个大概', ['听力 · 初级段', '泛听'], '「泛听：后台循环磨耳朵，积累语感体量」',
    '先不用听懂每个词。看画面、听声音，只抓一件事：<b>大苹果最后怎么了？</b>') +
    '<div class="card"><div class="vid"><video id="vid" src="assets/story.mp4" poster="assets/img/poster.jpg" controls playsinline webkit-playsinline x5-playsinline x5-video-player-type="h5-page" preload="metadata"></video></div>' +
    '<p class="sub" style="margin:8px 0 0">动画短片 · 英文配音 · 77 秒。<b>第一遍故意不放字幕</b>：先用耳朵和画面听懂。点一下画面开始播放。</p>' +
    '<button class="btn sm" id="subTog">字幕：关（点这里换成带英文字幕的版本）</button></div>' +
    '<div class="card" id="gist"><h3>看完了，回答一个问题</h3><p>这个故事讲的是什么？<span class="sub">（泛听只抓大意，所以用中文问）</span></p><div class="opts" id="gistOpts"></div><div id="gistFb"></div></div>' +
    '<div class="card"><h3>磨耳朵（可选）</h3><p class="sub">不看画面，把故事循环放着听。正式版会放到后台，一边做别的一边听。</p>' +
    '<div class="loop"><audio id="loopAudio" controls loop preload="none" src="' + AU('full') + '"></audio></div></div>';
  var v = $('#vid'), last = null;
  v.addEventListener('play', function () { seqId++; try { player.pause(); } catch (e) {} var l = $('#loopAudio'); if (l && !l.paused) l.pause(); last = v.currentTime; });
  v.addEventListener('timeupdate', function () { if (last !== null && !v.paused) { var d = v.currentTime - last; if (d > 0 && d < 1.5) R.videoSec += d; } last = v.currentTime; });
  $('#loopAudio').addEventListener('play', function () { if (!v.paused) v.pause(); });
  var subOn = false;
  $('#subTog').addEventListener('click', function () {
    subOn = !subOn; var t = v.currentTime, playing = !v.paused;
    v.src = subOn ? 'assets/story_sub.mp4' : 'assets/story.mp4';
    v.addEventListener('loadedmetadata', function once() { v.removeEventListener('loadedmetadata', once); try { v.currentTime = t; } catch (e) {} if (playing) v.play(); });
    v.load();
    this.textContent = subOn ? '字幕：开（点这里换回不带字幕的版本）' : '字幕：关（点这里换成带英文字幕的版本）';
  });
  var opts = shuffle([['朋友们一起把大苹果推回了家', 1], ['Pip 一个人把苹果吃掉了', 0], ['大熊把苹果抢走了', 0]]);
  var meta = { step: 'listen1', dim: '听', label: '泛听·故事大意' };
  $('#gistOpts').innerHTML = opts.map(function (o, i) { return '<button class="opt l" data-i="' + i + '">' + o[0] + '</button>'; }).join('');
  $('#gistOpts').addEventListener('click', function (e) {
    var b = e.target.closest('.opt'); if (!b || R.done.listen1) return;
    var o = opts[+b.getAttribute('data-i')];
    attempt('l1', meta, o[0], !!o[1]); beep(!!o[1]);
    if (o[1]) {
      b.classList.add('ok');
      $('#gistFb').innerHTML = '<div class="fb ok">对。大意抓住了，细节下一步再抠。</div>';
      finishStep('listen1');
      nextCard('泛听完成。', 'listen2', '下一步：精听');
    } else {
      b.classList.add('bad');
      $('#gistFb').innerHTML = '<div class="fb bad">再想想：苹果最后到了哪里？是谁一起推的？可以把动画再看一遍。</div>';
    }
  });
  if (R.done.listen1) nextCard('泛听已完成。', 'listen2', '下一步：精听');
};

/* ---------- 2 精听 ---------- */
var CLOZE = [
  { key: 'c1', scene: ['s05', 's06', 's07', 's08'], tgt: 3, before: 'They push and push. But the apple is too ', after: '.', ans: 'big', opts: ['pig', 'big', 'bag'] },
  { key: 'c2', scene: ['s09', 's06', 's10', 's08'], tgt: 1, before: '“Can you ', after: ' me?” asks Pip.', ans: 'help', opts: ['have', 'help', 'hear'] }
];
SCREENS.listen2 = function () {
  var queue = CLOZE.slice(), redo = [], idx = 0, inRedo = false;
  function draw() {
    var c = queue[idx];
    var title = inRedo ? '错题巩固 · 刚才选错的这句再来一遍' : '第 ' + (idx + 1) + ' 句 / 共 ' + queue.length + ' 句';
    stage.innerHTML = head(null, '第 2 步 · 精听：一句一停，抠细节', ['听力 · 初级段', '精听'], '「精听：AI分句停顿、挖空、复读、跟读、错题巩固、精修细节」') +
      '<div class="card"><h3>' + title + '</h3>' +
      '<p class="sub">先点「播放这一段」：系统一句一停。红框那一句有个空，听出来是哪个词。</p>' +
      '<div class="sents">' + c.scene.map(function (s, i) { return '<span class="' + (i === c.tgt ? 'tgt' : '') + '"></span>'; }).join('') + '</div>' +
      '<div class="rowb"><button class="btn sm" id="pScene">▶ 播放这一段</button><button class="btn sm" id="pRep">🔁 复读这一句</button><button class="btn sm" id="pSlow">🐢 慢速</button></div>' +
      '<div class="cloze eng" style="margin-top:10px">' + esc(c.before) + '<span class="gap" id="gap">?</span>' + esc(c.after) + '</div>' +
      '<div class="opts c3 eng" id="cOpts">' + c.opts.map(function (o) { return '<button class="opt" data-o="' + o + '">' + o + '</button>'; }).join('') + '</div>' +
      '<div id="cFb"></div>' +
      '<p class="note">样本演示：分句和挖空是预先切好的。正式版由 AI 自动分句，按孩子的错词出挖空。</p></div>';
    var bars = $$('.sents span');
    var mark = function (i) { bars.forEach(function (b, j) { b.classList.toggle('play', j === i); }); };
    $('#pScene').addEventListener('click', function () { playSeq(c.scene, mark); });
    $('#pRep').addEventListener('click', function () { mark(c.tgt); play(c.scene[c.tgt]).then(function () { mark(-1); }); });
    $('#pSlow').addEventListener('click', function () { mark(c.tgt); play(c.scene[c.tgt], 0.7).then(function () { mark(-1); }); });
    var solved = false;
    $('#cOpts').addEventListener('click', function (e) {
      var b = e.target.closest('.opt'); if (!b || solved) return;
      var o = b.getAttribute('data-o'), ok = o === c.ans;
      var meta = { step: 'listen2', dim: '听', label: '精听·挖空 ' + c.before.replace(/^.*\. /, '').trim() + ' ___' };
      if (inRedo) { var it0 = item(c.key); it0.redo = (it0.redo || []).concat([{ a: o, ok: ok }]); it0.note = triesText({ tries: it0.tries }) + '；巩固：' + triesText({ tries: it0.redo }); if (!ok) { b.classList.add('bad'); beep(false); return; } }
      else attempt(c.key, meta, o, ok);
      beep(ok);
      if (ok) {
        solved = true; b.classList.add('ok'); $('#gap').textContent = c.ans;
        halt(); mark(-1);
        $('#cFb').innerHTML = '<div class="fb ok">听对了。跟着原声小声读一遍，再往下走。</div><button class="btn pri" id="cNext">' + (idx < queue.length - 1 ? '下一句' : (!inRedo && redo.length ? '去巩固错题' : '完成精听')) + ' ›</button>';
        play(c.scene[c.tgt]);
        $('#cNext').addEventListener('click', function () {
          if (idx < queue.length - 1) { idx++; draw(); }
          else if (!inRedo && redo.length) { inRedo = true; queue = redo; idx = 0; draw(); }
          else done();
          window.scrollTo(0, 0);
        });
      } else {
        b.classList.add('bad');
        if (!inRedo && redo.indexOf(c) < 0) redo.push(c);
        $('#cFb').innerHTML = '<div class="fb bad">不是 ' + o + '。点「慢速」再听这一句，这句会进错题巩固。</div>';
      }
    });
  }
  function done() {
    finishStep('listen2');
    stage.innerHTML = head(null, '第 2 步 · 精听：完成', ['听力 · 初级段', '精听']) +
      '<div class="card"><div class="fb ok" style="margin-top:0">🔓 泛听、精听都做完了：<b>口语任务解锁</b>。</div>' +
      '<div class="quote" style="margin-top:10px">方案原句：「听中带说、输入带动输出，听力积累达到阶段阈值，自动解锁对应层级口语任务。」</div>' +
      '<p class="sub">样本里的「阈值」就是这两步做完；正式版按累计的听力量来算。</p>' +
      '<button class="btn pri" id="n">下一步：跟读 ›</button></div>';
    $('#n').addEventListener('click', function () { go('speak1'); });
  }
  function teach() {
    stage.innerHTML = head(null, '第 2 步 · 精听：系统先讲，再一句一句抠', ['听力 · 初级段', '精听'], '「老师只是服务，教学由系统主要完成。」') +
      '<div class="card"><h3>系统讲解短片 · 这一课的三句话（45 秒）</h3>' +
      '<div class="vid"><video id="vid" src="assets/teach.mp4" poster="assets/img/poster_teach.jpg" controls playsinline webkit-playsinline x5-playsinline x5-video-player-type="h5-page" preload="metadata"></video></div>' +
      '<p class="sub" style="margin:8px 0 0">英文配音加英文字幕，画面上有中文提示。讲三个句型，再点一下 hops / runs / walks 的尾巴。没有老师出镜，讲解由系统完成。</p>' +
      '<p class="note">样本演示：这支短片是按这一课的课文预先做好的。正式版可以由 AI 按同一个模板给每篇素材生成。</p>' +
      '<button class="btn pri" id="tNext">看完了，开始一句一句听 ›</button></div>';
    var v = $('#vid'), last = null;
    v.addEventListener('play', function () { seqId++; try { player.pause(); } catch (e) {} last = v.currentTime; });
    v.addEventListener('timeupdate', function () { if (last !== null && !v.paused) { var d = v.currentTime - last; if (d > 0 && d < 1.5) R.teachSec += d; } last = v.currentTime; });
    $('#tNext').addEventListener('click', function () { R.teachSeen = true; halt(); draw(); window.scrollTo(0, 0); });
  }
  if (R.done.listen2) done(); else if (!R.teachSeen) teach(); else draw();
};

/* ---------- 3 跟读 ---------- */
function aiDemo(stars, tip) {
  return '<div class="fb info"><b>AI 纠音会长这样（预置示例）</b><br>' + stars + '<br>' + tip + '</div>' +
    '<p class="note">样本演示：这里是预置反馈，不是听了这段录音给的；正式版接 AI 纠音打分。看板里「说」的分数只用完成情况和孩子的自评。</p>';
}
var SHADOW = [
  { key: 'sp1', id: 'm01', text: 'Can you help me?', tip: '问句，句尾往上扬 ↗', ai: ['发音 ★★★★☆ · 流利度 ★★★★★ · 语调 ★★★☆☆', 'help 的 /l/ 再清楚一点；问句的句尾往上扬。'] },
  { key: 'sp2', id: 'm04', text: 'But the apple is too big.', tip: 'too 和 big 读重一点', ai: ['发音 ★★★★☆ · 流利度 ★★★★☆ · 重音 ★★★☆☆', 'big 的 /ɪ/ 读短一点，别读成 beeg；too 和 big 要重读。'] }
];
SCREENS.speak1 = function () {
  var idx = 0;
  function draw() {
    var s = SHADOW[idx];
    stage.innerHTML = head(null, '第 3 步 · 跟读：听过的句子，开口说', ['口语 · Level 1 短句模仿', '给 Level 2 热身'], '「听中带说、输入带动输出」') +
      '<div class="card"><h3>第 ' + (idx + 1) + ' 句 / 共 ' + SHADOW.length + ' 句</h3>' +
      '<div class="model eng">' + esc(s.text) + '</div><p class="sub" style="text-align:center">' + s.tip + '</p>' +
      '<div class="recbox" id="rb"></div><div id="rate"></div></div>';
    recorderUI($('#rb'), {
      models: [s.id], max: 8000,
      onRecorded: function (r) {
        $('#rate').innerHTML = '<h3 style="margin-top:12px">和原声比一比，你觉得自己读得：</h3><div class="opts c3" id="rOpts"><button class="opt" data-v="1">很顺</button><button class="opt" data-v="0.7">有点卡</button><button class="opt" data-v="0.3">还不会</button></div>' + aiDemo(s.ai[0], s.ai[1]);
        $('#rOpts').addEventListener('click', function (e) {
          var b = e.target.closest('.opt'); if (!b) return;
          $$('#rOpts .opt').forEach(function (x) { x.classList.remove('pick'); }); b.classList.add('pick');
          var it = item(s.key, { step: 'speak1', dim: '说', label: '跟读 ' + s.text });
          it.val = +b.getAttribute('data-v'); it.done = true; it.low = it.val < 0.5;
          it.note = (r.mode === 'rec' ? '录音 ' + r.dur.toFixed(1) + ' 秒' : '没有录音，自己读了一遍') + '，自评「' + b.textContent + '」';
          if (!$('#spNext')) {
            var n = document.createElement('button'); n.className = 'btn pri'; n.id = 'spNext';
            n.textContent = idx < SHADOW.length - 1 ? '下一句 ›' : '下一步：看图复述 ›';
            n.addEventListener('click', function () { if (idx < SHADOW.length - 1) { idx++; draw(); window.scrollTo(0, 0); } else { finishStep('speak1'); go('speak2'); } });
            $('#rate').appendChild(n);
            n.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        });
      }
    });
  }
  draw();
};

/* ---------- 4 看图复述 ---------- */
var RETELL = [
  { img: 1, id: 'r01', st: 'First,', hint: 'Pip sees … It is too …', full: 'Pip sees a big red apple. It is too big.', zh: 'Pip 和大苹果' },
  { img: 3, id: 'r02', st: 'Then', hint: 'a rabbit and a fox … But …', full: 'A rabbit and a fox help Pip. But the apple is too big.', zh: '兔子和狐狸来帮忙' },
  { img: 4, id: 'r03', st: 'Next,', hint: 'a bear … The apple …', full: 'A bear helps. The apple rolls to Pip’s home.', zh: '大熊来了，苹果滚起来' },
  { img: 5, id: 'r04', st: 'At last,', hint: 'the friends …', full: 'The friends eat the apple together.', zh: '大家一起吃苹果' }
];
SCREENS.speak2 = function () {
  stage.innerHTML = head(null, '第 4 步 · 看图复述：用四句话讲这个故事', ['口语 · Level 2', '看图描述+短句复述'], '「输出形式：绘本画面描述、3-5句故事复述」',
    '看着四幅图，一幅图说一句。图下面是句子的开头，后面自己接。') +
    '<div class="card"><div class="strip">' + RETELL.map(function (r, i) {
      return '<figure data-f="' + i + '"><img src="' + TH(r.img) + '" alt=""><figcaption class="eng"><i>' + r.st + '</i> ' + r.hint + '</figcaption></figure>';
    }).join('') + '</div>' +
    '<div class="recbox" id="rb"></div><div id="rate"></div></div>';
  var figs = $$('.strip figure');
  recorderUI($('#rb'), {
    models: ['r01', 'r02', 'r03', 'r04'], max: 45000, verb: '说',
    onRecorded: function (r) {
      $('#rate').innerHTML = '<h3 style="margin-top:12px">对一对：你说到了哪几件事？</h3>' +
        RETELL.map(function (x, i) { return '<button class="chk" data-c="' + i + '">' + x.zh + '</button>'; }).join('') +
        '<div class="fb info"><b>AI 点评会长这样（预置示例）</b><br>内容 4/4 件事都说到了 · 用上了 First / Then · 句数 4 句<br>下一次试着加一句感受：Pip is happy.</div>' +
        '<p class="note">样本演示：这里是预置反馈，正式版接 AI 按流利度、发音、逻辑打分。看板里只用上面你自己勾的结果。</p>' +
        '<button class="btn pri" id="spDone">说完了，还有一个小问答 ›</button>';
      $$('#rate .chk').forEach(function (b) { b.addEventListener('click', function () { b.classList.toggle('on'); }); });
      $('#spDone').addEventListener('click', function () {
        var n = $$('#rate .chk.on').length;
        var it = item('rt', { step: 'speak2', dim: '说', label: '看图复述（四幅图）' });
        it.val = 0.4 + 0.15 * n; it.done = true; it.low = n <= 2;
        var miss = RETELL.filter(function (x, i) { return !$$('#rate .chk')[i].classList.contains('on'); }).map(function (x) { return x.zh; });
        it.note = (r.mode === 'rec' ? '录音 ' + r.dur.toFixed(1) + ' 秒' : '没有录音，自己说了一遍') + '，自查说到 ' + n + '/4 件事' + (miss.length ? '（漏了：' + miss.join('、') + '）' : '');
        qa(); window.scrollTo(0, 0);
      });
      $('#rate').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
  function qa() {
    halt(); Rec.cancel();
    stage.innerHTML = head(null, '第 4 步 · 小问答：系统问，你来答', ['口语 · Level 2', '简单人机问答'], '「输出形式：绘本画面描述、3-5句故事复述、简单人机问答」') +
      '<div class="card"><p>点喇叭听问题，<b>开口回答</b>，再对一下参考回答。</p>' +
      '<button class="bigplay ring" id="qPlay">▶</button><div class="model eng hide" id="qText">Who helps Pip first?</div>' +
      '<div class="recbox hide" id="rb"></div><div id="qOut"></div></div>';
    $('#qPlay').addEventListener('click', function () { this.classList.remove('ring'); play('q1'); $('#qText').classList.remove('hide'); $('#rb').classList.remove('hide'); });
    recorderUI($('#rb'), {
      max: 8000, verb: '答',
      onRecorded: function (r) {
        $('#qOut').innerHTML = '<h3 style="margin-top:12px">参考回答</h3><div class="frame eng">The rabbit helps Pip first.</div><button class="btn sm" id="qAns">▶ 听参考回答</button>' +
          '<h3 style="margin-top:12px">对一对，你答的是：</h3><div class="opts" id="qRate"><button class="opt l" data-v="1">答对了，说的是整句</button><button class="opt l" data-v="0.7">答对了，只说了 rabbit</button><button class="opt l" data-v="0.3">没答上来</button></div>' +
          '<p class="note">样本演示：这里没有 AI 听孩子的回答，对错由孩子对照参考回答自己选。正式版接 AI 对话，按孩子的回答接着问。</p>';
        $('#qAns').addEventListener('click', function () { play('q1a'); });
        $('#qRate').addEventListener('click', function (e) {
          var b = e.target.closest('.opt'); if (!b) return;
          $$('#qRate .opt').forEach(function (x) { x.classList.remove('pick'); }); b.classList.add('pick');
          var it = item('qa', { step: 'speak2', dim: '说', label: '小问答 Who helps Pip first?' });
          it.val = +b.getAttribute('data-v'); it.done = true; it.low = it.val < 0.5;
          it.note = (r.mode === 'rec' ? '录音 ' + r.dur.toFixed(1) + ' 秒' : '没有录音，口头回答') + '，自查「' + b.textContent + '」';
          if (!$('#qNext')) {
            var n = document.createElement('button'); n.className = 'btn pri'; n.id = 'qNext'; n.textContent = '下一步：阅读 ›';
            n.addEventListener('click', function () { finishStep('speak2'); go('read'); });
            $('#qOut').appendChild(n); n.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        });
        $('#qOut').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }
  var mb = $('[data-a=model]', $('#rb')); mb.textContent = '▶ 说不出来？听示范';
  mb.addEventListener('click', function (e) {
    e.stopPropagation();
    playSeq(['r01', 'r02', 'r03', 'r04'], function (i) { figs.forEach(function (f, j) { f.style.outline = j === i ? '3px solid #F6B93B' : 'none'; }); });
  }, true);
};

/* ---------- 5 阅读 ---------- */
SCREENS.read = function () {
  var hd = function (sub) { return head(null, '第 5 步 · 阅读：听过的故事，现在用眼睛读', ['阅读 · 启蒙绘本阶段策略', sub], null); };
  function lineBtn(l) { return '<button class="ln eng" data-l="' + l[0] + '" data-t="' + esc(l[1]).replace(/"/g, '&quot;') + '">' + markPat(l[1]) + '</button>'; }
  function bindLines(countTaps) {
    $$('.ln').forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.ln.on').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        if (countTaps) R.readTaps[b.getAttribute('data-t')] = 1;
        play(b.getAttribute('data-l')).then(function () { b.classList.remove('on'); });
      });
    });
  }
  function book() {
    stage.innerHTML = hd('同源复用') + '<div class="quote">方案原句：「听力听过的所有素材，全部同步转为阅读素材，实现『先听懂、再读懂』的闭环降维学习。」</div>' +
      '<p>下面就是你刚才听过、说过的那一篇，一个字没改。能自己读的直接读；读不出来的，<b>点一下那句话</b>听声音。</p>' +
      STORY.map(function (p, i) {
        return '<div class="page"><img src="' + IM(p.img) + '" alt="" loading="lazy"><div class="pgno">第 ' + (i + 1) + ' 页</div><div class="tx">' + p.lines.map(lineBtn).join('') + '</div></div>';
      }).join('') +
      '<p class="note">系统会记下孩子点读了哪几句：这些就是「听得懂、但还读不出」的句子，会出现在看板上。</p>' +
      '<button class="btn pri" id="toPredict">读完了，后面还有新的一页 ›</button>';
    bindLines(true);
    $('#toPredict').addEventListener('click', function () { halt(); predict(); window.scrollTo(0, 0); });
  }
  function predict() {
    stage.innerHTML = hd('Predict 图片预测剧情') + '<div class="card"><h3>Predict · 先看图，猜一猜</h3>' +
      '<p class="sub">这一页是新的，你没听过。先别读字，看图。</p>' +
      '<div class="page" style="margin-bottom:8px"><img src="' + IM(6) + '" alt=""><div class="pgno">第 6 页（新的）</div><div class="tx hide" id="p6tx">' + PAGE6.map(lineBtn).join('') + '</div></div>' +
      '<div id="pq"><p><b>接下来会怎样？</b></p><div class="opts eng" id="pOpts">' +
      '<button class="opt l" data-p="A">Pip pushes it alone.</button><button class="opt l" data-p="B">Pip asks his friends for help.</button><button class="opt l" data-p="C">Pip goes home.</button></div></div><div id="pOut"></div></div>';
    var txt = { A: 'Pip pushes it alone.', B: 'Pip asks his friends for help.', C: 'Pip goes home.' }, pick = null;
    $('#pOpts').addEventListener('click', function (e) {
      var b = e.target.closest('.opt'); if (!b || pick) return;
      pick = b.getAttribute('data-p'); b.classList.add('pick');
      $('#pOut').innerHTML = '<p style="margin-top:10px"><b>你是看到图里的什么，才这样猜的？</b></p><div class="opts" id="eOpts">' +
        '<button class="opt l">朋友们正朝他走过来</button><button class="opt l">南瓜比 Pip 大得多</button><button class="opt l">昨天的苹果就是这样</button></div>';
      $('#eOpts').addEventListener('click', function (e2) {
        var c = e2.target.closest('.opt'); if (!c) return;
        var it = item('pr', { step: 'read', dim: '策略', label: 'Predict 图片预测剧情' });
        it.val = 1; it.done = true; it.note = '猜的是「' + txt[pick] + '」，依据「' + c.textContent + '」，' + (pick === 'B' ? '和故事一致' : '和故事不一样（预测不扣分）');
        $('#pq').classList.add('hide'); $('#p6tx').classList.remove('hide'); bindLines(true);
        $('#pOut').innerHTML = '<div class="fb ' + (pick === 'B' ? 'ok' : 'info') + '">' +
          (pick === 'B' ? '你猜的和故事一样。' : '故事里，Pip 是请朋友来帮忙。猜得不一样不扣分。') +
          ' Predict 练的是：<b>先看图、先猜，再读字去对</b>。现在读一读上面的三句话，看看对不对。</div>' +
          (c.textContent.indexOf('昨天') >= 0 ? '<div class="fb info">用昨天的故事来猜今天的，这已经是在做 Connect 了。</div>' : '') +
          '<button class="btn pri" id="toRetell">读好了，下一个：Retell ›</button>';
        $('#toRetell').addEventListener('click', function () { halt(); retell(); window.scrollTo(0, 0); });
      });
    });
  }
  function retell() {
    var order = shuffle([0, 1, 2, 3]);
    while (order.join('') === '0123') order = shuffle([0, 1, 2, 3]);
    var placed = [], tries = 0, solved = false;
    stage.innerHTML = hd('Retell 读后口头复述') + '<div class="card"><h3>Retell · 把故事排回原来的顺序</h3>' +
      '<p class="sub">按故事的先后，依次点下面的句子。点错了可以点上面的格子拿回来。</p>' +
      '<div class="slots" id="slots"></div><div class="opts pool eng" id="pool"></div><div id="rFb"></div></div>';
    function draw() {
      $('#slots').innerHTML = [0, 1, 2, 3].map(function (i) {
        var p = placed[i];
        return '<button class="slot eng' + (p !== undefined ? ' fill' : '') + '" data-s="' + i + '"><b>' + (i + 1) + '</b><span>' + (p !== undefined ? esc(RETELL[p].full) : '') + '</span></button>';
      }).join('');
      $('#pool').innerHTML = order.filter(function (i) { return placed.indexOf(i) < 0; }).map(function (i) { return '<button class="opt l" data-i="' + i + '">' + esc(RETELL[i].full) + '</button>'; }).join('');
      if (placed.length === 4 && !solved) check();
    }
    function check() {
      tries++;
      var ok = placed.join('') === '0123';
      attempt('ro', { step: 'read', dim: '读', label: 'Retell·句子排顺序' }, '第 ' + tries + ' 次排：' + placed.map(function (i) { return i + 1; }).join('-'), ok);
      beep(ok);
      var sl = $$('#slots .slot');
      if (ok) {
        solved = true;
        sl.forEach(function (s, i) { s.classList.add('ok'); $('span', s).innerHTML = '<b style="color:#E4483A">' + RETELL[i].st + '</b> ' + esc(i === 0 || i === 2 || i === 3 ? RETELL[i].full.charAt(0) === 'P' ? RETELL[i].full : RETELL[i].full.charAt(0).toLowerCase() + RETELL[i].full.slice(1) : 'a' + RETELL[i].full.slice(1)); });
        $('#pool').innerHTML = '';
        $('#rFb').innerHTML = '<div class="fb ok">顺序对了。系统给每句加了 First / Then / Next / At last，这就是复述的架子。</div>' +
          '<button class="btn sm" id="rPlay">▶ 听一遍</button>' +
          '<button class="btn pri" id="rHide">记住了，盖住句子口头复述 ›</button>';
        $('#rPlay').addEventListener('click', function () { playSeq(['r01', 'r02', 'r03', 'r04'], function (i) { sl.forEach(function (s, j) { s.style.outline = j === i ? '3px solid #F6B93B' : 'none'; }); }); });
        $('#rHide').addEventListener('click', function () { halt(); oral(); window.scrollTo(0, 0); });
      } else {
        sl.forEach(function (s, i) { s.classList.add(placed[i] === i ? 'ok' : 'bad'); });
        $('#rFb').innerHTML = '<div class="fb bad">红色的位置不对。想一想：谁先来帮忙，谁最后来？</div><button class="btn" id="rAgain">把红色的拿回去，再排一次</button>';
        $('#rAgain').addEventListener('click', function () {
          var keep = []; placed.forEach(function (p, i) { if (p === i) keep[i] = p; });
          placed = []; // 只保留放对的
          var np = []; for (var i = 0; i < 4; i++) np[i] = keep[i];
          rebuild(np);
        });
      }
    }
    function oral() {
      stage.innerHTML = hd('Retell 读后口头复述') + '<div class="card"><h3>Retell · 不看句子，自己说一遍</h3>' +
        '<p class="sub">句子收起来了，只留四个开头。看着开头，把故事说出来。</p>' +
        '<div class="slots">' + RETELL.map(function (x, i) { return '<div class="slot eng fill"><b>' + (i + 1) + '</b><span><b style="color:#E4483A">' + x.st + '</b> …</span></div>'; }).join('') + '</div>' +
        '<div class="recbox" id="rb"></div><div id="oOut"></div></div>';
      recorderUI($('#rb'), {
        max: 45000, verb: '说',
        onRecorded: function (r) {
          $('#oOut').innerHTML = '<h3 style="margin-top:12px">说完对一对：四句都说出来了吗？</h3><div class="opts" id="oRate"><button class="opt l" data-v="1">四句都说出来了</button><button class="opt l" data-v="0.7">说了两三句</button><button class="opt l" data-v="0.3">想不起来，要看句子</button></div>' +
            '<p class="note">样本演示：这里没有 AI 听复述，由孩子自查。正式版接 AI 判断说到了几件事、顺序对不对。</p>';
          $('#oRate').addEventListener('click', function (e) {
            var b = e.target.closest('.opt'); if (!b) return;
            $$('#oRate .opt').forEach(function (x) { x.classList.remove('pick'); }); b.classList.add('pick');
            var it = item('sr', { step: 'read', dim: '策略', label: 'Retell 读后口头复述' });
            it.val = +b.getAttribute('data-v'); it.done = true; it.low = it.val < 0.5;
            it.note = '排对顺序后盖住句子口头复述：' + (r.mode === 'rec' ? '录音 ' + r.dur.toFixed(1) + ' 秒' : '没有录音') + '，自查「' + b.textContent + '」';
            if (!$('#oNext')) {
              var n = document.createElement('button'); n.className = 'btn pri'; n.id = 'oNext'; n.textContent = '下一个：Connect ›';
              n.addEventListener('click', function () { halt(); connect(); window.scrollTo(0, 0); });
              $('#oOut').appendChild(n); n.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          });
          $('#oOut').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }
    var fixed = {};
    function rebuild(np) { fixed = {}; placed = []; np.forEach(function (p, i) { if (p !== undefined) fixed[i] = p; }); $('#rFb').innerHTML = ''; drawFixed(); }
    function drawFixed() {
      // 带固定位的重排：按空位顺序填
      var free = [0, 1, 2, 3].filter(function (i) { return fixed[i] === undefined; });
      var used = Object.keys(fixed).map(function (k) { return fixed[k]; });
      var seq = [];
      $('#slots').innerHTML = [0, 1, 2, 3].map(function (i) {
        var p = fixed[i];
        return '<button class="slot eng' + (p !== undefined ? ' fill ok' : '') + '" data-s="' + i + '"><b>' + (i + 1) + '</b><span>' + (p !== undefined ? esc(RETELL[p].full) : '') + '</span></button>';
      }).join('');
      $('#pool').innerHTML = order.filter(function (i) { return used.indexOf(i) < 0; }).map(function (i) { return '<button class="opt l" data-i="' + i + '">' + esc(RETELL[i].full) + '</button>'; }).join('');
      $('#pool').onclick = function (e) {
        var b = e.target.closest('.opt'); if (!b) return;
        var i = +b.getAttribute('data-i'); seq.push(i); b.remove();
        var slot = free[seq.length - 1]; var s = $$('#slots .slot')[slot]; s.classList.add('fill'); $('span', s).textContent = RETELL[i].full;
        if (seq.length === free.length) {
          placed = []; for (var k = 0; k < 4; k++) placed[k] = fixed[k] !== undefined ? fixed[k] : seq[free.indexOf(k)];
          $('#pool').onclick = null; $$('#slots .slot').forEach(function (x) { x.classList.remove('ok'); });
          check();
        }
      };
      $('#slots').onclick = null;
    }
    $('#pool').onclick = function (e) {
      var b = e.target.closest('.opt'); if (!b || solved) return;
      placed.push(+b.getAttribute('data-i')); draw();
    };
    $('#slots').onclick = function (e) {
      var s = e.target.closest('.slot'); if (!s || solved) return;
      var i = +s.getAttribute('data-s'); if (placed[i] === undefined || placed.length === 4) return;
      placed.splice(i, 1); draw();
    };
    draw();
  }
  function connect() {
    var who = [['mom', '👩', 'My mom'], ['dad', '👨', 'My dad'], ['friend', '🧒', 'My friend'], ['teacher', '🧑‍🏫', 'My teacher']];
    stage.innerHTML = hd('Connect 新旧知识关联') + '<div class="card"><h3>Connect · 连到你自己</h3>' +
      '<p>Pip 推不动苹果，他问朋友：<span class="eng pat">Can you help me?</span></p><p><b>你遇到难事的时候，谁能帮你？</b></p>' +
      '<div class="opts c2" id="cnOpts">' + who.map(function (w, i) { return '<button class="opt" data-w="' + i + '"><span class="emo">' + w[1] + '</span><span class="eng">' + w[2].toLowerCase() + '</span></button>'; }).join('') + '</div><div id="cnOut"></div></div>';
    $('#cnOpts').addEventListener('click', function (e) {
      var b = e.target.closest('.opt'); if (!b) return;
      $$('#cnOpts .opt').forEach(function (x) { x.classList.remove('pick'); }); b.classList.add('pick');
      var w = who[+b.getAttribute('data-w')], sent = w[2] + ' can help me.';
      var it = item('cn', { step: 'read', dim: '策略', label: 'Connect 新旧知识关联' }); it.val = 1; it.done = true; it.note = '把故事里的 can 连到自己：' + sent;
      play('c_' + w[0]);
      $('#cnOut').innerHTML = '<div class="frame eng">' + sent + '</div><div class="fb ok">故事里的 <b>can</b>，换到你自己身上，就是一句新的话。读一遍。</div>' +
        '<button class="btn pri" id="toWrite">下一步：写 ›</button>';
      $('#toWrite').addEventListener('click', function () { finishStep('read'); go('write'); });
    });
  }
  book();
};

/* ---------- 6 写 ---------- */
var ANIMALS = [['cat', '🐱'], ['duck', '🦆'], ['pig', '🐷'], ['dog', '🐶']];
var VERBS = ['jump', 'swim', 'run', 'walk'];
function checkWrite(v, a, vb) {
  var target = 'A ' + a + ' ' + vb + 's by.';
  var t = v.trim().replace(/\s+/g, ' ').replace(/\s+([.!?])$/, '$1');
  if (t === target) return { ok: true, g: true };
  var issues = [], g = true;
  var low = t.toLowerCase().replace(/[.!?。]+$/, '');
  var words = low.split(' ');
  if (words.indexOf(vb + 's') < 0) {
    g = false;
    if (words.indexOf(vb) >= 0) issues.push('动词要加 s：一只 ' + a + '（它）做动作，' + vb + ' → <b>' + vb + 's</b>。原句也是 hop → hop<b>s</b>。');
    else issues.push('动作词再看一眼：应该是 <b>' + vb + 's</b>（' + vb + ' 后面加 s）。');
  }
  if (words.indexOf(a) < 0) issues.push('动物的词再对一下：<b>' + a + '</b>。');
  if (words[0] !== 'a') issues.push('照着句型，用 A 开头：A ___ ___s by.');
  if (words[words.length - 1] !== 'by') issues.push('最后别忘了 <b>by</b>。');
  if (t && /^[a-z]/.test(t)) issues.push('句子开头的字母要大写：<b>A</b>。');
  if (t && !/\.$/.test(t)) issues.push('句尾加上句号 <b>.</b>');
  if (!t) issues = ['先在上面的框里打出句子。'];
  if (!issues.length) issues.push('和句型再对一下：A ' + a + ' ' + vb + 's by.（中间各空一格）');
  return { ok: false, g: g, issues: issues };
}
SCREENS.write = function () {
  var a = null, vb = null, solved = false;
  stage.innerHTML = head(null, '第 6 步 · 写：换一换，写出你自己的一页', ['写作 · 入门写作', '句型替换'], '「语法不单独开课，全部融入写作与句型训练落地」',
    '故事里每来一个朋友，都是同一个句型。现在请一个新朋友来帮 Pip。') +
    '<div class="card"><h3>原句</h3><div class="frame eng">A <u>rabbit</u> <u>hop<span class="s">s</span></u> by.</div>' +
    '<h3>① 选一个新朋友</h3><div class="tiles eng" id="tA">' + ANIMALS.map(function (x) { return '<button class="tile" data-a="' + x[0] + '">' + x[1] + ' ' + x[0] + '</button>'; }).join('') + '</div>' +
    '<h3 style="margin-top:8px">② 它是怎么来的？选一个动作</h3><div class="tiles eng" id="tV">' + VERBS.map(function (x) { return '<button class="tile" data-v="' + x + '">' + x + '</button>'; }).join('') + '</div>' +
    '<div id="wStep3" class="hide"><h3 style="margin-top:8px">③ 照着原句，把新的一句打出来</h3>' +
    '<div class="frame eng" id="wFrame"></div><p class="sub" id="wHint"></p>' +
    '<input class="wr" id="wIn" type="text" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="在这里打出整句" enterkeyhint="done">' +
    '<button class="btn pri" id="wCheck">检查</button><div id="wFb"></div>' +
    '<p class="note">样本演示：这里是规则判断加预置反馈（查动词的 s、大小写、句号、拼写）。正式版接 AI 批改：语法纠错、句型优化。</p></div></div><div id="wOut"></div>';
  function upd() {
    if (!a || !vb) return;
    $('#wStep3').classList.remove('hide');
    $('#wFrame').innerHTML = 'A <u>' + a + '</u> <u>&nbsp;&nbsp;&nbsp;&nbsp;?&nbsp;&nbsp;&nbsp;&nbsp;</u> by.';
    $('#wHint').innerHTML = '动作词是 <b class="eng">' + vb + '</b>。看原句：hop 变成了 hop<b style="color:#2F8A56">s</b>，你的动作词要怎么变？';
  }
  $('#tA').addEventListener('click', function (e) { var b = e.target.closest('.tile'); if (!b || solved) return; $$('#tA .tile').forEach(function (x) { x.classList.remove('pick'); }); b.classList.add('pick'); a = b.getAttribute('data-a'); upd(); });
  $('#tV').addEventListener('click', function (e) { var b = e.target.closest('.tile'); if (!b || solved) return; $$('#tV .tile').forEach(function (x) { x.classList.remove('pick'); }); b.classList.add('pick'); vb = b.getAttribute('data-v'); upd(); });
  function check() {
    if (solved || !a || !vb) return;
    var v = $('#wIn').value, r = checkWrite(v, a, vb);
    if (!v.trim()) { $('#wFb').innerHTML = '<div class="fb bad">先在上面的框里打出句子。</div>'; return; }
    var first = !R.items.w1 || !R.items.w1.tries.length;
    attempt('w1', { step: 'write', dim: '写', label: '句型替换·写句子' }, v.trim(), r.ok);
    if (first) attempt('w1g', { step: 'write', dim: '语法', label: '第三人称动词加 s（写句子时）' }, v.trim(), r.g);
    else if (r.g && R.items.w1g && !R.items.w1g.done) attempt('w1g', null, v.trim(), true);
    beep(r.ok);
    if (!r.ok) { $('#wFb').innerHTML = '<div class="fb bad">还差一点：<br>· ' + r.issues.join('<br>· ') + '</div>'; return; }
    solved = true; $('#wIn').blur(); $('#wIn').disabled = true; $('#wCheck').classList.add('hide');
    var emo = ANIMALS.filter(function (x) { return x[0] === a; })[0][1], sent = 'A ' + a + ' ' + vb + 's by.';
    R.myPage = sent;
    $('#wFb').innerHTML = '<div class="fb ok">写对了：大写、动词加 s、句号都在。</div>';
    $('#wOut').innerHTML = '<div class="card"><h3>📖 你的新一页</h3><p class="sub">第一句是你写的；后两句是系统按故事的句型接上的。</p>' +
      '<div class="mypage"><div class="emo">🐭 ' + emo + ' 🍎</div><div class="eng" style="font-size:18px"><b>' + sent + '</b><br>“Can you help me?” asks Pip.<br>“Yes, I can!” says the ' + a + '.</div></div>' +
      '<button class="btn sm" id="wPlay">▶ 听听你写的这一页</button>' +
      '<button class="btn pri" id="toGame">下一步：闯关 ›</button></div>';
    $('#wPlay').addEventListener('click', function () { playSeq(['w_' + a + '_' + vb + 's', 's06']); });
    $('#toGame').addEventListener('click', function () { go('game'); });
    finishStep('write');
    $('#wOut').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  $('#wCheck').addEventListener('click', check);
  $('#wIn').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); check(); } });
};

/* ---------- 7 闯关 ---------- */
var ROUNDS = [
  { k: 'g1', dim: '听', label: '闯关·听句子选动物（A bear walks by.）', type: 'who', audio: 's11', q: '听一听：谁来了？', opts: [['🐰', 'rabbit'], ['🦊', 'fox'], ['🐻', 'bear']], ans: 'bear', time: 12 },
  { k: 'g2', dim: '读', label: '闯关·读句子选图（The apple rolls and rolls.）', type: 'pic', text: 'The apple rolls and rolls.', q: '读一读：是哪一幅图？', opts: [1, 4, 5], ans: 4, time: 12 },
  { k: 'g3', dim: '语法', label: '闯关·动词加 s（A fox ___ by.）', type: 'pick', text: 'A fox ___ by.', q: '选对的词，填进去', opts: ['run', 'runs'], ans: 'runs', time: 10 },
  { k: 'g4', dim: '听', label: '闯关·听句子选文字（too big）', type: 'hear', audio: 'm04', q: '听一听：说的是哪一句？', opts: ['But the apple is too small.', 'But the apple is too big.', 'But the apple is not big.'], ans: 'But the apple is too big.', time: 14 },
  { k: 'g5', dim: '语法', label: '闯关·can 问句排词序', type: 'order', q: '把词排成 Pip 说的那句问话', words: ['help', 'you', 'me', 'can'], ans: 'can you help me', tail: '?', time: 18 },
  { k: 'g6', dim: '读', label: "闯关·读句子选图（Let's eat the apple together!）", type: 'pic', text: '“Let’s eat the apple together!”', q: '读一读：是哪一幅图？', opts: [5, 2, 4], ans: 5, time: 12 }
];
var PICNAME = { 1: 'Pip 一个人推', 2: '兔子来帮忙', 3: '狐狸也来了', 4: '苹果滚起来', 5: '一起吃苹果' };
var APPLE_SVG_UNUSED = '<svg viewBox="0 0 48 48"><path d="M24 14c-7-5-18-1-18 11 0 10 7 19 13 19 2 0 3-1 5-1s3 1 5 1c6 0 13-9 13-19 0-12-11-16-18-11z" fill="#E4483A"/><path d="M12 22c0-4 3-7 6-7" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".6"/><path d="M24 15c0-4 1-7 3-9" stroke="#6B4423" stroke-width="2.5" stroke-linecap="round" fill="none"/><path d="M27 8c3-4 9-4 11-2-2 4-8 5-11 2z" fill="#3FA66B"/></svg>';
var SP = function (n) { return 'assets/img/sp_' + n + '.webp'; };
var CREW = [['mouse', 32, 0], ['rabbit', 44, 1], ['fox', 46, 3], ['bear', 60, 5]];   // 角色、显示高度、推到第几格时加入
var JOIN = { 1: ['兔子', 's07'], 3: ['狐狸', 's10'], 5: ['大熊', 's12'] };
function cap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
SCREENS.game = function () {
  var timer = null, hearts, pos, pushN, score, combo, queue, n, locked, missed = [];
  onLeave = function () { clearTimeout(timer); };
  var TRACK = '<div class="track" id="trk"><div class="crew" id="crew"></div><img class="apple" id="apl" src="' + SP('apple') + '" alt="apple"></div>';
  function place() {
    var a = $('#apl'), c = $('#crew'); if (!a) return;
    var f = pos + pushN / 3, left = 30 + f * (46 / ROUNDS.length);
    a.style.left = left + '%'; c.style.left = left + '%';
    a.style.transform = 'rotate(' + Math.round(f * 120) + 'deg)';
    var want = CREW.filter(function (x) { return pos >= x[2]; }).reverse();
    if (c.children.length !== want.length) c.innerHTML = want.map(function (x) { return '<img src="' + SP(x[0]) + '" style="height:' + x[1] + 'px" alt="' + x[0] + '">'; }).join('');
  }
  function intro() {
    stage.innerHTML = head(null, '第 7 步 · 闯关：把苹果推回家', ['AI游戏化闯关', '积分徽章'], '「AI游戏化闯关、积分徽章、趣味交互，解决坚持问题」') +
      '<div class="card">' + TRACK +
      '<p style="margin-top:10px">答对一题，就轮到你<b>连点三下把苹果推一格</b>，朋友会一个个来帮忙；<b>6 格到家</b>。</p>' +
      '<p class="sub">· 每题限时，超时算错 · 答错掉一颗心，这题排到最后再考 · 三颗心掉完，苹果滚回起点 · 连对有加分</p>' +
      '<button class="btn pri" id="gStart">开始闯关 ›</button></div>';
    pos = 0; pushN = 0; place();
    $('#gStart').addEventListener('click', start);
  }
  function start() {
    hearts = 3; pos = 0; pushN = 0; score = 0; combo = 0; n = 0;
    queue = ROUNDS.filter(function (r) { return missed.indexOf(r.k) >= 0; }).concat(ROUNDS.filter(function (r) { return missed.indexOf(r.k) < 0; }));   // 上次答错的先考
    stage.innerHTML = TRACK + '<div class="hud"><span class="hearts" id="hp"></span><span id="gNo"></span><span>⭐ <b id="sc">0</b></span></div><div class="tbar"><i id="tb"></i></div><div class="card" style="margin-top:10px" id="gBody"></div>';
    hud(); next();
  }
  function hud() {
    $('#hp').textContent = '❤️'.repeat(hearts) + '🤍'.repeat(3 - hearts);
    $('#sc').textContent = score;
    place();
  }
  function pop(t) { var p = document.createElement('div'); p.className = 'pop'; p.textContent = t; $('#trk').appendChild(p); setTimeout(function () { p.remove(); }, 850); }
  function next() {
    clearTimeout(timer); halt();
    if (pos >= ROUNDS.length) return win();
    if (hearts <= 0) return lose();
    var r = queue.shift(); n++; locked = false;
    $('#gNo').textContent = '第 ' + n + ' 题 · 还差 ' + (ROUNDS.length - pos) + ' 格';
    var b = $('#gBody'), h = '<div class="gq">' + r.q + '</div>';
    if (r.audio) h += '<button class="bigplay ring" id="gPlay">▶</button>';
    if (r.text) h += '<div class="gtext eng">' + esc(r.text) + '</div>';
    if (r.type === 'who') h += '<div class="opts c3">' + shuffle(r.opts).map(function (o) { return '<button class="opt" data-o="' + o[1] + '"><span class="emo">' + o[0] + '</span><span class="eng">' + o[1] + '</span></button>'; }).join('') + '</div>';
    if (r.type === 'pic') h += '<div class="opts pics">' + shuffle(r.opts).map(function (o) { return '<button class="opt" data-o="' + o + '"><img src="' + TH(o) + '" alt=""></button>'; }).join('') + '</div>';
    if (r.type === 'pick') h += '<div class="opts c2 eng">' + shuffle(r.opts).map(function (o) { return '<button class="opt" data-o="' + o + '">' + o + '</button>'; }).join('') + '</div>';
    if (r.type === 'hear') h += '<div class="opts eng">' + shuffle(r.opts).map(function (o) { return '<button class="opt l" data-o="' + esc(o) + '">' + esc(o) + '</button>'; }).join('') + '</div>';
    if (r.type === 'order') h += '<div class="built eng" id="built"></div><div class="tiles eng" id="oT" style="justify-content:center">' + shuffle(r.words).map(function (w) { return '<button class="tile" data-w="' + w + '">' + w + '</button>'; }).join('') + '</div><button class="btn sm" id="oClr" style="display:block;margin:6px auto 0">重排</button>';
    b.onclick = null;
    b.innerHTML = h;
    if (r.audio) {
      var pb = $('#gPlay');
      pb.addEventListener('click', function () { pb.classList.remove('ring'); play(r.audio); });
      _play(r.audio);   // 先试着自动播；被浏览器拦了就靠上面的按钮
    }
    var tb = $('#tb'); tb.style.transition = 'none'; tb.style.transform = 'scaleX(1)';
    void tb.offsetWidth; tb.style.transition = 'transform ' + r.time + 's linear'; tb.style.transform = 'scaleX(0)';
    timer = setTimeout(function () { answer(r, '（超时没答）', false, null); }, r.time * 1000);
    if (r.type === 'order') {
      var built = [];
      var drawB = function () { $('#built').textContent = built.length ? cap(built.join(' ')) + (built.length === r.words.length ? r.tail : '') : ''; };
      $('#oT').addEventListener('click', function (e) {
        var t = e.target.closest('.tile'); if (!t || locked || t.classList.contains('used')) return;
        t.classList.add('used'); built.push(t.getAttribute('data-w')); drawB();
        if (built.length === r.words.length) answer(r, cap(built.join(' ')) + r.tail, built.join(' ') === r.ans, null);
      });
      $('#oClr').addEventListener('click', function () { if (locked) return; built = []; $$('#oT .tile').forEach(function (x) { x.classList.remove('used'); }); drawB(); });
    } else {
      b.onclick = function (e) {
        var o = e.target.closest('.opt'); if (!o || locked) return;
        var v = o.getAttribute('data-o');
        answer(r, r.type === 'pic' ? '选了「' + PICNAME[v] + '」那幅图' : v, String(v) === String(r.ans), o);
      };
    }
  }
  function answer(r, text, ok, btn) {
    if (locked) return; locked = true; clearTimeout(timer);
    var tb = $('#tb'); var w = tb.getBoundingClientRect().width; tb.style.transition = 'none'; tb.style.transform = 'scaleX(' + (w / tb.parentNode.getBoundingClientRect().width) + ')';
    attempt(r.k, { step: 'game', dim: r.dim, label: r.label }, text, ok); beep(ok);
    if (ok) {
      combo++; var add = 10 + (combo > 1 ? 5 * (combo - 1) : 0); score += add;
      if (btn) btn.classList.add('ok');
      pop('+' + add + (combo > 1 ? '  连对 ×' + combo : ''));
      $('#sc').textContent = score;
      timer = setTimeout(pushPhase, 650);
    } else {
      combo = 0; hearts--; queue.push(r);
      if (missed.indexOf(r.k) < 0) missed.push(r.k);
      if (btn) btn.classList.add('bad');
      $$('#gBody .opt').forEach(function (o) { if (String(o.getAttribute('data-o')) === String(r.ans)) o.classList.add('ok'); });
      if (r.type === 'order') $('#built').innerHTML = '<span style="color:#C93A2E">' + esc(text) + '</span><br><span style="color:#2F8A56">' + cap(r.ans) + r.tail + '</span>';
      $('#trk').classList.add('wob'); setTimeout(function () { var t = $('#trk'); if (t) t.classList.remove('wob'); }, 600);
      pop('苹果晃了一下');
      hud();
      timer = setTimeout(next, 1900);
    }
  }
  function pushPhase() {
    var b = $('#gBody'); if (!b) return;
    b.onclick = null; pushN = 0;
    $('#gNo').textContent = '答对了，推！';
    b.innerHTML = '<div class="fb ok" style="margin-top:0;text-align:center">答对了！现在用力推：<b>连点三下</b></div><button class="pushbtn" id="pushBtn">👐 推！<small id="pushN">0 / 3</small></button><p class="sub" style="text-align:center;margin:8px 0 0">点上面的苹果也行</p>';
    var done = false;
    function tap() {
      if (done) return;
      pushN++; beep(true); place();
      var t = $('#trk'); t.classList.remove('shove'); void t.offsetWidth; t.classList.add('shove');
      $('#pushN').textContent = pushN + ' / 3';
      if (pushN >= 3) {
        done = true; pos++; pushN = 0; $('#apl').onclick = null;
        var j = JOIN[pos];
        setTimeout(function () {
          place();
          if (pos >= ROUNDS.length) return next();
          if (j) {
            pop(j[0] + '来帮忙了！');
            $('#gBody').innerHTML = '<div class="fb info" style="margin-top:0;text-align:center"><b class="eng" style="font-size:20px">“Yes, I can!”</b><br>' + j[0] + '来帮忙了</div>';
            var gone = false, go2 = function () { if (gone) return; gone = true; next(); };
            play(j[1]).then(function () { timer = setTimeout(go2, 250); });
            timer = setTimeout(go2, 4500);
          } else timer = setTimeout(next, 500);
        }, 480);
      }
    }
    $('#pushBtn').addEventListener('click', tap);
    $('#apl').onclick = tap;
  }
  function win() {
    var stars = hearts;
    if (!R.game || score > R.game.score) R.game = { stars: stars, score: score };
    finishStep('game');
    $('#gNo').textContent = '到家了！'; $('#tb').style.transition = 'none'; $('#tb').style.transform = 'scaleX(0)';
    $('#gBody').onclick = null;
    $('#gBody').innerHTML = '<div class="stars">' + '⭐'.repeat(stars) + '<span style="opacity:.25">' + '⭐'.repeat(3 - stars) + '</span></div>' +
      '<h2 style="text-align:center">苹果到家了！得分 ' + score + '</h2><p class="sub" style="text-align:center">剩 ' + hearts + ' 颗心 = ' + stars + ' 颗星。答错过的题已经记进看板（看板只算每题第一次的作答，再玩不扣分）。</p>' +
      '<button class="btn pri" id="toBoard">过关！看学情看板 ›</button><button class="btn" id="gAgain">再玩一次</button>';
    $('#toBoard').addEventListener('click', function () { go('board'); });
    $('#gAgain').addEventListener('click', start);
  }
  function lose() {
    $('#gNo').textContent = '三颗心掉完了'; pos = 0; pushN = 0; hud();
    $('#gBody').onclick = null;
    $('#gBody').innerHTML = '<h2 style="text-align:center">苹果滚回起点了</h2><p class="sub" style="text-align:center">没关系。错的题系统都记下了，再来一次会先考它们。</p><button class="btn pri" id="gAgain">再来一次 ›</button>';
    $('#gAgain').addEventListener('click', start);
  }
  intro();
};

/* ---------- 8 学情看板 ---------- */
var DIMS = ['听', '说', '读', '写', '语法', '策略'];
function dimData(d) {
  var its = R.order.map(function (k) { return R.items[k]; }).filter(function (i) { return i.dim === d; });
  if (!its.length) return { score: null, its: its };
  var sum = 0; its.forEach(function (i) { sum += credit(i); });
  var total = its.length;
  if (d === '策略') total = 3;           // Predict / Retell / Connect 三项，没做的算 0
  if (d === '说') total = Math.max(total, 4); // 跟读两句 + 复述一次 + 小问答
  return { score: Math.round(100 * sum / total), its: its };
}
function radar(vals) {
  var N = 6, cx = 165, cy = 150, RR = 100, h = '';
  var pt = function (i, r) { var a = -Math.PI / 2 + i * 2 * Math.PI / N; return [(cx + r * Math.cos(a)).toFixed(1), (cy + r * Math.sin(a)).toFixed(1)]; };
  [25, 50, 75, 100].forEach(function (p) { h += '<polygon points="' + DIMS.map(function (_, i) { return pt(i, RR * p / 100).join(','); }).join(' ') + '" fill="' + (p === 100 ? '#FFFDF8' : 'none') + '" stroke="#EADFCB" stroke-width="1"/>'; });
  DIMS.forEach(function (d, i) {
    var e = pt(i, RR), l = pt(i, RR + 24);
    h += '<line x1="' + cx + '" y1="' + cy + '" x2="' + e[0] + '" y2="' + e[1] + '" stroke="#EADFCB"/>';
    h += '<text x="' + l[0] + '" y="' + l[1] + '" text-anchor="middle" dominant-baseline="middle" font-size="14" font-weight="700" fill="#2B2A33">' + d + '</text>';
    h += '<text x="' + l[0] + '" y="' + (+l[1] + 16) + '" text-anchor="middle" dominant-baseline="middle" font-size="12" fill="#6F6A7A">' + (vals[i] === null ? '未做' : vals[i]) + '</text>';
  });
  h += '<polygon points="' + vals.map(function (v, i) { return pt(i, RR * (v || 0) / 100).join(','); }).join(' ') + '" fill="rgba(228,72,58,.22)" stroke="#E4483A" stroke-width="2.5" stroke-linejoin="round"/>';
  vals.forEach(function (v, i) { var p = pt(i, RR * (v || 0) / 100); h += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="4" fill="#E4483A"/>'; });
  return '<svg class="radar" viewBox="0 0 330 310" role="img" aria-label="六维度雷达图">' + h + '</svg>';
}
SCREENS.board = function () {
  R.done.board = true;
  var data = DIMS.map(dimData), vals = data.map(function (d) { return d.score; });
  var doneN = STEPS.slice(0, 7).filter(function (s) { return R.done[s.id]; }).length;
  var all = doneN === 7;
  var total = Date.now() - R.t0;
  var stuck = [];
  R.order.forEach(function (k) {
    var i = R.items[k], st = stepOf(i.step);
    var bad = (i.firstOk === false) || i.low;
    if (bad) stuck.push('第 ' + st.no + ' 步 ' + st.name + ' · ' + i.label + '：' + triesText(i));
  });
  var taps = Object.keys(R.readTaps);
  var pts = (R.game ? R.game.score : 0) + doneN * 10;
  var badge = function (on, emo, name) { return '<div class="badge' + (on ? '' : ' off') + '"><b>' + emo + '</b>' + name + '</div>'; };
  var sp = data[1].its.filter(function (i) { return i.done; }).length;
  var why = {
    '听': '泛听大意、精听挖空、闯关里的听力题：一次答对算满分，改对算一部分。',
    '说': '跟读两句、一次看图复述、一个小问答：做了才有分，高低看孩子的自评和自查，不是 AI 打的分。正式版换成 AI 的发音、流利度、逻辑打分。',
    '读': '句子排顺序、闯关里的读句选图。',
    '写': '句型替换那一句：一次写对满分，改几次才对就打折。',
    '语法': '没有单独的语法题：写句子时第一次有没有加 s，加闯关里的动词加 s 和 can 问句词序。',
    '策略': 'Predict、Connect 记的是「用没用过」，Retell 看盖住句子后口头复述的自查。这一栏说明用过，还谈不上掌握度。'
  };
  var plan = [];
  if (data[0].its.some(function (i) { return i.firstOk === false; })) plan.push('听：这一篇明天继续放进泛听循环；精听把今天选错的句子排在最前。');
  if (data[4].its.some(function (i) { return i.firstOk === false; })) plan.push('语法：明天的写作多给 2 句「它 + 动词加 s」的句型替换，不单独讲语法。');
  if (data[1].its.some(function (i) { return i.low; })) plan.push('说：明天跟读先复习今天自评不顺的句子，再进新句。');
  if (taps.length >= 3 || data[2].its.some(function (i) { return i.firstOk === false; })) plan.push('读：这一篇留在书架上，明天再读一遍，点读过的句子先出。');
  if (!plan.length && all) plan.push('今天全部一次通过：明天进下一篇同级童话，句型换成 Can I …? / Yes, you can.');
  if (!all) plan.push('还有 ' + (7 - doneN) + ' 步没做完：明天先补完这一课。');
  stage.innerHTML = '<h2>' + (all ? '🎉 过关！今天的一课走完了' : '学情看板（还有 ' + (7 - doneN) + ' 步没做）') + '</h2>' +
    '<div><span class="tag">全维度学情数据看板</span><span class="tag">用这次的真实作答算</span></div>' +
    '<div class="quote">方案原句：「全维度学情数据看板：听、说、读、写、语法、策略掌握度可视化」</div>' +
    '<div class="card"><div class="badges">' +
    badge(R.game, '🍎', '推苹果回家' + (R.game ? ' ' + '⭐'.repeat(R.game.stars) : '')) +
    badge(sp >= 4, '🗣️', '敢开口') + badge(!!R.myPage, '✍️', '我的新一页') +
    '</div><p class="sub" style="margin:10px 0 0;text-align:center">积分 <b style="color:#E4483A;font-size:18px">' + pts + '</b> · 完成 ' + doneN + '/7 步 · 用时 ' + fmtSec(total) + '</p></div>' +
    '<div class="card"><h3>六个维度</h3>' + radar(vals) +
    data.map(function (d, i) {
      var v = d.score, cls = v === null ? '' : v >= 80 ? '' : v >= 55 ? 'mid' : 'low';
      return '<div class="dim"><div class="hd"><span>' + DIMS[i] + '</span><span>' + (v === null ? '还没做' : v + ' 分') + '</span></div>' +
        '<div class="bar"><i class="' + cls + '" style="width:' + (v || 0) + '%"></i></div>' +
        '<small>怎么算：' + why[DIMS[i]] + '</small>' +
        d.its.map(function (it) { return '<small>· ' + it.label + '：' + triesText(it) + '</small>'; }).join('') +
        (DIMS[i] === '听' ? '<small>· 动画看了 ' + Math.round(R.videoSec) + ' 秒，讲解短片看了 ' + Math.round(R.teachSec) + ' 秒</small>' : '') +
        (DIMS[i] === '读' ? '<small>· 阅读时点读了 ' + taps.length + ' 句' + (taps.length ? '：' + taps.map(esc).join(' / ') : '') + '</small>' : '') +
        (DIMS[i] === '写' && R.myPage ? '<small>· 孩子写出的句子：' + esc(R.myPage) + '</small>' : '') +
        '</div>';
    }).join('') +
    '<p class="note">样本演示：分数是按上面写的规则当场算的，只基于这一课、这一次的作答，题量很少，不代表真实水平。正式版要累计很多课的数据。</p></div>' +
    '<div class="card"><h3>老师端会收到什么</h3><div class="tcard"><h3>演示学员 · The Big Red Apple</h3>' +
    (stuck.length || R.asks.length ?
      '<div>需要老师看的地方：</div><ul>' + stuck.map(function (s) { return '<li>' + s + '</li>'; }).join('') +
      R.asks.map(function (a) { return '<li>孩子主动求助 · 第 ' + a.no + ' 步 ' + a.name + '：「' + a.q + '」</li>'; }).join('') + '</ul>'
      : '<div>这一课没有卡点，也没有求助：<b>老师不用介入</b>。</div>') +
    '</div><p class="note">样本演示：这张卡是按这次的作答当场生成的，没有真的发给谁。正式版里，老师只看这张卡，有卡点才答疑。</p></div>' +
    '<div class="card"><h3>系统接下来怎么安排</h3><ul style="margin:0;padding-left:20px">' + plan.map(function (p) { return '<li>' + p + '</li>'; }).join('') + '</ul>' +
    '<p class="note">样本演示：这几条是写死的规则（错了什么就补什么）。正式版由系统按学情动态推送素材。</p></div>' +
    (all ? '' : '<button class="btn pri" id="bCont">接着做没做完的 ›</button>') +
    '<button class="btn" id="bHome">回首页</button><button class="btn" id="bReset">清空记录，从头再走一遍</button>';
  if (!all) $('#bCont').addEventListener('click', function () { go(STEPS.filter(function (s) { return !R.done[s.id]; })[0].id); });
  $('#bHome').addEventListener('click', function () { go('home'); });
  $('#bReset').addEventListener('click', function () { location.reload(); });
};

/* ---------- 启动 ---------- */
window.__loop = { R: R, go: go, Rec: Rec };
SCREENS.home(); drawTop();
})();
