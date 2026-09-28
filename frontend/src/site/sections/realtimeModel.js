// The comparison, as data. Each lane says where (0..100, along the conversation) its bar starts
// and ends in each mode. Kept out of the component so the two arrangements can be checked:
// a turn-based bot must never overlap its stages, and a real-time agent must.

export const LANES = [
  { id: "listen", label: "Слушает", note: "Включён всегда. Он слышит вас, даже когда говорит сам.", turn: [0, 32], realtime: [0, 44], again: [62, 100] },
  { id: "understand", label: "Понимает", note: "Смысл складывается по мере поступления слов.", turn: [38, 50], realtime: [8, 50] },
  { id: "think", label: "Думает", note: "Ищет данные, не прерывая разговор.", turn: [52, 70], realtime: [22, 60] },
  { id: "respond", label: "Отвечает", note: "Начинает с первой фразы. Замолкает, как только вы заговорите.", turn: [76, 100], realtime: [46, 92], cut: 62 },
];

export const GAP = { from: 32, to: 76 }; // the silence in a turn-based exchange

// How much the wave moves at position u (0..1) of the conversation. Turn-based: loud while
// someone is talking, flat in the gaps. Real-time: continuous.
export function envelopeAt(mode, u, interrupted = false) {
  const x = u * 100;

  if (mode === "realtime") {
    const base = 0.5 + 0.3 * Math.sin(u * 9);

    // after an interruption the agent's voice falls away at once and the caller's takes over
    return interrupted && x > 62 ? 0.42 + 0.2 * Math.sin(u * 14) : base;
  }

  if (x < GAP.from) return 0.55;
  if (x < GAP.to) return 0.03;

  return 0.55;
}

export function verdictFor(mode, interrupted) {
  if (mode === "turn") {
    return interrupted
      ? "Вы перебиваете. Он продолжает говорить, пока не закончит свой ответ."
      : "Он ждёт, пока вы договорите, потом обрабатывает и только затем отвечает. В промежутках — тишина.";
  }

  return interrupted
    ? "Вы перебиваете. Он замолкает на полуслове и слушает."
    : "Слушание, понимание и мышление идут одновременно. Он начинает отвечать, ещё не закончив думать.";
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
