import { shenzhenSunSchedule } from './shenzhen-sun.js';

const minute = 60_000;
const day = 24 * 60 * minute;
const bellSetting = 'whale-room.sun-announcements';
const formatTime = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const paper = 'var(--clock-paper)';
const blue = 'var(--clock-blue)';
const navy = 'var(--clock-navy)';

function rays(inner, outer, halfWidth) {
  return Array.from({ length: 8 }, (_, i) =>
    `<path transform="rotate(${i * 45})" d="M${-halfWidth} ${-inner} L0 ${-outer} L${halfWidth} ${-inner}Z"/>`).join('');
}

const stars = [[42,58,3.4],[66,34,2.4],[128,30,3],[158,62,2.2],[100,22,2],[52,88,2],[146,88,2.6],[84,66,1.6]]
  .map(([x,y,size]) => `<path transform="translate(${x} ${y}) scale(${size})" d="M0 -1 .28 -.28 1 0 .28 .28 0 1 -.28 .28 -1 0 -.28 -.28Z"/>`).join('');
const holes = Array.from({length: 11}, (_, index) => {
  const angle = (index + 1) * Math.PI / 12;
  return `<circle cx="${(100 - 93 * Math.cos(angle)).toFixed(2)}" cy="${(84 - 77 * Math.sin(angle)).toFixed(2)}" r="1.7"/>`;
}).join('');
const arch = 'M0 84 A100 84 0 0 1 200 84 V178 Q200 190 188 190 H12 Q0 190 0 178Z';
const ribbon = 'M64 -14 H136 L129 -4 L136 6 H64 L71 -4Z';
const scrollPaper = 'M8 12 H204 A8 8 0 0 1 212 20 V76 L200 70 L188 76 H24 L12 70 L0 76 V20 A8 8 0 0 1 8 12Z';
const announcements = {
  sunrise: {
    name: '日出', text: '天亮啦，窗外的云醒了',
    badge: `<g fill="${navy}">${rays(8.5,12,1.8)}<circle r="6.5"/></g><circle r="3.4" fill="none" stroke="${paper}" stroke-width="1.1"/>`,
  },
  sunset: {
    name: '日落', text: '太阳下班了，台灯可以亮起来了',
    badge: `<circle r="8.5" fill="${navy}"/><circle r="7.4" cx="4.2" cy="-3" fill="${paper}"/>`,
  },
};

const clockMarkup = `
  <div class="clock-scroll" aria-hidden="true">
    <svg viewBox="0 0 216 86" aria-hidden="true">
      <path d="M44 0 V16 M172 0 V16" fill="none" stroke="${navy}" stroke-width="1.3"/>
      <path transform="translate(4 4)" fill="${blue}" d="${scrollPaper}"/>
      <path fill="${navy}" d="${scrollPaper}"/>
      <path fill="none" stroke="${paper}" stroke-dasharray="3 3" opacity=".45" d="M10 17 H202 A5 5 0 0 1 207 22 V68 L200 64 L188 70 H24 L12 64 L5 68 V22 A5 5 0 0 1 10 17Z"/>
      <g fill="${paper}"><circle cx="44" cy="17" r="2.2"/><circle cx="172" cy="17" r="2.2"/><circle cx="30" cy="43" r="15"/></g>
      <g data-clock="badge" transform="translate(30 43) scale(.85)"></g>
      <g fill="${paper}">
        <text data-clock="heading" x="53" y="39" font-size="14.5" font-weight="700" letter-spacing="1"></text>
        <text data-clock="message" x="53" y="56" opacity=".85" font-size="10.5"></text>
      </g>
    </svg>
  </div>
  <svg class="clock-face" role="img" aria-label="深圳时钟" viewBox="-8 -18 224 218">
    <defs>
      <clipPath id="room-clock-sky"><path d="M14 128 V88 A86 72 0 0 1 186 88 V128Z"/></clipPath>
      <filter id="room-clock-grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7"/>
        <feColorMatrix type="matrix" values="0 0 0 0 .17 0 0 0 0 .29 0 0 0 0 .52 0 0 0 .09 0"/>
        <feComposite in2="SourceGraphic" operator="in"/>
        <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode/></feMerge>
      </filter>
    </defs>
    <path fill="${blue}" transform="translate(4 4)" d="${arch}"/>
    <path fill="${paper}" filter="url(#room-clock-grain)" d="${arch}"/>
    <g fill="${blue}">${holes}</g>
    <g clip-path="url(#room-clock-sky)">
      <rect fill="${blue}" width="200" height="130"/>
      <g data-clock="night"><rect fill="${navy}" width="200" height="130"/><g fill="${paper}">${stars}</g></g>
      <g data-clock="clouds" fill="${paper}">
        <path d="M34 74 a6 6 0 0 1 8-6 a8 8 0 0 1 15 1 a5 5 0 0 1 3 9 H37 a4 4 0 0 1 -3-4Z"/>
        <path d="M138 52 a5 5 0 0 1 7-5 a7 7 0 0 1 13 1 a4.5 4.5 0 0 1 2 8 H140 a3.5 3.5 0 0 1 -2-4Z"/>
      </g>
      <path fill="none" stroke="${paper}" stroke-width="1.2" stroke-dasharray="2 4" opacity=".8" d="M30 128 A70 86 0 0 1 170 128"/>
      <g data-clock="sun"><g class="clock-pulse" fill="${paper}">
        ${rays(11.5,16.5,2.6)}<circle r="9.5"/><circle r="5.6" fill="none" stroke="${blue}" stroke-width="1.3"/><circle r="1.8" fill="${blue}"/>
      </g></g>
      <g data-clock="moon"><g class="clock-pulse">
        <circle r="9" fill="${paper}"/><circle r="8" cx="4.5" cy="-3.2" fill="${navy}"/><circle r="1.2" cx="-4" cy="3" fill="${navy}"/>
      </g></g>
      <path data-clock="hill" d="M14 128 V110 C34 100 52 100 72 108 C92 116 112 98 136 100 C156 102 170 108 186 104 V128Z"/>
      <g fill="${navy}">
        <path d="M14 128 V121 C40 112 70 114 96 120 C120 126 146 116 166 112 C176 110 182 112 186 113 V128Z"/>
        <path d="M141 118 V109.5 L147 104 L153 109.5 V118Z M58 121 L62 110 L66 121Z M64 122 L67.5 113 L71 122Z"/>
      </g>
      <rect fill="${paper}" x="145.4" y="110.4" width="3.2" height="3.6" rx=".5"/>
    </g>
    <path d="M14 128.5 H186" stroke="${navy}" stroke-width="1.4"/>
    <g fill="${navy}" text-anchor="middle">
      <g font-size="9" opacity=".6" letter-spacing="1"><text x="32" y="146">日出</text><text x="168" y="146">日落</text></g>
      <g class="clock-digits" font-size="13"><text data-clock="sunrise" x="32" y="162"></text><text data-clock="sunset" x="168" y="162"></text></g>
      <path d="M58 140 V166 M142 140 V166" stroke="${navy}" stroke-dasharray="2 2.5" opacity=".3"/>
      <text class="clock-digits" data-clock="now" x="100" y="159" font-size="25" letter-spacing="1"></text>
      <text data-clock="countdown" x="100" y="178" font-size="9.5" opacity=".75" letter-spacing=".5"></text>
    </g>
    <path transform="translate(3 3)" fill="${blue}" d="${ribbon}"/><path fill="${navy}" d="${ribbon}"/>
    <text data-clock="period" x="101.5" y="0" fill="${paper}" text-anchor="middle" font-size="11" font-weight="700" letter-spacing="3"></text>
  </svg>
  <button class="clock-bell" type="button" aria-label="日出日落报时" aria-pressed="true">
    <svg viewBox="0 0 26 26" aria-hidden="true">
      <circle cx="14" cy="14" r="11" fill="${blue}"/><circle cx="12" cy="12" r="11" fill="${navy}"/>
      <path fill="${paper}" d="M12 5.5a1 1 0 0 1 1 1v.6a4.3 4.3 0 0 1 3.3 4.2v3l1.4 1.9H6.3L7.7 14.3v-3A4.3 4.3 0 0 1 11 7.1v-.6a1 1 0 0 1 1-1Z M10.3 17.4h3.4a1.7 1.7 0 0 1-3.4 0Z"/>
      <path class="clock-slash" stroke="${paper}" stroke-width="1.8" stroke-linecap="round" d="M6.5 6.5 17.5 17.5"/>
    </svg>
  </button>
  <span class="clock-announcement" role="status"></span>`;

function periodName(t, sunrise, sunset) {
  if (t < 300) return '深夜';
  if (t < sunrise) return '破晓';
  if (t < 540) return '早上';
  if (t < 690) return '上午';
  if (t < 810) return '中午';
  if (t < sunset - 60) return '午后';
  if (t < sunset + 40) return '黄昏';
  return t < 1320 ? '夜里' : '深夜';
}

function durationLabel(milliseconds) {
  const minutes = Math.ceil(milliseconds / minute);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder}分`;
  return remainder ? `${hours}时${remainder}分` : `${hours}时`;
}

export function initRoomClock() {
  const clock = document.querySelector('#room-clock');
  clock.innerHTML = clockMarkup;
  const parts = Object.fromEntries([...clock.querySelectorAll('[data-clock]')]
    .map(element => [element.dataset.clock, element]));
  const bell = clock.querySelector('.clock-bell');
  const face = clock.querySelector('.clock-face');
  const liveMessage = clock.querySelector('.clock-announcement');
  let muted = false;
  try { muted = localStorage.getItem(bellSetting) === 'off'; } catch { /* Offline files can deny storage. */ }
  let lastUpdate, timer, scrollTimer, schedule, yesterdaySunset, tomorrowSunrise;
  let lastAnnounced = -Infinity;

  function updateBell() {
    bell.setAttribute('aria-pressed', String(!muted));
    bell.title = muted ? '开启日出日落报时' : '关闭日出日落报时';
  }
  updateBell();
  bell.addEventListener('click', () => {
    muted = !muted;
    updateBell();
    if (muted) clock.classList.remove('clock-announcing');
    try { localStorage.setItem(bellSetting, muted ? 'off' : 'on'); } catch { /* The current page still retains the setting. */ }
  });

  function announce(kind) {
    const eventTime = schedule[kind];
    if (muted || eventTime <= lastAnnounced) return;
    lastAnnounced = eventTime;
    const {name, text, badge} = announcements[kind];
    parts.heading.textContent = `${formatTime.format(eventTime)} · ${name}`;
    parts.message.textContent = text;
    parts.badge.innerHTML = badge;
    liveMessage.textContent = `${parts.heading.textContent}，${text}`;
    clock.classList.add('clock-announcing');
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => clock.classList.remove('clock-announcing'), 3400);
  }

  function tick() {
    clearTimeout(timer);
    if (document.hidden) return;
    const now = Date.now();
    if (!schedule || now >= schedule.nextMidnight || now < schedule.nextMidnight - day) {
      schedule = shenzhenSunSchedule(new Date(now));
      yesterdaySunset = shenzhenSunSchedule(new Date(schedule.nextMidnight - day - 1)).sunset;
      tomorrowSunrise = shenzhenSunSchedule(new Date(schedule.nextMidnight)).sunrise;
      parts.sunrise.textContent = formatTime.format(schedule.sunrise);
      parts.sunset.textContent = formatTime.format(schedule.sunset);
    }
    const {sunrise, sunset, nextMidnight} = schedule;
    const midnight = nextMidnight - day;
    const isDay = now >= sunrise && now < sunset;
    const beforeSunrise = now < sunrise;
    const start = isDay ? sunrise : beforeSunrise ? yesterdaySunset : sunset;
    const end = isDay ? sunset : beforeSunrise ? sunrise : tomorrowSunrise;
    const progress = (now - start) / (end - start);
    const angle = progress * Math.PI;
    const daylight = Math.max(0, Math.min(1, (now - sunrise) / (50 * minute) + .5, (sunset - now) / (50 * minute) + .5));
    parts.night.setAttribute('opacity', 1 - daylight);
    parts.clouds.setAttribute('opacity', daylight);
    parts.hill.setAttribute('fill', daylight < .5 ? blue : paper);
    (isDay ? parts.sun : parts.moon).setAttribute('transform',
      `translate(${100 - 70 * Math.cos(angle)} ${128 - 86 * Math.sin(angle)})`);
    parts.sun.setAttribute('visibility', isDay ? 'visible' : 'hidden');
    parts.moon.setAttribute('visibility', isDay ? 'hidden' : 'visible');
    parts.now.textContent = formatTime.format(now);
    parts.period.textContent = periodName((now - midnight) / minute, (sunrise - midnight) / minute, (sunset - midnight) / minute);
    parts.countdown.textContent = `距${isDay ? '日落' : '日出'} ${durationLabel(end - now)}`;
    face.setAttribute('aria-label', `深圳时间 ${parts.now.textContent}，日出 ${parts.sunrise.textContent}，日落 ${parts.sunset.textContent}，${parts.countdown.textContent}`);

    // Announce only a crossing observed during this visit, including a tick at the event itself.
    if (lastUpdate < sunrise && now >= sunrise && now < sunset) announce('sunrise');
    else if (lastUpdate < sunset && now >= sunset) announce('sunset');
    lastUpdate = now;
    const nextMinute = now - now % minute + minute;
    const nextUpdate = Math.min(nextMinute, end, nextMidnight);
    timer = setTimeout(tick, Math.max(1, nextUpdate - now));
  }
  document.addEventListener('visibilitychange', () => {
    lastUpdate = undefined;
    tick();
  });
  window.addEventListener('pageshow', () => { lastUpdate = undefined; tick(); });
  tick();
}
