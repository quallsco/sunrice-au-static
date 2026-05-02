const UNIT_MAP = {
  none: { label: '', type: 'count', baseUnit: null, multiplier: 1 },
  g: { label: 'g', type: 'weight', baseUnit: 'g', multiplier: 1 },
  kg: { label: 'kg', type: 'weight', baseUnit: 'g', multiplier: 1000 },
  ml: { label: 'ml', type: 'volume', baseUnit: 'ml', multiplier: 1 },
  L: { label: 'L', type: 'volume', baseUnit: 'ml', multiplier: 1000 },
  tsp: { label: 'tsp', type: 'volume', baseUnit: 'ml', multiplier: 5 },
  tbsp: { label: 'tbsp', type: 'volume', baseUnit: 'ml', multiplier: 15 },
  cup: { label: 'cup', type: 'volume', baseUnit: 'ml', multiplier: 250 },
  pinch: { label: 'pinch', type: 'approx', baseUnit: null, multiplier: 1 },
  clove: { label: 'clove', type: 'count', baseUnit: null, multiplier: 1 },
  slice: { label: 'slice', type: 'count', baseUnit: null, multiplier: 1 },
  piece: { label: 'piece', type: 'count', baseUnit: null, multiplier: 1 },
  can: { label: 'can', type: 'pack', baseUnit: null, multiplier: 1 },
  packet: { label: 'packet', type: 'pack', baseUnit: null, multiplier: 1 },
  bunch: { label: 'bunch', type: 'count', baseUnit: null, multiplier: 1 },
};

const FRACTIONS = [
  [0.25, '1/4'],
  [1 / 3, '1/3'],
  [0.5, '1/2'],
  [2 / 3, '2/3'],
  [0.75, '3/4'],
];

function roundNicely(value) {
  if (value >= 10) return Math.round(value);
  if (value >= 2) return Math.round(value * 2) / 2;
  return Math.round(value * 4) / 4;
}

function formatFriendlyQuantity(value) {
  if (!Number.isFinite(value)) return '';

  const whole = Math.floor(value);
  const decimal = value - whole;
  const match = FRACTIONS.find(([fraction]) => Math.abs(decimal - fraction) < 0.03);

  if (match) {
    return whole > 0 ? `${whole} ${match[1]}` : match[1];
  }

  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function scaleQuantity(quantity, scaleFactor, scalingRule) {
  const value = Number(quantity);
  if (!Number.isFinite(value)) return '';

  if (['noScale', 'optional'].includes(scalingRule)) return formatFriendlyQuantity(value);
  if (scalingRule === 'toTaste') return 'to taste';

  const scaled = scalingRule === 'roundNicely'
    ? roundNicely(value * scaleFactor)
    : value * scaleFactor;

  return formatFriendlyQuantity(scaled);
}

function updateIngredients(root, servings) {
  const baseServings = Number(root.dataset.baseServings || servings || 1);
  const scaleFactor = servings / baseServings;

  root.querySelectorAll('[data-quantity]').forEach((row) => {
    if (row.querySelector('.ingredient-display-override')) return;

    const quantity = row.querySelector('[data-scaled-quantity]');
    if (!quantity) return;

    quantity.textContent = scaleQuantity(
      row.dataset.quantity,
      scaleFactor,
      row.dataset.scalingRule || 'normal',
    );

    const unit = row.querySelector('[data-ingredient-unit]');
    const unitMeta = UNIT_MAP[row.dataset.unit];
    if (unit && unitMeta) {
      unit.textContent = unitMeta.label;
    }
  });
}

const SERVING_OPTIONS = [1, 2, 4, 6, 8];

document.querySelectorAll('[data-base-servings]').forEach((root) => {
  const picker = root.querySelector('[data-servings-picker]');
  const base = Math.max(1, Number(root.dataset.baseServings || 2));
  let servings = SERVING_OPTIONS.reduce((prev, curr) =>
    Math.abs(curr - base) < Math.abs(prev - base) ? curr : prev
  );

  const render = () => {
    picker?.querySelectorAll('[data-servings-value]').forEach(btn => {
      const active = Number(btn.dataset.servingsValue) === servings;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    updateIngredients(root, servings);
  };

  picker?.addEventListener('click', e => {
    const btn = e.target.closest('[data-servings-value]');
    if (!btn) return;
    servings = Number(btn.dataset.servingsValue);
    render();
  });

  render();
});
