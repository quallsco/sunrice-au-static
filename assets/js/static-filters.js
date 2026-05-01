/**
 * Static client-side filtering for products and recipes listing pages.
 * Replaces server-side AJAX filtering with DOM show/hide + URL param sync.
 * Uses Fuse.js for fuzzy text search.
 */

import Fuse from '/assets/js/vendor/fuse.esm.min.js';

const PAGE_SIZE = 12;

// ── URL state helpers ─────────────────────────────────────────────────

function readState() {
  const p = new URLSearchParams(window.location.search);
  return {
    q:        p.get('q')        || '',
    category: p.get('category') || '',
    rice:     p.get('rice')     || '',
    tag:      p.get('tag')      || '',
    sort:     p.get('sort')     || '',
    cuisine:  p.get('cuisine')  || '',
    protein:  p.get('protein')  || '',
    cookTime: p.get('cookTime') || '',
  };
}

function writeState(state, push = true) {
  const url = new URL(window.location.href);
  Object.entries(state).forEach(([k, v]) => {
    if (v) url.searchParams.set(k, v);
    else url.searchParams.delete(k);
  });
  if (push) history.pushState(state, '', url.href);
  else history.replaceState(state, '', url.href);
}

// ── Shared UI sync ────────────────────────────────────────────────────

function syncUI(state) {
  // Category pill buttons
  document.querySelectorAll('[data-cat-slug]').forEach(el => {
    const active = el.dataset.catSlug === state.category;
    el.classList.toggle('is-active', active);
    el.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

  // Rice grain buttons
  document.querySelectorAll('[data-rice-slug]').forEach(el => {
    const active = el.dataset.riceSlug === state.rice;
    el.classList.toggle('is-active', active);
    el.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

  // Sort buttons
  document.querySelectorAll('[data-sort]').forEach(el => {
    el.classList.toggle('is-active', el.dataset.sort === state.sort);
  });

  // Hidden inputs for filter keys
  document.querySelectorAll('[data-filter-key]').forEach(input => {
    if (input.tagName === 'INPUT') {
      input.value = state[input.dataset.filterKey] || '';
    }
  });

  // Dropdown choice active states + labels
  document.querySelectorAll('.filter-select').forEach(select => {
    const keyInput = select.querySelector('[data-filter-key]');
    if (!keyInput) return;
    const key = keyInput.dataset.filterKey;
    const val = state[key] || '';

    select.querySelectorAll('[data-filter-choice]').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.filterValue === val);
    });

    const labelEl = select.querySelector('[data-filter-label]');
    if (labelEl) {
      const activeBtn = select.querySelector(`[data-filter-choice][data-filter-value="${val}"]`);
      if (activeBtn) labelEl.textContent = activeBtn.textContent.trim();
    }
  });

  // Search input value (don't overwrite while user is typing)
  document.querySelectorAll('[data-filter-form] input[name="q"]').forEach(input => {
    if (input !== document.activeElement) input.value = state.q;
  });

  // Reset / show-all buttons
  const hasFilter = state.q || state.category || state.rice || state.tag ||
                    state.cuisine || state.protein || state.cookTime;
  document.querySelectorAll('[data-filter-reset]').forEach(el => {
    el.hidden = !hasFilter;
  });
}

// ── Products listing ──────────────────────────────────────────────────

function initProductListing() {
  const section = document.querySelector('[data-product-listing]');
  if (!section) return;

  const allItems      = [...section.querySelectorAll('[data-filter-item]')];
  const listEl        = section.querySelector('[data-filter-list]');
  const countEl       = section.querySelector('[data-filter-count]');
  const loadMoreWrap  = section.querySelector('[data-load-more-wrap]');
  const loadMoreBtn   = section.querySelector('[data-load-more-button]');
  const categoryData  = JSON.parse(document.getElementById('product-category-data')?.textContent || '[]');

  const fuse = new Fuse(allItems, {
    keys: [{ name: 'text', getFn: el => el.dataset.searchText || '' }],
    threshold: 0.35,
    distance: 300,
    minMatchCharLength: 2,
  });

  let state        = readState();
  let filtered     = allItems;
  let shownCount   = PAGE_SIZE;
  // Track original DOM order for restoring after sort changes
  const origOrder  = [...allItems];

  function applyFilters() {
    let items = state.q.length >= 2
      ? fuse.search(state.q).map(r => r.item)
      : [...origOrder];

    items = items.filter(item => {
      const cats = tokenSet(item.dataset.cats);
      const rice = tokenSet(item.dataset.rice);
      const tags = tokenSet(item.dataset.tags);
      if (state.category && !cats.has(state.category)) return false;
      if (state.rice     && !rice.has(state.rice))     return false;
      if (state.tag      && !tags.has(state.tag))      return false;
      return true;
    });

    return items;
  }

  function render() {
    filtered   = applyFilters();
    shownCount = PAGE_SIZE;
    paint();
  }

  function paint() {
    // Hide all items
    allItems.forEach(item => { item.hidden = true; });
    // Remove any injected category headings
    listEl.querySelectorAll('.product-category-separator').forEach(h => h.remove());

    const visible = filtered.slice(0, shownCount);

    if (state.sort === 'category' && categoryData.length) {
      paintByCategory(visible);
    } else {
      visible.forEach(item => { item.hidden = false; });
    }

    // Count label
    if (countEl) {
      const total  = filtered.length;
      const shown  = Math.min(shownCount, total);
      const active = state.category || state.rice || state.tag || state.q;
      if (shown >= total) {
        countEl.textContent = active
          ? `Showing ${total} filtered products`
          : `Showing all ${total} products`;
      } else {
        countEl.textContent = `Showing ${shown} of ${total} products`;
      }
    }

    // Load more
    if (loadMoreWrap) loadMoreWrap.hidden = shownCount >= filtered.length;
  }

  function paintByCategory(visible) {
    categoryData.forEach(cat => {
      const catItems = visible.filter(item =>
        tokenSet(item.dataset.cats).has(cat.slug)
      );
      if (!catItems.length) return;

      const heading = document.createElement('h3');
      heading.className = 'product-category-separator';
      heading.textContent = cat.title;

      // Insert heading before the first item in this category
      listEl.insertBefore(heading, catItems[0]);
      catItems.forEach(item => { item.hidden = false; });
    });
  }

  // Initial render
  syncUI(state);
  render();

  // Load more
  loadMoreBtn?.addEventListener('click', () => {
    shownCount += PAGE_SIZE;
    paint();
  });

  // Category pills
  section.closest('body').addEventListener('click', e => {
    const pill = e.target.closest('[data-cat-slug]');
    if (!pill) return;
    e.preventDefault();
    state = { ...state, category: state.category === pill.dataset.catSlug ? '' : pill.dataset.catSlug };
    syncUI(state); writeState(state); render();
  });

  // Rice grain buttons
  document.addEventListener('click', e => {
    const grain = e.target.closest('[data-rice-slug]');
    if (!grain) return;
    e.preventDefault();
    state = { ...state, rice: state.rice === grain.dataset.riceSlug ? '' : grain.dataset.riceSlug };
    syncUI(state); writeState(state); render();
  });

  // Sort buttons
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-sort]');
    if (!btn || !section.contains(btn) && !document.querySelector('.product-listing-header')?.contains(btn)) return;
    state = { ...state, sort: btn.dataset.sort };
    syncUI(state); writeState(state); paint();
  });

  // Filter choices (tag dropdown, etc.)
  document.addEventListener('click', e => {
    const choice = e.target.closest('[data-filter-choice]');
    if (!choice) return;
    const key = choice.dataset.filterKey;
    if (!key) return;
    const root = choice.closest('.filter-select');
    root?.classList.remove('is-open');
    state = { ...state, [key]: choice.dataset.filterValue || '' };
    syncUI(state); writeState(state); render();
  });

  // Search (form submit + live input)
  document.addEventListener('submit', e => {
    const form = e.target.closest('[data-filter-form]');
    if (!form) return;
    e.preventDefault();
    state = { ...state, q: new FormData(form).get('q') || '' };
    syncUI(state); writeState(state); render();
  });

  let _searchTimer;
  document.addEventListener('input', e => {
    const input = e.target.closest('[data-filter-form] input[name="q"]');
    if (!input) return;
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => {
      state = { ...state, q: input.value.trim() };
      writeState(state, false);
      render();
    }, 250);
  });

  // Reset
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-filter-reset]')) return;
    state = { q: '', category: '', rice: '', tag: '', sort: state.sort, cuisine: '', protein: '', cookTime: '' };
    syncUI(state); writeState(state); render();
  });

  // Popstate
  window.addEventListener('popstate', () => {
    state = readState();
    syncUI(state); render();
  });
}

// ── Recipes listing ───────────────────────────────────────────────────

function initRecipeListing() {
  const section = document.querySelector('[data-recipe-listing]');
  if (!section) return;

  const allItems     = [...section.querySelectorAll('[data-filter-item]')];
  const countEl      = section.querySelector('[data-filter-count]');
  const loadMoreWrap = section.querySelector('[data-load-more-wrap]');
  const loadMoreBtn  = section.querySelector('[data-load-more-button]');

  const fuse = new Fuse(allItems, {
    keys: [{ name: 'text', getFn: el => el.dataset.searchText || '' }],
    threshold: 0.35,
    distance: 300,
    minMatchCharLength: 2,
  });

  let state      = readState();
  let filtered   = allItems;
  let shownCount = PAGE_SIZE;

  function applyFilters() {
    let items = state.q.length >= 2
      ? fuse.search(state.q).map(r => r.item)
      : [...allItems];

    return items.filter(item => {
      if (state.cuisine  && item.dataset.cuisine  !== state.cuisine)  return false;
      if (state.protein  && item.dataset.protein  !== state.protein)  return false;
      if (state.rice     && item.dataset.rice     !== state.rice)     return false;
      if (state.cookTime && Number(item.dataset.cookTime) > Number(state.cookTime)) return false;
      return true;
    });
  }

  function render() {
    filtered   = applyFilters();
    shownCount = PAGE_SIZE;
    paint();
  }

  function paint() {
    allItems.forEach(item => { item.hidden = true; });
    filtered.slice(0, shownCount).forEach(item => { item.hidden = false; });

    if (countEl) {
      const total = filtered.length;
      const shown = Math.min(shownCount, total);
      const active = state.cuisine || state.protein || state.rice || state.cookTime || state.q;
      countEl.textContent = shown >= total
        ? (active ? `Showing ${total} filtered recipes` : `Showing all ${total} recipes`)
        : `Showing ${shown} of ${total} recipes`;
    }

    if (loadMoreWrap) loadMoreWrap.hidden = shownCount >= filtered.length;
  }

  syncUI(state);
  render();

  loadMoreBtn?.addEventListener('click', () => {
    shownCount += PAGE_SIZE;
    paint();
  });

  // Filter choices
  document.addEventListener('click', e => {
    const choice = e.target.closest('[data-filter-choice]');
    if (!choice) return;
    const key = choice.dataset.filterKey;
    if (!key) return;
    choice.closest('.filter-select')?.classList.remove('is-open');
    state = { ...state, [key]: choice.dataset.filterValue || '' };
    syncUI(state); writeState(state); render();
  });

  // Reset
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-filter-reset]')) return;
    state = { q: '', category: '', rice: '', tag: '', sort: '', cuisine: '', protein: '', cookTime: '' };
    syncUI(state); writeState(state); render();
  });

  window.addEventListener('popstate', () => {
    state = readState();
    syncUI(state); render();
  });
}

// ── Dropdown open/close (shared) ──────────────────────────────────────

document.addEventListener('click', e => {
  const trigger = e.target.closest('[data-filter-dropdown]');
  if (trigger) {
    const root = trigger.closest('.filter-select');
    const wasOpen = root?.classList.contains('is-open');
    document.querySelectorAll('.filter-select.is-open').forEach(d => d.classList.remove('is-open'));
    if (root && !wasOpen) root.classList.add('is-open');
    return;
  }
  if (!e.target.closest('.filter-select')) {
    document.querySelectorAll('.filter-select.is-open').forEach(d => d.classList.remove('is-open'));
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.filter-select.is-open').forEach(d => d.classList.remove('is-open'));
  }
});

// ── Helpers ───────────────────────────────────────────────────────────

function tokenSet(str) {
  return new Set((str || '').split(' ').filter(Boolean));
}

// ── Boot ──────────────────────────────────────────────────────────────

initProductListing();
initRecipeListing();
