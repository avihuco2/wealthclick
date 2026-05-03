// Injected before first paint — reads localStorage and sets .dark on <html>.
// Prevents flash of wrong theme on page load.
export function ThemeScript() {
  const script = `
(function(){
  try {
    var t = localStorage.getItem('theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = t === 'dark' || (!t && prefersDark);
    if (dark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  } catch(e){}
})();
`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
