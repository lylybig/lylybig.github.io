(function () {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- hero: residual-mask strip ---------- */
  const strip = document.getElementById('blocks');
  const code = document.getElementById('maskcode');
  if (strip && code) {
    const L = 8, blks = [];
    for (let i = 0; i < L; i++) {
      if (i) { const w = document.createElement('i'); w.className = 'wire'; strip.appendChild(w); }
      const b = document.createElement('span'); b.className = 'blk'; b.textContent = 'F' + (i + 1);
      strip.appendChild(b); blks.push(b);
    }
    const masks = ['10110100', '10111000', '01001100', '11111111', '00000000', '11010110', '01110011', '10011101'];
    let idx = 0;
    const show = m => {
      blks.forEach((b, i) => b.classList.toggle('on', m[i] === '1'));
      const k = m.split('').filter(c => c === '1').length;
      code.innerHTML = `m = <b>${m}</b> &nbsp;·&nbsp; |S| = <b>${k}</b>`;
    };
    show(masks[0]);
    if (!reduce) setInterval(() => { idx = (idx + 1) % masks.length; show(masks[idx]); }, 1600);
  }

  /* ---------- scroll-spy for the nav ---------- */
  const links = Array.from(document.querySelectorAll('.nav ul a[href^="#"]'));
  const targets = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  if (targets.length && 'IntersectionObserver' in window) {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    targets.forEach(t => obs.observe(t));
  }

  /* ---------- KaTeX ---------- */
  function renderMath() {
    if (window.renderMathInElement) {
      window.renderMathInElement(document.body, {
        delimiters: [{ left: '\\[', right: '\\]', display: true }, { left: '$', right: '$', display: false }],
        throwOnError: false
      });
    }
  }
  if (document.readyState === 'complete') renderMath(); else window.addEventListener('load', renderMath);

  /* ---------- BibTeX copy ---------- */
  const btn = document.getElementById('copy-bib');
  if (btn) btn.addEventListener('click', () => {
    const txt = document.getElementById('bibtex').textContent;
    const done = ok => { btn.textContent = ok ? 'Copied' : 'Select & copy'; setTimeout(() => (btn.textContent = 'Copy'), 1800); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(() => done(true), () => { selectBib(); done(false); });
    } else { selectBib(); done(false); }
  });
  function selectBib() {
    const r = document.createRange(); r.selectNodeContents(document.getElementById('bibtex'));
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  }
})();
