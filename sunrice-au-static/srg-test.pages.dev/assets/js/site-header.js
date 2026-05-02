const header = document.querySelector('[data-site-header]');

if (header) {
  const megaMenu = header.querySelector('[data-mega-menu]');
  const megaTriggers = Array.from(header.querySelectorAll('[data-mega-trigger]'));
  const searchPanel = header.querySelector('[data-search-panel]');
  const searchToggle = header.querySelector('[data-search-toggle]');
  const searchClose = header.querySelector('[data-search-close]');
  const mobileToggle = header.querySelector('[data-mobile-menu-toggle]');
  const mobileMenu = header.querySelector('[data-mobile-menu]');
  let closeTimer = null;
  let megaPinned = false;
  let activeMegaKey = null;

  function setMega(open, activeKey = null) {
    if (!megaMenu) return;

    megaMenu.hidden = !open;
    header.classList.toggle('is-mega-open', open);
    if (!open) {
      megaPinned = false;
      activeMegaKey = null;
    } else if (activeKey) {
      activeMegaKey = activeKey;
    }

    megaTriggers.forEach((trigger) => {
      const isActive = open && (!activeKey || trigger.dataset.megaTrigger === activeKey);
      trigger.setAttribute('aria-expanded', String(isActive));
    });
  }

  function setSearch(open) {
    if (!searchPanel || !searchToggle) return;

    searchPanel.hidden = !open;
    header.classList.toggle('is-search-open', open);
    searchToggle.setAttribute('aria-expanded', String(open));

    if (open) {
      setMega(false);
      searchPanel.querySelector('input')?.focus();
    }
  }

  function setMobile(open) {
    if (!mobileMenu || !mobileToggle) return;

    mobileMenu.hidden = !open;
    header.classList.toggle('is-mobile-open', open);
    mobileToggle.setAttribute('aria-expanded', String(open));

    if (open) {
      setMega(false);
      setSearch(false);
    }
  }

  function scheduleMegaClose() {
    if (megaPinned) return;
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(() => setMega(false), 180);
  }

  function cancelMegaClose() {
    window.clearTimeout(closeTimer);
  }

  megaTriggers.forEach((trigger) => {
    trigger.addEventListener('mouseenter', () => {
      cancelMegaClose();
      megaPinned = false;
      setSearch(false);
      setMega(true, trigger.dataset.megaTrigger);
    });

    trigger.addEventListener('focus', () => {
      setSearch(false);
      setMega(true, trigger.dataset.megaTrigger);
    });

    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      const isPinnedOpen = megaPinned && !megaMenu?.hidden && activeMegaKey === trigger.dataset.megaTrigger;
      cancelMegaClose();
      megaPinned = !isPinnedOpen;
      setSearch(false);
      setMega(!isPinnedOpen, trigger.dataset.megaTrigger);
    });
  });

  header.addEventListener('mouseleave', scheduleMegaClose);
  header.addEventListener('mouseenter', cancelMegaClose);
  megaMenu?.addEventListener('mouseenter', cancelMegaClose);
  megaMenu?.addEventListener('mouseleave', scheduleMegaClose);

  searchToggle?.addEventListener('click', () => setSearch(searchPanel?.hidden ?? true));
  searchClose?.addEventListener('click', () => setSearch(false));
  mobileToggle?.addEventListener('click', () => setMobile(mobileMenu?.hidden ?? true));

  document.addEventListener('click', (event) => {
    if (!header.contains(event.target)) {
      setMega(false);
      setSearch(false);
      setMobile(false);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setMega(false);
      setSearch(false);
      setMobile(false);
    }
  });
}
