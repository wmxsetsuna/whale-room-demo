const rooms = [
  { id: 'room', name: '卧室', fullName: '她的小房间', icon: 'bed', bounds: [0, 0, 92, 78], open: true },
  { id: 'study', name: '书房', icon: 'book', bounds: [92, 0, 62, 78] },
  { id: 'farm', name: '菜园', fullName: '大肥鱼的菜园', icon: 'plant', bounds: [154, 0, 30, 78], open: true },
  { id: 'living', name: '客厅', icon: 'sofa', bounds: [0, 78, 112, 82] },
  { id: 'kitchen', name: '厨房', icon: 'kitchen', bounds: [112, 78, 72, 82] },
];

const icons = {
  bed: `<rect x="2" y="6" width="2.6" height="13" rx="1"/><rect x="2" y="12.5" width="20" height="4.5" rx="1.5"/>
    <rect x="19.4" y="16" width="2.6" height="3" rx="1"/><rect x="6" y="9" width="5.5" height="3" rx="1.5"/>
    <path d="M12.5 12.5v-2.5a1.5 1.5 0 0 1 1.5-1.5h6.5a1.5 1.5 0 0 1 1.5 1.5v2.5z"/>
    <g class="map-cut"><circle cx="17" cy="14.7" r="1"/><circle cx="12" cy="14.7" r="1"/><circle cx="7" cy="14.7" r="1"/></g>`,
  book: `<rect x="3" y="4" width="4.2" height="16" rx="1"/><rect x="8.4" y="6.5" width="4.2" height="13.5" rx="1"/>
    <rect x="14" y="5.5" width="4.2" height="15" rx="1" transform="rotate(-14 16 13)"/><rect x="2" y="20" width="20" height="1.8" rx=".9"/>
    <g class="map-cut"><rect x="3.9" y="7" width="2.4" height="1.2" rx=".4"/><rect x="9.3" y="9" width="2.4" height="1.2" rx=".4"/><circle cx="5.1" cy="15.5" r="1"/></g>`,
  sofa: `<path d="M5 8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3H5z M2 11.5a2 2 0 0 1 4 0V14h12v-2.5a2 2 0 0 1 4 0V18H2z"/>
    <rect x="3.5" y="18" width="2" height="2.5" rx=".6"/><rect x="18.5" y="18" width="2" height="2.5" rx=".6"/>
    <path class="map-cut-line" d="M12 6.5v3.5 M7 16h10"/>`,
  kitchen: `<path d="M5 10h12v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z M17 11.5h1.5a2.5 2.5 0 0 1 0 5H17v-1.6h1.5a.9.9 0 0 0 0-1.8H17z M5.2 12.5L2 10.4v1.9l3.2 2.2z"/>
    <rect x="8" y="7.6" width="6" height="2" rx="1"/><circle cx="11" cy="6.3" r="1.3"/><path class="map-cut-line" d="M8 14.5c1 1 2 1 3 0s2-1 3 0"/>`,
  plant: `<path d="M7 14.5h10l-1.4 6.5H8.4z"/><rect x="6" y="13" width="12" height="2.2" rx=".6"/><rect x="11.3" y="8" width="1.4" height="5.5"/>
    <path d="M12 10C12 6 9 3.5 4.5 3.5c0 4.2 3 6.5 7.5 6.5z M12 9c0-3.6 2.6-5.8 7.2-5.8 0 4-2.9 5.8-7.2 5.8z"/>
    <path class="map-cut-line" d="M6.5 5.5 10.5 8.8 M17.4 5 13.6 8"/><circle class="map-cut" cx="12" cy="18" r="1"/>`,
};

function roomCell(room) {
  const [x, y, w, h] = room.bounds;
  const cx = x + w / 2, cy = y + h / 2;
  const iconY = cy - (room.open ? 20 : 25);
  return `<g data-map-room="${room.id}" role="${room.open ? 'button' : 'img'}"
      aria-label="${room.fullName || room.name}${room.open ? '' : '，待开放'}" ${room.open ? 'tabindex="0"' : 'class="map-unavailable"'}>
    <rect class="map-floor" x="${x}" y="${y}" width="${w}" height="${h}"/>
    <g class="map-symbol" transform="translate(${cx - 12} ${iconY})">${icons[room.icon]}</g>
    <text class="map-name" x="${cx}" y="${cy + (room.open ? 16 : 10)}">${room.name}</text>
    ${room.open ? '' : `<text class="map-soon" x="${cx}" y="${cy + 24}">待开放</text>`}
    <path class="map-star" transform="translate(${x + w - 8} ${y + 9}) scale(${w < 40 ? .8 : 1})" d="M0 -5.5l1.7 3.5 3.9.5-2.8 2.7.7 3.8-3.5-1.9-3.4 1.9.7-3.8L-5.5-1.5l3.9-.5Z"/>
    <rect class="map-focus" x="${x + 3}" y="${y + 3}" width="${w - 6}" height="${h - 6}" rx="2"/>
  </g>`;
}

const panelShape = 'M10 0H202A10 10 0 0 1 212 10V224A10 10 0 0 1 202 234H120L106 248 92 234H10A10 10 0 0 1 0 224V10A10 10 0 0 1 10 0Z';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export function initRoomMap({ getLocation, travelTo }) {
  const host = document.getElementById('room-map');
  host.innerHTML = `
    <button class="map-door" type="button" aria-controls="room-floor-plan" aria-expanded="false">
      <svg viewBox="0 0 190 56" aria-hidden="true">
        <rect x="4" y="4" width="190" height="52" rx="8" class="map-blue"/>
        <rect width="190" height="52" rx="8" class="map-ink"/>
        <rect x="5" y="5" width="180" height="42" rx="6" fill="none" stroke="var(--map-paper)" stroke-dasharray="2 3" opacity=".4"/>
        <g transform="translate(14 14)" class="map-paper">
          <path d="M0 3L7 0l7 3 7-3v21l-7 3-7-3-7 3Z"/><path d="M7 0V21M14 3V24" fill="none" stroke="var(--map-ink)" stroke-width="1.2"/>
          <circle cx="10.5" cy="10" r="2.2" class="map-ink"/>
        </g>
        <g class="map-paper"><text x="46" y="22" font-size="9" opacity=".75" letter-spacing="1">当前房间</text>
          <text class="map-current" x="46" y="39" font-size="15" font-weight="700" letter-spacing="3"></text>
          <text x="160" y="31" font-size="11" text-anchor="middle" letter-spacing="1">切换</text></g>
        <path d="M134 12v28" stroke="var(--map-paper)" opacity=".35"/>
        <path class="map-arrow" d="M156 40l4-4 4 4" fill="none" stroke="var(--map-paper)" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
    </button>
    <div id="room-floor-plan" class="map-plan" role="group" aria-label="房间地图" inert>
      <svg viewBox="0 0 212 252" role="group" aria-label="选择目的地">
        <defs><filter id="map-paper-texture" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7" result="noise"/>
          <feColorMatrix in="noise" type="matrix" values="0 0 0 0 .17  0 0 0 0 .29  0 0 0 0 .52  0 0 0 .09 0"/>
          <feComposite in2="SourceGraphic" operator="in"/><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode/></feMerge>
        </filter></defs>
        <path transform="translate(4 4)" class="map-blue" d="${panelShape}"/>
        <path class="map-paper" filter="url(#map-paper-texture)" d="${panelShape}"/>
        <path class="map-ink" d="M10 0H202A10 10 0 0 1 212 10V34H0V10A10 10 0 0 1 10 0Z"/>
        <g class="map-paper"><text x="16" y="22" font-size="12" font-weight="700" letter-spacing="2">房间地图</text>
          <text x="196" y="22" font-size="8.5" opacity=".75" text-anchor="end" letter-spacing="1">点一下就过去</text></g>
        <g transform="translate(14 48)">${rooms.map(roomCell).join('')}
          <g pointer-events="none" fill="none" stroke="var(--map-ink)">
            <path stroke-width="4" d="M70 160H0V0H184V20M184 54V160H96"/>
            <path stroke-width="2" stroke-linecap="square" d="M92 0V30M92 52V78M154 0V24M154 48V78M0 78H40M64 78H130M150 78H184M112 78V112M112 136V160"/>
          </g>
        </g>
        <text x="106" y="224" class="map-ink" opacity=".65" font-size="8.5" text-anchor="middle" letter-spacing="1">★ 她现在在这里</text>
      </svg>
    </div>
    <div class="map-blind" hidden aria-hidden="true">
      <div class="map-sheet"><i></i><i></i></div>
      <svg viewBox="0 0 150 150">
        <circle cx="77" cy="77" r="72" class="map-blue"/><circle cx="73" cy="73" r="72" class="map-paper" filter="url(#map-paper-texture)"/>
        <circle cx="73" cy="73" r="64" fill="none" stroke="var(--map-ink)" stroke-dasharray="2 3" opacity=".4"/>
        <g text-anchor="middle" class="map-ink"><text x="73" y="58" font-size="11" opacity=".65" letter-spacing="3">换个房间</text>
          <text class="map-destination" x="77" y="94" font-size="26" font-weight="700" letter-spacing="8"></text></g>
      </svg>
    </div>`;
  const door = host.querySelector('.map-door');
  const panel = host.querySelector('.map-plan');
  const blind = host.querySelector('.map-blind');
  const cells = [...panel.querySelectorAll('[role="button"]')];
  let busy = false;

  function refresh() {
    const current = rooms.find(room => room.id === getLocation());
    host.querySelector('.map-current').textContent = current.name;
    door.setAttribute('aria-label', `当前房间：${current.fullName}，切换房间`);
    for (const cell of cells) {
      cell.setAttribute('aria-current', cell.dataset.mapRoom === current.id ? 'location' : 'false');
    }
  }

  function setOpen(open) {
    door.setAttribute('aria-expanded', String(open));
    panel.inert = !open;
  }

  async function goTo(id) {
    const destination = rooms.find(room => room.id === id && room.open);
    if (!destination || busy) return false;
    if (panel.contains(document.activeElement)) door.focus({ preventScroll: true });
    if (id === getLocation()) {
      setOpen(false);
      return false;
    }
    busy = true;
    panel.inert = true;
    const animate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    try {
      if (animate) {
        blind.querySelector('.map-destination').textContent = destination.name;
        blind.hidden = false;
        blind.getBoundingClientRect(); // Establish the raised position before lowering the sheet.
        blind.classList.add('lowered');
        await wait(1100);
      }
      await travelTo(id);
      refresh();
      setOpen(false);
      blind.classList.remove('lowered');
      if (animate) await wait(580);
      return id === getLocation();
    } finally {
      blind.hidden = true;
      blind.classList.remove('lowered');
      setOpen(false);
      busy = false;
    }
  }

  door.addEventListener('click', () => {
    if (!busy) setOpen(door.getAttribute('aria-expanded') !== 'true');
  });
  for (const cell of cells) {
    cell.addEventListener('click', () => goTo(cell.dataset.mapRoom));
    cell.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (!event.repeat) goTo(cell.dataset.mapRoom);
      }
    });
  }
  document.addEventListener('pointerdown', event => {
    if (!busy && !host.contains(event.target)) setOpen(false);
  });
  document.addEventListener('focusin', event => {
    if (!busy && !host.contains(event.target)) setOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !busy && !panel.inert) {
      setOpen(false);
      door.focus({ preventScroll: true });
    }
  });
  refresh();
  return { goTo, refresh };
}
