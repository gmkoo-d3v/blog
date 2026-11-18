/* Tiny shared helpers for the day-1 widgets (h04b-*): HiDPI canvas fit, axis frame, element maker. No data, no globals except window.H4. */
(function (root) {
  'use strict';
  const f = (x, d = 1) => (Math.round(x * 10 ** d) / 10 ** d + 0).toFixed(d);
  const make = (tag, text, cls) => { const e = document.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; return e; };
  function fit(canvas) {
    const dpr = Math.min(root.devicePixelRatio || 1, 2), w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return null;
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    const c = canvas.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    return { c, w, h };
  }
  /* Draws a grid with tick labels inside the margins L,R,T,B and returns the x/y mappers. */
  function frame(g, m, xr, yr, xticks, yticks, xfmt, yfmt) {
    const { c, w, h } = g, X = v => m.L + (w - m.L - m.R) * (v - xr[0]) / (xr[1] - xr[0]), Y = v => m.T + (h - m.T - m.B) * (yr[1] - v) / (yr[1] - yr[0]);
    c.font = '13px sans-serif'; c.lineWidth = 1; c.strokeStyle = '#d3dedb'; c.fillStyle = '#445';
    c.textAlign = 'right'; for (const v of yticks) { c.beginPath(); c.moveTo(m.L, Y(v)); c.lineTo(w - m.R, Y(v)); c.stroke(); c.fillText(yfmt ? yfmt(v) : v, m.L - 6, Y(v) + 4); }
    c.textAlign = 'center'; for (const v of xticks) { c.beginPath(); c.moveTo(X(v), m.T); c.lineTo(X(v), h - m.B); c.stroke(); c.fillText(xfmt ? xfmt(v) : v, X(v), h - m.B + 17); }
    return { X, Y };
  }
  root.H4 = { f, make, fit, frame };
})(typeof window !== 'undefined' ? window : globalThis);
