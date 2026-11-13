(() => {
  'use strict';

  const { Chess } = window.ChessLib;
  const { OPENINGS, TIERS, DIFFICULTY, PIECE_SVG } = window;
  const $app = document.getElementById('app');
  const FILES = 'abcdefgh';
  const PIECE_NAMES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
  const STAR_LABELS = ['', 'Dubious', 'Risky', 'Good', 'Excellent', 'Top tier'];
  const DIFF_CLASS = ['easy', 'medium', 'hard', 'vhard'];
  const GAMBIT_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 2L5 13.5h5.5L9.5 22 19 9.5h-6z" fill="currentColor"/></svg>';

  /* ───────── helpers ───────── */

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(kid));
    }
    return el;
  }

  // Timers that must die when the screen changes.
  let timers = [];
  function later(ms, fn) {
    const id = setTimeout(fn, ms);
    timers.push(id);
    return id;
  }
  function cleanup() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  function show(view, direction) {
    cleanup();
    view.classList.add('view', direction ? 'enter-' + direction : 'enter-fade');
    $app.replaceChildren(view);
  }

  /* ───────── saved progress ───────── */

  const KEY = 'pip-chess-v1';
  const store = {
    data: (() => {
      try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
    })(),
    get(id) { return (this.data.progress || {})[id] || {}; },
    set(id, patch) {
      this.data.progress = this.data.progress || {};
      this.data.progress[id] = { ...this.get(id), ...patch };
      this.save();
    },
    get tab() { return ['w', 'b', 'g'].includes(this.data.tab) ? this.data.tab : 'w'; },
    set tab(v) { this.data.tab = v; this.save(); },
    save() {
      try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* private mode: progress lasts for this visit only */ }
    },
  };

  /* ───────── drawing: pieces, boards, stars, Pip ───────── */

  function injectSprite() {
    const symbols = Object.entries(PIECE_SVG)
      .map(([k, v]) => `<symbol id="pc-${k}" viewBox="0 0 45 45">${v}</symbol>`)
      .join('');
    document.body.insertAdjacentHTML(
      'afterbegin',
      `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${symbols}</svg>`,
    );
  }

  const pieceSVG = (color, type) =>
    `<svg viewBox="0 0 45 45" aria-hidden="true"><use href="#pc-${color}${type.toUpperCase()}"/></svg>`;

  function sqXY(sq, orient) {
    const f = FILES.indexOf(sq[0]);
    const r = +sq[1] - 1;
    return orient === 'w' ? [f, 7 - r] : [7 - f, r];
  }

  // Small static board used on the menu cards.
  function miniBoard(chess, orient) {
    let out = '<svg class="mini-board" viewBox="0 0 8 8" aria-hidden="true"><rect width="8" height="8" class="mb-light"/>';
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2) out += `<rect x="${x}" y="${y}" width="1" height="1" class="mb-dark"/>`;
    for (const row of chess.board()) {
      for (const p of row) {
        if (!p) continue;
        const [x, y] = sqXY(p.square, orient);
        out += `<use href="#pc-${p.color}${p.type.toUpperCase()}" x="${x}" y="${y}" width="1" height="1"/>`;
      }
    }
    return out + '</svg>';
  }

  function stars(n) {
    const path = 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z';
    let out = `<span class="stars" role="img" aria-label="${n} out of 5 stars">`;
    for (let i = 1; i <= 5; i++) out += `<svg viewBox="0 0 24 24" class="${i <= n ? 'on' : 'off'}"><path d="${path}"/></svg>`;
    return out + '</span>';
  }

  function diffChip(level) {
    let bars = '';
    for (let i = 0; i < 4; i++) bars += `<i class="${i <= level ? 'on' : ''}"></i>`;
    return `<span class="chip diff ${DIFF_CLASS[level]}"><span class="bars" aria-hidden="true">${bars}</span>${DIFFICULTY[level]}</span>`;
  }

  // Pip, the pawn who explains things.
  function pip(mood = 'happy') {
    const stroke = 'fill="none" stroke="#3a2608" stroke-width="2.2" stroke-linecap="round"';
    const mouth = {
      happy: `<path d="M26.5 27q5.5 5 11 0" ${stroke}/>`,
      cheer: '<path d="M25.5 26h13a6.5 6.5 0 0 1-13 0z" fill="#3a2608"/>',
      think: `<path d="M28.5 28.8h7" ${stroke}/>`,
      oops: `<path d="M27 30.5q5-4.5 10 0" ${stroke}/>`,
    }[mood];
    return `<svg class="pip-svg pip-${mood}" viewBox="0 0 64 76" role="img" aria-label="Pip the pawn">
      <ellipse cx="32" cy="72" rx="21" ry="3" class="pip-shadow"/>
      <path d="M21 62c3-7 5-14 5-21h12c0 7 2 14 5 21z" class="pip-body"/>
      <rect x="12" y="60" width="40" height="10" rx="5" class="pip-base"/>
      <rect x="19" y="36" width="26" height="6.5" rx="3.25" class="pip-base"/>
      <circle cx="32" cy="21" r="16.5" class="pip-body"/>
      <path d="M20.5 15.5a13 13 0 0 1 7.5-7" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2.6" stroke-linecap="round"/>
      <g class="pip-eyes" fill="#3a2608"><ellipse cx="26" cy="20.5" rx="2.3" ry="3"/><ellipse cx="38" cy="20.5" rx="2.3" ry="3"/></g>
      <circle cx="21.5" cy="26" r="2.6" fill="#ff7a59" fill-opacity=".45"/><circle cx="42.5" cy="26" r="2.6" fill="#ff7a59" fill-opacity=".45"/>
      ${mouth}
    </svg>`;
  }

  /* ───────── the interactive board ───────── */

  class Board {
    constructor(root, { orientation = 'w', userColor = null, onAttempt = null } = {}) {
      this.root = root;
      this.o = orientation;
      this.userColor = userColor;
      this.onAttempt = onAttempt;
      this.enabled = false;
      this.selected = null;
      this.targets = [];
      this.chess = new Chess();

      root.classList.add('board');
      this.sqEls = {};
      const grid = h('div', { class: 'squares' });
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const file = orientation === 'w' ? x : 7 - x;
          const rank = orientation === 'w' ? 8 - y : y + 1;
          const sq = FILES[file] + rank;
          const el = h('div', { class: 'sq ' + ((file + rank) % 2 ? 'dark' : 'light') });
          if (x === 0) el.append(h('span', { class: 'coord rank' }, String(rank)));
          if (y === 7) el.append(h('span', { class: 'coord file' }, FILES[file]));
          this.sqEls[sq] = el;
          grid.append(el);
        }
      }
      this.piecesEl = h('div', { class: 'pieces' });
      this.arrowEl = h('div', { class: 'arrows' });
      root.replaceChildren(grid, this.arrowEl, this.piecesEl);
      this.render();
      if (userColor) this.bind();
    }

    render() {
      this.piecesEl.replaceChildren();
      for (const row of this.chess.board()) {
        for (const p of row) {
          if (!p) continue;
          const el = h('div', { class: 'piece', html: pieceSVG(p.color, p.type) });
          this.place(el, p.square);
          this.piecesEl.append(el);
        }
      }
    }

    reset() {
      this.chess.reset();
      this.clearMarks();
      this.clearHint();
      this.render();
    }

    place(el, sq) {
      const [x, y] = sqXY(sq, this.o);
      el.style.transform = `translate(${x * 100}%, ${y * 100}%)`;
      el.dataset.sq = sq;
    }

    pieceAt(sq) {
      return this.piecesEl.querySelector(`.piece[data-sq="${sq}"]`);
    }

    remove(sq) {
      const el = this.pieceAt(sq);
      if (!el) return;
      delete el.dataset.sq;
      el.classList.add('gone');
      setTimeout(() => el.remove(), 220);
    }

    // Play a move (SAN) on the board and animate it.
    play(san) {
      const m = this.chess.move(san);
      this.select(null);
      if (m.flags.includes('e')) this.remove(m.to[0] + m.from[1]);
      else if (m.captured) this.remove(m.to);
      const el = this.pieceAt(m.from);
      el.classList.remove('drag');
      this.place(el, m.to);
      if (m.flags.includes('k') || m.flags.includes('q')) {
        const rank = m.from[1];
        const [rf, rt] = m.flags.includes('k') ? ['h', 'f'] : ['a', 'd'];
        this.place(this.pieceAt(rf + rank), rt + rank);
      }
      if (m.promotion) el.innerHTML = pieceSVG(m.color, m.promotion);
      this.clearMarks();
      this.sqEls[m.from].classList.add('last');
      this.sqEls[m.to].classList.add('last');
      return m;
    }

    clearMarks() {
      for (const el of Object.values(this.sqEls)) el.classList.remove('last');
    }

    select(sq) {
      for (const el of Object.values(this.sqEls)) el.classList.remove('sel', 'target', 'capture');
      this.selected = sq;
      this.targets = [];
      if (!sq) return;
      this.sqEls[sq].classList.add('sel');
      for (const m of this.chess.moves({ square: sq, verbose: true })) {
        this.targets.push(m.to);
        this.sqEls[m.to].classList.add('target');
        if (m.captured) this.sqEls[m.to].classList.add('capture');
      }
    }

    // level 1 highlights the piece to move, level 2 also draws the arrow.
    hint(from, to, level = 2) {
      this.clearHint();
      this.sqEls[from].classList.add('hint');
      if (level < 2) return;
      const [x1, y1] = sqXY(from, this.o).map((v) => v + 0.5);
      const [x2, y2] = sqXY(to, this.o).map((v) => v + 0.5);
      const len = Math.hypot(x2 - x1, y2 - y1);
      const ex = x2 - ((x2 - x1) / len) * 0.38;
      const ey = y2 - ((y2 - y1) / len) * 0.38;
      this.arrowEl.innerHTML = `<svg viewBox="0 0 8 8"><defs><marker id="ah" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="2.6" markerHeight="2.6" orient="auto"><path d="M0 0l10 5-10 5z" class="arrow-head"/></marker></defs><line x1="${x1}" y1="${y1}" x2="${ex}" y2="${ey}" class="arrow-line" marker-end="url(#ah)"/></svg>`;
    }

    clearHint() {
      for (const el of Object.values(this.sqEls)) el.classList.remove('hint');
      this.arrowEl.innerHTML = '';
    }

    shake(sq) {
      const el = this.pieceAt(sq);
      if (el && el.firstChild.animate) {
        el.firstChild.animate(
          [{ transform: 'translateX(0)' }, { transform: 'translateX(-12%)' }, { transform: 'translateX(12%)' }, { transform: 'translateX(-6%)' }, { transform: 'translateX(0)' }],
          { duration: 320 },
        );
      }
    }

    squareFromEvent(e) {
      const r = this.root.getBoundingClientRect();
      const x = Math.floor(((e.clientX - r.left) / r.width) * 8);
      const y = Math.floor(((e.clientY - r.top) / r.height) * 8);
      if (x < 0 || x > 7 || y < 0 || y > 7) return null;
      return this.o === 'w' ? FILES[x] + (8 - y) : FILES[7 - x] + (y + 1);
    }

    attempt(from, to) {
      const ok = this.onAttempt(from, to);
      if (!ok) {
        const el = this.pieceAt(from);
        if (el) { el.classList.remove('drag'); this.place(el, from); }
        this.select(null);
        this.shake(from);
      }
    }

    // Tap a piece then a square, or drag the piece there.
    bind() {
      let drag = null;
      const root = this.root;

      root.addEventListener('pointerdown', (e) => {
        if (!this.enabled) return;
        const sq = this.squareFromEvent(e);
        if (!sq) return;
        if (this.selected && this.targets.includes(sq)) {
          this.attempt(this.selected, sq);
          return;
        }
        const p = this.chess.get(sq);
        if (p && p.color === this.userColor && this.chess.turn() === this.userColor) {
          const wasSelected = this.selected === sq;
          this.select(sq);
          drag = { sq, el: this.pieceAt(sq), x: e.clientX, y: e.clientY, moved: false, wasSelected };
          try { root.setPointerCapture(e.pointerId); } catch { /* not supported */ }
        } else {
          this.select(null);
        }
      });

      root.addEventListener('pointermove', (e) => {
        if (!drag) return;
        if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return;
        drag.moved = true;
        const r = root.getBoundingClientRect();
        const size = r.width / 8;
        drag.el.classList.add('drag');
        drag.el.style.transform = `translate(${e.clientX - r.left - size / 2}px, ${e.clientY - r.top - size / 2}px) scale(1.15)`;
      });

      const end = (e) => {
        if (!drag) return;
        const d = drag;
        drag = null;
        if (!d.moved) {
          if (d.wasSelected) this.select(null);
          return;
        }
        const sq = e.type === 'pointerup' ? this.squareFromEvent(e) : null;
        if (sq && sq !== d.sq && this.targets.includes(sq)) {
          this.attempt(d.sq, sq);
        } else {
          d.el.classList.remove('drag');
          this.place(d.el, d.sq);
          if (sq && sq !== d.sq) { this.select(null); this.shake(d.sq); }
        }
      };
      root.addEventListener('pointerup', end);
      root.addEventListener('pointercancel', end);
    }
  }

  /* ───────── opening helpers ───────── */

  const moveLabel = (i, san) => `${Math.floor(i / 2) + 1}.${i % 2 ? '..' : ''} ${san}`;

  function describe(m) {
    if (m.flags.includes('k')) return 'castle kingside';
    if (m.flags.includes('q')) return 'castle queenside';
    return `${PIECE_NAMES[m.piece]} ${m.captured ? 'takes on' : 'to'} ${m.to}`;
  }

  function lineText(o) {
    return o.moves.map(([san], i) => (i % 2 ? san : `${i / 2 + 1}.${san}`)).join(' ');
  }

  // Final position of each opening, used for the menu previews.
  for (const o of OPENINGS) {
    const c = new Chess();
    o.moves.forEach(([san]) => c.move(san));
    o.preview = miniBoard(c, o.side);
  }

  /* ───────── screen: menu ───────── */

  let homeScroll = 0;

  function renderHome(direction) {
    const tab = store.tab;
    const learned = OPENINGS.filter((o) => store.get(o.id).learned).length;

    const seg = h('div', { class: 'segmented', role: 'tablist', 'aria-label': 'Choose a course list' },
      ...[['w', 'White', pieceSVG('w', 'k')], ['b', 'Black', pieceSVG('b', 'k')], ['g', 'Gambits', GAMBIT_ICON]].map(([t, label, icon]) =>
        h('button', {
          class: 'seg' + (t === tab ? ' on' : ''), role: 'tab', 'aria-selected': String(t === tab),
          html: icon + `<span>${label}</span>`,
          onclick: () => { if (store.tab !== t) { store.tab = t; homeScroll = 0; renderHome(); } },
        })));

    // Each tab is a list of groups: Elo levels for White and Black, colours for Gambits.
    const groups = tab === 'g'
      ? [
        { name: 'Gambits for White', pill: 'You play White', blurb: 'Give up a pawn or two early to open lines and attack before Black is ready.', list: OPENINGS.filter((o) => o.gambit && o.side === 'w'), jump: 'For White' },
        { name: 'Gambits for Black', pill: 'You play Black', blurb: 'Counter-gambits that grab the initiative from White, from sound to downright cheeky.', list: OPENINGS.filter((o) => o.gambit && o.side === 'b'), jump: 'For Black' },
      ]
      : TIERS.map((tier, t) => ({ name: tier.name, pill: 'Elo ' + tier.elo, blurb: tier.blurb, list: OPENINGS.filter((o) => o.side === tab && o.tier === t), jump: tier.name }));

    const sections = [];
    const jump = h('nav', { class: 'tier-nav', 'aria-label': 'Jump to section' });
    for (const g of groups) {
      if (!g.list.length) continue;
      const section = h('section', { class: 'tier' },
        h('div', { class: 'tier-head' }, h('h2', {}, g.name), h('span', { class: 'elo' }, g.pill)),
        h('p', { class: 'tier-blurb' }, g.blurb),
        h('div', { class: 'cards' }, ...g.list.map((o) => card(o, tab === 'g'))));
      sections.push(section);
      jump.append(h('button', { class: 'jump', onclick: () => section.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, g.jump));
    }

    const view = h('main', { class: 'home' },
      h('header', { class: 'hero' },
        h('div', { class: 'hero-pip', html: pip('happy') }),
        h('div', { class: 'hero-text' },
          h('h1', {}, 'Chess Openings'),
          h('p', {}, learned
            ? `Welcome back! You've learned ${learned} of ${OPENINGS.length} openings.`
            : "Hi, I'm Pip. Pick an opening and I'll explain every move."))),
      h('div', { class: 'sticky-bar' }, seg, jump),
      tab === 'g' && h('p', { class: 'intro' }, 'A gambit gives up material, usually a pawn, in return for fast development and attacking chances. The stars tell you how well each one holds up against good defence.'),
      ...sections,
      h('p', { class: 'footnote' }, 'Star ratings and Elo groups are a guide to how sound and how popular each opening is at that level, not a strict rule. Play what you enjoy.'));

    show(view, direction);
    view.scrollTop = homeScroll;
    view.addEventListener('scroll', () => { homeScroll = view.scrollTop; }, { passive: true });
  }

  function card(o, inGambits) {
    const p = store.get(o.id);
    const badge = p.best === 1 ? 'Mastered' : p.learned ? 'Learned' : '';
    return h('button', { class: 'card', onclick: () => renderDetail(o, 'forward') },
      h('div', { class: 'card-board', html: o.preview }),
      h('div', { class: 'card-body' },
        h('div', { class: 'card-title' }, o.name),
        h('p', { class: 'card-tag' }, o.tagline),
        h('div', { class: 'card-meta', html: stars(o.stars) + diffChip(o.difficulty) + (inGambits ? `<span class="chip">${TIERS[o.tier].name}</span>` : o.gambit ? '<span class="chip gambit">Gambit</span>' : '') + (badge ? `<span class="chip done">✓ ${badge}</span>` : '') })));
  }

  /* ───────── screen: opening detail ───────── */

  function renderDetail(o, direction) {
    const tier = TIERS[o.tier];
    const p = store.get(o.id);
    const boardEl = h('div', {});
    const caption = h('div', { class: 'preview-caption' });

    const view = h('main', { class: 'detail' },
      h('div', { class: 'topbar' },
        h('button', { class: 'back', onclick: () => renderHome('back'), 'aria-label': 'Back to openings' },
          h('span', { class: 'chev', html: '<svg viewBox="0 0 12 20"><path d="M10 2L2 10l8 8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' }), 'Openings')),
      h('div', { class: 'preview' }, boardEl, caption),
      h('div', { class: 'detail-head' },
        h('p', { class: 'eyebrow' }, `${o.side === 'w' ? 'You play White' : 'You play Black'}${o.gambit ? ' · Gambit' : ''} · ECO ${o.eco}`),
        h('h1', {}, o.name),
        h('p', { class: 'lede' }, o.tagline)),
      h('div', { class: 'facts' },
        h('div', { class: 'fact' }, h('span', { class: 'fact-label' }, 'Strength'), h('span', { html: stars(o.stars) }), h('span', { class: 'fact-note' }, STAR_LABELS[o.stars])),
        h('div', { class: 'fact' }, h('span', { class: 'fact-label' }, 'To study'), h('span', { html: diffChip(o.difficulty) }), h('span', { class: 'fact-note' }, `${o.moves.length} moves here`)),
        h('div', { class: 'fact' }, h('span', { class: 'fact-label' }, 'Level'), h('strong', {}, tier.name), h('span', { class: 'fact-note' }, 'Elo ' + tier.elo))),
      h('section', { class: 'block' }, h('h2', {}, 'A little history'), h('p', {}, o.history)),
      h('section', { class: 'block' }, h('h2', {}, 'Key ideas'), h('ul', { class: 'ideas' }, ...o.ideas.map((t) => h('li', {}, t)))),
      h('section', { class: 'block' }, h('h2', {}, 'The line'), h('p', { class: 'line' }, lineText(o))),
      h('div', { class: 'cta' },
        h('button', { class: 'btn primary', onclick: () => renderLesson(o, 'learn') }, p.learned ? 'Learn again with Pip' : 'Learn with Pip'),
        h('button', { class: 'btn', onclick: () => renderLesson(o, 'practice') }, p.best != null ? `Practice · best ${Math.round(p.best * 100)}%` : 'Practice from memory')));

    show(view, direction);

    // Looping preview of the line.
    const board = new Board(boardEl, { orientation: o.side });
    let i = 0;
    const tick = () => {
      if (i >= o.moves.length) {
        later(2200, () => { board.reset(); i = 0; caption.textContent = 'Starting position'; later(900, tick); });
        return;
      }
      const san = o.moves[i][0];
      board.play(san);
      caption.textContent = moveLabel(i, san);
      i++;
      later(i >= o.moves.length ? 0 : 850, tick);
    };
    caption.textContent = 'Starting position';
    later(900, tick);
  }

  /* ───────── screen: lesson ───────── */

  function renderLesson(o, mode) {
    const user = o.side;
    const total = o.moves.length;
    const isUserPly = (i) => (i % 2 === 0) === (user === 'w');
    let idx = 0;
    let wrong = 0;
    let hintLevel = 0;
    let cleanPlies = 0;
    let userPlies = 0;

    const boardEl = h('div', {});
    const bar = h('div', { class: 'progress-fill' });
    const counter = h('span', { class: 'counter' });
    const pipEl = h('div', { class: 'coach-pip' });
    const tagEl = h('div', { class: 'move-tag' });
    const textEl = h('p', { class: 'why' });
    const promptEl = h('div', { class: 'prompt' });
    const actions = h('div', { class: 'actions' });

    const view = h('main', { class: 'lesson' },
      h('div', { class: 'lesson-top' },
        h('button', { class: 'close', 'aria-label': 'Leave lesson', onclick: () => renderDetail(o, 'back'), html: '<svg viewBox="0 0 20 20"><path d="M4 4l12 12M16 4L4 16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>' }),
        h('div', { class: 'progress', role: 'progressbar', 'aria-label': 'Lesson progress' }, bar),
        counter),
      h('div', { class: 'lesson-title' }, h('strong', {}, o.name), h('span', { class: 'chip mode' }, mode === 'learn' ? 'Learn' : 'Practice')),
      h('div', { class: 'lesson-board' }, boardEl),
      actions,
      h('div', { class: 'coach' }, pipEl, h('div', { class: 'bubble', 'aria-live': 'polite' }, tagEl, textEl, promptEl)));

    show(view, 'forward');
    const board = new Board(boardEl, { orientation: user, userColor: user, onAttempt });

    function coach({ mood = 'happy', tag = '', tagClass = '', text = '', prompt = '' }) {
      pipEl.innerHTML = pip(mood);
      tagEl.textContent = tag;
      tagEl.className = 'move-tag ' + tagClass;
      tagEl.hidden = !tag;
      textEl.textContent = text;
      textEl.hidden = !text;
      promptEl.innerHTML = prompt;
      promptEl.hidden = !prompt;
    }
    const setPrompt = (mood, html) => { pipEl.innerHTML = pip(mood); promptEl.innerHTML = html; promptEl.hidden = false; };

    function setActions(...btns) {
      actions.replaceChildren(...btns);
    }
    function progress() {
      bar.style.width = (idx / total) * 100 + '%';
      counter.textContent = `${idx}/${total}`;
    }

    function expected() {
      const m = board.chess.move(o.moves[idx][0]);
      board.chess.undo();
      return m;
    }

    const playPrompt = (m) => `Your turn. Play <b>${m.san}</b> <span class="say">(${describe(m)})</span>`;

    function showHint() {
      const m = expected();
      hintLevel = Math.min(hintLevel + 1, 2);
      board.hint(m.from, m.to, hintLevel);
      setPrompt('think', hintLevel === 1
        ? `Move the highlighted ${PIECE_NAMES[m.piece]}. Where does it go?`
        : `The move is <b>${m.san}</b> <span class="say">(${describe(m)})</span>. Follow the arrow.`);
    }

    // Ask the learner for their move. `keep` leaves Pip's last explanation on screen.
    function askUser(keep) {
      const m = expected();
      wrong = 0;
      hintLevel = 0;
      board.enabled = true;
      if (mode === 'learn') {
        board.hint(m.from, m.to, 2);
        if (keep) setPrompt('happy', playPrompt(m));
        else coach({ text: `You have the ${user === 'w' ? 'white' : 'black'} pieces. Tap a piece, then the square it goes to. You can also drag it.`, prompt: playPrompt(m) });
        setActions(h('p', { class: 'tip' }, 'Follow the arrow on the board'));
      } else {
        const q = 'Your turn. What do we play here?';
        if (keep) setPrompt('think', q);
        else coach({ mood: 'think', text: `Play the ${o.name} from memory. I'll step in if you get stuck.`, prompt: q });
        setActions(h('button', { class: 'btn ghost', onclick: showHint }, 'Show me a hint'));
      }
    }

    function opponentMove() {
      board.enabled = false;
      setActions(h('p', { class: 'tip' }, `${user === 'w' ? 'Black' : 'White'} is thinking…`));
      later(550, () => {
        const [san, why] = o.moves[idx];
        board.play(san);
        coach({ tag: `${user === 'w' ? 'Black' : 'White'} plays ${moveLabel(idx, san)}`, tagClass: 'opp', text: why });
        idx++;
        progress();
        if (idx >= total) setActions(h('button', { class: 'btn primary', onclick: finish }, 'Finish'));
        else askUser(true);
      });
    }

    function onAttempt(from, to) {
      const m = expected();
      if (m.from !== from || m.to !== to) {
        wrong++;
        if (mode === 'learn') {
          setPrompt('oops', `Not that one. In this opening we play <b>${m.san}</b> <span class="say">(${describe(m)})</span>.`);
        } else if (wrong === 1 && hintLevel === 0) {
          setPrompt('oops', 'Not quite. Have another look.');
        } else {
          showHint();
        }
        return false;
      }
      const [san, why] = o.moves[idx];
      board.enabled = false;
      board.clearHint();
      board.play(san);
      userPlies++;
      if (wrong === 0 && hintLevel === 0) cleanPlies++;
      coach({ mood: 'cheer', tag: `✓ You played ${moveLabel(idx, san)}`, tagClass: 'you', text: why });
      idx++;
      progress();
      const last = idx >= total;
      setActions(h('button', { class: 'btn primary', onclick: last ? finish : opponentMove }, last ? 'Finish' : 'Next'));
      return true;
    }

    function finish() {
      const prev = store.get(o.id);
      const score = userPlies ? cleanPlies / userPlies : 0;
      if (mode === 'learn') store.set(o.id, { learned: true });
      else store.set(o.id, { learned: true, best: Math.max(prev.best || 0, score) });
      renderDone(o, mode, cleanPlies, userPlies);
    }

    progress();
    if (isUserPly(0)) askUser(false);
    else {
      coach({ text: `You have the black pieces, so White moves first. Watch what they play, then it's your turn.` });
      opponentMove();
    }
  }

  /* ───────── screen: lesson complete ───────── */

  function renderDone(o, mode, clean, plies) {
    const perfect = mode === 'practice' && clean === plies;
    const headline = mode === 'learn'
      ? `You've learned the ${o.name}!`
      : perfect ? 'Perfect. Every move from memory!' : `${clean} of ${plies} moves from memory`;
    const sub = mode === 'learn'
      ? 'Now try it without the arrows and see how much sticks.'
      : perfect ? `You know the ${o.name} by heart.` : 'Run it again and the missing moves will stick.';

    const view = h('main', { class: 'done' },
      h('div', { class: 'done-pip', html: pip('cheer') }),
      h('h1', {}, headline),
      h('p', { class: 'lede' }, sub),
      h('section', { class: 'block recap' }, h('h2', {}, 'Remember'), h('ul', { class: 'ideas' }, ...o.ideas.map((t) => h('li', {}, t)))),
      h('div', { class: 'cta' },
        h('button', { class: 'btn primary', onclick: () => renderLesson(o, 'practice') }, mode === 'learn' ? 'Practice from memory' : 'Practice again'),
        h('button', { class: 'btn', onclick: () => renderHome('back') }, 'Back to openings')));
    show(view, 'forward');
  }

  /* ───────── start ───────── */

  injectSprite();
  renderHome();

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !window.__NO_SW__) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
