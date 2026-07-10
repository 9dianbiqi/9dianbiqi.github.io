let observer: IntersectionObserver | undefined;
let mediaQuery: MediaQueryList | undefined;
let mediaHandler: (() => void) | undefined;

const decodeHash = (hash: string) => {
  try {
    return decodeURIComponent(hash.slice(1));
  } catch {
    return hash.slice(1);
  }
};

const initArticleToc = () => {
  observer?.disconnect();
  if (mediaQuery && mediaHandler) mediaQuery.removeEventListener('change', mediaHandler);

  const toc = document.querySelector<HTMLDetailsElement>('[data-article-toc]');
  if (!toc) return;

  const links = [...toc.querySelectorAll<HTMLAnchorElement>('[data-toc-link]')];
  const headings = links
    .map((link) => document.getElementById(decodeHash(link.hash)))
    .filter((heading): heading is HTMLElement => Boolean(heading));

  const setActive = (id: string) => {
    for (const link of links) {
      const active = decodeHash(link.hash) === id;
      if (active) {
        link.setAttribute('aria-current', 'location');
        const group = link.closest<HTMLDetailsElement>('.toc-group');
        if (group) group.open = true;
      } else {
        link.removeAttribute('aria-current');
      }
    }
  };

  mediaQuery = window.matchMedia('(min-width: 981px)');
  mediaHandler = () => {
    toc.open = Boolean(mediaQuery?.matches && toc.dataset.tocLayout === 'guide');
  };
  mediaHandler();
  mediaQuery.addEventListener('change', mediaHandler);

  if (toc.dataset.enhanced !== 'true') {
    toc.dataset.enhanced = 'true';
    toc.addEventListener('click', (event) => {
      const link = (event.target as Element).closest<HTMLAnchorElement>('[data-toc-link]');
      if (!link) return;
      setActive(decodeHash(link.hash));
      if (!window.matchMedia('(min-width: 981px)').matches) toc.open = false;
    });
  }

  if ('IntersectionObserver' in window && headings.length > 0) {
    observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const current = visible[0]?.target as HTMLElement | undefined;
        if (current) setActive(current.id);
      },
      { rootMargin: '-18% 0px -68% 0px', threshold: 0 },
    );
    headings.forEach((heading) => observer?.observe(heading));
  }

  const currentId = decodeHash(window.location.hash);
  if (currentId) setActive(currentId);
};

document.addEventListener('astro:page-load', initArticleToc);
initArticleToc();
