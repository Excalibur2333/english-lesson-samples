/* 写作样本 · KET 短邮件 · 一般过去时融入。纯前端，无外部依赖。 */
(function () {
  'use strict';

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function closest(n, sel) { while (n && n.nodeType === 1) { if (n.matches(sel)) return n; n = n.parentNode; } return null; }
  function wc(s) { return (s.match(/[A-Za-z']+/g) || []).length; }

  /* ---------- 声音 ---------- */
  var AC = null;
  function beep(kind) {
    try {
      if (!AC) { var C = window.AudioContext || window.webkitAudioContext; if (!C) return; AC = new C(); }
      if (AC.state === 'suspended') AC.resume();
      var seq = kind === 'ok' ? [[660, 0, 0.09], [880, 0.09, 0.14]] : kind === 'win' ? [[523, 0, 0.12], [659, 0.12, 0.12], [784, 0.24, 0.12], [1047, 0.36, 0.28]] : [[200, 0, 0.2]];
      seq.forEach(function (n) {
        var o = AC.createOscillator(), g = AC.createGain(), t0 = AC.currentTime + n[1];
        o.type = kind === 'bad' ? 'triangle' : 'sine'; o.frequency.value = n[0];
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + n[2]);
        o.connect(g); g.connect(AC.destination); o.start(t0); o.stop(t0 + n[2] + 0.03);
      });
    } catch (e) { /* 没有声音也不影响学习 */ }
  }
  var curAudio = null;
  function play(name) {
    try {
      if (curAudio) curAudio.pause();
      curAudio = new Audio('assets/audio/' + name + '.mp3');
      var p = curAudio.play(); if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }
  var toastT = null;
  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, 2600); }

  /* ---------- 步骤 ---------- */
  var STEPS = [
    { id: 'start', name: '开始' }, { id: 'video', name: '看视频' }, { id: 'read', name: '读范文' }, { id: 'imitate', name: '仿写' },
    { id: 'rewrite', name: '改写' }, { id: 'trans', name: '翻译' }, { id: 'write', name: '写邮件' }, { id: 'mark', name: '批改' },
    { id: 'game', name: '游戏' }, { id: 'pass', name: '过关' }
  ];
  var cur = 0, done = {}, inited = {};
  var ST = {
    read: { miss: 0 },
    imitate: { tries: 0, first: 0, done: 0, n: 3 }, rewrite: { tries: 0, first: 0, done: 0, n: 4 }, trans: { tries: 0, first: 0, done: 0, n: 3 },
    write: { tries: 0, firstErr: null, pastOk: [], final: '', passed: false },
    game: { right: 0, wrong: 0, best: 0, score: 0, stars: 0, secs: 0, played: 0 }, asks: 0
  };

  function renderProg() {
    var h = '';
    for (var i = 1; i < STEPS.length; i++) {
      var d = done[STEPS[i].id];
      h += '<li><button class="' + (i === cur ? 'cur' : (d ? 'done' : '')) + '" data-goto="' + i + '" aria-label="' + STEPS[i].name + '">' + (d && i !== cur ? '✓' : i) + '</button></li>';
    }
    $('#prog').innerHTML = h;
    $('#progT').textContent = cur === 0 ? '共 9 步 · 约 6 分钟' : '第 ' + cur + ' / 9 步 · ' + STEPS[cur].name;
  }
  function complete(id) {
    if (!done[id]) { done[id] = true; }
    $$('[data-need="' + id + '"]').forEach(function (b) { b.disabled = false; });
    renderProg();
  }
  var INIT = {}, ENTER = {};
  function go(i) {
    if (i < 0 || i >= STEPS.length) return;
    try { $('#vid').pause(); } catch (e) {}
    if (curAudio) { try { curAudio.pause(); } catch (e2) {} }
    gStop();
    cur = i;
    var id = STEPS[i].id;
    $$('.scr').forEach(function (s) { s.classList.remove('on'); });
    $('#s-' + id).classList.add('on');
    $('#map').style.display = (i === 0 || i === 9) ? '' : 'none';
    renderProg();
    window.scrollTo(0, 0);
    if (!inited[id]) { inited[id] = true; if (INIT[id]) INIT[id](); }
    if (ENTER[id]) ENTER[id]();
  }

  document.addEventListener('click', function (e) {
    var b;
    if ((b = closest(e.target, '[data-go="next"]'))) { if (b.disabled) return; var id = STEPS[cur].id; if (id === 'start' || id === 'video') complete(id); go(cur + 1); return; }
    if ((b = closest(e.target, '[data-skip]'))) { go(cur + 1); return; }
    if ((b = closest(e.target, '[data-goto]'))) { go(parseInt(b.getAttribute('data-goto'), 10)); return; }
    if ((b = closest(e.target, '[data-play]'))) { play(b.getAttribute('data-play')); return; }
    if ((b = closest(e.target, '[data-ask]'))) { openAsk(); return; }
  });

  var STUCK = '<div><button class="link" data-ask>连错两次了，可以问老师 🙋</button></div>';
  var TIN = 'display:block;width:100%;height:76px;resize:none;line-height:1.5;border:2px solid #C6CFDB;border-radius:12px;padding:8px 12px;font-family:Georgia,serif;font-size:18px;color:#1F3A5F;margin:4px 0 10px;outline:none;background:#fff';

  /* ---------- 第 2 步：读范文 ---------- */
  var MODEL = [
    { c: 'p1', t: 'Hi Ben,' },
    { c: 'p2', t: "Last Saturday I went to my grandma's farm." },
    { c: 'p2', t: 'We saw some baby chickens and picked apples.' },
    { c: 'p2', t: 'I had lunch in the garden. It was great!' },
    { c: 'p3', t: 'See you on Monday.' },
    { c: 'p3', t: 'Lily' }
  ];
  var VERBS = { went: 'go', saw: 'see', picked: 'pick', had: 'have', was: 'is' };
  INIT.read = function () {
    var box = $('#modelMail'), found = 0, misses = 0, fbN = $('#readFb');
    box.innerHTML = MODEL.map(function (L) {
      return '<p class="ln ' + L.c + '">' + L.t.split(' ').map(function (w) {
        return '<span class="w" data-k="' + w.toLowerCase().replace(/[^a-z']/g, '') + '">' + esc(w) + '</span>';
      }).join(' ') + '</p>';
    }).join('');
    box.addEventListener('click', function (e) {
      var w = closest(e.target, '.w'); if (!w || w.classList.contains('hit')) return;
      var k = w.getAttribute('data-k');
      if (VERBS[k]) {
        w.classList.add('hit'); w.parentNode.style.background = '';
        w.appendChild(el('small', '', VERBS[k] + ' → ' + k));
        found++; beep('ok');
        $('#readN').textContent = found + ' / 5';
        if (found === 5) {
          fbN.className = 'fb ok';
          fbN.innerHTML = '🎉 5 个都找到了！这些事都发生在 <b>Last Saturday</b>，已经过去了，所以动词都变了样子：<span class="en">go → went　see → saw　pick → picked　have → had　is → was</span>下面轮到你照着写。';
          $('#readHint').style.display = 'none';
          complete('read');
        } else {
          fbN.className = 'fb ok';
          fbN.innerHTML = '✓ 对！<b>' + k + '</b> 是 <b>' + VERBS[k] + '</b> 变来的。还有 ' + (5 - found) + ' 个。';
        }
      } else {
        misses++; ST.read.miss++; beep('bad');
        w.classList.add('no'); setTimeout(function () { w.classList.remove('no'); }, 400);
        fbN.className = 'fb no';
        fbN.innerHTML = '「' + esc(w.textContent.replace(/[.,!]/g, '')) + '」不是。要找的是讲「做了什么、当时怎么样」的词，比如：去了、看见了、（那天）很棒。' + (misses >= 3 ? STUCK : '');
      }
    });
    $('#readHint').onclick = function () {
      var left = $$('.w', box).filter(function (w) { return VERBS[w.getAttribute('data-k')] && !w.classList.contains('hit'); });
      if (left.length) { left[0].parentNode.style.background = '#FFF3C9'; fbN.className = 'fb ok'; fbN.innerHTML = '提示：在变黄的那一行里找一找。'; }
    };
    $('#listenBtn').onclick = function () { play('model-email'); };
  };

  /* ---------- 通用：一题一题做 ---------- */
  function Runner(box, items, render, stepId) {
    var i = 0, stat = ST[stepId];
    function show() {
      box.innerHTML = '';
      box.appendChild(el('div', 'count', '第 ' + (i + 1) + ' / ' + items.length + ' 题'));
      var body = el('div', 'item'); box.appendChild(body);
      var fbN = el('div', 'fb'); box.appendChild(fbN);
      var nextB = el('button', 'btn ghost nextitem', i < items.length - 1 ? '下一题 →' : '这一步做完了 ✓'); nextB.style.display = 'none'; box.appendChild(nextB);
      var wrong = 0, fin = false;
      function finish(first) { if (fin) return; fin = true; if (first) stat.first++; stat.done++; body.classList.add('locked'); nextB.style.display = ''; }
      var api = {
        right: function (html) { stat.tries++; beep('ok'); fbN.className = 'fb ok'; fbN.innerHTML = html; finish(wrong === 0); },
        wrong: function (html, answerHtml) {
          wrong++; stat.tries++; beep('bad'); fbN.className = 'fb no';
          if (wrong >= 2) { fbN.innerHTML = html + '<div class="ans">Pip 的参考答案：<span class="en">' + answerHtml + '</span></div>' + STUCK; finish(false); }
          else fbN.innerHTML = html + ' <b>再试一次。</b>';
        },
        nudge: function (html) { fbN.className = 'fb no'; fbN.innerHTML = html; }
      };
      nextB.onclick = function () {
        if (i < items.length - 1) { i++; show(); }
        else { complete(stepId); nextB.style.display = 'none'; fbN.className = 'fb ok'; fbN.innerHTML = '这一步完成，盖一枚邮戳 ✓　点下面的「下一步」。'; }
      };
      render(items[i], body, api);
    }
    show();
  }

  /* ---------- 第 3 步：仿写 ---------- */
  var WHY = {
    go: '「go」是平时的写法。这句讲的是已经过去的事，看看 Lily 的句子里用的是哪个词。',
    goed: '没有「goed」这个词。go 变的时候整个换了样子，看看 Lily 写的。',
    see: '「see」是平时的写法。这件事已经发生了，看看 Lily 的句子。',
    seed: '没有「seed」这种变法（seed 是「种子」）。看看 Lily 是怎么写「看见了」的。',
    play: '「play」是平时的写法。已经玩过了，要像 Lily 的 picked 那样变。',
    plays: '「plays」是说他/她平时做的事。这里是昨天做完的事，要像 Lily 的 picked 那样变。',
    have: '「have」是平时的写法。已经吃过了，看看 Lily 的句子。',
    haved: '没有「haved」这个词。看看 Lily 写的是哪个。',
    is: '「is」是说现在。那天的感觉已经过去了，看看 Lily 的最后一句。',
    were: '「It」后面用 was；「We / They」后面才用 were。'
  };
  var IM = [
    { model: "<u>Last Saturday</u> I <em>went</em> to <u>my grandma's farm</u>.",
      parts: [{ label: '时间', opts: ['Yesterday', 'Last Sunday', 'Last week'] }, { text: 'I' }, { label: '动词', opts: ['go', 'went', 'goed'], ans: 'went' }, { text: 'to' }, { label: '地点', opts: ['the zoo', 'the park', "my friend's house"] }, { text: '.' }] },
    { model: 'We <em>saw</em> <u>some baby chickens</u> and <em>picked</em> <u>apples</u>.',
      parts: [{ text: 'We' }, { label: '动词 ①', opts: ['see', 'seed', 'saw'], ans: 'saw' }, { label: '看到的', opts: ['some monkeys', 'a big robot', 'a funny film'] }, { text: 'and' }, { label: '动词 ②', opts: ['played', 'play', 'plays'], ans: 'played' }, { label: '玩的', opts: ['football', 'games', 'with a dog'] }, { text: '.' }] },
    { model: 'I <em>had</em> <u>lunch</u> <u>in the garden</u>. It <em>was</em> <u>great</u>!',
      parts: [{ text: 'I' }, { label: '动词', opts: ['have', 'had', 'haved'], ans: 'had' }, { label: '吃的', opts: ['dinner', 'a picnic', 'breakfast'] }, { label: '在哪儿', opts: ['at a restaurant', 'in the park', 'at home'] }, { text: '. It' }, { label: 'is 变成？', opts: ['is', 'was', 'were'], ans: 'was' }, { label: '感觉', opts: ['fun', 'great', 'amazing'] }, { text: '!' }] },
    { free: true }
  ];
  function renderFree(it, body, api) {
    var unk = 0;
    body.innerHTML = '<div class="pair"><div class="who">Lily 写的</div><p class="en"><u>Last Saturday</u> I <em>went</em> to <u>my grandma\'s farm</u>.</p></div>' +
      '<div class="pair mine"><div class="who">这一句不给选项：写一件你上个周末真的做过的事</div>' +
      '<textarea data-free rows="2" autocapitalize="sentences" autocomplete="off" autocorrect="off" spellcheck="false" maxlength="90" placeholder="Last Sunday I ..." style="' + TIN + '"></textarea>' +
      '<div class="chips">' + ['Last Saturday I', 'Last Sunday I', 'Yesterday we'].map(function (s) { return '<button class="chip" style="font-size:15px;min-height:38px;padding:4px 9px">' + s + '</button>'; }).join('') + '</div></div>' +
      '<button class="btn primary" data-check>检查</button><span class="demo">样本演示：这一句用规则检查动词，正式版接 AI 判断。</span>';
    var inp = $('[data-free]', body);
    function check() {
      var s = inp.value.trim();
      if (wc(s) < 4) { api.nudge('写一整句：什么时候 + 谁 + 做了什么。'); return; }
      var r = mark(s);
      var bad = Object.keys(r.fixes).map(function (k) { return r.fixes[k]; }).filter(function (f) { return f.type === 'tense' || f.type === 'form'; });
      if (bad.length) { api.wrong('「' + esc(bad[0].from) + '」还是平时的写法。上个周末的事已经过去了，这个动词要变。', esc(r.fixedText)); return; }
      var hasPast = r.pastOk.length > 0 || /\b[a-z]{2,}ed\b/i.test(s) || IRR.test(s);
      if (!hasPast && unk === 0) { unk++; api.nudge('没认出这句里变成「过去的样子」的动词，检查一下动词。确定写对了就再点一次「检查」。'); return; }
      api.right('✓ 这一句是你自己的了！<span class="en">' + esc(r.fixedText) + '</span>' + (hasPast ? '' : '<span class="demo">样本的规则没认出这个动词，先收下；正式版由 AI 判断。</span>'));
    }
    body.addEventListener('click', function (e) {
      var c = closest(e.target, '.chip');
      if (c) { if (!inp.value.trim()) inp.value = c.textContent + ' '; inp.focus(); return; }
      if (closest(e.target, '[data-check]')) check();
    });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.keyCode === 13) { e.preventDefault(); inp.blur(); check(); } });
  }
  var IRR = /\b(swam|ran|wrote|slept|flew|caught|won|lost|sat|stood|told|knew|left|heard|wore|broke|fell|grew|kept|paid|sent|spent|taught|forgot|began|brought|chose|drove|read|put|cut|hit|did|got|came|made|took|ate|drank|rode|met|sang|gave|found|felt|drew|built|said|bought|had|saw|went|was|were)\b/i;
  function renderImitate(it, body, api) {
    if (it.free) { renderFree(it, body, api); return; }
    var sel = {}, need = it.parts.filter(function (p) { return p.opts; }).length;
    var h = '<div class="pair"><div class="who">Lily 写的</div><p class="en">' + it.model + '</p></div>' +
      '<div class="pair mine"><div class="who">你来写（每一格选一个）</div><p class="en" data-prev></p></div>';
    it.parts.forEach(function (p, pi) {
      if (!p.opts) return;
      h += '<div class="slot"><div class="slab">' + p.label + '</div><div class="chips">' + p.opts.map(function (o) { return '<button class="chip" data-pi="' + pi + '" data-v="' + esc(o) + '">' + esc(o) + '</button>'; }).join('') + '</div></div>';
    });
    h += '<button class="btn primary" data-check disabled>检查</button>';
    body.innerHTML = h;
    function sentence(useAns, html) {
      return it.parts.map(function (p, pi) {
        if (!p.opts) return esc(p.text);
        var v = useAns && p.ans ? p.ans : (sel[pi] || (useAns ? p.opts[0] : ''));
        if (!v) return '<span class="blank">' + p.label + '</span>';
        return html ? '<b class="fill' + (p.ans ? ' v' : '') + '">' + esc(v) + '</b>' : esc(v);
      }).join(' ').replace(/ ([.!,])/g, '$1');
    }
    function prev() { $('[data-prev]', body).innerHTML = sentence(false, true); $('[data-check]', body).disabled = Object.keys(sel).length < need; }
    body.addEventListener('click', function (e) {
      var c = closest(e.target, '.chip');
      if (c) {
        var pi = c.getAttribute('data-pi'); sel[pi] = c.getAttribute('data-v');
        $$('.chip[data-pi="' + pi + '"]', body).forEach(function (x) { x.classList.toggle('sel', x === c); x.classList.remove('bad'); });
        prev(); return;
      }
      if (closest(e.target, '[data-check]')) {
        var bad = [];
        it.parts.forEach(function (p, pi) { if (p.opts && p.ans && sel[pi] !== p.ans) bad.push(pi); });
        if (!bad.length) { api.right('✓ 写对了！<span class="en">' + sentence(false, false) + '</span>'); return; }
        bad.forEach(function (pi) { $$('.chip.sel[data-pi="' + pi + '"]', body).forEach(function (x) { x.classList.add('bad'); }); });
        api.wrong(WHY[sel[bad[0]]] || '动词再看看 Lily 是怎么写的。', sentence(true, true));
      }
    });
    prev();
  }
  INIT.imitate = function () { Runner($('#imBox'), IM, renderImitate, 'imitate'); };

  /* ---------- 第 4 步：改写 ---------- */
  var RW = [
    { from: '<u>Every Sunday</u> I <em>visit</em> my grandma.', pre: '<u>Last Sunday</u> I', post: 'my grandma.', ans: 'visited', base: 'visit', reg: true, opts: ['visit', 'visited', 'visiting'] },
    { from: 'We <em>go</em> to the park <u>every day</u>.', pre: '<u>Yesterday</u> we', post: 'to the park.', ans: 'went', base: 'go', opts: ['goed', 'go', 'went'] },
    { from: 'It <em>is</em> sunny <u>today</u>.', pre: 'It', post: 'sunny <u>yesterday</u>.', ans: 'was', base: 'is', opts: ['is', 'were', 'was'] }
  ];
  function renderRewrite(it, body, api) {
    body.innerHTML = '<div class="pair"><div class="who">平时的事</div><p class="en">' + it.from + '</p></div>' +
      '<div class="pair mine"><div class="who">昨天的事（把红色的动词改掉，填进空格）</div><p class="en">' + it.pre +
      ' <input class="gap" type="text" inputmode="text" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" maxlength="12" placeholder="?"> ' + it.post + '</p></div>' +
      '<div class="chips" data-optbox style="display:none;margin-top:8px">' + it.opts.map(function (o) { return '<button class="chip" data-v="' + o + '">' + o + '</button>'; }).join('') + '</div>' +
      '<div class="row"><button class="btn primary" data-check>检查</button><button class="link" data-opts>不想打字？点这里选</button></div>';
    var inp = $('.gap', body);
    var full = (it.pre + ' <b class="fill v">' + it.ans + '</b> ' + it.post).replace(/<\/?u>/g, '');
    function check() {
      var v = inp.value.trim().toLowerCase().replace(/[^a-z]/g, '');
      if (!v) { api.nudge('先在空格里填一个词。'); return; }
      if (v === it.ans) { inp.value = it.ans; api.right('✓ 对了！<span class="en">' + full + '</span>'); return; }
      var msg;
      if (v === it.base || v === 'have') msg = '「' + v + '」还是平时的写法。时间变成过去了，动词也要跟着变。';
      else if (it.reg) msg = '很接近了。visit 是规规矩矩的那一类：直接在后面加 -ed。';
      else if (/ed$/.test(v)) msg = '这个词不是加 -ed，它整个换了样子。想想 Lily 的邮件里是怎么写的。';
      else msg = '还不对。提示：首字母是 ' + it.ans.charAt(0) + '，一共 ' + it.ans.length + ' 个字母。';
      api.wrong(msg, full);
    }
    body.addEventListener('click', function (e) {
      var c = closest(e.target, '.chip');
      if (c) { inp.value = c.getAttribute('data-v'); check(); return; }
      if (closest(e.target, '[data-opts]')) { $('[data-optbox]', body).style.display = ''; return; }
      if (closest(e.target, '[data-check]')) check();
    });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.keyCode === 13) { e.preventDefault(); inp.blur(); check(); } });
  }
  INIT.rewrite = function () { Runner($('#rwBox'), RW, renderRewrite, 'rewrite'); };

  /* ---------- 第 5 步：翻译（词块拼句） ---------- */
  var LOWMID = { Yesterday: 1, We: 1, It: 1 };
  function joinChunks(chunks) {
    var out = [];
    chunks.forEach(function (c, k) {
      var start = k === 0 || /[.!?]$/.test(chunks[k - 1]);
      out.push(start ? cap(c) : (LOWMID[c] ? c.toLowerCase() : c));
    });
    var s = out.join(' ');
    if (s && !/[.!?,]$/.test(s)) s += '.';
    return s;
  }
  function norm(s) { return s.toLowerCase().replace(/[.!?,]/g, '').replace(/\s+/g, ' ').trim(); }
  var TR = [
    { zh: '昨天我们去了科技馆。', chunks: ['Yesterday', 'we', 'went', 'go', 'to the Science Museum'], bad: ['go'],
      ans: ['yesterday we went to the science museum', 'we went to the science museum yesterday'], show: 'Yesterday we went to the Science Museum.', audio: 't1', key: [' went ', ' museum '] },
    { zh: '我看到了一个大机器人。', chunks: ['I', 'saw', 'see', 'a big robot', 'look'], bad: ['see', 'look'],
      ans: ['i saw a big robot'], show: 'I saw a big robot.', audio: 't2', key: [' saw ', ' robot '] },
    { zh: '我们在咖啡厅吃了冰淇淋。太棒了！', chunks: ['We', 'had', 'have', 'ice cream', 'in the café.', 'It', 'was', 'is', 'great!'], bad: ['have', 'is'],
      ans: ['we had ice cream in the café it was great', 'we had ice cream in the cafe it was great', 'we had ice cream in the café it was great', 'we had ice cream in the cafe it was great'], show: 'We had ice cream in the café. It was great!', audio: 't3', key: [' ice cream ', ' was '] }
  ];
  function renderTrans(it, body, api) {
    var placed = [], order = shuffle(it.chunks.map(function (c, i) { return i; }));
    var typing = false;
    body.innerHTML = '<p class="zh">' + it.zh + '</p><div data-chunkui><div class="answer" data-ans></div><div class="chips" data-pool></div></div>' +
      '<textarea data-typed rows="2" autocapitalize="sentences" autocomplete="off" autocorrect="off" spellcheck="false" maxlength="90" placeholder="在这里打出整句英文" style="display:none;' + TIN + '"></textarea>' +
      '<div class="row"><button class="btn primary" data-check disabled>检查</button><button class="link" data-clear>清空重来</button><button class="link" data-totype>⌨️ 不用词块，自己打字</button></div>';
    var tin = $('[data-typed]', body);
    function draw() {
      $('[data-ans]', body).innerHTML = placed.map(function (ci) { return '<button class="chip sel" data-out="' + ci + '">' + esc(it.chunks[ci]) + '</button>'; }).join('');
      $('[data-pool]', body).innerHTML = order.map(function (ci) { return '<button class="chip' + (placed.indexOf(ci) >= 0 ? ' used' : '') + '" data-in="' + ci + '">' + esc(it.chunks[ci]) + '</button>'; }).join('');
      $('[data-check]', body).disabled = !typing && placed.length < 2;
    }
    body.addEventListener('click', function (e) {
      var c;
      if ((c = closest(e.target, '[data-in]'))) { placed.push(parseInt(c.getAttribute('data-in'), 10)); draw(); return; }
      if ((c = closest(e.target, '[data-out]'))) { placed.splice(placed.indexOf(parseInt(c.getAttribute('data-out'), 10)), 1); draw(); return; }
      if (closest(e.target, '[data-clear]')) { placed = []; tin.value = ''; draw(); return; }
      if ((c = closest(e.target, '[data-totype]'))) {
        typing = !typing;
        tin.style.display = typing ? '' : 'none'; $('[data-chunkui]', body).style.display = typing ? 'none' : '';
        c.textContent = typing ? '🧩 改用词块' : '⌨️ 不用词块，自己打字';
        if (typing) tin.focus();
        draw(); return;
      }
      if (closest(e.target, '[data-check]')) {
        var chunks = typing ? [] : placed.map(function (ci) { return it.chunks[ci]; });
        var s = typing ? tin.value.trim() : joinChunks(chunks);
        if (typing && wc(s) < 2) { api.nudge('先打出一整句英文。'); return; }
        if (it.ans.indexOf(norm(s)) >= 0) {
          api.right('✓ 译对了！<span class="en">' + esc(s) + '</span><button class="link" data-play="' + it.audio + '">🔊 再听一遍</button>');
          play(it.audio); return;
        }
        if (typing) {
          var tr = mark(s), tbad = Object.keys(tr.fixes).map(function (k) { return tr.fixes[k]; }).filter(function (f) { return f.type === 'tense' || f.type === 'form'; });
          var ns = ' ' + norm(s) + ' ';
          if (tbad.length) { api.wrong('「' + esc(tbad[0].from) + '」还是平时的写法。这是已经发生的事，动词要变。', esc(it.show)); return; }
          if (it.key.every(function (k) { return ns.indexOf(k) >= 0; })) {
            api.right('✓ 可以！动词用对了。<span class="en">' + esc(tr.fixedText) + '</span>Pip 的参考答案：<span class="en">' + esc(it.show) + '</span><span class="demo">样本演示：自己打的句子只做了动词检查和关键词比对，正式版由 AI 判断意思对不对。</span>');
            return;
          }
          api.wrong('意思还不完整，对着中文再看看少了什么。', esc(it.show)); return;
        }
        var usedBad = chunks.filter(function (c2) { return it.bad.indexOf(c2) >= 0; });
        var msg = usedBad.length ? '意思快对了。可这是已经发生的事，「' + usedBad[0] + '」要换成变过的那个词。'
          : (chunks.length < it.chunks.length - it.bad.length ? '句子还没拼完，再看看中文里还有什么没说。' : '词的顺序再看看：谁 → 做了什么 → 什么东西 / 在哪儿。');
        api.wrong(msg, esc(it.show));
      }
    });
    draw();
  }
  INIT.trans = function () { Runner($('#trBox'), TR, renderTrans, 'trans'); };

  /* ---------- 第 6 步：写邮件 ---------- */
  var WL = [
    { label: '① 打招呼 <b>Say hello</b>', pool: ['Hi Tom,', 'Dear Tom,', 'Hello Tom,'], one: true },
    { label: '② 去了哪儿 <b>Where did you go?</b>', pool: ['Yesterday', 'we', 'I', 'went', 'go', 'to the Science Museum', 'with my class'] },
    { label: '② 看到了什么 <b>What did you see?</b>', pool: ['We', 'I', 'saw', 'see', 'a big robot', 'and', 'a dinosaur', 'some planets'] },
    { label: '② 做了什么 <b>What did you do?</b>', pool: ['We', 'I', 'had', 'have', 'ice cream', 'in the café', 'and', 'bought', 'buy', 'a toy rocket', 'in the shop'] },
    { label: '② 感觉怎么样（想写就写）', pool: ['It', 'was', 'is', 'great!', 'amazing!', 'so much fun!'] },
    { label: '③ 说再见 <b>Say goodbye</b>', pool: ['See you soon.', 'Get well soon!', 'See you at school.'], one: true }
  ];
  var wSel = WL.map(function () { return []; }), wIns = WL.map(function () { return null; }), wMode = 'chunk';
  function chunkText() {
    var lines = [];
    WL.forEach(function (L, li) {
      if (!wSel[li].length) return;
      lines.push(joinChunks(wSel[li].map(function (ci) { return L.pool[ci]; })));
    });
    var name = $('#wName').value.trim();
    if (name && lines.length) lines.push(name);
    return lines.join('\n');
  }
  function getText() { return wMode === 'chunk' ? chunkText() : $('#wText').value; }
  function updCount() {
    var t = getText(), n = wc(t), c = $('#wCount');
    c.textContent = n; c.className = n >= 25 ? 'enough' : '';
    if (wMode === 'chunk') $('#wPrev').textContent = t;
  }
  function drawLines() {
    $('#wLines').innerHTML = WL.map(function (L, li) {
      return '<div class="wl"><div class="slab">' + L.label + '</div><div class="answer">' +
        wSel[li].map(function (ci) { return '<button class="chip sel" data-li="' + li + '" data-out="' + ci + '">' + esc(L.pool[ci]) + '</button>'; }).join('') +
        '</div><div class="chips">' + L.pool.map(function (c, ci) { return '<button class="chip' + (wSel[li].indexOf(ci) >= 0 ? ' used' : '') + '" data-li="' + li + '" data-in="' + ci + '">' + esc(c) + '</button>'; }).join('') + '</div></div>';
    }).join('');
    updCount();
  }
  function setMode(m) {
    if (m === 'type' && wMode === 'chunk' && !$('#wText').value.trim()) $('#wText').value = chunkText();
    wMode = m;
    $$('#wTabs button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-mode') === m); });
    $('#wChunk').hidden = m !== 'chunk'; $('#wType').hidden = m !== 'type';
    $('#wChunk').style.display = m === 'chunk' ? '' : 'none'; $('#wType').style.display = m === 'type' ? '' : 'none';
    updCount();
  }
  var DEMO_BAD = 'hi Tom,\nYesterday we go to the Science Museum. I see a big robot. I buyed a toy rocket. It is great!\nSee you soon.\nAlex';
  var lastMark = null;
  INIT.write = function () {
    drawLines();
    $('#wLines').addEventListener('click', function (e) {
      var c;
      if ((c = closest(e.target, '[data-in]'))) {
        var li = parseInt(c.getAttribute('data-li'), 10), ci = parseInt(c.getAttribute('data-in'), 10);
        if (WL[li].one) wSel[li] = [ci];
        else if (wIns[li] != null && wIns[li] <= wSel[li].length) wSel[li].splice(wIns[li], 0, ci);
        else wSel[li].push(ci);
        wIns[li] = null;
        drawLines(); return;
      }
      if ((c = closest(e.target, '[data-out]'))) {
        var li2 = parseInt(c.getAttribute('data-li'), 10), ci2 = parseInt(c.getAttribute('data-out'), 10);
        var pos = wSel[li2].indexOf(ci2);
        wSel[li2].splice(pos, 1);
        wIns[li2] = pos < wSel[li2].length ? pos : null; /* 拿掉中间一块后，下一块补回原位，方便只换一个词 */
        drawLines();
      }
    });
    $('#wStarters').innerHTML = ['Hi Tom,', 'Yesterday', 'we went to', 'I saw', 'We had', 'It was', 'See you soon.'].map(function (s) { return '<button class="chip" style="font-size:15px;min-height:38px;padding:4px 9px">' + s + '</button>'; }).join('');
    $('#wStarters').addEventListener('click', function (e) {
      var c = closest(e.target, '.chip'); if (!c) return;
      var ta = $('#wText'), v = ta.value;
      ta.value = v + (v && !/\s$/.test(v) ? ' ' : '') + c.textContent + (/,$/.test(c.textContent) ? '\n' : ' ');
      ta.focus(); updCount();
    });
    $('#wText').addEventListener('input', updCount);
    $('#wName').addEventListener('input', updCount);
    $('#wTabs').addEventListener('click', function (e) { var b = closest(e.target, '[data-mode]'); if (b) setMode(b.getAttribute('data-mode')); });
    $('#wDemo').onclick = function () { $('#wText').value = DEMO_BAD; setMode('type'); toast('已填入一封带典型错误的作文，点「交给 AI 批改」'); };
    $('#wSubmit').onclick = function () {
      var t = getText();
      if (wc(t) < 5) { toast('先写几句，再交给 AI 批改哦'); return; }
      lastMark = mark(t);
      ST.write.tries++;
      if (ST.write.firstErr === null) ST.write.firstErr = lastMark.tenseN;
      renderMark(lastMark);
      complete('write');
      go(7);
    };
    setMode('chunk');
  };

  /* ---------- 第 7 步：批改（规则检查 + 预置反馈） ---------- */
  var PAST = { go: 'went', goes: 'went', see: 'saw', sees: 'saw', eat: 'ate', eats: 'ate', have: 'had', has: 'had', buy: 'bought', buys: 'bought', play: 'played', plays: 'played', take: 'took', takes: 'took', make: 'made', makes: 'made', visit: 'visited', visits: 'visited', look: 'looked', looks: 'looked', watch: 'watched', watches: 'watched', is: 'was', am: 'was', are: 'were', drink: 'drank', drinks: 'drank', ride: 'rode', meet: 'met', learn: 'learned', learns: 'learned', get: 'got', come: 'came', comes: 'came', walk: 'walked', touch: 'touched', talk: 'talked', sing: 'sang', say: 'said', says: 'said', give: 'gave', gives: 'gave', find: 'found', feel: 'felt', draw: 'drew', build: 'built', laugh: 'laughed', pick: 'picked', wave: 'waved', waves: 'waved' };
  var BADFORM = { goed: 'went', wented: 'went', seed: 'saw', sawed: 'saw', eated: 'ate', ated: 'ate', buyed: 'bought', boughted: 'bought', haved: 'had', taked: 'took', maked: 'made', drinked: 'drank', rided: 'rode', comed: 'came', gived: 'gave', finded: 'found', feeled: 'felt', drawed: 'drew', builded: 'built', wased: 'was', meeted: 'met', getted: 'got', singed: 'sang', sayed: 'said' };
  var PASTSET = { were: 1, could: 1, did: 1, loved: 1, liked: 1, wanted: 1, stayed: 1, danced: 1, enjoyed: 1 };
  Object.keys(PAST).forEach(function (k) { PASTSET[PAST[k]] = 1; });
  var SUBJ = { i: 1, we: 1, he: 1, she: 1, it: 1, they: 1, and: 1, then: 1, 'class': 1, teacher: 1, friends: 1, robot: 1 };
  var BESUBJ = { i: 1, we: 1, he: 1, she: 1, it: 1, they: 1 };
  var ADV = { also: 1, really: 1, just: 1, all: 1, both: 1 };
  var EXEMPT = /\b(you|your|hope|wish|tomorrow|next|soon|now|today|bye|let's|will|can't wait)\b/i;
  var FEEL = /\b(great|fun|amazing|good|nice|cool|interesting|fantastic|wonderful|exciting|happy|tired|awesome|funny|boring|brilliant|lovely)\b/i;

  function mark(text) {
    text = text.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{2,}/g, '\n').trim();
    var toks = text.match(/[A-Za-z']+|[^A-Za-z']+/g) || [];
    var fixes = {}, tenseN = 0, capN = 0, pastOk = [], sents = [], curIdx = [];
    toks.forEach(function (t, i) {
      curIdx.push(i);
      if (!/^[A-Za-z']/.test(t) && /[.!?\n]/.test(t)) { sents.push(curIdx); curIdx = []; }
    });
    if (curIdx.length) sents.push(curIdx);
    var info = [];
    sents.forEach(function (idxs) {
      var str = idxs.map(function (i) { return toks[i]; }).join('');
      var ex = EXEMPT.test(str), feel = FEEL.test(str);
      var words = idxs.filter(function (i) { return /^[A-Za-z']/.test(toks[i]); });
      words.forEach(function (ti, j) {
        var w = toks[ti], lw = w.toLowerCase();
        var prev = j > 0 ? toks[words[j - 1]].toLowerCase() : '', prev2 = j > 1 ? toks[words[j - 2]].toLowerCase() : '';
        var fix = null;
        if (!ex) {
          if (BADFORM[lw]) fix = { type: 'form', to: BADFORM[lw] };
          else if (PAST[lw]) {
            var subj = SUBJ[prev] ? prev : (ADV[prev] && SUBJ[prev2] ? prev2 : '');
            var isBe = lw === 'is' || lw === 'am' || lw === 'are';
            if (subj && (!isBe || (BESUBJ[subj] && feel))) fix = { type: 'tense', to: PAST[lw] };
          }
        }
        if (fix) tenseN++;
        else if (PASTSET[lw] && !ex) pastOk.push(lw);
        if (!fix && w === 'i') fix = { type: 'capI', to: 'I' };
        if (j === 0 && /^[a-z]/.test(w)) {
          if (fix) { if (fix.type !== 'capI') fix.to = cap(fix.to); }
          else fix = { type: 'cap', to: cap(w) };
        } else if (fix && fix.type !== 'capI' && /^[A-Z]/.test(w)) fix.to = cap(fix.to);
        if (fix) { if (fix.type === 'cap' || fix.type === 'capI') capN++; fix.from = w; fixes[ti] = fix; }
      });
      var fixed = idxs.map(function (i) { return fixes[i] ? fixes[i].to : toks[i]; }).join('').replace(/\s+/g, ' ').trim();
      info.push({ ex: ex, str: fixed, n: words.length });
    });
    var body = info.filter(function (s) { return !s.ex; }).map(function (s) { return s.str; }).join(' ');
    /* 署名：最后一小段（允许带句号），1–2 个词，且不是「See you / It was great」这类句子 */
    var lastM = text.replace(/[.!,\s]+$/, '').match(/([^.!?\n]*)$/), last = lastM ? lastM[1].trim() : '';
    var notName = /\b(see|you|bye|goodbye|soon|love|wishes|care|thanks|great|fun|it|was|is|well|get|school|monday)\b/i;
    var pts = {
      greet: /^\s*(hi|hello|dear|hey)\b/i.test(text),
      where: /\b(went|go|goes|goed|visit|visited)\s+to\b/i.test(body) || /\bmuseum\b/i.test(body),
      saw: /\b(saw|see|sees|seed|watched|watch|looked at|look at|there was|there were|there is|there are)\b/i.test(body),
      did: /\b(ate|had|bought|played|took|made|drank|touched|danced|learned|learnt|rode|built|drew|talked|eat|have|buy|buyed|play|take|make|drink|eated|haved)\b/i.test(body),
      close: /\b(see you|bye|goodbye|get well|best wishes|take care|write soon|talk soon)\b/i.test(text) || /\blove,?\s*\n/i.test(text),
      name: last.length > 0 && last !== text && wc(last) >= 1 && wc(last) <= 2 && /^[A-Za-z' ]+$/.test(last) && !notName.test(last)
    };
    var words = wc(text);
    var bodyS = info.filter(function (s) { return !s.ex && s.n >= 3; }).length;
    var conn = /\b(and|then|because|but|after that|so)\b/i.test(body);
    var miss = (pts.where ? 0 : 1) + (pts.saw ? 0 : 1) + (pts.did ? 0 : 1);
    var scores = {
      c: Math.max(1, Math.round(5 - 1.5 * miss - (words < 25 ? 1 : 0))),
      o: Math.max(1, (pts.greet ? 1 : 0) + (pts.close ? 1 : 0) + (pts.name ? 1 : 0) + (bodyS >= 3 ? 1 : 0) + (conn ? 1 : 0)),
      l: Math.max(1, 5 - Math.min(tenseN, 3) - (capN > 0 ? 1 : 0))
    };
    var sugg = [];
    for (var k = 0; k < info.length - 1; k++) {
      var a = info[k], b = info[k + 1];
      if (a.ex || b.ex) continue;
      var ma = a.str.match(/^(I|We)\s+(.+?)\.$/), mb = b.str.match(/^(I|We)\s+(.+?)([.!])$/);
      if (ma && mb && ma[1] === mb[1] && a.n <= 8 && b.n <= 8 && !/\band\b/.test(a.str) && !/\band\b/.test(b.str)) {
        sugg.push({ t: '两句短句，可以用 and 连成一句', bf: a.str + ' ' + b.str, af: ma[1] + ' ' + esc(ma[2]) + ' <b>and</b> ' + esc(mb[2]) + '.', why: 'Lily 的邮件里就是这样写的：We saw some baby chickens and picked apples.' });
        break;
      }
    }
    if (!/\b(yesterday|last\s+\w+)\b/i.test(text)) sugg.push({ t: '加上时间词，让 Tom 一眼知道是哪天的事', bf: 'We went to the Science Museum.', af: '<b>Yesterday</b> we went to the Science Museum.' });
    if (!/\b(it|that|this|trip|day)\s+(was|is)\b/i.test(text)) sugg.push({ t: '最后加一句感受，更像在跟朋友说话', bf: '', af: 'It was <b>amazing</b>!' });
    if (sugg.length < 2 && !/\bbecause\b/i.test(text)) sugg.push({ t: '想再进一步？加一个原因', bf: 'It was great!', af: 'It was great <b>because</b> the robot waved at us.' });
    sugg = sugg.slice(0, 2);
    return {
      text: text, toks: toks, fixes: fixes, tenseN: tenseN, capN: capN, pastOk: pastOk, pts: pts, words: words, scores: scores, sugg: sugg,
      fixedText: toks.map(function (t, i) { return fixes[i] ? fixes[i].to : t; }).join(''),
      pass: pts.greet && pts.where && pts.saw && pts.did && pts.close && pts.name && words >= 25 && tenseN === 0
    };
  }

  function renderMark(r) {
    var p = r.pts, todo = [];
    if (!p.greet) todo.push('开头打个招呼（Hi Tom,）');
    if (!p.where) todo.push('说清楚去了哪儿');
    if (!p.saw) todo.push('说说看到了什么');
    if (!p.did) todo.push('说说在那儿做了什么');
    if (!p.close) todo.push('结尾说再见（See you soon.）');
    if (!p.name) todo.push('最后一行写上你的名字');
    if (r.words < 25) todo.push('再多写几个词（现在 ' + r.words + ' 词）');
    if (r.tenseN > 0) todo.push('把 ' + r.tenseN + ' 个动词改成「过去的样子」');
    function row(ok, txt) { return '<li class="' + (ok ? '' : 'x') + '"><span class="ic">' + (ok ? '✓' : '!') + '</span><span>' + txt + '</span></li>'; }
    var h = r.pass
      ? '<div class="verdict pass">✓ 这封邮件过关了！<small>三个要点都写到了，动词也都用对了。可以寄给 Tom 了。</small></div>'
      : '<div class="verdict todo">还差一点点，改完再交一次<small>' + todo.join('；') + '。</small></div>';
    h += '<h3>① 任务完成度</h3><div class="card"><ul class="checks">' +
      row(p.greet, '打招呼 <span class="muted">Say hello</span>') +
      row(p.where, '要点 1：去了哪儿 <span class="muted">where you went</span>') +
      row(p.saw, '要点 2：看到了什么 <span class="muted">what you saw</span>') +
      row(p.did, '要点 3：做了什么 <span class="muted">what you did there</span>') +
      row(p.close && p.name, '说再见 + 名字' + (p.close && !p.name ? '（还没写名字）' : (!p.close && p.name ? '（还没说再见）' : ''))) +
      row(r.words >= 25, '字数：' + r.words + ' 词（要求 25 词以上）') + '</ul></div>';
    var seen = {}, list = [];
    var mh = r.toks.map(function (t, i) {
      var f = r.fixes[i];
      if (f) {
        var key = f.from + '>' + f.to;
        if (!seen[key]) {
          seen[key] = 1;
          var why = f.type === 'tense' ? '这是昨天的事，已经过去了，动词要变。'
            : f.type === 'form' ? '这个词不是加 -ed，它变成 ' + f.to.toLowerCase() + '。'
            : f.type === 'capI' ? '「我」I 永远大写。' : '句子和称呼的开头要大写。';
          list.push('<li><del>' + esc(f.from) + '</del> → <ins>' + esc(f.to) + '</ins>　' + why + '</li>');
        }
        return '<del>' + esc(f.from) + '</del><ins>' + esc(f.to) + '</ins>';
      }
      if (PASTSET[t.toLowerCase()] && r.pastOk.indexOf(t.toLowerCase()) >= 0) return '<mark>' + esc(t) + '</mark>';
      return esc(t);
    }).join('');
    h += '<h3>② 语法纠错</h3><div class="mail marked"><div class="mail-h">To: <b>Tom</b>　你写的邮件</div><div class="mail-b">' + mh + '</div></div>' +
      '<p class="muted" style="margin:4px 0"><del style="color:#D9483B">红色划掉</del> = 要改　<mark style="background:#E7EEF7;color:#2F6FB5">蓝底</mark> = 你用对的「过去的动词」</p>';
    if (list.length) h += '<div class="card"><ul class="fixlist">' + list.join('') + '</ul></div>';
    else h += '<div class="fb ok">这次没有发现要改的动词 👍' + (r.pastOk.length ? ' 你用对了：<b>' + r.pastOk.filter(function (v, i2, a2) { return a2.indexOf(v) === i2; }).join('、') + '</b>' : '') + '</div>';
    h += '<h3>③ 句型优化</h3>' + r.sugg.map(function (s) {
      return '<div class="sg"><b>' + s.t + '</b>' + (s.bf ? '<p class="en bf">' + esc(s.bf) + '</p>' : '') + '<p class="en af">→ ' + s.af + '</p>' + (s.why ? '<span class="muted">' + s.why + '</span>' : '') + '</div>';
    }).join('');
    function bar(name, v) { return '<span>' + name + '</span><span class="bar"><i style="width:' + (v * 20) + '%"></i></span><b>' + v + ' / 5</b>'; }
    h += '<h3>这一篇的三项评分</h3><div class="card"><div class="bars">' + bar('内容 Content', r.scores.c) + bar('结构 Organisation', r.scores.o) + bar('语言 Language', r.scores.l) + '</div>' +
      '<p class="muted" style="margin:8px 0 0">对标 KET 写作评分的三个维度（内容、结构、语言，每项 5 分）。样本里的分数由规则算出，只做演示。</p></div>';
    if (r.pass) h += '<button class="btn" data-goto="6">想再改一改</button>';
    else h += '<button class="btn go" data-goto="6">← 回去自己改一改，再交一次</button>' +
      (ST.write.tries >= 2 ? '<button class="btn" id="mkAdopt">改了两次还没过？填入 AI 改好的版本</button>'
        : '<p class="muted" style="text-align:center;margin:8px 0 0">先自己改。第二次还没过，这里会出现「填入 AI 改好的版本」。</p>');
    $('#mkBox').innerHTML = h;
    var ad = $('#mkAdopt');
    if (ad) ad.onclick = function () {
      $('#wText').value = r.fixedText; setMode('type'); go(6);
      toast('已填入改好的版本。读一遍，缺的要点自己补上，再交一次。');
    };
    if (r.pass) { ST.write.passed = true; ST.write.final = r.text; ST.write.pastOk = r.pastOk; complete('mark'); beep('win'); }
  }

  /* ---------- 第 8 步：游戏「赶邮车」 ---------- */
  var GQ = [
    { t: 'pick', s: ['Yesterday we', 'to the zoo.'], opts: ['went', 'go', 'goed'], a: 'went' },
    { t: 'pick', s: ['Last night I', 'a funny film.'], opts: ['watch', 'watched', 'watching'], a: 'watched' },
    { t: 'pick', s: ['We', 'pizza for lunch yesterday.'], opts: ['have', 'haved', 'had'], a: 'had' },
    { t: 'pick', s: ['The party last week', 'so much fun!'], opts: ['is', 'was', 'were'], a: 'was' },
    { t: 'pick', s: ['I', 'a red kite in the park last Sunday.'], opts: ['saw', 'see', 'seed'], a: 'saw' },
    { t: 'spot', w: ['Yesterday', 'I', 'play', 'football', 'with', 'Ben.'], bad: 2, fix: 'played' },
    { t: 'spot', w: ['Last', 'Saturday', 'we', 'go', 'to', 'the', 'beach.'], bad: 3, fix: 'went' },
    { t: 'spot', w: ['I', 'visited', 'my', 'aunt', 'and', 'eat', 'cake.'], bad: 5, fix: 'ate' },
    { t: 'spot', w: ['The', 'film', 'last', 'night', 'is', 'great!'], bad: 4, fix: 'was' },
    { t: 'order', c: ['Yesterday', 'I', 'went', 'to the park'], zh: '昨天我去了公园。' },
    { t: 'order', c: ['We', 'saw', 'a big robot', 'at the museum'], zh: '我们在博物馆看到了一个大机器人。' },
    { t: 'order', c: ['I', 'had', 'lunch', 'with my friends'], zh: '我和朋友们吃了午饭。' }
  ];
  var G = null, gTimer = null;
  function gStop() { if (gTimer) { clearInterval(gTimer); gTimer = null; } if (G) G.lock = true; }
  function gIntro() {
    gStop(); G = null;
    $('#gBox').innerHTML = '<div class="card"><div class="g-top"><img class="g-van" src="assets/img/van.webp" alt=""><div><b>邮车马上要开了！</b><br><span class="muted">帮 Pip 把 8 封信装上车。每封信讲的都是「已经发生的事」。</span></div></div>' +
      '<ul class="points"><li><b>选词</b>：给空格选对动词</li><li><b>捉错</b>：点出写错的那个词</li><li><b>排队</b>：把词块排成一句话</li></ul>' +
      '<p class="muted">邮车沿着街慢慢往前开，开到路口 🏁 就走了。抢在它开走之前装满 8 封！连对、答得快有加分；答错的信回到队尾，等会儿再来。</p>' +
      '<button class="btn go" id="gStart">开始装信 →</button></div>';
    $('#gStart').onclick = gStart;
  }
  function gStart() {
    beep('ok');
    function take(t, n) { return shuffle(GQ.filter(function (q) { return q.t === t; })).slice(0, n); }
    var P = take('pick', 3), S = take('spot', 3), O = take('order', 2);
    var q = [P[0], S[0], O[0], P[1], S[1], O[1], P[2], S[2]];
    /* 整局一个总时间：邮车从街这头开到路口。没装完就开走，下一班多等一会儿（保证孩子自己能过） */
    G = { queue: q, loaded: 0, need: 8, score: 0, streak: 0, best: 0, wrong: 0, right: 0, t: 0, ct: 0, max: gFails >= 2 ? 180 : (gFails === 1 ? 140 : 105), lock: true, start: Date.now() };
    var slots = ''; for (var i = 0; i < 8; i++) slots += '<i></i>';
    $('#gBox').innerHTML = '<div class="road" id="gRoad"><img id="gVan" src="assets/img/van.webp" alt=""><span class="flag">🏁</span></div>' +
      '<div class="g-slots" id="gSlots" style="grid-template-columns:repeat(8,1fr)">' + slots + '</div>' +
      '<div class="g-info"><span>得分 <b id="gScore">0</b></span><span id="gStreak"></span><span id="gLeft"></span></div><div id="gCard"></div><div class="fb" id="gFb"></div>';
    gNext();
    gTimer = setInterval(gTick, 100);
  }
  var gFails = 0;
  function gTick() {
    if (!G || G.lock) return;
    G.t += 0.1; G.ct += 0.1;
    var p = Math.min(1, G.t / G.max), van = $('#gVan'), l = $('#gLeft');
    if (van) { van.style.left = 'calc((100% - 96px) * ' + p.toFixed(3) + ')'; $('#gRoad').classList.toggle('low', p > 0.75); }
    if (l) l.textContent = '⏱ 还有 ' + Math.max(0, Math.ceil(G.max - G.t)) + ' 秒';
    if (p >= 1) gFail();
  }
  function gFail() {
    if (gTimer) { clearInterval(gTimer); gTimer = null; }
    gFails++; beep('bad');
    var n = G.loaded; G = null;
    $('#gBox').innerHTML = '<div class="card g-end"><h3 style="margin:0">邮车开走了！</h3><p>这次装上了 <b>' + n + ' / 8</b> 封信。</p>' +
      '<p class="muted">没关系，下一班车会多等一会儿。答错过的句子，多看一眼再点。</p><button class="btn go" id="gAgain">再来一次 →</button></div>';
    $('#gAgain').onclick = gStart;
  }
  function gKey(q) { return q.t === 'pick' ? '应该填 <b>' + q.a + '</b>。' : q.t === 'spot' ? '写错的是 <b>' + q.w[q.bad].replace(/[.!]/, '') + '</b>，应该是 <b>' + q.fix + '</b>。' : '正确顺序：<b>' + q.c.join(' ') + '.</b>'; }
  function gNext() {
    if (!G) return;
    if (G.loaded >= G.need) { gEnd(); return; }
    var q = G.cur = G.queue.shift(); G.ct = 0;
    var card = $('#gCard'), h = '';
    if (q.t === 'pick') {
      h = '<div class="letter" id="gL"><div class="kind">✉️ 选词：这件事已经发生了</div><div class="body">' + q.s[0] + ' <span class="hole" id="gHole">&nbsp;?&nbsp;</span> ' + q.s[1] + '</div></div>' +
        '<div class="chips" id="gOpts">' + shuffle(q.opts).map(function (o) { return '<button class="chip" data-v="' + o + '">' + o + '</button>'; }).join('') + '</div>';
    } else if (q.t === 'spot') {
      h = '<div class="letter" id="gL"><div class="kind">✉️ 捉错：点出写错的那个词</div><div class="body spot">' + q.w.map(function (w, i) { return '<span class="gw" data-i="' + i + '">' + w + '</span>'; }).join(' ') + '</div></div>';
    } else {
      var ord = shuffle(q.c.map(function (c, i) { return i; }));
      if (ord.join() === q.c.map(function (c, i) { return i; }).join()) ord.reverse();
      G.placed = [];
      h = '<div class="letter" id="gL"><div class="kind">✉️ 排队：' + q.zh + '</div><div class="body"><div class="answer" id="gAns" style="margin:0;border-color:#C6CFDB"></div></div></div>' +
        '<div class="chips" id="gOpts">' + ord.map(function (ci) { return '<button class="chip" data-ci="' + ci + '">' + q.c[ci] + '</button>'; }).join('') + '</div>';
    }
    card.innerHTML = h;
    G.lock = false;
  }
  function gClick(e) {
    if (!G || G.lock || !G.cur) return;
    var q = G.cur, c;
    if (q.t === 'pick' && (c = closest(e.target, '#gOpts .chip'))) {
      var v = c.getAttribute('data-v');
      if (v === q.a) { $('#gHole').textContent = q.a; c.classList.add('good'); gAnswer(true); }
      else { c.classList.add('bad'); gAnswer(false, gKey(q)); }
    } else if (q.t === 'spot' && (c = closest(e.target, '.gw'))) {
      var i = parseInt(c.getAttribute('data-i'), 10), right = $('.gw[data-i="' + q.bad + '"]');
      var tail = /[.!]$/.test(q.w[q.bad]) ? q.w[q.bad].slice(-1) : '';
      right.innerHTML = '<s style="opacity:.55;font-weight:400">' + q.w[q.bad].replace(/[.!]/, '') + '</s> ' + q.fix + tail;
      right.classList.add('good');
      if (i === q.bad) gAnswer(true); else { c.classList.add('bad'); gAnswer(false, gKey(q)); }
    } else if (q.t === 'order') {
      if ((c = closest(e.target, '#gOpts .chip'))) {
        G.placed.push(parseInt(c.getAttribute('data-ci'), 10)); c.classList.add('used');
      } else if ((c = closest(e.target, '#gAns .chip'))) {
        var ci = parseInt(c.getAttribute('data-ci'), 10); G.placed.splice(G.placed.indexOf(ci), 1);
        $('#gOpts .chip[data-ci="' + ci + '"]').classList.remove('used');
      } else return;
      $('#gAns').innerHTML = G.placed.map(function (ci2) { return '<button class="chip sel" data-ci="' + ci2 + '">' + q.c[ci2] + '</button>'; }).join('');
      if (G.placed.length === q.c.length) {
        if (G.placed.join() === q.c.map(function (x, k) { return k; }).join()) gAnswer(true); else gAnswer(false, gKey(q));
      }
    }
  }
  function gAnswer(ok, msg) {
    if (!G || G.lock) return; G.lock = true;
    var L = $('#gL'), fbN = $('#gFb');
    if (ok) {
      G.right++; G.streak++; G.best = Math.max(G.best, G.streak);
      var add = 10 + (G.streak >= 2 ? 5 : 0) + (G.ct < 5 ? 3 : 0);
      G.score += add; G.loaded++; beep('ok');
      fbN.className = 'fb ok'; fbN.innerHTML = '✓ 装车！+' + add + ' 分' + (G.streak >= 2 ? '（连对 ' + G.streak + ' 封）' : '');
      $$('#gSlots i').forEach(function (s, i) { if (i < G.loaded) { s.className = 'in'; s.textContent = '✉️'; } });
      setTimeout(function () { if (L) L.classList.add('fly'); }, 350);
      setTimeout(gNext, 950);
    } else {
      G.wrong++; G.streak = 0; G.queue.push(G.cur); beep('bad');
      if (L) L.classList.add('bad');
      fbN.className = 'fb no'; fbN.innerHTML = msg + ' 这封信回到队尾，等会儿再来。';
      setTimeout(gNext, 2300);
    }
    $('#gScore').textContent = G.score;
    $('#gStreak').textContent = G.streak >= 2 ? '🔥 连对 ' + G.streak : '';
  }
  function gEnd() {
    if (gTimer) { clearInterval(gTimer); gTimer = null; }
    var stars = G.wrong <= 1 ? 3 : G.wrong <= 3 ? 2 : 1, secs = Math.round((Date.now() - G.start) / 1000);
    ST.game = { right: G.right, wrong: G.wrong, best: G.best, score: G.score, stars: stars, secs: secs, played: ST.game.played + 1 };
    beep('win');
    $('#gBox').innerHTML = '<div class="card g-end"><div style="overflow:hidden"><img class="g-van vanrun" src="assets/img/van.webp" alt="" style="width:150px;margin:0 auto"></div>' +
      '<h3 style="margin:6px 0 0">邮车出发了！8 封信全部送出</h3><div class="stars">' + '★★★'.slice(0, stars) + '<span style="opacity:.2">' + '★★★'.slice(stars) + '</span></div>' +
      '<p style="margin:0">得分 <b>' + G.score + '</b>　答对 ' + G.right + ' 次　答错 ' + G.wrong + ' 次　最长连对 ' + G.best + ' 封　用时 ' + secs + ' 秒</p>' +
      '<p class="muted">' + (stars === 3 ? '太稳了！' : '答错的信都重新做对了。想拿三颗星可以再玩一次。') + '</p>' +
      '<button class="btn" id="gAgain">再玩一次</button></div>';
    $('#gAgain').onclick = gStart;
    G = null;
    complete('game');
  }
  INIT.game = function () { $('#gBox').addEventListener('click', gClick); };
  ENTER.game = gIntro;

  /* ---------- 第 9 步：过关 ---------- */
  ENTER.pass = function () {
    var need = ['read', 'imitate', 'rewrite', 'trans', 'mark', 'game'];
    var all = need.every(function (k) { return done[k]; });
    if (all) { complete('pass'); beep('win'); }
    var h = '<div class="tags"><span class="tag r">KET 写作 · 短邮件</span><span class="tag">一般过去时</span></div>';
    h += '<h1>' + (all ? '这一课过关了！' : '这一课走到头了') + '</h1>';
    if (!all) h += '<p class="sub">有几步是跳过的（样本审阅用）。孩子真学的时候，每一步做完才盖邮戳，6 枚盖齐才发徽章。</p>';
    h += '<div class="badge"' + (all ? '' : ' style="opacity:.35"') + '><span>WELL DONE</span><b>Past-Tense<br>Postie</b><span>★ ★ ★</span></div>' +
      '<p style="text-align:center;margin:0 0 6px">徽章：<b>昨天的事，我会写了</b></p>';
    if (ST.write.final) h += '<div class="mail"><div class="mail-h">已寄出 ✉️　To: <b>Tom</b></div><div class="mail-b" style="white-space:pre-wrap;font:18px/1.7 Georgia,serif">' + esc(ST.write.final) + '</div></div>';
    function r(a, b, c) { return '<span>' + a + '</span><span class="muted">' + b + '</span><b>' + c + '</b>'; }
    h += '<h3>这一课的学情小结</h3><div class="card"><div class="stat">' +
      r('读范文', '找出 5 个动词，误点 ' + ST.read.miss + ' 次', done.read ? '✓' : '—') +
      r('仿写', '一次做对 ' + ST.imitate.first + ' / 4 句', done.imitate ? '✓' : '—') +
      r('改写', '一次做对 ' + ST.rewrite.first + ' / 3 句', done.rewrite ? '✓' : '—') +
      r('翻译', '一次做对 ' + ST.trans.first + ' / 3 句', done.trans ? '✓' : '—') +
      r('写邮件', ST.write.tries ? '交了 ' + ST.write.tries + ' 次，第一次有 ' + ST.write.firstErr + ' 处动词要改' : '还没交', done.mark ? '✓' : '—') +
      r('游戏', ST.game.played ? '答对 ' + ST.game.right + '，答错 ' + ST.game.wrong + '，' + ST.game.stars + ' 星' : '还没玩', done.game ? '✓' : '—') +
      r('问老师', '点了 ' + ST.asks + ' 次', '') + '</div>' +
      '<span class="demo">样本演示：这里只有这一课、这一台设备上的数据。正式版会进学情看板，老师能看到孩子卡在哪一步。</span></div>';
    h += '<h3>这一课的小闭环</h3><div class="card"><ol class="points">' +
      '<li><b>学</b>：1 分钟视频 + 读一封范文，自己把变了样的动词找出来</li>' +
      '<li><b>练</b>：仿写 → 改写 → 翻译 → 写一封短邮件，每一步当场判对错</li>' +
      '<li><b>改</b>：写完马上批改（任务完成度、语法纠错、句型优化），改到过关</li>' +
      '<li><b>玩</b>：「赶邮车」用同一批句型和动词</li>' +
      '<li><b>过关</b>：6 枚邮戳盖齐发徽章；卡住时找老师</li></ol></div>';
    h += '<h3>接下来可以出的课</h3><div class="card"><p style="margin:0 0 4px">同一套「看 → 读 → 仿写 → 改写 → 翻译 → 写 → 批改 → 游戏」的模板，换话题、换语法点就是下一课，比如：</p><ol class="points">' +
      '<li>便条：给妈妈留一张便条（情态动词 can / must）</li>' +
      '<li>短邮件：约朋友周末出去玩（be going to）</li>' +
      '<li>短篇记叙：看三幅图写一个小故事（一般过去时 + and / then / because）</li></ol>' +
      '<span class="demo">样本演示：这三课还没做，只是按你 KET 写作清单（便条、短邮件、信息填空、短篇记叙）列出可以接着让 AI 出的题目。</span></div>';
    h += '<button class="btn" data-goto="0">从头再来一遍</button>';
    $('#psBox').innerHTML = h;
  };

  /* ---------- 问老师 ---------- */
  function openAsk() {
    $('#askWhere').textContent = cur === 0 ? '开始页' : '第 ' + cur + ' 步 · ' + STEPS[cur].name;
    $('#askFb').className = 'fb'; $('#askFb').innerHTML = ''; $('#askText').value = '';
    $$('#askWhy .chip').forEach(function (c) { c.classList.remove('sel'); });
    $('#askSend').style.display = '';
    $('#askSheet').classList.add('on');
  }
  $('#askBtn').onclick = openAsk;
  $('#askClose').onclick = function () { $('#askSheet').classList.remove('on'); };
  $('#askSheet').addEventListener('click', function (e) { if (e.target === this) this.classList.remove('on'); });
  $('#askWhy').addEventListener('click', function (e) {
    var c = closest(e.target, '.chip'); if (!c) return;
    $$('#askWhy .chip').forEach(function (x) { x.classList.toggle('sel', x === c); });
  });
  $('#askSend').onclick = function () {
    var why = $('#askWhy .chip.sel');
    ST.asks++;
    $('#askFb').className = 'fb ok';
    $('#askFb').innerHTML = '已记下：<b>' + $('#askWhere').textContent + '</b>' + (why ? ' · ' + why.textContent : '') + '。老师回复之前，可以先照 Pip 的提示接着往下学。';
    $('#askSend').style.display = 'none';
  };

  /* ---------- 启动 ---------- */
  $('#vid').addEventListener('play', function () { complete('video'); });
  renderProg();
  var m = /[#&]s=(\d)/.exec(location.hash);
  if (m) go(parseInt(m[1], 10));
})();
