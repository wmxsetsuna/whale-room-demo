// Apparent solar longitude, declination and equation of time from the
// NOAA/Meeus solar calculation: https://gml.noaa.gov/grad/solcalc/calcdetails.html
const DEG = Math.PI / 180;
const LATITUDE = 22.5431 * DEG;
const LONGITUDE = 114.0579; // Degrees east of Greenwich, Shenzhen city centre.
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const UTC_OFFSET = 8 * 60 * MINUTE;
let cachedSchedule;

function solarTerms(instant) {
  // Julian centuries since J2000.0 (2000-01-01 12:00 UTC).
  const t = (instant / DAY + 2_440_587.5 - 2_451_545) / 36_525;
  const L = ((280.46646 + t * (36_000.76983 + t * 0.0003032)) % 360) * DEG;
  const M = (357.52911 + t * (35_999.05029 - t * 0.0001537)) * DEG;
  const e = 0.016708634 - t * (0.000042037 + t * 0.0000001267);
  const centreDegrees =
    (1.914602 - t * (0.004817 + t * 0.000014)) * Math.sin(M)
    + (0.019993 - t * 0.000101) * Math.sin(2 * M)
    + 0.000289 * Math.sin(3 * M);
  const omega = (125.04 - 1934.136 * t) * DEG;
  const apparentLongitude = L + (centreDegrees - 0.00569 - 0.00478 * Math.sin(omega)) * DEG;
  const tiltSeconds = 21.448 - t * (46.815 + t * (0.00059 - t * 0.001813));
  const tilt = (23 + 26 / 60 + tiltSeconds / 3600 + 0.00256 * Math.cos(omega)) * DEG;
  const declination = Math.asin(Math.sin(tilt) * Math.sin(apparentLongitude));
  const y = Math.tan(tilt / 2) ** 2;
  const equationOfTime = (4 / DEG) * (
    y * Math.sin(2 * L) - 2 * e * Math.sin(M)
    + 4 * e * y * Math.sin(M) * Math.cos(2 * L)
    - 0.5 * y * y * Math.sin(4 * L) - 1.25 * e * e * Math.sin(2 * M)
  );
  return { declination, equationOfTime };
}

function solarEvent(utcMidnight, altitudeDegrees, direction) {
  let instant = utcMidnight + DAY / 2 - UTC_OFFSET;
  // Start at local noon and update the solar coordinates at the estimated event.
  for (let i = 0; i < 3; i++) {
    const { declination, equationOfTime } = solarTerms(instant);
    const cosHourAngle = (Math.sin(altitudeDegrees * DEG) - Math.sin(LATITUDE) * Math.sin(declination))
      / (Math.cos(LATITUDE) * Math.cos(declination));
    const hourAngle = Math.acos(cosHourAngle) / DEG;
    const minutesUTC = 720 - 4 * LONGITUDE - equationOfTime + direction * 4 * hourAngle;
    instant = utcMidnight + minutesUTC * MINUTE;
  }
  return Math.round(instant);
}

export function shenzhenSunSchedule(now) {
  // UTC midnight labelled with the same calendar date as Shenzhen local time.
  const utcMidnight = Math.floor((now.getTime() + UTC_OFFSET) / DAY) * DAY;
  const nextMidnight = utcMidnight + DAY - UTC_OFFSET;
  if (cachedSchedule?.nextMidnight === nextMidnight) return cachedSchedule;

  cachedSchedule = Object.freeze({
    dateKey: new Date(utcMidnight).toISOString().slice(0, 10),
    sunrise: solarEvent(utcMidnight, -0.833, -1),
    sunset: solarEvent(utcMidnight, -0.833, 1),
    nightfall: solarEvent(utcMidnight, -18, 1),
    nextMidnight,
  });
  return cachedSchedule;
}
