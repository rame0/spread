// Applies the saved color scheme before React starts, so the page does not flash.
(function () {
  var mode = 'system';
  try { mode = localStorage.getItem('mui-mode') || 'system'; } catch (e) {}
  var dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-color-scheme', dark ? 'dark' : 'light');
})();
