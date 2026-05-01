/**
 * Site-wide search using Fuse.js.
 * Powers two surfaces:
 *   1. Header search overlay — live results as you type
 *   2. /search page — results based on ?q= URL param
 *
 * Search index is fetched lazily from /search-index.json and cached.
 */

import Fuse from '/assets/js/vendor/fuse.esm.min.js';

const INDEX_URL = '/search-index.json';
const MAX_OVERLAY_RESULTS = 6;
const MAX_PAGE_RESULTS    = 40;

let fuseInstance = null;
let indexPromise = null;

// ── Load search index (lazy, cached) ─────────────────────────────────

function loadIndex() {
  if (!indexPromise) {
    indexPromise = fetch(INDEX_URL)
      .then(r => {
        if (!r.ok) throw new Error('Search index load failed');
        return r.json();
      })
      .then(data => {
        fuseInstance = new Fuse(data, {
          keys: [
            { name: 'title', weight: 2 },
            { name: 'text',  weight: 1 },
          ],
          threshold: 0.35,
          distance: 400,
          minMatchCharLength: 2,
          includeScore: true,
        });
        return fuseInstance;
      });
  }
  return indexPromise;
}

function search(query) {
  if (!fuseInstance || !query.trim()) return [];
  return fuseInstance.search(query.trim());
}

// ── Result card HTML ──────────────────────────────────────────────────

const TYPE_LABELS = { product: 'Product', recipe: 'Recipe', page: 'Page' };
const TYPE_ICONS  = {
  product: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M8 3v18M16 3v18M2 9h20M2 15h20"/></svg>',
  recipe:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>',
  page:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
};

function resultCard(item, compact = false) {
  const { type, title, url, image, description, meta } = item;
  const typeLabel = TYPE_LABELS[type] || '';
  const icon = TYPE_ICONS[type] || '';

  if (compact) {
    return `<a class="search-result search-result--compact" href="${esc(url)}">
      ${image ? `<img class="search-result__thumb" src="${esc(image)}" alt="" loading="lazy">` : `<span class="search-result__icon">${icon}</span>`}
      <span class="search-result__body">
        <span class="search-result__title">${esc(title)}</span>
        ${typeLabel ? `<span class="search-result__type">${esc(typeLabel)}</span>` : ''}
      </span>
    </a>`;
  }

  return `<a class="search-result" href="${esc(url)}">
    ${image ? `<img class="search-result__thumb" src="${esc(image)}" alt="" loading="lazy">` : `<span class="search-result__icon">${icon}</span>`}
    <span class="search-result__body">
      <span class="search-result__type">${esc(typeLabel)}</span>
      <span class="search-result__title">${esc(title)}</span>
      ${description ? `<span class="search-result__desc">${esc(description)}</span>` : ''}
    </span>
    <span class="search-result__arrow" aria-hidden="true">→</span>
  </a>`;
}

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Header search overlay ─────────────────────────────────────────────

function initHeaderSearch() {
  const panel      = document.querySelector('[data-search-panel]');
  const input      = panel?.querySelector('input[name="q"]');
  const form       = panel?.querySelector('form');
  if (!panel || !input) return;

  // Add a live-results container inside the panel
  const liveResults = document.createElement('div');
  liveResults.className = 'site-header__search-results';
  liveResults.setAttribute('aria-live', 'polite');
  panel.appendChild(liveResults);

  let debounceTimer;

  function showResults(query) {
    const results = search(query).slice(0, MAX_OVERLAY_RESULTS);

    if (!query || !results.length) {
      liveResults.innerHTML = query
        ? `<p class="search-results__empty">No results for "${esc(query)}"</p>`
        : '';
      return;
    }

    liveResults.innerHTML = results.map(r => resultCard(r.item, true)).join('');

    // View all link
    const viewAll = document.createElement('a');
    viewAll.className = 'search-results__view-all';
    viewAll.href = `/search?q=${encodeURIComponent(query)}`;
    viewAll.textContent = `View all results for "${query}"`;
    liveResults.appendChild(viewAll);
  }

  input.addEventListener('input', () => {
    const q = input.value.trim();
    clearTimeout(debounceTimer);

    if (!q) {
      liveResults.innerHTML = '';
      return;
    }

    debounceTimer = setTimeout(async () => {
      await loadIndex();
      showResults(q);
    }, 220);
  });

  // Pre-warm the index when search panel opens
  document.addEventListener('click', e => {
    if (e.target.closest('[data-search-toggle]')) {
      loadIndex(); // fire and forget, warms cache
    }
  });
}

// ── /search page ──────────────────────────────────────────────────────

function initSearchPage() {
  const resultsEl = document.querySelector('[data-search-page-results]');
  const countEl   = document.querySelector('[data-search-page-count]');
  const input     = document.querySelector('[data-search-page-input]');
  const form      = document.querySelector('[data-search-page-form]');
  if (!resultsEl) return;

  const initialQuery = window.__SEARCH_QUERY__ || new URLSearchParams(window.location.search).get('q') || '';

  async function runSearch(query) {
    await loadIndex();
    const results = search(query).slice(0, MAX_PAGE_RESULTS);

    if (!query) {
      resultsEl.innerHTML = '<p class="search-page__hint">Enter a search term above to find products, recipes and more.</p>';
      if (countEl) countEl.hidden = true;
      return;
    }

    if (!results.length) {
      resultsEl.innerHTML = `<p class="search-page__empty">No results found for "<strong>${esc(query)}</strong>". Try different keywords.</p>`;
      if (countEl) countEl.hidden = true;
      return;
    }

    resultsEl.innerHTML = `<div class="search-results-grid">${results.map(r => resultCard(r.item)).join('')}</div>`;
    if (countEl) {
      countEl.textContent = `${results.length} result${results.length === 1 ? '' : 's'} for "${query}"`;
      countEl.hidden = false;
    }
  }

  // Run on page load
  runSearch(initialQuery);

  // Live search as user types on the page
  let debounceTimer;
  input?.addEventListener('input', () => {
    const q = input.value.trim();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const url = new URL(window.location.href);
      if (q) url.searchParams.set('q', q);
      else url.searchParams.delete('q');
      history.replaceState({}, '', url.href);
      runSearch(q);
    }, 250);
  });

  form?.addEventListener('submit', e => {
    e.preventDefault();
    const q = input?.value.trim() || '';
    const url = new URL(window.location.href);
    if (q) url.searchParams.set('q', q);
    else url.searchParams.delete('q');
    history.pushState({}, '', url.href);
    runSearch(q);
  });
}

// ── Boot ──────────────────────────────────────────────────────────────

initHeaderSearch();
initSearchPage();
