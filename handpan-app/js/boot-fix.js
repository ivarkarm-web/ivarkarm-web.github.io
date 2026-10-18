/** Force first handpan paint after CSS/layout settle. */
(function () {
  function repaint() {
    try {
      const core = window.PionierCore;
      if (core && typeof core.draw === 'function') {
        core.draw();
        return true;
      }
      window.dispatchEvent(new Event('resize'));
      return false;
    } catch (_) { return false; }
  }
  function run() {
    repaint();
    requestAnimationFrame(repaint);
    setTimeout(repaint, 100);
    setTimeout(repaint, 350);
    setTimeout(repaint, 900);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(run, 0));
  else setTimeout(run, 0);
})();
