const setupReveal = () => {
  document.documentElement.classList.add('reveal-enabled');
  const revealItems = Array.from(document.querySelectorAll<HTMLElement>('.reveal'));

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    revealItems.forEach((item) => item.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.08 },
  );

  revealItems.forEach((item) => observer.observe(item));
};

setupReveal();
document.addEventListener('astro:page-load', setupReveal);
