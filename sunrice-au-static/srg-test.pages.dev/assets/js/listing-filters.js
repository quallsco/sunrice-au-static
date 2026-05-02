const FILTER_PAGE_SELECTOR = '.listing-filter, .product-filter, .product-listing-header';
const LISTING_SECTION_SELECTOR = '.section--tight';

let currentRequest = null;

function updateLoadMoreCount(section, visibleCount, totalCount) {
  const count = section.querySelector('[data-load-more-count]');
  if (!count) return;

  const itemLabel = section.dataset.itemLabel || 'items';
  const isFiltered = section.dataset.filtered === '1';
  const shown = Math.min(visibleCount, totalCount);

  if (shown >= totalCount) {
    count.textContent = isFiltered
      ? `Showing ${totalCount} filtered ${itemLabel}`
      : `Showing all ${totalCount} ${itemLabel}`;
  } else {
    count.textContent = `Showing ${shown} of ${totalCount} ${itemLabel}`;
  }
}

function initializeLoadMore(root = document) {
  root.querySelectorAll('[data-load-more-section]').forEach((section) => {
    const list = section.querySelector('[data-load-more-list]');
    const button = section.querySelector('[data-load-more-button]');
    if (!list) return;

    const step = Number.parseInt(list.dataset.loadMoreStep || '12', 10);
    const pageSize = Number.isNaN(step) || step < 1 ? 12 : step;
    const totalCount = Number.parseInt(section.dataset.totalCount || '0', 10);
    let visibleCount = list.querySelectorAll('[data-load-more-item]').length;

    updateLoadMoreCount(section, visibleCount, totalCount);

    if (!button) return;

    button.hidden = visibleCount >= totalCount;

    button.addEventListener('click', async () => {
      button.disabled = true;
      const originalText = button.textContent;
      button.textContent = 'Loading…';

      try {
        const url = new URL(window.location.href);
        url.searchParams.set('offset', visibleCount);

        const response = await fetch(url.href, { headers: { 'X-Requested-With': 'fetch' } });
        if (!response.ok) throw new Error('Load more failed');

        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const newItems = doc.querySelectorAll('[data-load-more-item]');

        newItems.forEach((item) => list.appendChild(item.cloneNode(true)));
        visibleCount += newItems.length;

        updateLoadMoreCount(section, visibleCount, totalCount);
        button.hidden = visibleCount >= totalCount;
      } catch (e) {
        console.warn('[load-more]', e);
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    });
  });
}

function buildFormUrl(form) {
  const url = new URL(form.action, window.location.origin);
  const data = new FormData(form);

  data.forEach((value, key) => {
    const text = String(value).trim();
    if (text) {
      url.searchParams.set(key, text);
    } else {
      url.searchParams.delete(key);
    }
  });

  return url;
}

function sameListingPath(url) {
  return ['/recipes', '/products'].includes(url.pathname);
}

async function updateListing(url, pushState = true) {
  const main = document.querySelector('#content');
  if (!main || !sameListingPath(url)) {
    window.location.assign(url.href);
    return;
  }

  currentRequest?.abort();
  currentRequest = new AbortController();
  main.classList.add('is-filtering');

  try {
    const response = await fetch(url.href, {
      headers: { 'X-Requested-With': 'fetch' },
      signal: currentRequest.signal,
    });

    if (!response.ok) throw new Error(`Filter request failed: ${response.status}`);

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const nextMain = doc.querySelector('#content');

    if (!nextMain) throw new Error('Filter response did not include page content.');

    main.innerHTML = nextMain.innerHTML;
    initializeLoadMore(main);
    document.title = doc.title;

    if (pushState) {
      window.history.pushState({ ajaxFilter: true }, '', url.href);
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      window.location.assign(url.href);
    }
  } finally {
    main.classList.remove('is-filtering');
  }
}

document.addEventListener('submit', (event) => {
  const form = event.target.closest('[data-ajax-filter-form]');
  if (!form) return;

  event.preventDefault();
  updateListing(buildFormUrl(form));
});

document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-filter-dropdown]');
  if (!trigger) return;

  const root = trigger.closest('.filter-select');
  const wasOpen = root?.classList.contains('is-open');

  document.querySelectorAll('.filter-select.is-open').forEach((dropdown) => {
    dropdown.classList.remove('is-open');
  });

  if (root && !wasOpen) {
    root.classList.add('is-open');
  }
});

document.addEventListener('click', (event) => {
  const choice = event.target.closest('[data-filter-choice]');
  if (!choice) return;

  const root = choice.closest('.filter-select');
  const form = choice.closest('[data-ajax-filter-form]');
  const input = root?.querySelector('input[type="hidden"]');
  const label = root?.querySelector('[data-filter-label]');

  if (!form || !input || !label) return;

  input.value = choice.dataset.filterValue || '';
  label.textContent = choice.textContent.trim();
  root.classList.remove('is-open');

  updateListing(buildFormUrl(form));
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('.filter-select')) {
    document.querySelectorAll('.filter-select.is-open').forEach((dropdown) => {
      dropdown.classList.remove('is-open');
    });
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    document.querySelectorAll('.filter-select.is-open').forEach((dropdown) => {
      dropdown.classList.remove('is-open');
    });
  }
});

document.addEventListener('change', (event) => {
  const select = event.target.closest('[data-ajax-filter-form] select');
  if (!select) return;

  updateListing(buildFormUrl(select.form));
});

document.addEventListener('click', (event) => {
  const link = event.target.closest(`${FILTER_PAGE_SELECTOR} a[href]`);
  if (!link) return;

  const url = new URL(link.href, window.location.origin);
  if (url.origin !== window.location.origin || !sameListingPath(url)) return;

  event.preventDefault();
  updateListing(url);
});

window.addEventListener('popstate', () => {
  const url = new URL(window.location.href);
  if (sameListingPath(url)) {
    updateListing(url, false);
  }
});

initializeLoadMore();
