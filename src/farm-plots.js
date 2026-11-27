export function initFarmPlots(plots) {
  const layer = document.getElementById('farm-plots');
  const highlights = document.getElementById('farm-plot-highlights');
  const status = document.getElementById('farm-plot-status');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const highlightsByButton = new Map();
  const landLabels = new Map();
  let selected = null;
  let pulseFrame;

  function pulse(paint) {
    const start = performance.now();
    function fade(now) {
      const remaining = Math.max(0, 1 - (now - start) / 420);
      if (remaining === 0) {
        paint.style.removeProperty('fill-opacity');
        return;
      }
      // Inline opacity propagates to every SVG use of this path during a time-of-day blend.
      paint.style.fillOpacity = String(.18 + .39 * remaining ** 2);
      pulseFrame = requestAnimationFrame(fade);
    }
    fade(start);
  }

  function select(button) {
    const paint = highlightsByButton.get(button);
    if (!paint) return false;
    clear();
    selected = { button, paint };
    button.setAttribute('aria-pressed', 'true');
    paint.classList.add('selected');
    status.textContent = '已选中' + button.getAttribute('aria-label');
    if (!reducedMotion.matches) pulse(paint);
    return true;
  }

  function pathData(loops) {
    return loops.map(loop => 'M ' + loop.map(point => point.join(',')).join(' ') + ' Z').join(' ');
  }

  for (const { id, row, column, polygon, outline, fragments = [], holes = [] } of plots) {
    const button = document.createElementNS(layer.namespaceURI, 'path');
    button.dataset.plotId = id;
    // Only exposed soil accepts input. Its outline continues behind the scenery.
    const hitPath = pathData([polygon, ...fragments, ...holes]);
    button.setAttribute('d', hitPath);
    button.setAttribute('fill-rule', 'evenodd');
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');
    const label = `第 ${row} 行第 ${column} 列土地`;
    landLabels.set(button, label);
    button.setAttribute('aria-label', label + '，空田');
    button.setAttribute('aria-pressed', 'false');
    const paint = document.createElementNS(layer.namespaceURI, 'path');
    paint.classList.add('farm-plot-highlight');
    paint.setAttribute('d', outline ? pathData([outline]) : hitPath);
    paint.setAttribute('fill-rule', 'evenodd');
    highlights.append(paint);
    highlightsByButton.set(button, paint);
    button.addEventListener('pointerenter', () => paint.classList.add('hovered'));
    button.addEventListener('pointerleave', () => paint.classList.remove('hovered'));
    button.addEventListener('focus', () => paint.classList.toggle('keyboard-focus', button.matches(':focus-visible')));
    button.addEventListener('blur', () => paint.classList.remove('keyboard-focus'));
    button.addEventListener('pointerdown', () => paint.classList.remove('keyboard-focus'));
    button.addEventListener('keydown', event => {
      paint.classList.add('keyboard-focus');
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) select(button);
    });
    layer.append(button);
  }

  function clear() {
    if (!selected) return;
    cancelAnimationFrame(pulseFrame);
    selected.paint.style.removeProperty('fill-opacity');
    selected.button.setAttribute('aria-pressed', 'false');
    selected.paint.classList.remove('selected');
    selected = null;
    status.textContent = '';
  }
  function setCrops(planted) {
    const byPlot = new Map(planted.map(crop => [crop.plotId, crop]));
    const phases = ['幼苗期', '生长期', '成熟期'];
    for (const [button, land] of landLabels) {
      const crop = byPlot.get(button.dataset.plotId);
      const description = crop ? `${crop.name} ${crop.count} 株，${phases[crop.stage - 1]}` : '空田';
      const label = land + '，' + description;
      if (button.getAttribute('aria-label') !== label) {
        button.setAttribute('aria-label', label);
        if (selected?.button === button) status.textContent = '已选中' + label;
      }
    }
  }

  return { get selectedId() { return selected?.button.dataset.plotId ?? null; }, select, clear, setCrops };
}
