// The comparison, as data: what happens when marketing and IT are bought separately, and what
// happens when they are one team. Each lane says where (0..100, along the project) its bar starts
// and ends in each mode. Kept out of the component so the two arrangements can be checked: the
// separate vendors must never overlap, and the single team always does.
//
// The two mode keys keep their old names because they still say the only thing that matters here -
// one after another, or at the same time.

export const LANES = [
  { id: "listen", label: "Задача", note: "Слышим клиента с первого дня и до самого запуска.", turn: [0, 32], realtime: [0, 44], again: [62, 100] },
  { id: "understand", label: "Стратегия", note: "Анализ и план: решения принимаются на данных.", turn: [38, 50], realtime: [8, 50] },
  { id: "think", label: "Реализация", note: "Контент, сайты, настройки каналов.", turn: [52, 70], realtime: [22, 60] },
  { id: "respond", label: "Запуск и поддержка", note: "Кампании работают, а контур измеряется и меняется.", turn: [76, 100], realtime: [46, 92], cut: 62 },
];

export const GAP = { from: 32, to: 76 }; // the silence between two vendors' parts

// How much the ribbon moves at position u (0..1) of the project. Separate vendors: the work runs
// while someone is on it and goes flat in the gaps. One team: it never fully stops.
export function envelopeAt(mode, u, interrupted = false) {
  const x = u * 100;

  if (mode === "realtime") {
    const base = 0.5 + 0.3 * Math.sin(u * 9);

    // after a change of task the current work falls away at once and the next one takes over
    return interrupted && x > 62 ? 0.42 + 0.2 * Math.sin(u * 14) : base;
  }

  if (x < GAP.from) return 0.55;
  if (x < GAP.to) return 0.03;

  return 0.55;
}

export function verdictFor(mode, interrupted) {
  if (mode === "turn") {
    return interrupted
      ? "Задачу сменили посреди проекта: новый цикл начинается с нуля, потому что подрядчики ещё не договорились о передаче."
      : "Этапы идут по очереди. Между стратегией и запуском проект стоит и ждёт, пока каждый подрядчик закончит свою часть.";
  }

  return interrupted
    ? "Задачу сменили посреди проекта: план пересобирается на ходу, работы продолжаются без остановки."
    : "Маркетинг и IT работают одновременно. Сайт, контент и реклама готовятся параллельно, и проект не стоит на паузе.";
}

// Do any two lanes' bars overlap in time, in this mode?
export function overlaps(mode) {
  const bars = LANES.map((lane) => lane[mode === "turn" ? "turn" : "realtime"]);

  for (let a = 0; a < bars.length; a += 1) {
    for (let b = a + 1; b < bars.length; b += 1) {
      if (bars[a][0] < bars[b][1] && bars[b][0] < bars[a][1]) return true;
    }
  }

  return false;
}