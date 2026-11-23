// Weights are relative to the activities still available after the last visit.
const activities = [
  { id: 'rug',    seconds: [45, 90],  weight: { day: 25, dusk: 30, dawn: 65 } },
  { id: 'window', seconds: [35, 75],  weight: { day: 25, dusk: 55, dawn: 20 } },
  { id: 'desk',   seconds: [80, 150], weight: { day: 50, dusk: 15, dawn: 15 } },
];

const farmActivities = [
  { id: 'field', seconds: [45, 90], weight: { day: 50, dusk: 20, dawn: 15 } },
  { id: 'pond', seconds: [35, 75], weight: { day: 30, dusk: 60, dawn: 20 } },
  { id: 'rest', seconds: [60, 120], weight: { day: 20, dusk: 20, dawn: 65 } },
];

export function chooseActivity(period, previousId, random = Math.random, location = 'room') {
  const choices = location === 'farm' ? farmActivities : activities;
  const available = choices.filter(activity => activity.id !== previousId);
  const total = available.reduce((sum, activity) => sum + activity.weight[period], 0);
  let draw = random() * total;
  const selected = available.find(activity => {
    draw -= activity.weight[period];
    return draw < 0;
  }) ?? available.at(-1);

  const [shortest, longest] = selected.seconds;
  return {
    id: selected.id,
    duration: shortest + Math.floor(random() * (longest - shortest + 1)),
  };
}
