import { matchesArchivePost } from '../lib/archiveFilter.mjs';

type ArchiveCard = {
  element: HTMLElement;
  searchText: string;
  tags: string[];
};

const initArchiveFilter = () => {
  const tools = document.querySelector<HTMLElement>('[data-archive-tools]');
  if (!tools || tools.dataset.enhanced === 'true') return;

  const input = tools.querySelector<HTMLInputElement>('[data-archive-search]');
  const count = tools.querySelector<HTMLElement>('[data-archive-count]');
  const reset = document.querySelector<HTMLButtonElement>('[data-archive-reset]');
  const empty = document.querySelector<HTMLElement>('[data-archive-empty]');
  const moreTags = tools.querySelector<HTMLDetailsElement>('[data-archive-more]');
  const tagButtons = [...tools.querySelectorAll<HTMLButtonElement>('[data-archive-tag]')];
  const cards: ArchiveCard[] = [...document.querySelectorAll<HTMLElement>('[data-archive-post]')].map(
    (element) => ({
      element,
      searchText: element.dataset.searchText ?? '',
      tags: JSON.parse(element.dataset.tags ?? '[]') as string[],
    }),
  );

  if (!input || !count || !reset || !empty) return;

  const validTags = tagButtons.map((button) => button.dataset.archiveTag ?? '');
  const params = new URLSearchParams(window.location.search);
  const requestedTag = params.get('tag') ?? '';
  let selectedTag = validTags.includes(requestedTag) ? requestedTag : '';
  let debounceTimer: number | undefined;

  input.value = params.get('q') ?? '';
  const selectedButton = tagButtons.find((button) => button.dataset.archiveTag === selectedTag);
  if (selectedButton?.closest('[data-archive-more]') && moreTags) moreTags.open = true;

  const syncUrl = () => {
    const next = new URL(window.location.href);
    const query = input.value.trim();
    if (query) next.searchParams.set('q', query);
    else next.searchParams.delete('q');
    if (selectedTag) next.searchParams.set('tag', selectedTag);
    else next.searchParams.delete('tag');
    window.history.replaceState({}, '', `${next.pathname}${next.search}${next.hash}`);
  };

  const applyFilters = (updateUrl = true) => {
    let visibleCount = 0;
    for (const card of cards) {
      const visible = matchesArchivePost(card, { query: input.value, tag: selectedTag });
      card.element.hidden = !visible;
      if (visible) visibleCount += 1;
    }

    for (const button of tagButtons) {
      button.setAttribute(
        'aria-pressed',
        String((button.dataset.archiveTag ?? '') === selectedTag),
      );
    }

    count.textContent = visibleCount === cards.length
      ? `共 ${visibleCount} 篇文章`
      : `找到 ${visibleCount} 篇文章`;
    empty.hidden = visibleCount > 0;
    if (updateUrl) syncUrl();
  };

  tools.dataset.enhanced = 'true';
  tools.hidden = false;

  input.addEventListener('input', () => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => applyFilters(), 150);
  });

  for (const button of tagButtons) {
    button.addEventListener('click', () => {
      selectedTag = button.dataset.archiveTag ?? '';
      applyFilters();
    });
  }

  reset.addEventListener('click', () => {
    input.value = '';
    selectedTag = '';
    applyFilters();
    input.focus();
  });

  applyFilters(requestedTag !== selectedTag);
};

document.addEventListener('astro:page-load', initArchiveFilter);
initArchiveFilter();
