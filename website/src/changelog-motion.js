export function mountChangelogMotion() {
  const section = document.querySelector('#changelog');
  if (!section || !('IntersectionObserver' in window)) return () => {};
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let observer;
  const clear = () => {
    observer?.disconnect();
    section.querySelectorAll('.reveal-pending').forEach(element => element.classList.remove('reveal-pending'));
  };
  const setup = () => {
    clear();
    if (motion.matches) return;
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.remove('reveal-pending');
          observer.unobserve(entry.target);
        }
      }
    }, { threshold: 0.08 });
    section.querySelectorAll('.reveal:not(.earlier-posts .reveal)').forEach(element => {
      element.classList.add('reveal-pending');
      observer.observe(element);
    });
  };
  setup();
  motion.addEventListener('change', setup);
  return () => { clear(); motion.removeEventListener('change', setup); };
}
