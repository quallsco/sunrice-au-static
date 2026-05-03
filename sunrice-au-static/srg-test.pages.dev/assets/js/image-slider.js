const GAP = 20;              // px gap between slides (desktop)
const PEEK_RATIO = 0.11;     // 11% of container shown on each side (~matches sunrice.com.au)
const MOBILE_BP = 640;       // px — below this: full-width, no peek, no gap
const DURATION = 500;        // ms slide transition
const EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';
const AUTO_DELAY = 5000;

class ImageSlider {
  constructor(el) {
    this.el = el;
    this.track = el.querySelector('.slider__track');
    this.dots = [...el.querySelectorAll('.slider__dot')];
    this.n = 0;
    this.current = 0;
    this.domIdx = 0;
    this.isAnimating = false;
    this.timer = null;
    this._resizeTimer = null;

    // Collect real slides (not clones — safe to query before cloning)
    this.realSlides = [...this.track.querySelectorAll('.slider__slide')];
    this.n = this.realSlides.length;

    if (this.n === 0) return;

    if (this.n === 1) {
      // Single slide: just show it, no looping
      this.el.classList.add('slider--single');
      this.realSlides[0].classList.add('is-active');
      return;
    }

    // Clone last slide → prepend; clone first slide → append
    const cloneLast = this.realSlides[this.n - 1].cloneNode(true);
    const cloneFirst = this.realSlides[0].cloneNode(true);
    [cloneLast, cloneFirst].forEach(c => {
      c.classList.add('is-clone');
      c.classList.remove('is-active');
      c.setAttribute('aria-hidden', 'true');
      c.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
    });
    this.track.prepend(cloneLast);
    this.track.append(cloneFirst);

    // All slides including clones. Real slides occupy domIdx 1..n.
    this.allSlides = [...this.track.querySelectorAll('.slider__slide')];

    this.resize(false);                // set widths
    this.moveTo(1, false);             // position to first real slide
    this.syncActive(0);                // mark slide 0 as active

    // Dots
    this.dots.forEach((dot, i) => {
      dot.addEventListener('click', () => {
        this.goTo(i);
        this.resetAuto();
      });
    });

    // After each animated move, silently jump if we landed on a clone
    this.track.addEventListener('transitionend', e => {
      if (e.target !== this.track || e.propertyName !== 'transform') return;
      this.isAnimating = false;
      this.handleLoopJump();
    });

    // Touch / swipe
    this.initTouch();

    // Resize (debounced)
    window.addEventListener('resize', () => {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => this.resize(true), 100);
    });

    // Pause on hover / focus
    this.el.addEventListener('mouseenter', () => this.stopAuto());
    this.el.addEventListener('mouseleave', () => this.startAuto());
    this.el.addEventListener('focusin', () => this.stopAuto());
    this.el.addEventListener('focusout', () => this.startAuto());

    this.startAuto();
  }

  // ─── Sizing ────────────────────────────────────────────────────────────────

  isMobile() {
    return window.innerWidth <= MOBILE_BP;
  }

  peek() {
    return this.isMobile() ? 0 : Math.round(this.el.offsetWidth * PEEK_RATIO);
  }

  gap() {
    return this.isMobile() ? 0 : GAP;
  }

  slideWidth() {
    // containerWidth = peek + slide + gap + peek  →  slide = container - 2*peek - gap
    return Math.max(100, this.el.offsetWidth - 2 * this.peek() - this.gap());
  }

  resize(reposition = true) {
    const sw = this.slideWidth();
    this.track.style.gap = this.gap() + 'px';
    this.allSlides.forEach(s => { s.style.width = sw + 'px'; });
    if (reposition) this.moveTo(this.domIdx, false);
  }

  // ─── Positioning ───────────────────────────────────────────────────────────

  translateXFor(di) {
    const sw = this.slideWidth();
    return this.peek() - di * (sw + this.gap());
  }

  moveTo(di, animate = true) {
    this.domIdx = di;
    this.track.style.transition = animate
      ? `transform ${DURATION}ms ${EASING}`
      : 'none';
    this.track.style.transform = `translateX(${this.translateXFor(di)}px)`;
  }

  // After landing on a clone, silently snap to the real counterpart
  handleLoopJump() {
    const last = this.allSlides.length - 1;
    if (this.domIdx === 0) {
      // Arrived at clone-of-last → jump to real last (domIdx n)
      requestAnimationFrame(() => this.moveTo(this.n, false));
    } else if (this.domIdx === last) {
      // Arrived at clone-of-first → jump to real first (domIdx 1)
      requestAnimationFrame(() => this.moveTo(1, false));
    }
  }

  // ─── Active state ──────────────────────────────────────────────────────────

  syncActive(realIdx) {
    this.current = realIdx;
    const activeDomIdx = realIdx + 1; // +1 for prepended clone
    this.allSlides.forEach((s, i) => s.classList.toggle('is-active', i === activeDomIdx));
    this.dots.forEach((d, i) => {
      d.classList.toggle('is-active', i === realIdx);
      d.setAttribute('aria-selected', i === realIdx ? 'true' : 'false');
    });
  }

  // ─── Navigation ────────────────────────────────────────────────────────────

  // Go to real slide index (called from dots)
  goTo(realIdx) {
    if (this.isAnimating) return;
    this.isAnimating = true;
    this.syncActive(realIdx);
    this.moveTo(realIdx + 1, true);
  }

  next() {
    if (this.isAnimating) return;
    this.isAnimating = true;
    const nextReal = (this.current + 1) % this.n;
    this.syncActive(nextReal);
    // If currently at last real slide, animate to clone-of-first (at end of DOM)
    const nextDom = this.domIdx === this.n
      ? this.allSlides.length - 1
      : this.domIdx + 1;
    this.moveTo(nextDom, true);
  }

  prev() {
    if (this.isAnimating) return;
    this.isAnimating = true;
    const prevReal = (this.current - 1 + this.n) % this.n;
    this.syncActive(prevReal);
    // If currently at first real slide, animate to clone-of-last (at start of DOM)
    const prevDom = this.domIdx === 1
      ? 0
      : this.domIdx - 1;
    this.moveTo(prevDom, true);
  }

  // ─── Auto-advance ──────────────────────────────────────────────────────────

  startAuto() {
    this.stopAuto();
    this.timer = setInterval(() => this.next(), AUTO_DELAY);
  }

  stopAuto() {
    clearInterval(this.timer);
    this.timer = null;
  }

  resetAuto() {
    this.stopAuto();
    this.startAuto();
  }

  // ─── Touch / swipe ─────────────────────────────────────────────────────────

  initTouch() {
    let startX = 0, startY = 0, moved = false;

    this.track.addEventListener('touchstart', e => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      moved = false;
      this.stopAuto();
    }, { passive: true });

    this.track.addEventListener('touchmove', () => {
      moved = true;
    }, { passive: true });

    this.track.addEventListener('touchend', e => {
      if (!moved) { this.startAuto(); return; }
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
        dx < 0 ? this.next() : this.prev();
      }
      this.startAuto();
    }, { passive: true });
  }
}

document.querySelectorAll('.builder-block--imageslider .slider').forEach(el => new ImageSlider(el));
