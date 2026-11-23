export function initFarmPlots(plots) {
  const layer = document.getElementById('farm-plots');
  const outline = document.getElementById('farm-plot-selection');
  const status = document.getElementById('farm-plot-status');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let selected = null;
  let pulse = null;

  function select(button, perimeter) {
    selected?.setAttribute('aria-pressed', 'false');
    selected = button;
    button.setAttribute('aria-pressed', 'true');
    outline.setAttribute('points', perimeter);
    outline.removeAttribute('hidden');
    status.textContent = '已选中' + button.getAttribute('aria-label');
    pulse?.cancel();
    if (!reducedMotion.matches) {
      pulse = button.animate(
        [{ fillOpacity: 0.57 }, { fillOpacity: 0.18 }],
        { duration: 420, easing: 'ease-out' },
      );
    }
  }

  for (const { id, row, column, polygon, holes = [] } of plots) {
    const button = document.createElementNS(layer.namespaceURI, 'path');
    button.dataset.plotId = id;
    const contours = [polygon, ...holes].map(loop => loop.map(point => point.join(',')).join(' '));
    button.setAttribute('d', contours.map(points => `M ${points} Z`).join(' '));
    button.setAttribute('fill-rule', 'evenodd');
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');
    button.setAttribute('aria-label', `第 ${row} 行第 ${column} 列土地`);
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', event => {
      event.stopPropagation();
      select(button, contours[0]);
    });
    button.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) select(button, contours[0]);
    });
    outline.before(button);
  }

  return {
    get selectedId() { return selected?.dataset.plotId ?? null; },
    clear() {
      if (!selected) return;
      pulse?.cancel();
      selected.setAttribute('aria-pressed', 'false');
      selected = null;
      outline.setAttribute('hidden', '');
      status.textContent = '';
    },
  };
}
