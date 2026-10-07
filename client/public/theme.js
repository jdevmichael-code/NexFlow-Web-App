// Runs before the page is drawn, so there is no flash of the wrong theme.
// Plain old JavaScript on purpose: it is loaded as-is, without Vite.
(function () {
  var theme = 'dark' // the default
  try {
    theme = localStorage.getItem('nexflow-theme') || 'dark'
  } catch (e) {
    // storage blocked (private mode etc.): keep the default
  }
  document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark')
})()
