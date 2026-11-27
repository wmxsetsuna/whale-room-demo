const ALL_SEASONS = ['春', '夏', '秋', '冬'];

function htmlText(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function bagSVG(icon) {
  const crop = document.getElementById(`crop-${icon}`);
  const symbolId = crop?.localName === 'symbol' ? crop.id : 'bag';
  return `<svg aria-hidden="true"><use href="#${htmlText(symbolId)}" width="100%" height="100%"/></svg>`;
}

export function readSeedInventory(list) {
  if (!Array.isArray(list)) throw new TypeError('种子配置须为数组');
  const ids = new Set();
  return list.map((seed, index) => {
    if (!seed || typeof seed.id !== 'string' || !seed.id.trim() || ids.has(seed.id)) {
      throw new TypeError(`第 ${index + 1} 项种子需要唯一的 id`);
    }
    if (typeof seed.name !== 'string' || !seed.name.trim() ||
        !Number.isSafeInteger(seed.count) || seed.count < 0 || !Number.isSafeInteger(seed.days) || seed.days < 0) {
      throw new TypeError(`种子 ${seed.id} 的 name、count 或 days 无效`);
    }
    ids.add(seed.id);
    return {
      id: seed.id, name: seed.name, count: seed.count, days: seed.days,
      icon: typeof seed.icon === 'string' ? seed.icon : seed.id,
      seasons: ALL_SEASONS.filter(season => Array.isArray(seed.seasons) && seed.seasons.includes(season)),
      desc: typeof seed.desc === 'string' ? seed.desc : '',
    };
  });
}

export function initSeedLibrary(initialSeeds, packetSheet) {
  document.getElementById('seed-packet-sheet').setAttribute('href', packetSheet);
  const button = document.getElementById('seedBtn');
  const badge = document.getElementById('seedBadge');
  const overlay = document.getElementById('seedOverlay');
  const closeButton = document.getElementById('seedClose');
  const grid = document.getElementById('seedGrid');
  const detail = document.getElementById('seedDetail');
  const summary = document.getElementById('seedSum');
  let seeds = [], selected = -1, closingTransition = null;

  function renderGrid() {
    grid.innerHTML = seeds.map((seed, i) => {
      const name = htmlText(seed.name);
      return `
        <li class="seed-grid__item" role="presentation" style="--seed-index:${i}">
          <button class="seed-card" type="button" role="option" data-index="${i}"
                  aria-selected="${i === selected}" tabindex="${i === selected ? 0 : -1}"
                  aria-label="${name}种子，持有 ${seed.count} 粒">
            <span class="seed-card__count">×${seed.count}</span>
            ${bagSVG(seed.icon)}
            <span class="seed-card__name">${name}</span>
            <span class="seed-card__meta">${seed.days} 天成熟</span>
          </button>
        </li>`;
    }).join('') || '<li class="seed-empty" role="presentation">种子库里还没有种子</li>';
  }

  function renderDetail() {
    const seed = seeds[selected];
    if (!seed) {
      detail.replaceChildren();
      return;
    }
    detail.innerHTML = `
      <div class="detail">
        <div class="detail__top">
          <div class="detail__art">${bagSVG(seed.icon)}</div>
          <div>
            <h3 class="detail__name">${htmlText(seed.name)}</h3>
            <dl class="detail__stats">
              <div><dt>持有</dt><dd><b>${seed.count}</b> 粒</dd></div>
              <div><dt>成熟</dt><dd><b>${seed.days}</b> 天</dd></div>
            </dl>
          </div>
        </div>
        <div>
          <div class="detail__label">适合季节</div>
          <div class="seasons">${ALL_SEASONS.map(season =>
            `<span class="season${seed.seasons.includes(season) ? ' is-on' : ''}">${season}</span>`).join('')}</div>
        </div>
        <div>
          <div class="detail__label">简介</div>
          <p class="detail__desc">${htmlText(seed.desc)}</p>
        </div>
      </div>`;
  }

  function focusSelection() {
    const card = grid.querySelector('[aria-selected="true"]');
    (card ?? closeButton).focus({ preventScroll: true });
    if (!card || grid.scrollHeight <= grid.clientHeight) return;
    // Reveal the resting row, even while its paper is still moving into place.
    const row = card.parentElement;
    const inset = parseFloat(getComputedStyle(grid).paddingTop);
    const top = row.offsetTop - inset;
    const bottom = row.offsetTop + row.offsetHeight + inset;
    if (top < grid.scrollTop) grid.scrollTop = top;
    else if (bottom > grid.scrollTop + grid.clientHeight) grid.scrollTop = bottom - grid.clientHeight;
  }

  function setSeeds(list) {
    const previousId = seeds[selected]?.id;
    const restoreCardFocus = grid.contains(document.activeElement);
    seeds = readSeedInventory(list);
    const previousIndex = seeds.findIndex(seed => seed.id === previousId);
    selected = previousIndex >= 0 ? previousIndex : seeds.length ? 0 : -1;
    const total = seeds.reduce((sum, seed) => sum + seed.count, 0);
    summary.innerHTML = `共<b>${seeds.length}</b>种 · <b>${total}</b>粒`;
    badge.textContent = String(seeds.length);
    if (overlay.open) {
      renderGrid();
      renderDetail();
      if (restoreCardFocus) focusSelection();
    }
  }

  function select(index, focus = false) {
    if (index < 0 || index >= seeds.length) return;
    if (index === selected) {
      if (focus) focusSelection();
      return;
    }
    selected = index;
    for (const card of grid.querySelectorAll('.seed-card')) {
      const active = Number(card.dataset.index) === index;
      card.setAttribute('aria-selected', String(active));
      card.tabIndex = active ? 0 : -1;
    }
    renderDetail();
    if (focus) focusSelection();
  }

  function open() {
    if (button.hidden || overlay.classList.contains('is-open')) return;
    closingTransition = null;
    if (!overlay.open) {
      renderGrid();
      renderDetail();
      overlay.showModal();
      // Establish the folded position. Reversing a close keeps the existing cards in motion.
      overlay.getBoundingClientRect();
    }
    overlay.classList.add('is-open');
    button.setAttribute('aria-expanded', 'true');
    focusSelection();
  }

  function finishClose() {
    closingTransition = null;
    overlay.close();
    if (!button.hidden) button.focus({ preventScroll: true });
  }

  function close() {
    if (!overlay.open || !overlay.classList.contains('is-open')) return;
    overlay.classList.remove('is-open');
    button.setAttribute('aria-expanded', 'false');
    const fade = overlay.getAnimations().find(animation => animation.transitionProperty === 'opacity');
    if (!fade) {
      finishClose();
      return;
    }
    closingTransition = fade;
    const finish = () => { if (closingTransition === fade) finishClose(); };
    fade.finished.then(finish, finish);
  }

  function setAvailable(available) {
    button.hidden = !available;
    if (!available && overlay.open) {
      overlay.classList.remove('is-open');
      button.setAttribute('aria-expanded', 'false');
      finishClose();
    }
  }

  button.addEventListener('click', open);
  closeButton.addEventListener('click', close);
  overlay.addEventListener('cancel', event => {
    event.preventDefault();
    close();
  });
  overlay.addEventListener('click', event => {
    if (event.target === overlay) close();
  });
  grid.addEventListener('click', event => {
    const card = event.target.closest('.seed-card');
    if (card) select(Number(card.dataset.index));
  });
  overlay.addEventListener('keydown', event => {
    if (event.key === 'Tab') {
      const active = document.activeElement;
      if (event.shiftKey && active === closeButton) {
        event.preventDefault();
        focusSelection();
      } else if (!event.shiftKey && (grid.contains(active) || selected < 0)) {
        event.preventDefault();
        closeButton.focus();
      }
      return;
    }
    if (!grid.contains(event.target)) return;
    const columns = getComputedStyle(grid).gridTemplateColumns.split(/\s+/).length;
    const targets = {
      ArrowLeft: selected - 1, ArrowRight: selected + 1,
      ArrowUp: selected - columns, ArrowDown: selected + columns,
      Home: 0, End: seeds.length - 1,
    };
    if (Object.hasOwn(targets, event.key)) {
      event.preventDefault();
      select(targets[event.key], true);
    }
  });

  setSeeds(initialSeeds);
  return { setAvailable, setSeeds, open, close };
}
