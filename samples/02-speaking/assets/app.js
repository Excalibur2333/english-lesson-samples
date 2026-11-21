/* 口语样本 · Level 3 · Saturday Plan
   纯静态演示：没有接 AI。对练分支、打分卡、纠音提示都是预置内容或简单规则。 */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function clip(n) { return 'assets/audio/' + n + '.mp3'; }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function stars(n) { var s = ''; for (var i = 1; i <= 5; i++) s += i <= n ? '★' : '<i>★</i>'; return '<span class="stars">' + s + '</span>'; }

  var DEMO_NOTE = '样本演示：这里是预置反馈，正式版接 AI';

  /* 示范句时长（秒），用来粗算流利度 */
  var DUR = { m_r1a: 5.14, m_r1b: 5.42, m_r2pa: 5.04, m_r2pb: 4.63, m_r2ca: 4.82, m_r2cb: 5.78, m_r3a: 6.91, m_r3b: 7.37, m_ice_a: 4.46, m_ice_b: 7.01 };

  var state = { cur: 'home', visited: {}, talkDone: false, logicStars: 0, gameVotes: -1, spoken: 0, points: 0, mono: false };
  var SPEAK_NEED = 5;
  function addPts(n) {
    state.points += n;
    var p = $('#pts'); if (p) { p.textContent = '⭐ ' + state.points; p.classList.remove('pop'); void p.offsetWidth; p.classList.add('pop'); }
  }
  function spoke() { state.spoken++; addPts(5); }

  /* ---------------- 播放 ---------------- */
  var player = new Audio();
  player.preload = 'auto';
  var curBtn = null;
  function stopAudio() {
    try { player.pause(); } catch (e) {}
    if (curBtn) { curBtn.classList.remove('playing'); curBtn = null; }
  }
  function play(src, btn, onend) {
    stopAudio();
    var v = $('#vid'); if (v && !v.paused) { try { v.pause(); } catch (e) {} }
    curBtn = btn || null;
    if (btn) btn.classList.add('playing');
    player.onended = function () { if (btn) btn.classList.remove('playing'); if (curBtn === btn) curBtn = null; if (onend) onend(); };
    player.onerror = function () { if (btn) btn.classList.remove('playing'); };
    player.src = src;
    var p = player.play();
    if (p && p.catch) p.catch(function () { if (btn) btn.classList.remove('playing'); });
  }
  function playBtn(label, src, cls) {
    var b = el('button', 'pill ' + (cls || ''), label);
    b.type = 'button';
    b.addEventListener('click', function () { play(typeof src === 'function' ? src() : src, b); });
    return b;
  }

  /* ---------------- 麦克风与录音 ---------------- */
  var Mic = {
    stream: null,
    supported: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder),
    failed: false,
    ensure: function () {
      var self = this;
      if (self.stream) return Promise.resolve(true);
      if (!self.supported || self.failed) return Promise.resolve(false);
      return new Promise(function (resolve) {
        var settled = false;
        var to = setTimeout(function () { if (!settled) { settled = true; self.failed = true; resolve(false); } }, 20000);
        navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
          if (settled || self.failed) { s.getTracks().forEach(function (t) { t.stop(); }); if (!settled) { settled = true; clearTimeout(to); resolve(false); } return; }
          settled = true; clearTimeout(to); self.stream = s; resolve(true);
        }).catch(function () {
          if (settled) return; settled = true; clearTimeout(to); self.failed = true; resolve(false);
        });
      });
    },
    release: function () { if (this.stream) { this.stream.getTracks().forEach(function (t) { t.stop(); }); this.stream = null; } }
  };
  window.addEventListener('pagehide', function () { Mic.release(); });
  if (!Mic.supported) Mic.failed = true;

  /* 解码录音，量一下有没有声音、有声部分多长（50 毫秒一格，按音量门槛算） */
  function analyze(blob) {
    return new Promise(function (res) {
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC || !blob.arrayBuffer) { res(null); return; }
        blob.arrayBuffer().then(function (buf) {
          var ctx = new AC(), fin = false;
          function ok(ab) {
            if (fin) return; fin = true;
            var d = ab.getChannelData(0), win = Math.floor(ab.sampleRate * 0.05), voiced = 0, peak = 0, frames = [];
            for (var i = 0; i + win <= d.length; i += win) {
              var sum = 0; for (var j = i; j < i + win; j++) sum += d[j] * d[j];
              var rms = Math.sqrt(sum / win); if (rms > peak) peak = rms; frames.push(rms);
            }
            /* 门槛跟着这段录音最响的地方走，轻声说话的孩子不会被当成没出声 */
            var gate = Math.max(0.01, peak * 0.2);
            frames.forEach(function (x) { if (x > gate) voiced += 0.05; });
            try { ctx.close(); } catch (e) {}
            res({ voiced: voiced, peak: peak });
          }
          function bad() { if (fin) return; fin = true; try { ctx.close(); } catch (e) {} res(null); }
          var p = ctx.decodeAudioData(buf, ok, bad);
          if (p && p.then) p.then(ok, bad);
        }, function () { res(null); });
      } catch (e) { res(null); }
    });
  }

  var recorders = [];
  /* opts: model(示范音频名，可为空或函数)、maxSec、onDone(rec|null)、sayLabel */
  function Recorder(host, opts) {
    opts = opts || {};
    var box = el('div', 'rec'); host.appendChild(box);
    var st = Mic.failed ? 'nomic' : 'idle', mr = null, chunks = [], t0 = 0, tick = null, rec = null;
    var api = { rec: null, refresh: function () { if (Mic.failed && (st === 'idle' || st === 'asking')) { st = 'nomic'; draw(); } } };
    recorders.push(api);

    function modelSrc() { var m = typeof opts.model === 'function' ? opts.model() : opts.model; return m ? clip(m) : null; }
    function addModel(row) { if (modelSrc()) row.appendChild(playBtn('▶ 示范', function () { return modelSrc(); })); }
    var counted = false;
    function done(r) { rec = r; api.rec = r; if (!counted && (!r || !r.silent)) { counted = true; spoke(); } if (opts.onDone) opts.onDone(r); }

    function toNoMic() { Mic.failed = true; st = 'nomic'; recorders.forEach(function (r) { r.refresh(); }); draw(); }

    function start() {
      stopAudio();
      st = 'asking'; draw();
      Mic.ensure().then(function (ok) {
        if (st !== 'asking') return;
        if (!ok) { toNoMic(); return; }
        try {
          chunks = [];
          mr = new MediaRecorder(Mic.stream);
          mr.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
          mr.onstop = function () {
            var dur = (Date.now() - t0) / 1000;
            var blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
            if (!blob.size) { toNoMic(); return; }
            var r = { url: URL.createObjectURL(blob), dur: dur, voiced: null, silent: false };
            analyze(blob).then(function (a) {
              if (a) { r.voiced = a.voiced; r.silent = a.peak < 0.01; }
              st = 'done'; rec = r; draw();
              done(r);
            });
          };
          mr.start();
          t0 = Date.now(); st = 'rec'; draw();
          tick = setInterval(function () {
            var s = (Date.now() - t0) / 1000;
            var t = $('.sec', box); if (t) t.textContent = s.toFixed(0) + ' 秒';
            if (s >= (opts.maxSec || 15)) stop();
          }, 250);
        } catch (e) { toNoMic(); }
      });
    }
    function stop() { clearInterval(tick); try { if (mr && mr.state !== 'inactive') mr.stop(); } catch (e) { toNoMic(); } }

    function draw() {
      box.innerHTML = '';
      var b, row;
      if (st === 'idle') {
        b = el('button', 'mic', '🎤 ' + (opts.sayLabel || '按一下，开始说'));
        b.type = 'button'; b.addEventListener('click', start); box.appendChild(b);
        var l = el('button', 'link', '用不了麦克风？改为不录音'); l.type = 'button';
        l.style.marginTop = '6px'; l.addEventListener('click', toNoMic);
        var hintRow = el('div', 'hint'); hintRow.appendChild(l); box.appendChild(hintRow);
      } else if (st === 'asking') {
        box.appendChild(el('div', 'hint', '正在请求麦克风…… 请在弹出的提示里点「允许」。'));
        var l2 = el('button', 'link', '没有弹出提示？改为不录音'); l2.type = 'button'; l2.addEventListener('click', toNoMic); box.appendChild(l2);
      } else if (st === 'rec') {
        b = el('button', 'mic on', '■ 说完了，点这里停止　<span class="sec">0 秒</span>');
        b.type = 'button'; b.addEventListener('click', stop); box.appendChild(b);
      } else if (st === 'done') {
        row = el('div');
        row.appendChild(playBtn('▶ 我的录音', function () { return rec.url; }, 'coral'));
        addModel(row);
        var again = el('button', 'pill sm', '↻ 重录'); again.type = 'button';
        again.addEventListener('click', function () { st = 'idle'; draw(); start(); }); row.appendChild(again);
        box.appendChild(row);
        if (rec && rec.silent) box.appendChild(el('div', 'fb bad', '这段录音里几乎没有声音。靠近话筒，大声再说一次（点「重录」）。'));
        else if (modelSrc()) box.appendChild(el('div', 'hint', '先听自己的，再听示范，找找哪里不一样。'));
      } else if (st === 'nomic') {
        box.appendChild(el('div', 'hint', '🎤 这里没拿到麦克风（微信里常见）。不影响学习：<b>大声说出来</b>，再点下面的按钮。'));
        b = el('button', 'mic', '我说完了'); b.type = 'button'; b.style.marginTop = '8px';
        b.addEventListener('click', function () { st = 'said'; draw(); done(null); }); box.appendChild(b);
      } else if (st === 'said') {
        row = el('div');
        row.appendChild(el('span', 'tag g', '✓ 已开口（未录音）'));
        addModel(row);
        box.appendChild(row);
      }
    }
    draw();
    return api;
  }

  /* ---------------- 导航 ---------------- */
  var ORDER = ['learn', 'practice', 'talk', 'game', 'pass'];
  function go(id) {
    stopAudio();
    var v = $('#vid'); if (v && !v.paused) { try { v.pause(); } catch (e) {} }
    Game.pause();
    state.cur = id; state.visited[id] = true;
    $$('.step').forEach(function (s) { s.classList.toggle('on', s.id === 's-' + id); });
    $$('#stepper button').forEach(function (b) {
      var k = b.getAttribute('data-go'), i = ORDER.indexOf(k), c = ORDER.indexOf(id);
      b.classList.toggle('cur', k === id);
      b.classList.toggle('done', c > i && c >= 0);
    });
    window.scrollTo(0, 0);
    if (id === 'talk') Talk.enter();
    if (id === 'game') Game.enter();
    if (id === 'pass') Pass.render();
  }
  document.addEventListener('click', function (e) {
    var t = e.target;
    while (t && t !== document) {
      if (t.getAttribute && t.getAttribute('data-go')) { e.preventDefault(); go(t.getAttribute('data-go')); return; }
      t = t.parentNode;
    }
  });

  /* ---------------- ① 课文 ---------------- */
  var DIALOG = [
    { who: 'Leo', c: 'd1_leo', en: 'Hi Mia! Tomorrow is Saturday. What shall we do?', zh: '嗨 Mia！明天周六，我们干点什么？' },
    { who: 'Mia', c: 'd2_mia', en: '<span class="op">I think we should go to the park,</span> <span class="rs">because the weather is nice.</span>', zh: '我觉得我们应该去公园，因为天气很好。' },
    { who: 'Leo', c: 'd3_leo', en: 'Good idea! What shall we do there?', zh: '好主意！到那儿做什么？' },
    { who: 'Mia', c: 'd4_mia', en: '<span class="op">I’d like to ride bikes,</span> <span class="rs">because it’s good exercise.</span> What about you?', zh: '我想骑车，因为能好好锻炼。你呢？' },
    { who: 'Leo', c: 'd5_leo', en: '<span class="op">I prefer flying a kite,</span> <span class="rs">because it’s windy this week.</span>', zh: '我更喜欢放风筝，因为这周风大。' },
    { who: 'Mia', c: 'd6_mia', en: 'OK! Let’s do both!', zh: '好！那就两样都玩！' }
  ];
  function renderDialog() {
    var host = $('#dlg'); host.innerHTML = '';
    host.appendChild(el('div', 'sub', '<span class="tag o">观点</span><span class="tag r">理由</span>颜色标出了每句话的两半。'));
    DIALOG.forEach(function (d) {
      var row = el('button', 'line'); row.type = 'button'; row.style.width = '100%'; row.style.textAlign = 'left';
      row.innerHTML = '<img class="av" src="assets/img/' + d.who.toLowerCase() + '.jpg" alt="' + d.who + '"><span class="bub en"><span class="who">' + d.who + ' ▶</span>' + d.en + '<small class="zh hide">' + d.zh + '</small></span>';
      row.addEventListener('click', function () { play(clip(d.c), row); });
      host.appendChild(row);
    });
    $('#zhToggle').addEventListener('click', function () { $$('#dlg .zh').forEach(function (z) { z.classList.toggle('hide'); }); });
  }

  /* ---------------- ② 分步练 ---------------- */
  var SHADOW = [
    { c: 'sh1', en: '<span class="op">I think we should go to the park,</span> <span class="rs">because the weather is nice.</span>', zh: '我觉得我们应该去公园，因为天气很好。' },
    { c: 'sh2', en: '<span class="op">I’d like to ride bikes,</span> <span class="rs">because it’s good exercise.</span>', zh: '我想骑车，因为能好好锻炼。' }
  ];
  function renderShadow() {
    var host = $('#shadow'); host.innerHTML = '';
    SHADOW.forEach(function (s, i) {
      var b = el('div'); b.style.borderTop = i ? '1px dashed var(--line)' : '0'; b.style.paddingTop = i ? '10px' : '0'; b.style.marginTop = i ? '10px' : '0';
      b.appendChild(el('p', 'en', '<b style="font-size:17px;font-weight:600">' + s.en + '</b><br><span class="sub">' + s.zh + '</span>'));
      var row = el('div');
      row.appendChild(playBtn('▶ 示范', clip(s.c)));
      row.appendChild(playBtn('🐢 慢速', clip(s.c + '_slow')));
      b.appendChild(row);
      Recorder(b, { model: s.c, sayLabel: '按一下，跟着说' });
      host.appendChild(b);
    });
  }

  var QUIZ = [
    { type: 'choice', q: 'Leo 问：<b class="en">What shall we do on Sunday?</b><br>哪个回答有「观点 + 理由」？',
      opts: [
        { t: 'Swimming.', ok: false, fb: '只有一个词：没有观点句，也没有理由，对话接不下去。' },
        { t: 'I think we should go swimming, because it’s very hot.', ok: true, fb: '对。I think … 是观点，because … 是理由，两半都有。' },
        { t: 'Because it’s hot.', ok: false, fb: '只有理由，没说想做什么。' }] },
    { type: 'choice', q: '接上合适的理由：<br><b class="en">I’d like to stay at home today, because …</b>',
      opts: [
        { t: 'the park is beautiful.', ok: false, fb: '这是「去公园」的理由，和 stay at home 接不上。' },
        { t: 'it’s raining hard.', ok: true, fb: '对。雨下得大，所以想待在家，理由和观点接得上。' },
        { t: 'I think so.', ok: false, fb: '「因为我这么想」等于没给理由。' }] },
    { type: 'part', q: '点一下这句话里的<b>理由</b>：', parts: ['I prefer the cartoon,', 'because it’s really funny.'], ok: 1,
      fbOk: '对。because 后面这半句是理由。', fbBad: '这半句是观点（I prefer …）。理由在 because 后面。' },
    { type: 'order', q: '按顺序点词块，拼成完整的回答：', tiles: ['because', 'it’s good exercise.', 'I think we should', 'play football,'],
      answer: ['I think we should', 'play football,', 'because', 'it’s good exercise.'],
      fbOk: '对。先观点，再 because，再理由。大声读一遍。', fbBad: '顺序不对：先说观点（I think we should …），再接 because 和理由。再试一次。' }
  ];
  var quizI = 0, quizWrong = 0;
  var askHold = 0;
  function nudgeAsk() { var a = $('#askBtn'); askHold = Date.now() + 4000; a.classList.remove('mini'); a.classList.remove('nudge'); void a.offsetWidth; a.classList.add('nudge'); }
  function stuckHint(host) {
    quizWrong++;
    if (quizWrong >= 2 && !$('.stuck', host)) {
      var s = el('div', 'fb bad stuck', '这题卡住了？可以 <button class="link" type="button">问老师</button>，老师只讲这一个卡点。');
      $('button', s).addEventListener('click', function () { Ask.open('第 2 小步第 ' + (quizI + 1) + ' 题'); });
      host.appendChild(s); nudgeAsk();
    }
  }
  function renderQuiz() {
    var host = $('#quiz'); host.innerHTML = '';
    var dots = el('div', 'dots');
    QUIZ.forEach(function (_, i) { dots.appendChild(el('i', i < quizI ? 'd' : (i === quizI ? 'c' : ''))); });
    host.appendChild(dots);
    if (quizI >= QUIZ.length) {
      host.appendChild(el('div', 'fb ok', '✓ 4 题都做完了。你已经能分清观点和理由，下一小步自己说。'));
      var re = el('button', 'link', '再做一遍'); re.type = 'button'; re.addEventListener('click', function () { quizI = 0; renderQuiz(); }); host.appendChild(re);
      return;
    }
    quizWrong = 0;
    var Q = QUIZ[quizI];
    host.appendChild(el('p', '', '<b>第 ' + (quizI + 1) + ' / ' + QUIZ.length + ' 题</b>　' + Q.q));
    var fb = el('div'); var next = el('button', 'btn teal hide', quizI === QUIZ.length - 1 ? '完成 ✓' : '下一题 →'); next.type = 'button';
    next.addEventListener('click', function () { addPts(quizWrong ? 5 : 10); quizI++; renderQuiz(); });

    if (Q.type === 'choice') {
      Q.opts.forEach(function (o) {
        var b = el('button', 'opt en', o.t); b.type = 'button';
        b.addEventListener('click', function () {
          if (o.ok) { b.classList.add('ok'); $$('.opt', host).forEach(function (x) { x.disabled = true; }); fb.innerHTML = '<div class="fb ok">✓ ' + o.fb + '</div>'; next.classList.remove('hide'); }
          else { b.classList.add('bad'); b.disabled = true; fb.innerHTML = '<div class="fb bad">✗ ' + o.fb + ' 再选一次。</div>'; stuckHint(host); }
        });
        host.appendChild(b);
      });
    } else if (Q.type === 'part') {
      Q.parts.forEach(function (p, i) {
        var b = el('button', 'opt en', p); b.type = 'button';
        b.addEventListener('click', function () {
          if (i === Q.ok) { b.classList.add('ok'); $$('.opt', host).forEach(function (x) { x.disabled = true; }); fb.innerHTML = '<div class="fb ok">✓ ' + Q.fbOk + '</div>'; next.classList.remove('hide'); }
          else { b.classList.add('bad'); b.disabled = true; fb.innerHTML = '<div class="fb bad">✗ ' + Q.fbBad + '</div>'; stuckHint(host); }
        });
        host.appendChild(b);
      });
    } else if (Q.type === 'order') {
      var picked = [];
      var slot = el('div', 'slot en'); var pool = el('div', 'tiles en');
      var resetB = el('button', 'link', '清空重拼'); resetB.type = 'button';
      function drawOrder() {
        slot.innerHTML = picked.length ? '' : '<span class="sub" style="padding:0 8px">点下面的词块</span>';
        picked.forEach(function (p) { slot.appendChild(el('span', 'tile', p)); });
        $$('.tile', pool).forEach(function (t) { t.classList.toggle('used', picked.indexOf(t.textContent) >= 0); });
        if (picked.length === Q.tiles.length) {
          if (picked.join('|') === Q.answer.join('|')) { fb.innerHTML = '<div class="fb ok">✓ ' + Q.fbOk + '</div>'; next.classList.remove('hide'); resetB.classList.add('hide'); }
          else { fb.innerHTML = '<div class="fb bad">✗ ' + Q.fbBad + '</div>'; stuckHint(host); setTimeout(function () { picked = []; drawOrder(); }, 900); }
        }
      }
      Q.tiles.forEach(function (t) {
        var b = el('button', 'tile', t); b.type = 'button';
        b.addEventListener('click', function () { if (picked.length < Q.tiles.length) { picked.push(t); if (picked.length < Q.tiles.length) fb.innerHTML = ''; drawOrder(); } });
        pool.appendChild(b);
      });
      resetB.addEventListener('click', function () { picked = []; fb.innerHTML = ''; drawOrder(); });
      host.appendChild(slot); host.appendChild(pool); host.appendChild(resetB); drawOrder();
    }
    host.appendChild(fb); host.appendChild(next);
  }

  var CUESAY = [
    { e1: '🏊', k1: 'go swimming', e2: '☀️', k2: 'very hot today', frame: 'I think we should <u></u>, because <u></u>.', sample: '<span class="op">I think we should go swimming,</span> <span class="rs">because it’s very hot today.</span>', c: 's_swim' },
    { e1: '🍕', k1: 'make pizza', e2: '😋', k2: 'really hungry', frame: 'I’d like to <u></u>, because <u></u>.', sample: '<span class="op">I’d like to make pizza,</span> <span class="rs">because I’m really hungry.</span>', c: 's_pizza' }
  ];
  function renderCueSay() {
    var host = $('#cuesay'); host.innerHTML = '';
    CUESAY.forEach(function (c, i) {
      var b = el('div'); b.style.borderTop = i ? '1px dashed var(--line)' : '0'; b.style.paddingTop = i ? '10px' : '0'; b.style.marginTop = i ? '10px' : '0';
      b.appendChild(el('div', 'cue en', '<b>' + c.e1 + '</b><span>' + c.k1 + '</span><i>+</i><b>' + c.e2 + '</b><span>' + c.k2 + '</span>'));
      b.appendChild(el('div', 'frame en', c.frame));
      var ans = el('div', 'hide');
      ans.appendChild(el('p', 'en', '<span class="sub">参考答案：</span><br><b style="font-weight:600">' + c.sample + '</b>'));
      ans.appendChild(playBtn('▶ 听参考答案', clip(c.c)));
      ans.appendChild(el('div', 'hint sub', '对一对：你说了观点吗？说了 because 和理由吗？意思对、句子完整就算过，不必一字不差。'));
      var show = el('button', 'link hide', '看参考答案'); show.type = 'button';
      show.addEventListener('click', function () { ans.classList.remove('hide'); show.classList.add('hide'); });
      Recorder(b, { sayLabel: '按一下，自己说整句', onDone: function () { show.classList.remove('hide'); } });
      b.appendChild(show); b.appendChild(ans);
      host.appendChild(b);
    });
  }

  /* ---------------- ③ 情景对练 ---------------- */
  var T = {
    r1: { leo: 'leo_r1', en: 'Hi! Tomorrow is Saturday. What shall we do?', zh: '嗨！明天周六，我们干点什么？',
      cues: ['🌳 park · nice weather', '🎬 film · new cartoon'],
      opts: [
        { id: 'r1a', o: 'I think we should go to the park,', r: 'because the weather is nice.', model: 'm_r1a', next: 'r2p', scene: 'park' },
        { id: 'r1b', o: 'I’d like to watch a film,', r: 'because there’s a new cartoon this week.', model: 'm_r1b', next: 'r2c', scene: 'cinema' },
        { id: 'r1c', short: 'Let’s go to the park.', why: { leo: 'leo_r1_why', en: 'The park? Hmm. Why the park?', zh: '公园？嗯……为什么去公园？',
          fix: [{ t: 'Because I think so.', ok: false, fb: '「因为我这么想」不算理由，Leo 还是不知道为什么。' }, { t: 'Because the weather is nice.', ok: true }, { t: 'Because park.', ok: false, fb: 'because 后面要接一个完整的小句子（谁 / 什么 + 怎么样）。' }], then: 'r1a' } }] },
    r2p: { leo: 'leo_r2p', en: 'Good idea! What shall we do there: ride bikes, or fly a kite?', zh: '好主意！到那儿做什么：骑车，还是放风筝？',
      cues: ['🚲 bikes · good exercise', '🪁 kite · windy'],
      opts: [
        { id: 'r2pa', o: 'I prefer riding bikes,', r: 'because it’s good exercise.', model: 'm_r2pa', next: 'ice' },
        { id: 'r2pb', o: 'I’d like to fly a kite,', r: 'because it’s windy today.', model: 'm_r2pb', next: 'ice' },
        { id: 'r2pc', short: 'Bikes.', why: { leo: 'leo_r2p_why', en: 'Bikes? Why do you like bikes?', zh: '骑车？你为什么喜欢骑车？',
          fix: [{ t: 'Because it’s good exercise.', ok: true }, { t: 'Because bikes are bikes.', ok: false, fb: '这句是在绕圈，没有说出骑车好在哪儿。' }, { t: 'Because I like.', ok: false, fb: '句子不完整（like 后面缺东西），而且「因为我喜欢」没解释为什么喜欢。' }], then: 'r2pa' } }] },
    r2c: { leo: 'leo_r2c', en: 'Nice! Which film shall we see: the cartoon, or the space film?', zh: '不错！看哪部：动画片，还是太空片？',
      cues: ['😂 cartoon · really funny', '🪐 space film · love planets'],
      opts: [
        { id: 'r2ca', o: 'I’d like to see the cartoon,', r: 'because it’s really funny.', model: 'm_r2ca', next: 'ice' },
        { id: 'r2cb', o: 'I prefer the space film,', r: 'because I love learning about planets.', model: 'm_r2cb', next: 'ice' },
        { id: 'r2cc', short: 'The cartoon.', why: { leo: 'leo_r2c_why', en: 'The cartoon? Why?', zh: '动画片？为什么？',
          fix: [{ t: 'Because it’s a cartoon.', ok: false, fb: '这句是在绕圈，没有说出动画片好在哪儿。' }, { t: 'Because yes.', ok: false, fb: 'because 后面要接一个完整的小句子。' }, { t: 'Because it’s really funny.', ok: true }], then: 'r2ca' } }] },
    ice: { leo: 'leo_ice', en: 'Great! And after that, let’s get some ice cream. What do you think?', zh: '太好了！然后我们去吃冰淇淋吧。你觉得呢？',
      lead: '这一轮换 Leo 提主意。你要表态：同意、不同意都行，但都要给理由；不同意时再提一个新建议。',
      cues: ['👍 That’s a good idea, because …', '🤔 I’m not sure, because … How about …?'],
      opts: [
        { id: 'icea', o: 'That’s a good idea,', r: 'because I love ice cream!', model: 'm_ice_a', next: 'r4a', oTag: '表态 ✓' },
        { id: 'iceb', o: 'I’m not sure,', r: 'because I had ice cream yesterday.', tail: 'How about some juice?', tailTag: '新建议 ✓', model: 'm_ice_b', next: 'r4b', oTag: '表态 ✓' },
        { id: 'icec', short: 'No.', oTag: '表态 ✓', why: { leo: 'leo_ice_why', en: 'No? Why not?', zh: '不要？为什么不要？',
          fix: [{ t: 'Because no.', ok: false, fb: 'because 后面要接一个完整的小句子，说出原因。' }, { t: 'Because I had ice cream yesterday.', ok: true }, { t: 'Because I not like.', ok: false, fb: '句子有语法错误（应为 I don’t like it），而且「不喜欢」也没说出原因。' }], then: 'iceb' } }] }
  };
  var TIME_OPTS = [
    { id: 'r3a', o: 'I think the morning is better,', r: 'because it’s not so hot.', tail: 'What about you?', model: 'm_r3a', end: 'am' },
    { id: 'r3b', o: 'I prefer the afternoon,', r: 'because I get up late on Saturdays.', tail: 'Is that OK?', model: 'm_r3b', end: 'pm' },
    { id: 'r3c', short: 'In the morning.', why: { leo: 'leo_r3_why', en: 'The morning? Why?', zh: '上午？为什么？',
      fix: [{ t: 'Because morning is morning.', ok: false, fb: '这句是在绕圈，没有说出上午好在哪儿。' }, { t: 'Because it’s not so hot.', ok: true }, { t: 'Because I say so.', ok: false, fb: '「我说了算」不是理由，朋友之间商量要讲原因。' }], then: 'r3a' } }];
  var TIME_CUES = ['🌅 morning · not so hot', '🌇 afternoon · get up late', '↩️ 说完反问一句'];
  T.r4a = { leo: 'leo_r4_a', en: 'Yay, ice cream it is! Now, shall we meet in the morning, or in the afternoon?', zh: '好耶，就吃冰淇淋！那我们上午见，还是下午见？', cues: TIME_CUES, opts: TIME_OPTS };
  T.r4b = { leo: 'leo_r4_b', en: 'Juice? OK, that sounds good too. Now, shall we meet in the morning, or in the afternoon?', zh: '果汁？行，也不错。那我们上午见，还是下午见？', cues: TIME_CUES, opts: TIME_OPTS };
  var ENDS = { am: { leo: 'leo_end_am', en: 'Morning is fine with me. See you at nine!', zh: '上午我没问题。九点见！' }, pm: { leo: 'leo_end_pm', en: 'Sure, the afternoon is fine. See you at two!', zh: '行，下午可以。两点见！' } };
  /* 预置的纠音提示：按孩子走的分支挑两条 */
  var TIPS = {
    r1a: { w: 'think', ipa: '/θɪŋk/', tip: '舌尖轻轻放在上下齿之间送气，别读成 sink。' },
    r1b: { w: 'film', ipa: '/fɪlm/', tip: 'l 和 m 连着读，中间不要加元音，别读成 “fi-lem”。' },
    r2pa: { w: 'exercise', ipa: '/ˈeksərsaɪz/', tip: '重音在第一个音节 EX-，后面读轻。' },
    r2pb: { w: 'windy', ipa: '/ˈwɪndi/', tip: '开头是圆唇的 /w/，不要咬唇读成 /v/。' },
    r2ca: { w: 'cartoon', ipa: '/kɑːrˈtuːn/', tip: '重音在后面 -TOON，/uː/ 拉长。' },
    r2cb: { w: 'planets', ipa: '/ˈplænɪts/', tip: '/æ/ 嘴张大；结尾 /ts/ 轻而短。' },
    icea: { w: 'that’s', ipa: '/ðæts/', tip: '开头是浊音 /ð/：舌尖放在齿间并振动声带，别读成 /z/ 或 /d/。' },
    iceb: { w: 'juice', ipa: '/dʒuːs/', tip: '结尾是清音 /s/，别拖成 /z/。' },
    r3a: { w: 'because', ipa: '/bɪˈkʌz/', tip: '重音在后面 -CAUSE，结尾是浊音 /z/，不是 /s/。' },
    r3b: { w: 'Saturdays', ipa: '/ˈsætərdeɪz/', tip: '重音在最前面 SAT-，中间的 -ur- 读得很轻。' }
  };

  var Talk = {
    started: false, turns: [], node: null, recs: {},
    enter: function () { if (!this.started) this.intro(); },
    intro: function () {
      var self = this;
      $('#chat').innerHTML = ''; $('#scoreHost').innerHTML = '';
      $('#sceneImg').src = 'assets/img/school.jpg'; $('#sceneCap').textContent = '周五放学 · 校门口';
      var p = $('#talkPanel'); p.innerHTML = '';
      var c = el('div', 'panel');
      c.innerHTML = '<h3>怎么玩</h3><p class="sub" style="margin:0">一共 4 轮，最后再把计划连起来讲一遍。每轮 Leo 先问，你用「<span class="op">观点</span> + because + <span class="rs">理由</span>」开口回答；第 3 轮 Leo 会提一个主意，你要表态（同意或不同意）并给理由。先开口，说完才出现选项，点你说的那句，Leo 会接着你的话往下聊。</p>';
      var b = el('button', 'btn', '开始对练（点一下，Leo 开口）'); b.type = 'button';
      b.addEventListener('click', function () { self.started = true; self.turns = []; self.recs = {}; self.ask('r1'); });
      c.appendChild(b); p.appendChild(c);
    },
    bubble: function (who, html, zh, clipName, autoplay) {
      var row = el('div', 'line' + (who === 'me' ? ' me' : ''));
      var av = who === 'me' ? '<span class="av">我</span>' : '<img class="av" src="assets/img/leo.jpg" alt="Leo">';
      row.innerHTML = av + '<span class="bub en">' + (who === 'me' ? '' : '<span class="who">Leo</span>') + html + (zh ? '<small>' + zh + '</small>' : '') + '</span>';
      $('#chat').appendChild(row);
      if (clipName) {
        var pb = playBtn('▶ 再听一遍', clip(clipName), 'sm'); pb.style.margin = '6px 0 0';
        var pw = el('div'); pw.appendChild(pb); $('.bub', row).appendChild(pw);
        if (autoplay) play(clip(clipName), pb);
      }
      return row;
    },
    scroll: function (node) { setTimeout(function () { try { node.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { node.scrollIntoView(); } }, 60); },
    ask: function (key) {
      var self = this, N = T[key]; self.node = key;
      var turnNo = self.turns.length + 1;
      $('#chat').appendChild(el('div', 'sys', '— 第 ' + turnNo + ' / 4 轮 —'));
      self.bubble('leo', N.en, N.zh, N.leo, true);
      var p = $('#talkPanel'); p.innerHTML = '';
      var c = el('div', 'panel');
      c.appendChild(el('h3', '', '轮到你：<span class="op">观点</span> + because + <span class="rs">理由</span>'));
      if (N.lead) c.appendChild(el('div', 'fb ok', N.lead));
      c.appendChild(el('div', 'sub', N.lead ? '可以这样开头（后半句自己说）：' : '想法提示（只给关键词，句子自己组）：'));
      var cues = el('div', 'cues en'); N.cues.forEach(function (x) { cues.appendChild(el('span', '', x)); }); c.appendChild(cues);
      var pick = el('div', 'hide');
      var turn = { key: key, first: true, rec: null };
      Recorder(c, { sayLabel: '按一下，开口回答 Leo', maxSec: 15, onDone: function (r) { turn.rec = r; pick.classList.remove('hide'); self.scroll(pick); } });
      pick.appendChild(el('p', '', '<b>你刚才说的是哪一句？</b>点最接近的：'));
      shuffle(N.opts).forEach(function (o) {
        var txt = o.short ? o.short : (o.o + ' ' + o.r + (o.tail ? ' ' + o.tail : ''));
        var b = el('button', 'opt en', txt); b.type = 'button';
        b.addEventListener('click', function () { self.answer(turn, o); });
        pick.appendChild(b);
      });
      pick.appendChild(el('div', 'note', '样本演示：正式版由 AI 听懂孩子说的话，不需要点选。'));
      c.appendChild(pick);
      p.appendChild(c);
      self.scroll(c);
    },
    answer: function (turn, o) {
      var self = this, p = $('#talkPanel');
      stopAudio();
      if (o.short) {
        /* 只说了观点 / 一个词：Leo 追问 Why */
        turn.first = false;
        self.bubble('me', o.short + '<br><span class="tag o">' + (o.oTag || '观点 ✓') + '</span><span class="tag x">理由 ✗ 没说</span>');
        self.bubble('leo', o.why.en, o.why.zh, o.why.leo, true);
        p.innerHTML = '';
        var c = el('div', 'panel');
        c.appendChild(el('h3', '', 'Leo 追问了：补上你的理由'));
        c.appendChild(el('div', 'sub', '只说半句，朋友就得追着问。选一个说得通的理由，大声说出来：'));
        var fb = el('div'); var wrong = 0;
        o.why.fix.forEach(function (f) {
          var b = el('button', 'opt en', f.t); b.type = 'button';
          b.addEventListener('click', function () {
            if (f.ok) {
              var full = null; T[turn.key].opts.forEach(function (x) { if (x.id === o.why.then) full = x; });
              self.bubble('me', '<span class="rs">' + f.t + '</span><br><span class="tag r">理由 ✓ 补上了</span>');
              self.afterGood(turn, full, true);
            } else {
              b.classList.add('bad'); b.disabled = true; wrong++;
              fb.innerHTML = '<div class="fb bad">✗ ' + f.fb + '</div>';
              if (wrong >= 2) { var s = el('div', 'fb bad', '卡住了？可以 <button class="link" type="button">问老师</button>。'); $('button', s).addEventListener('click', function () { Ask.open('对练：补理由'); }); fb.appendChild(s); nudgeAsk(); }
            }
          });
          c.appendChild(b);
        });
        c.appendChild(fb);
        p.appendChild(c); self.scroll(c);
      } else {
        self.bubble('me', '<span class="op">' + o.o + '</span> <span class="rs">' + o.r + '</span>' + (o.tail ? ' ' + o.tail : '') + '<br><span class="tag o">' + (o.oTag || '观点 ✓') + '</span><span class="tag r">理由 ✓</span>' + (o.tail ? '<span class="tag g">' + (o.tailTag || '反问 ✓') + '</span>' : ''));
        self.afterGood(turn, o, false);
      }
    },
    afterGood: function (turn, o, fixed) {
      var self = this, p = $('#talkPanel');
      turn.opt = o; self.turns.push(turn); addPts(fixed ? 10 : 20);
      if (o.scene) { $('#sceneImg').src = 'assets/img/' + o.scene + '.jpg'; $('#sceneCap').textContent = o.scene === 'park' ? '周六计划 · 公园' : '周六计划 · 电影院'; }
      p.innerHTML = '';
      var c = el('div', 'panel');
      if (fixed) {
        c.appendChild(el('div', 'fb bad', '这一轮是被追问后才补上理由的。下次一口气说完：'));
        c.appendChild(el('p', 'en', '<b style="font-weight:600"><span class="op">' + o.o + '</span> <span class="rs">' + o.r + '</span>' + (o.tail ? ' ' + o.tail : '') + '</b>'));
      } else {
        c.appendChild(el('div', 'fb ok', '✓ 观点和理由都说到了，Leo 听懂了你的想法。'));
      }
      var row = el('div');
      if (turn.rec) row.appendChild(playBtn('▶ 我的录音', turn.rec.url, 'coral'));
      row.appendChild(playBtn('▶ 示范', clip(o.model)));
      c.appendChild(row);
      c.appendChild(el('div', 'sub', turn.rec ? '对比着听：先听自己，再听示范。' : '听一遍示范，跟着再说一次。'));
      var last = !!o.end;
      var b = el('button', 'btn', last ? '听 Leo 怎么说 →' : '下一轮 →'); b.type = 'button';
      b.addEventListener('click', function () { if (last) self.finish(o.end); else self.ask(o.next); });
      c.appendChild(b);
      p.appendChild(c); self.scroll(c);
    },
    finish: function (endKey) {
      var self = this, E = ENDS[endKey], p = $('#talkPanel');
      self.bubble('leo', E.en, E.zh, E.leo, true);
      $('#chat').appendChild(el('div', 'sys', '— 对话结束：周六的计划定下来了 —'));
      p.innerHTML = '';
      self.mono();
    },
    /* 日常话题阐述：把刚才商量好的计划连起来说 3–4 句，参考说法按孩子走的分支拼 */
    mono: function () {
      var self = this, p = $('#talkPanel'), ids = {};
      self.turns.forEach(function (t) { ids[t.opt.id] = true; });
      var what = ids.r2pa ? 'pa' : ids.r2pb ? 'pb' : ids.r2ca ? 'ca' : 'cb', snack = ids.icea ? 'a' : 'b', time = ids.r3a ? 'a' : 'b';
      var park = what.charAt(0) === 'p';
      var W = { pa: ['🚲 ride bikes', 'We’re going to ride bikes,', 'because it’s good exercise.'], pb: ['🪁 fly a kite', 'We’re going to fly a kite,', 'because it’s windy.'],
        ca: ['😂 a cartoon', 'We’re going to see a cartoon,', 'because it’s really funny.'], cb: ['🪐 a space film', 'We’re going to see a space film,', 'because I love learning about planets.'] }[what];
      var c = el('div', 'panel');
      c.appendChild(el('h3', '', '最后一步 · 连起来说 <span class="tag g">日常话题阐述</span>'));
      c.appendChild(el('div', 'sub', '回到家，妈妈问：<b class="en" style="color:var(--ink)">What are you doing on Saturday?</b><br>用 3–4 句话，把刚才和 Leo 商量好的计划讲给她听。这次没有人一句一句问你，要自己连着说。'));
      var cues = el('div', 'cues en');
      [(park ? '📍 the park' : '📍 the cinema') + ' · with Leo', W[0] + ' · because …', (snack === 'a' ? '🍦 ice cream' : '🧃 juice') + ' · after that', (time === 'a' ? '⏰ nine · morning' : '⏰ two · afternoon')].forEach(function (x) { cues.appendChild(el('span', '', x)); });
      c.appendChild(cues);
      c.appendChild(el('div', 'frame en sub', 'On Saturday, I’m going to … / We’re going to …, because … / After that, … / We’re meeting at …'));
      var ans = el('div', 'hide');
      ans.appendChild(el('p', 'en', '<span class="sub">参考说法（按你刚才的选择拼出来的）：</span><br><b style="font-weight:600">On Saturday, I’m going to ' + (park ? 'the park' : 'the cinema') + ' with Leo. <span class="op">' + W[1] + '</span> <span class="rs">' + W[2] + '</span> After that, we’re going to ' + (snack === 'a' ? 'get some ice cream' : 'have some juice') + '. We’re meeting at ' + (time === 'a' ? 'nine in the morning' : 'two in the afternoon') + '.</b>'));
      ans.appendChild(playBtn('▶ 听参考说法', clip('mono_' + what + '_' + snack + '_' + time)));
      ans.appendChild(el('div', 'sub', '自己对一对，说到了就点亮：'));
      var checks = el('div'); var got = 0;
      ['说了去哪儿、和谁', '说了做什么 + because 理由', '说了之后做什么、几点见'].forEach(function (t) {
        var b = el('button', 'pill sm', '○ ' + t); b.type = 'button';
        b.addEventListener('click', function () { if (b.classList.contains('playing')) return; b.classList.add('playing'); b.textContent = '✓ ' + t; got++; });
        checks.appendChild(b);
      });
      ans.appendChild(checks);
      ans.appendChild(el('div', 'note', '样本演示：这里是预置反馈，正式版接 AI。正式版由 AI 听这段话，判断说了几句、有没有理由、顺序清不清楚；样本里改为孩子对照参考说法自评。'));
      var go2 = el('button', 'btn', '看打分卡 →'); go2.type = 'button';
      go2.addEventListener('click', function () { stopAudio(); state.mono = true; self.monoGot = got; addPts(20); p.innerHTML = ''; self.score(); });
      ans.appendChild(go2);
      Recorder(c, { sayLabel: '按一下，连着说 3–4 句', maxSec: 45, onDone: function (r) { self.monoRec = r; ans.classList.remove('hide'); self.scroll(ans); } });
      c.appendChild(ans);
      p.appendChild(c); self.scroll(c);
    },
    score: function () {
      var self = this, host = $('#scoreHost'); host.innerHTML = '';
      var first = 0, ratios = [], tips = [], silent = 0, total = self.turns.length;
      self.turns.forEach(function (t) {
        if (t.first) first++;
        if (t.rec && t.rec.silent) silent++;
        else if (t.rec && DUR[t.opt.model]) ratios.push((t.rec.voiced != null ? t.rec.voiced : t.rec.dur) / Math.max(1, DUR[t.opt.model] - 0.9));
        if (TIPS[t.opt.id]) tips.push({ tip: TIPS[t.opt.id], model: t.opt.model });
      });
      var logic = [2, 2, 3, 4, 5][first];
      var logicTxt = first === total ? total + ' 轮都一口气说出了「观点 + 理由」，没有被追问。'
        : total + ' 轮里有 ' + first + ' 轮一次说全；另外 ' + (total - first) + ' 轮只说了半句，被 Leo 追问后才补上理由。';
      if (state.mono) logicTxt += ' 话题阐述：自评说到了 ' + (self.monoGot || 0) + ' / 3 项。';
      var flu, fluTxt, fluSrc;
      if (ratios.length) {
        var avg = ratios.reduce(function (a, b) { return a + b; }, 0) / ratios.length;
        flu = (avg >= 0.6 && avg <= 1.5) ? 5 : ((avg > 1.5 && avg <= 2.1) || (avg >= 0.4 && avg < 0.6)) ? 4 : 3;
        fluTxt = '你录音里有声音的部分，平均是示范的 ' + avg.toFixed(1) + ' 倍长。' + (avg > 1.5 ? '用时偏长，可能中间有重复或拖音；先把整句想好再开口。' : avg < 0.6 ? '有声部分偏短，可能没说完整句。' : '和示范接近。') + (silent ? ' 另有 ' + silent + ' 段录音几乎没有声音，没有计入。' : '');
        fluSrc = '<span class="src rule">规则粗算：只量了有声时长</span>';
      } else if (silent) {
        flu = 2; fluTxt = silent + ' 段录音里几乎没有声音，算不出流利度。靠近话筒再练一次。';
        fluSrc = '<span class="src rule">规则粗算：只量了有声时长</span>';
      } else {
        flu = 4; fluTxt = '这次没有录音，这里显示的是示例分。正式版按语速、停顿、重复来算。';
        fluSrc = '<span class="src pre">预置示例</span>';
      }
      state.talkDone = true; state.logicStars = logic;

      var card = el('div', 'score');
      card.innerHTML = '<h3>这一轮对练的打分卡</h3><div class="note" style="margin-top:4px">' + DEMO_NOTE + '。下面每一项都标了来源：<span class="src rule">规则</span>是按你刚才的作答当场算的，<span class="src pre">预置</span>是事先写好的样例。</div>'
        + '<div class="dim"><div class="n">逻辑<small>Logic</small></div><div class="v">' + stars(logic) + '<span class="src rule">规则：按你的作答</span><p>' + logicTxt + '</p></div></div>'
        + '<div class="dim"><div class="n">流利度<small>Fluency</small></div><div class="v">' + stars(flu) + fluSrc + '<p>' + fluTxt + '</p></div></div>'
        + '<div class="dim"><div class="n">发音<small>Pronunciation</small></div><div class="v">' + stars(4) + '<span class="src pre">预置示例</span><p>静态网页听不出发音，这一项是样例。正式版由 AI 逐音评测，并给出下面这样的纠音提示。</p></div></div>';
      var fixBox = el('div', 'dim'); fixBox.style.display = 'block';
      fixBox.appendChild(el('div', '', '<b style="font-size:15px">纠音提示</b><span class="src pre">预置示例：按你选的句子挑的</span><br><span class="sub" style="font-size:12px">音标按美式标，和示范配音一致。流利度那条规则只看「有声音的时间」，听不出说得对不对；正式版要靠语音识别和发音评测。</span>'));
      tips.slice(0, 2).forEach(function (x) {
        var f = el('div', 'fix en'); f.innerHTML = '<b>' + x.tip.w + '</b> <code>' + x.tip.ipa + '</code><br><span style="font-family:inherit">' + x.tip.tip + '</span><br>';
        f.appendChild(playBtn('▶ 听示范怎么读这句', clip(x.model), 'sm'));
        fixBox.appendChild(f);
      });
      card.appendChild(fixBox);
      host.appendChild(card);
      var again = el('button', 'btn ghost', '换一条分支再练一次'); again.type = 'button';
      again.addEventListener('click', function () { self.started = false; self.intro(); window.scrollTo(0, 0); });
      host.appendChild(again);
      var nx = el('button', 'btn', '去玩游戏 →'); nx.type = 'button'; nx.setAttribute('data-go', 'game');
      host.appendChild(nx);
      self.scroll(card);
    }
  };

  /* ---------------- ④ 游戏：拉票大作战 ---------------- */
  var ROUNDS = [
    { who: 'Amy', face: '👧', g: 'g', say: 'It’s raining hard today.', zh: '今天雨下得很大。', ops: ['watch a film at home', 'ride our bikes', 'have a picnic'], rs: ['we can stay dry', 'riding is good exercise', 'we can eat outside'], c: 'g1' },
    { who: 'Ben', face: '👦', g: 'b', say: 'I’m really hungry!', zh: '我好饿！', ops: ['have some sandwiches', 'play chess', 'go for a run'], rs: ['they are quick to make', 'it’s a quiet game', 'running is good for us'], c: 'g2' },
    { who: 'Tom', face: '🧒', g: 'b', say: 'I sat at my desk all day.', zh: '我在书桌前坐了一整天。', ops: ['play football', 'read a long book', 'watch TV'], rs: ['we need some exercise', 'the story is exciting', 'my favorite show is on'], c: 'g3' },
    { who: 'Lily', face: '👧', g: 'g', say: 'It’s so hot outside!', zh: '外面太热了！', ops: ['go swimming', 'run in the park', 'fly a kite'], rs: ['the water is cool', 'running keeps us fit', 'it’s windy today'], c: 'g4' },
    { who: 'Nina', face: '👧', g: 'g', say: 'Tomorrow is Grandma’s birthday.', zh: '明天是奶奶的生日。', ops: ['make a card', 'clean our bikes', 'play video games'], rs: ['Grandma loves handmade presents', 'they are very dirty', 'the new game is fun'], c: 'g5' }
  ];
  /* 每轮：ops[0] 是对得上同学情况的观点；rs[i] 是 ops[i] 的理由 */
  var ROUND_SEC = 25;
  var Game = {
    i: 0, votes: [], timer: null, left: 0, running: false, quick: 0,
    enter: function () { if (!this.running) this.intro(); },
    pause: function () { if (this.timer) { clearInterval(this.timer); this.timer = null; } if (this.running && state.cur === 'game') { /* 离开页面：本局作废 */ this.running = false; } },
    intro: function () {
      var self = this, host = $('#gameHost'); host.innerHTML = '';
      host.appendChild(el('p', '', '<b>玩法</b>：同学先说一句自己的情况（有声音）→ 你给他出主意：先选<span class="tag o">观点</span>再选<span class="tag r">理由</span>，拼成一句 <span class="en">I think we should …, because ….</span><br>观点要回应他的情况，理由要接得上观点。说服一位得一票，每轮 ' + ROUND_SEC + ' 秒。每一轮最后都要把整句亲口说出来（录音，或拿不到麦克风时点「我说完了」），才能去找下一位。'));
      if (state.gameVotes >= 0) host.appendChild(el('div', 'fb ' + (state.gameVotes >= 3 ? 'ok' : 'bad'), '上一局：' + state.gameVotes + ' / 5 票'));
      var b = el('button', 'btn', '开始拉票'); b.type = 'button';
      b.addEventListener('click', function () { self.i = 0; self.votes = []; self.quick = 0; self.running = true; self.round(); });
      host.appendChild(b);
    },
    bar: function () {
      var self = this, h = '<div class="gbar"><div class="ballots">';
      for (var k = 0; k < ROUNDS.length; k++) h += '<i class="' + (k < self.votes.length ? (self.votes[k] ? 'y' : 'n') : (k === self.i ? 'c' : '')) + '">' + (k < self.votes.length ? (self.votes[k] ? '✓' : '·') : '') + '</i>';
      h += '</div><span>已得 ' + self.votes.filter(Boolean).length + ' 票</span></div>';
      return h;
    },
    round: function () {
      var self = this, R = ROUNDS[self.i], host = $('#gameHost');
      var selO = -1, selR = -1, locked = false;
      host.innerHTML = self.bar() + '<div class="timer"><i id="tbar"></i></div>'
        + '<div class="mate"><b>' + R.face + '</b><div class="say en"><span class="who" style="font-size:11px;color:var(--muted);display:block">' + R.who + ' <button type="button" class="link" id="sayAgain" style="font-size:11px">▶ 再听</button></span>' + R.say + '<small>' + R.zh + '</small></div></div>'
        + '<div class="build en">I think we should <u class="o" id="bo">观点</u>, because <u class="r" id="br">理由</u>.</div>';
      var oBox = el('div'); oBox.appendChild(el('div', 'glabel', '<span class="tag o">观点</span>我们应该做什么？'));
      var oc = el('div', 'chips en'); oBox.appendChild(oc);
      var rBox = el('div'); rBox.appendChild(el('div', 'glabel', '<span class="tag r">理由</span>为什么？'));
      var rc = el('div', 'chips en'); rBox.appendChild(rc);
      var fb = el('div');
      shuffle([0, 1, 2]).forEach(function (k) {
        var b = el('button', 'chip o', R.ops[k]); b.type = 'button';
        b.addEventListener('click', function () { if (locked) return; selO = k; $$('.chip', oc).forEach(function (x) { x.classList.remove('sel'); }); b.classList.add('sel'); var u = $('#bo'); u.textContent = R.ops[k]; u.classList.add('f'); check(); });
        oc.appendChild(b);
      });
      shuffle([0, 1, 2]).forEach(function (k) {
        var b = el('button', 'chip r', R.rs[k]); b.type = 'button';
        b.addEventListener('click', function () { if (locked) return; selR = k; $$('.chip', rc).forEach(function (x) { x.classList.remove('sel'); }); b.classList.add('sel'); var u = $('#br'); u.textContent = R.rs[k]; u.classList.add('f'); check(); });
        rc.appendChild(b);
      });
      host.appendChild(oBox); host.appendChild(rBox); host.appendChild(fb);
      $('#sayAgain').addEventListener('click', function () { play(clip(R.c + 's')); });
      play(clip(R.c + 's'));

      self.left = ROUND_SEC;
      if (self.timer) clearInterval(self.timer);
      self.timer = setInterval(function () {
        if (Ask.isOpen) return; /* 问老师时暂停计时 */
        self.left -= 0.1;
        var t = $('#tbar'); if (t) { t.style.width = Math.max(0, self.left / ROUND_SEC * 100) + '%'; t.classList.toggle('low', self.left < 7); }
        if (self.left <= 0) settle(false, '⏰ 时间到，' + R.who + ' 没等到你的话。', true);
      }, 100);

      function check() { if (selO >= 0 && selR >= 0) setTimeout(function () { if (!locked) judge(); }, 350); }
      function judge() {
        var opOk = selO === 0, rOk = selR === selO;
        if (opOk && rOk) settle(true, '✓ 观点回应了 ' + R.who + ' 的情况，理由也接得上。');
        else if (opOk) settle(false, '✗ 观点对了，可是理由接不上：“' + R.rs[selR] + '” 说的不是 “' + R.ops[selO] + '”。');
        else if (rOk) settle(false, '✗ 句子本身通顺，可是没回应 ' + R.who + ' 说的话（' + R.zh + '）。');
        else settle(false, '✗ 观点没回应 ' + R.who + ' 的情况，理由和观点也接不上。');
      }
      function settle(win, msg, timeout) {
        if (locked) return; locked = true;
        clearInterval(self.timer); self.timer = null;
        self.votes.push(win);
        var quick = win && self.left > ROUND_SEC - 10;
        if (quick) self.quick++;
        if (win) addPts(quick ? 15 : 10);
        var full = 'I think we should ' + R.ops[0] + ', because ' + R.rs[0] + '.';
        fb.innerHTML = '<div class="fb ' + (win ? 'ok' : 'bad') + ' pop">' + msg + (win ? '<br><b class="en">' + R.who + ': “Good idea! You have my vote!”</b>' : '<br>能拿到这一票的说法：<b class="en">' + full + '</b>') + '</div>';
        var row = el('div');
        row.appendChild(playBtn('▶ 听这句', clip(R.c), 'sm'));
        fb.appendChild(row);
        fb.appendChild(el('div', 'sub', (win ? '票到手了。' : '这一票没拿到。') + '把这句亲口说给 ' + R.who + ' 听，才能去找下一位：'));
        var last = self.i === ROUNDS.length - 1;
        var b = el('button', 'btn teal hide', last ? '看结果 →' : '下一位同学 →'); b.type = 'button';
        b.addEventListener('click', function () { stopAudio(); if (last) self.result(); else { self.i++; self.round(); } });
        Recorder(fb, { model: R.c, sayLabel: '按一下，说给 ' + R.who + ' 听', maxSec: 12, onDone: function () {
          b.classList.remove('hide'); try { b.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {} } });
        fb.appendChild(b);
        var bar = $('.gbar', host); if (bar) bar.outerHTML = self.barAfter();
        if (!timeout) play(clip((win ? 'vote_yes_' : 'vote_no_') + R.g));
        try { fb.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
      }
    },
    barAfter: function () { var keep = this.i; this.i = -1; var h = this.bar(); this.i = keep; return h; },
    result: function () {
      var self = this, host = $('#gameHost'), n = self.votes.filter(Boolean).length, win = n >= 3;
      self.running = false; state.gameVotes = Math.max(state.gameVotes, n);
      host.innerHTML = self.barAfter()
        + '<div style="text-align:center;margin:14px 0"><div style="font-size:54px" class="pop">' + (win ? '🎉' : '🤔') + '</div>'
        + '<h3 style="font-size:20px">' + (win ? '当选！你拿到 ' + n + ' / 5 票' : '只拿到 ' + n + ' / 5 票，差一点当选') + '</h3>'
        + '<p class="sub">' + (win ? '观点回应了对方、理由接得上观点，别人才会被你说服。' + (self.quick ? '其中 ' + self.quick + ' 票是 10 秒内拿下的 ⚡' : '') : '看清同学说的情况，再选观点；理由要说的是你选的那件事。') + '</p></div>';
      var again = el('button', 'btn ghost', '再玩一局'); again.type = 'button';
      again.addEventListener('click', function () { self.i = 0; self.votes = []; self.quick = 0; self.running = true; self.round(); });
      host.appendChild(again);
      var nx = el('button', 'btn', win ? '去过关 →' : '先看过关条件 →'); nx.type = 'button'; nx.setAttribute('data-go', 'pass');
      host.appendChild(nx);
      window.scrollTo(0, 0);
    }
  };

  /* ---------------- ⑤ 过关 ---------------- */
  var Pass = {
    render: function () {
      var host = $('#passHost'); host.innerHTML = '';
      var okTalk = state.talkDone, okGame = state.gameVotes >= 3, okSpeak = state.spoken >= SPEAK_NEED, pass = okTalk && okGame && okSpeak;
      var c = el('div', 'card'); c.style.textAlign = 'center';
      c.innerHTML = '<div class="badge' + (pass ? ' pop' : ' off') + '"><b>🗣️</b><span class="en">Level 3 · 1</span></div>'
        + '<h3 style="font-size:20px">' + (pass ? '过关！徽章「有理有据」到手' : '还差一点就过关') + '</h3>'
        + '<p class="sub">' + (pass ? '你已经能在对话里说出观点，并用 because 给一个说得通的理由。' : '过关要三样都完成：') + '</p>'
        + '<p style="font-weight:700;margin:6px 0 0">本课积分 ⭐ ' + state.points + '</p>';
      host.appendChild(c);
      var k = el('div', 'card');
      k.innerHTML = '<h3>过关条件</h3>'
        + '<div class="check"><i>' + (okSpeak ? '✅' : '⬜') + '</i><span>开口：至少 ' + SPEAK_NEED + ' 次（现在 ' + state.spoken + ' 次）<br><small style="color:var(--muted)">有声音的录音算一次；拿不到麦克风时点「我说完了」也算一次，这种情况系统核实不了，正式版用语音识别确认。</small></span>' + (okSpeak ? '' : '<button class="pill sm" data-go="practice">去练</button>') + '</div>'
        + '<div class="check"><i>' + (okTalk ? '✅' : '⬜') + '</i><span>情景对练：和 Leo 聊完 4 轮，并把计划连起来讲一遍' + (okTalk ? '（逻辑 ' + state.logicStars + ' 星）' : '') + '</span>' + (okTalk ? '' : '<button class="pill sm" data-go="talk">去对练</button>') + '</div>'
        + '<div class="check"><i>' + (okGame ? '✅' : '⬜') + '</i><span>拉票大作战：拿到 3 票以上' + (state.gameVotes >= 0 ? '（最好成绩 ' + state.gameVotes + ' 票）' : '') + '</span>' + (okGame ? '' : '<button class="pill sm" data-go="game">去游戏</button>') + '</div>'
        + '<p class="note">过关线是样本里暂定的。正式版按阶段智能测评的结果来定，孩子没过就自动推同一层的换题重练。</p>';
      host.appendChild(k);
      var l = el('div', 'card');
      l.innerHTML = '<h3>在八级阶梯上的位置</h3>'
        + '<div class="stairs"><div class="dn" style="height:26%">L1</div><div class="dn" style="height:36%">L2</div><div class="cu" style="height:47%">L3</div><div style="height:57%">L4</div><div style="height:67%">L5</div><div style="height:77%">L6</div><div style="height:88%">L7</div><div style="height:100%">L8</div></div>'
        + '<div style="margin-top:10px"><div class="lvrow"><span class="k cu">本级</span><div><b>Level 3 情景对话 + 个人观点表达</b><small>' + (pass ? '第 1 课「观点 + 理由」已过关。' : '第 1 课进行中。') + '本级后面的课继续在不同情景里用它：点餐、选礼物、聊爱好、约时间……（样本只做了这一课）</small></div></div>'
        + '<div class="lvrow"><span class="k lk">下一级 🔒</span><div><b>Level 4 小型主题汇报（演讲雏形）</b><small>解锁后学 1–2 分钟 mini presentation、故事总结、利弊简单讨论，建立「开头-主体-结尾」表达框架。口语不跳级：Level 3 全部过关才开放。</small></div></div></div>';
      host.appendChild(l);
      var t = el('div', 'card');
      t.innerHTML = '<h3>老师这边会看到什么</h3><p class="sub" style="margin:0">这一课全程由系统带着走。陪练老师只收到两样：孩子点「问老师」时卡住的那一步，和这张过关记录（开口几次、对练几轮被追问、游戏几票）。<br><span class="note" style="display:block">样本演示：没有真的发送和存储，这里只说明设计。</span></p>';
      host.appendChild(t);
      var again = el('button', 'btn ghost', '从头再走一遍（清空记录）'); again.type = 'button';
      again.addEventListener('click', function () { Mic.release(); window.scrollTo(0, 0); window.location.reload(); });
      host.appendChild(again);
    }
  };

  /* ---------------- 问老师 ---------------- */
  var STEP_NAME = { home: '课程首页', learn: '① 看示范', practice: '② 分步练', talk: '③ 情景对练', game: '④ 游戏', pass: '⑤ 过关' };
  var Ask = {
    open: function (where) {
      var sheet = $('#askSheet'), mask = $('#askMask');
      var pos = where || STEP_NAME[state.cur];
      sheet.innerHTML = '<h3 style="font-size:18px">🙋 卡住了？问老师</h3>'
        + '<p class="sub">教学由系统完成，老师只在你卡住的时候答疑。系统会把你卡住的这一步带给陪练老师，老师只讲这一个点。</p>'
        + '<p style="margin:8px 0 2px"><b>卡在哪儿</b>：' + pos + '</p>'
        + '<div id="askWhy"></div>'
        + '<textarea id="askText" placeholder="也可以自己写一句，中文就行"></textarea>';
      var why = $('#askWhy', sheet);
      ['听不清对方说什么', '不知道理由怎么说', 'because 后面不会接', '发音没把握', '想法有，英语说不出来'].forEach(function (w) {
        var b = el('button', 'pill sm', w); b.type = 'button'; b.addEventListener('click', function () { b.classList.toggle('sel'); }); why.appendChild(b);
      });
      var send = el('button', 'btn', '发给老师'); send.type = 'button';
      send.addEventListener('click', function () {
        sheet.innerHTML = '<h3 style="font-size:18px">✓ 已记下你的卡点</h3><p>卡在：<b>' + pos + '</b></p>'
          + '<p class="note">样本演示：这里没有真的发出。正式版会把这一步（连同你的录音）发给陪练老师，老师回复后在这里提醒你。</p>'
          + '<p class="sub">不用等老师：可以先回到示范再听一遍，或者继续往下走。</p>';
        var ok = el('button', 'btn ghost', '继续学习'); ok.type = 'button'; ok.addEventListener('click', Ask.close); sheet.appendChild(ok);
      });
      sheet.appendChild(send);
      var cancel = el('button', 'btn ghost', '先不问了'); cancel.type = 'button'; cancel.addEventListener('click', Ask.close); sheet.appendChild(cancel);
      mask.classList.add('on'); Ask.isOpen = true;
    },
    isOpen: false,
    close: function () { $('#askMask').classList.remove('on'); Ask.isOpen = false; }
  };
  $('#askBtn').addEventListener('click', function () { Ask.open(); });
  window.addEventListener('scroll', function () { if (Date.now() < askHold) return; $('#askBtn').classList.toggle('mini', window.scrollY > 80); }, { passive: true });
  $('#askMask').addEventListener('click', function (e) { if (e.target === this) Ask.close(); });

  /* 视频播放时停掉别的声音 */
  var vid = $('#vid');
  if (vid) vid.addEventListener('play', stopAudio);

  /* ---------------- 启动 ---------------- */
  renderDialog(); renderShadow(); renderQuiz(); renderCueSay();
  window.__lesson = { go: go, state: state, Mic: Mic };
})();
