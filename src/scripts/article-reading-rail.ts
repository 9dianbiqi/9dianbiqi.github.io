import { calculateReadingProgress } from '../lib/articleReading.mjs';

let cleanup: (() => void) | undefined;

const initArticleReadingRail = () => {
  cleanup?.();

  const prose = document.querySelector<HTMLElement>('.prose');
  const rail = document.querySelector<HTMLElement>('[data-reading-rail]');
  const progress = rail?.querySelector<HTMLProgressElement>('[data-reading-progress]');
  const percent = rail?.querySelector<HTMLElement>('[data-reading-percent]');
  const current = rail?.querySelector<HTMLElement>('[data-reading-current]');
  if (!prose || !rail || !progress || !percent || !current) return;

  const headings = [
    ...prose.querySelectorAll<HTMLHeadingElement>('h2[id], h3[id]'),
  ];
  let frame = 0;

  const update = () => {
    frame = 0;
    const articleTop = prose.getBoundingClientRect().top + window.scrollY;
    const value = calculateReadingProgress(
      window.scrollY,
      articleTop,
      prose.scrollHeight,
      window.innerHeight,
    );

    progress.value = value;
    progress.textContent = `${value}%`;
    progress.setAttribute('aria-valuenow', String(value));
    percent.textContent = `${value}%`;

    const activeHeading = headings
      .filter((heading) => heading.getBoundingClientRect().top <= 160)
      .at(-1);
    current.textContent = activeHeading?.textContent?.trim() || '文章开头';
  };

  const scheduleUpdate = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(update);
  };

  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  update();

  cleanup = () => {
    window.removeEventListener('scroll', scheduleUpdate);
    window.removeEventListener('resize', scheduleUpdate);
    if (frame) window.cancelAnimationFrame(frame);
  };
};

document.addEventListener('astro:page-load', initArticleReadingRail);
initArticleReadingRail();
