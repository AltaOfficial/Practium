import { CanvasPath } from "react-sketch-canvas";

// The grader's marks on a drawn answer: a circle or underline on the part of
// the work that went wrong, with a few words next to it. They are added to the
// board as ordinary strokes, so the student can erase them like their own.

// Not one of the pen colors, so the grader's strokes can be told apart from
// the student's (they are left out of the image that gets graded).
export const MARK_COLOR = "#0891b2";
const MARK_WIDTH = 3;
const MAX_MARKS = 4;

// space between the marked work and the circle / underline around it
const MARK_PADDING = 12;
const UNDERLINE_GAP = 8;
// space between a mark and its note
const NOTE_GAP = 14;
// how close a note may come to other strokes
const NOTE_MARGIN = 12;
// how far from its mark a note may be written
const NOTE_REACH = 700;
// size of the cells used to find a clear spot for a note
const CELL = 12;

// Notes are written in a stroke font: each glyph is a few polylines on a grid
// 4 wide and 6 tall (y down), listed as flat x,y pairs.
const UNIT = 4;
const ADVANCE = 6 * UNIT;
const GLYPH_HEIGHT = 6 * UNIT;
const LINE_HEIGHT = GLYPH_HEIGHT + 10;
const MAX_NOTE_LENGTH = 40;
const MAX_LINE_LENGTH = 16;
const MAX_LINES = 3;

const ROUND = [1, 0, 3, 0, 4, 1, 4, 5, 3, 6, 1, 6, 0, 5, 0, 1, 1, 0];
const BOWL = [0, 6, 0, 0, 3, 0, 4, 1, 4, 2, 3, 3, 0, 3];
const DOT = [2, 6, 2.2, 6];

const GLYPHS: Record<string, number[][]> = {
  A: [[0, 6, 0, 2, 2, 0, 4, 2, 4, 6], [0, 4, 4, 4]],
  B: [[0, 0, 0, 6, 3, 6, 4, 5, 4, 4, 3, 3, 0, 3], [0, 0, 3, 0, 4, 1, 4, 2, 3, 3]],
  C: [[4, 1, 3, 0, 1, 0, 0, 1, 0, 5, 1, 6, 3, 6, 4, 5]],
  D: [[0, 0, 0, 6, 2, 6, 4, 4, 4, 2, 2, 0, 0, 0]],
  E: [[4, 0, 0, 0, 0, 6, 4, 6], [0, 3, 3, 3]],
  F: [[4, 0, 0, 0, 0, 6], [0, 3, 3, 3]],
  G: [[4, 1, 3, 0, 1, 0, 0, 1, 0, 5, 1, 6, 3, 6, 4, 5, 4, 3, 2, 3]],
  H: [[0, 0, 0, 6], [4, 0, 4, 6], [0, 3, 4, 3]],
  I: [[1, 0, 3, 0], [2, 0, 2, 6], [1, 6, 3, 6]],
  J: [[4, 0, 4, 5, 3, 6, 1, 6, 0, 5]],
  K: [[0, 0, 0, 6], [4, 0, 0, 3, 4, 6]],
  L: [[0, 0, 0, 6, 4, 6]],
  M: [[0, 6, 0, 0, 2, 3, 4, 0, 4, 6]],
  N: [[0, 6, 0, 0, 4, 6, 4, 0]],
  O: [ROUND],
  P: [BOWL],
  Q: [ROUND, [2, 4, 4, 6]],
  R: [BOWL, [2, 3, 4, 6]],
  S: [[4, 1, 3, 0, 1, 0, 0, 1, 0, 2, 1, 3, 3, 3, 4, 4, 4, 5, 3, 6, 1, 6, 0, 5]],
  T: [[0, 0, 4, 0], [2, 0, 2, 6]],
  U: [[0, 0, 0, 5, 1, 6, 3, 6, 4, 5, 4, 0]],
  V: [[0, 0, 2, 6, 4, 0]],
  W: [[0, 0, 1, 6, 2, 3, 3, 6, 4, 0]],
  X: [[0, 0, 4, 6], [4, 0, 0, 6]],
  Y: [[0, 0, 2, 3, 4, 0], [2, 3, 2, 6]],
  Z: [[0, 0, 4, 0, 0, 6, 4, 6]],
  "0": [ROUND, [1, 5, 3, 1]],
  "1": [[1, 1, 2, 0, 2, 6], [1, 6, 3, 6]],
  "2": [[0, 1, 1, 0, 3, 0, 4, 1, 4, 2, 0, 6, 4, 6]],
  "3": [
    [0, 1, 1, 0, 3, 0, 4, 1, 4, 2, 3, 3, 1, 3],
    [3, 3, 4, 4, 4, 5, 3, 6, 1, 6, 0, 5],
  ],
  "4": [[3, 6, 3, 0, 0, 4, 4, 4]],
  "5": [[4, 0, 0, 0, 0, 3, 3, 3, 4, 4, 4, 5, 3, 6, 1, 6, 0, 5]],
  "6": [[4, 1, 3, 0, 1, 0, 0, 1, 0, 5, 1, 6, 3, 6, 4, 5, 4, 4, 3, 3, 0, 3]],
  "7": [[0, 0, 4, 0, 1, 6]],
  "8": [
    [1, 3, 0, 2, 0, 1, 1, 0, 3, 0, 4, 1, 4, 2, 3, 3, 1, 3],
    [1, 3, 0, 4, 0, 5, 1, 6, 3, 6, 4, 5, 4, 4, 3, 3],
  ],
  "9": [[4, 3, 1, 3, 0, 2, 0, 1, 1, 0, 3, 0, 4, 1, 4, 5, 3, 6, 1, 6, 0, 5]],
  "-": [[1, 3, 3, 3]],
  "+": [[0, 3, 4, 3], [2, 1, 2, 5]],
  "=": [[0, 2, 4, 2], [0, 4, 4, 4]],
  "/": [[4, 0, 0, 6]],
  ".": [DOT],
  ",": [[2, 5, 1, 7]],
  "!": [[2, 0, 2, 4], DOT],
  "?": [[0, 1, 1, 0, 3, 0, 4, 1, 4, 2, 2, 4], DOT],
  "(": [[3, 0, 1, 2, 1, 4, 3, 6]],
  ")": [[1, 0, 3, 2, 3, 4, 1, 6]],
  "'": [[2, 0, 2, 1.5]],
  ":": [[2, 2, 2.2, 2], [2, 5, 2.2, 5]],
};

type Point = { x: number; y: number };

export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Mark {
  // left, top, right, bottom, each 0-1000 across the graded image
  box: [number, number, number, number];
  shape: "circle" | "underline";
  note: string;
}

// The marks come from the grader model, so nothing about them is trusted.
function parseMarks(raw: unknown): Mark[] {
  if (!Array.isArray(raw)) return [];
  const marks: Mark[] = [];
  for (const item of raw) {
    const box = item?.box;
    if (
      !Array.isArray(box) ||
      box.length !== 4 ||
      !box.every((value) => typeof value === "number" && isFinite(value))
    ) {
      continue;
    }
    const [x1, y1, x2, y2] = box.map((value: number) =>
      Math.min(1000, Math.max(0, value))
    );
    marks.push({
      box: [
        Math.min(x1, x2),
        Math.min(y1, y2),
        Math.max(x1, x2),
        Math.max(y1, y2),
      ],
      shape: item.shape === "underline" ? "underline" : "circle",
      note: typeof item.note === "string" ? item.note : "",
    });
    if (marks.length === MAX_MARKS) break;
  }
  return marks;
}

interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

// a random amount between -size and size
const wobble = (size: number) => (Math.random() * 2 - 1) * size;

// Marks are meant to look written by hand, so nothing is drawn exactly: every
// point is nudged a little, and the canvas then smooths the stroke through
// them. A point halfway along each segment lets straight lines bow slightly.
function handDrawn(points: Point[], shake: number) {
  const drawn: Point[] = [];
  points.forEach((point, index) => {
    const previous = points[index - 1];
    if (previous) {
      drawn.push({
        x: (previous.x + point.x) / 2 + wobble(shake),
        y: (previous.y + point.y) / 2 + wobble(shake),
      });
    }
    drawn.push({ x: point.x + wobble(shake), y: point.y + wobble(shake) });
  });
  return drawn;
}

// The strokes of one character with its top left at (x, y). Each one comes out
// a slightly different size and lean, and sits a little off the line.
function glyphStrokes(character: string, x: number, y: number) {
  const scale = UNIT * (1 + wobble(0.1));
  const lean = 0.12 + wobble(0.08);
  const offsetX = x + wobble(1.5);
  const offsetY = y + GLYPH_HEIGHT - 6 * scale + wobble(2);
  return (GLYPHS[character] || []).map((flat) => {
    const points: Point[] = [];
    for (let i = 0; i < flat.length; i += 2) {
      points.push({
        x: offsetX + (flat[i] + (6 - flat[i + 1]) * lean) * scale,
        y: offsetY + flat[i + 1] * scale,
      });
    }
    return handDrawn(points, 0.7);
  });
}

// a ring that wavers and doesn't quite close on itself
function ring(bounds: Bounds) {
  const centerX = (bounds.left + bounds.right) / 2;
  const centerY = (bounds.top + bounds.bottom) / 2;
  const radiusX = (bounds.right - bounds.left) / 2;
  const radiusY = (bounds.bottom - bounds.top) / 2;
  const steps = 28;
  const start = -Math.PI * (0.6 + Math.random() * 0.3);
  const phase = Math.random() * Math.PI * 2;
  const points: Point[] = [];
  for (let i = 0; i <= steps + 3; i++) {
    const turn = i / steps;
    const angle = start + turn * Math.PI * 2;
    const stretch = 1 + 0.05 * Math.sin(angle * 2 + phase) + 0.07 * turn;
    points.push({
      x: centerX + Math.cos(angle) * radiusX * stretch + wobble(0.8),
      y: centerY + Math.sin(angle) * radiusY * stretch + wobble(0.8),
    });
  }
  return points;
}

// a line from one point to another that tilts and wavers along the way
function wavyLine(from: Point, to: Point) {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(2, Math.round(length / 30));
  const bow = wobble(Math.min(6, length / 20));
  const points: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    points.push({
      x: from.x + (to.x - from.x) * t + wobble(1),
      y: from.y + (to.y - from.y) * t + Math.sin(t * Math.PI) * bow + wobble(1),
    });
  }
  return points;
}

// The note in the characters the font has, split into short lines.
function noteLines(note: string) {
  const words = note
    .toUpperCase()
    .split("")
    .map((character) => (GLYPHS[character] ? character : " "))
    .join("")
    .slice(0, MAX_NOTE_LENGTH)
    .split(" ")
    .filter(Boolean);
  const lines: string[] = [];
  for (const word of words) {
    const last = lines[lines.length - 1];
    if (last !== undefined && last.length + 1 + word.length <= MAX_LINE_LENGTH) {
      lines[lines.length - 1] = `${last} ${word}`;
    } else {
      lines.push(word);
    }
  }
  return lines.slice(0, MAX_LINES);
}

// Which parts of the board have strokes on them, as a grid of small cells.
class Occupied {
  private cells = new Set<number>();

  private static key(column: number, row: number) {
    return column * 100000 + row;
  }

  // marks every cell a stroke passes through, not only the ones its points
  // are in (a quickly drawn line has few points)
  add(points: Point[]) {
    points.forEach((point, index) => {
      const previous = points[index - 1] || point;
      const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
      const steps = Math.max(1, Math.ceil(distance / (CELL / 2)));
      for (let i = 1; i <= steps; i++) {
        const x = previous.x + ((point.x - previous.x) * i) / steps;
        const y = previous.y + ((point.y - previous.y) * i) / steps;
        this.cells.add(Occupied.key(Math.floor(x / CELL), Math.floor(y / CELL)));
      }
    });
  }

  // whether any stroke comes within NOTE_MARGIN of the rectangle
  touches(x: number, y: number, width: number, height: number) {
    const lastColumn = Math.floor((x + width + NOTE_MARGIN) / CELL);
    const lastRow = Math.floor((y + height + NOTE_MARGIN) / CELL);
    for (
      let column = Math.floor((x - NOTE_MARGIN) / CELL);
      column <= lastColumn;
      column++
    ) {
      for (
        let row = Math.floor((y - NOTE_MARGIN) / CELL);
        row <= lastRow;
        row++
      ) {
        if (this.cells.has(Occupied.key(column, row))) return true;
      }
    }
    return false;
  }
}

// Where to write a note of the given size: the clear spot on the board that is
// closest to the mark, so it never lands on top of the student's work.
function placeNote(
  mark: Bounds,
  width: number,
  height: number,
  board: { width: number; height: number },
  occupied: Occupied
) {
  let best: Point | null = null;
  let bestScore = Infinity;
  const maxX = Math.min(board.width - width, mark.right + NOTE_REACH);
  const maxY = Math.min(board.height - height, mark.bottom + NOTE_REACH);
  const minX = Math.max(0, mark.left - NOTE_REACH - width);
  const minY = Math.max(0, mark.top - NOTE_REACH - height);
  for (let y = minY; y <= maxY; y += CELL) {
    for (let x = minX; x <= maxX; x += CELL) {
      const gap = Math.hypot(
        Math.max(mark.left - (x + width), x - mark.right, 0),
        Math.max(mark.top - (y + height), y - mark.bottom, 0)
      );
      // on top of the mark itself
      if (gap < NOTE_GAP) continue;
      // equally close spots: rather below or to the right, lined up with the mark
      const score =
        gap +
        (y + height < mark.top ? 10 : 0) +
        (x + width < mark.left ? 10 : 0) +
        Math.abs(x - mark.left) * 0.02;
      if (score >= bestScore || occupied.touches(x, y, width, height)) continue;
      best = { x, y };
      bestScore = score;
    }
  }
  return (
    best || {
      x: Math.max(0, Math.min(board.width - width, mark.left)),
      y: Math.max(0, Math.min(board.height - height, mark.bottom + NOTE_GAP)),
    }
  );
}

// The two ends of the shortest line between two spans on one axis.
function between(
  fromStart: number,
  fromEnd: number,
  toStart: number,
  toEnd: number
) {
  if (fromEnd < toStart) return [fromEnd, toStart];
  if (toEnd < fromStart) return [fromStart, toEnd];
  const middle = (Math.max(fromStart, toStart) + Math.min(fromEnd, toEnd)) / 2;
  return [middle, middle];
}

// Turns the grader's marks into strokes for the board. `region` is the part of
// the board the graded image showed, and `existing` the strokes already there.
export function buildMarkPaths(
  rawMarks: unknown,
  region: Region,
  board: { width: number; height: number },
  existing: CanvasPath[]
): CanvasPath[] {
  const occupied = new Occupied();
  for (const path of existing) {
    if (path.drawMode) occupied.add(path.paths);
  }
  const strokes: CanvasPath[] = [];
  const add = (points: Point[]) => {
    strokes.push({
      drawMode: true,
      strokeColor: MARK_COLOR,
      strokeWidth: MARK_WIDTH,
      paths: points,
    });
    occupied.add(points);
  };

  for (const mark of parseMarks(rawMarks)) {
    const left = region.x + (mark.box[0] / 1000) * region.width;
    const top = region.y + (mark.box[1] / 1000) * region.height;
    const right = region.x + (mark.box[2] / 1000) * region.width;
    const bottom = region.y + (mark.box[3] / 1000) * region.height;

    let bounds: Bounds;
    if (mark.shape === "underline") {
      bounds = { left, top, right, bottom: bottom + UNDERLINE_GAP };
      add(
        wavyLine(
          { x: left, y: bounds.bottom + wobble(2) },
          { x: right, y: bounds.bottom + wobble(2) }
        )
      );
    } else {
      bounds = {
        left: left - MARK_PADDING,
        top: top - MARK_PADDING,
        right: right + MARK_PADDING,
        bottom: bottom + MARK_PADDING,
      };
      add(ring(bounds));
    }

    const lines = noteLines(mark.note);
    if (lines.length === 0) continue;
    const width = Math.max(...lines.map((line) => line.length)) * ADVANCE;
    const height = (lines.length - 1) * LINE_HEIGHT + GLYPH_HEIGHT;
    const spot = placeNote(bounds, width, height, board, occupied);

    // a note that had to go further away is joined to its mark by a line
    const [fromX, toX] = between(
      spot.x,
      spot.x + width,
      bounds.left,
      bounds.right
    );
    const [fromY, toY] = between(
      spot.y,
      spot.y + height,
      bounds.top,
      bounds.bottom
    );
    const distance = Math.hypot(toX - fromX, toY - fromY);
    if (distance > NOTE_GAP * 2) {
      const inset = 6 / distance;
      add(
        wavyLine(
          { x: fromX + (toX - fromX) * inset, y: fromY + (toY - fromY) * inset },
          { x: toX - (toX - fromX) * inset, y: toY - (toY - fromY) * inset }
        )
      );
    }

    lines.forEach((line, lineIndex) => {
      // each line of writing drifts up or down a little as it goes
      const drift = wobble(0.5);
      line.split("").forEach((character, index) => {
        glyphStrokes(
          character,
          spot.x + index * ADVANCE,
          spot.y + lineIndex * LINE_HEIGHT + index * drift
        ).forEach(add);
      });
    });
  }
  return strokes;
}
