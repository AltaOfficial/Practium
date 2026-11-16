"use client";
import {
  forwardRef,
  ReactNode,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  CanvasPath,
  ReactSketchCanvas,
  ReactSketchCanvasRef,
} from "react-sketch-canvas";
import {
  FaCompress,
  FaEraser,
  FaExpand,
  FaPen,
  FaRedo,
  FaRegCommentDots,
  FaRegHandPaper,
  FaTrash,
  FaUndo,
} from "react-icons/fa";
import { buildMarkPaths, MARK_COLOR, Region } from "./boardMarks";

// The drawable area is a fixed size, larger than what is shown, so there is
// room to scroll around. Paths are stored in these pixel coordinates.
const BOARD_WIDTH = 3000;
const BOARD_HEIGHT = 2000;
const BOARD_ID = "drawing-board";

const COLORS = [
  "#e11d48", // red
  "#333333", // black
  "#2563eb", // blue
  "#16a34a", // green
  "#f59e0b", // orange
  "#9333ea", // purple
];
const STROKE_WIDTH = 4;
// how close the eraser has to come to a stroke to take it off
const ERASER_RADIUS = 10;
const MAX_UNDO_STEPS = 100;
const EXPORT_PADDING = 40;
const MAX_EXPORT_SIDE = 2000;

type Tool = "pen" | "eraser" | "pan";

export interface DrawingBoardRef {
  // replaces whatever is on the board; also drops the undo history
  load: (paths: CanvasPath[]) => void;
  // a JPEG data URL of the student's drawing (without the grader's marks),
  // cropped to what was drawn
  exportImage: () => Promise<string>;
  // Draws the grader's marks on the board, in place of any earlier ones. Their
  // positions are relative to the last exported image. Returns the board's
  // paths as JSON with the marks added, or null when nothing was drawn.
  annotate: (marks: unknown) => string | null;
}

interface DrawingBoardProps {
  // called with the paths as JSON ("" when the board is empty) after each change
  onChange: (paths: string) => void;
  // shown above the board while it is full screen, e.g. the question
  fullscreenHeader?: ReactNode;
  // can be opened next to the board while it is full screen, e.g. the tutor chat
  fullscreenSide?: ReactNode;
  // what fullscreenSide is, for its button ("Show chat")
  fullscreenSideLabel?: string;
}

type Point = { x: number; y: number };

function distanceToSegment(point: Point, from: Point, to: Point) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  const along =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared
          )
        );
  return Math.hypot(
    point.x - (from.x + along * dx),
    point.y - (from.y + along * dy)
  );
}

function segmentsCross(a: Point, b: Point, c: Point, d: Point) {
  const side = (p: Point, q: Point, r: Point) =>
    Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return side(a, b, c) !== side(a, b, d) && side(c, d, a) !== side(c, d, b);
}

// Whether the eraser, moved from one point to another, touched a stroke.
function eraserTouches(path: CanvasPath, from: Point, to: Point) {
  const reach = ERASER_RADIUS + path.strokeWidth / 2;
  const points = path.paths;
  for (let i = 0; i < points.length; i++) {
    const start = points[i];
    // a stroke of one point is a dot
    const end = points[Math.min(i + 1, points.length - 1)];
    if (
      segmentsCross(from, to, start, end) ||
      distanceToSegment(from, start, end) <= reach ||
      distanceToSegment(to, start, end) <= reach ||
      distanceToSegment(start, from, to) <= reach ||
      distanceToSegment(end, from, to) <= reach
    ) {
      return true;
    }
  }
  return false;
}

// The region the student drew on, so the exported image isn't mostly empty board.
function drawnRegion(paths: CanvasPath[]): Region {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const path of paths) {
    if (!path.drawMode || path.strokeColor === MARK_COLOR) continue;
    for (const point of path.paths) {
      minX = Math.min(minX, point.x - path.strokeWidth);
      minY = Math.min(minY, point.y - path.strokeWidth);
      maxX = Math.max(maxX, point.x + path.strokeWidth);
      maxY = Math.max(maxY, point.y + path.strokeWidth);
    }
  }
  if (minX === Infinity) {
    return { x: 0, y: 0, width: 1000, height: 600 };
  }
  const x = Math.max(0, Math.floor(minX - EXPORT_PADDING));
  const y = Math.max(0, Math.floor(minY - EXPORT_PADDING));
  const right = Math.min(BOARD_WIDTH, Math.ceil(maxX + EXPORT_PADDING));
  const bottom = Math.min(BOARD_HEIGHT, Math.ceil(maxY + EXPORT_PADDING));
  return {
    x,
    y,
    width: Math.max(1, right - x),
    height: Math.max(1, bottom - y),
  };
}

// A stylus touching the board and asking to erase: its eraser end / eraser
// button (32), or its side (barrel) button (2).
function isPenEraser(event: PointerEvent) {
  return event.pointerType === "pen" && (event.buttons & (32 | 2)) !== 0;
}

// A hovering stylus reporting the primary button (1). Nothing is touching, so
// it can only be a button on the pen: this is how Chrome on Android reports
// the Samsung S Pen's side button. Chrome keeps every touch made while that
// button is held for itself (it selects text with it), so the button can't
// be held to erase; a press of it switches between the pen and the eraser.
function isHoveringPenClick(event: PointerEvent) {
  return event.pointerType === "pen" && (event.buttons & 1) !== 0;
}

// A copy of a pointer event that can be dispatched again.
function clonePointerEvent(type: string, event: PointerEvent) {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window,
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    isPrimary: event.isPrimary,
    button: event.button,
    buttons: event.buttons,
    clientX: event.clientX,
    clientY: event.clientY,
    screenX: event.screenX,
    screenY: event.screenY,
    pressure: event.pressure,
  });
}

const toolButton = (active: boolean) =>
  `w-8 h-8 shrink-0 flex items-center justify-center outline-none !border-2 !border-[#333333] rounded-[4px] ${
    active ? "!bg-[#333333] text-white" : "!bg-transparent text-[#333333]"
  }`;

const DrawingBoard = forwardRef<DrawingBoardRef, DrawingBoardProps>(
  function DrawingBoard(
    { onChange, fullscreenHeader, fullscreenSide, fullscreenSideLabel = "panel" },
    ref
  ) {
    const canvasRef = useRef<ReactSketchCanvasRef>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const pathsRef = useRef<CanvasPath[]>([]);
    // the part of the board the last exported image showed, which is what the
    // grader's marks are positioned against
    const exportedRegion = useRef<Region | null>(null);
    // the board itself, inside the scrolling viewport
    const boardRef = useRef<HTMLDivElement>(null);
    // The board as it was before each change, to undo it, and as it was before
    // each undo, to redo it. Kept here because the canvas can't undo an erased stroke.
    const undoStack = useRef<CanvasPath[][]>([]);
    const redoStack = useRef<CanvasPath[][]>([]);
    // the eraser being dragged over the board: where it was last, the board
    // before it started, and whether it has taken anything off yet
    const eraseGesture = useRef<{
      last: Point;
      before: CanvasPath[];
      changed: boolean;
    } | null>(null);
    // the stroke that is ending was already put in the undo history
    const strokeAlreadyInHistory = useRef(false);
    const panStart = useRef<{
      x: number;
      y: number;
      left: number;
      top: number;
    } | null>(null);

    const [tool, setTool] = useState<Tool>("pen");
    const [color, setColor] = useState(COLORS[0]);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isSideOpen, setIsSideOpen] = useState(false);
    // erasing for one stroke because the stylus's eraser button is held
    const [penErasing, setPenErasing] = useState(false);
    const redispatching = useRef(false);
    // whether a stylus is touching the screen right now
    const penDown = useRef(false);
    // the eraser was switched on by a hovering pen, which is also what
    // switches it off again (the button can't be seen while the pen is down)
    const eraseFromHover = useRef(false);
    // whether the hovering pen's button was held at the last hover event
    const hoverClickHeld = useRef(false);
    const erasing = tool === "eraser" || penErasing;

    const notify = () => {
      const paths = pathsRef.current;
      onChange(paths.length > 0 ? JSON.stringify(paths) : "");
    };

    // puts these paths on the board in place of what is there
    const showPaths = (paths: CanvasPath[]) => {
      pathsRef.current = paths;
      canvasRef.current?.resetCanvas();
      canvasRef.current?.loadPaths(paths);
    };

    // remembers the board as it was before a change, so the change can be undone
    const addToHistory = (before: CanvasPath[]) => {
      undoStack.current.push(before);
      if (undoStack.current.length > MAX_UNDO_STEPS) undoStack.current.shift();
      redoStack.current = [];
    };

    const undo = () => {
      const before = undoStack.current.pop();
      if (!before) return;
      redoStack.current.push(pathsRef.current);
      showPaths(before);
      notify();
    };

    const redo = () => {
      const after = redoStack.current.pop();
      if (!after) return;
      undoStack.current.push(pathsRef.current);
      showPaths(after);
      notify();
    };

    const clear = () => {
      if (pathsRef.current.length === 0) return;
      addToHistory(pathsRef.current);
      showPaths([]);
      notify();
    };

    // where on the board a pointer is
    const boardPoint = (event: { clientX: number; clientY: number }): Point => {
      const rect = boardRef.current?.getBoundingClientRect();
      return {
        x: event.clientX - (rect?.left ?? 0),
        y: event.clientY - (rect?.top ?? 0),
      };
    };

    // The eraser takes off whole strokes: every stroke it touches on its way
    // to this point goes, in one piece.
    const eraseTo = (point: Point) => {
      const gesture = eraseGesture.current;
      if (!gesture) return;
      const kept = pathsRef.current.filter(
        (path) => !path.drawMode || !eraserTouches(path, gesture.last, point)
      );
      gesture.last = point;
      if (kept.length !== pathsRef.current.length) {
        gesture.changed = true;
        showPaths(kept);
      }
    };

    const startErasing = (event: PointerEvent) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      // not when the press is on the viewport's scrollbars
      const rect = viewport.getBoundingClientRect();
      if (
        event.clientX - rect.left > viewport.clientWidth ||
        event.clientY - rect.top > viewport.clientHeight
      ) {
        return;
      }
      const point = boardPoint(event);
      eraseGesture.current = {
        last: point,
        before: pathsRef.current,
        changed: false,
      };
      try {
        // keep getting the pointer's moves, wherever it goes
        viewport.setPointerCapture(event.pointerId);
      } catch {
        // the pointer is already gone
      }
      eraseTo(point);
    };

    const stopErasing = () => {
      const gesture = eraseGesture.current;
      if (!gesture) return;
      eraseGesture.current = null;
      if (gesture.changed) {
        addToHistory(gesture.before);
        notify();
      }
    };

    useImperativeHandle(ref, () => ({
      load: (paths) => {
        // marks for the drawing that was here don't belong on this one
        exportedRegion.current = null;
        undoStack.current = [];
        redoStack.current = [];
        eraseGesture.current = null;
        showPaths(paths);
        viewportRef.current?.scrollTo({ left: 0, top: 0 });
      },
      exportImage: async () => {
        let svg = await canvasRef.current?.exportSvg();
        if (!svg) throw new Error("Drawing board is not ready");

        // the grader should see the student's work, not its own earlier marks
        const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
        if (!parsed.querySelector("parsererror")) {
          parsed
            .querySelectorAll(`[stroke="${MARK_COLOR}"]`)
            .forEach((mark) => mark.remove());
          svg = new XMLSerializer().serializeToString(parsed);
        }

        const image = new window.Image();
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error("Could not render drawing"));
          image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
            svg
          )}`;
        });

        const region = drawnRegion(pathsRef.current);
        exportedRegion.current = region;
        const scale = Math.min(
          1,
          MAX_EXPORT_SIDE / Math.max(region.width, region.height)
        );
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(region.width * scale);
        canvas.height = Math.round(region.height * scale);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Could not render drawing");
        context.fillStyle = "white";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(
          image,
          region.x,
          region.y,
          region.width,
          region.height,
          0,
          0,
          canvas.width,
          canvas.height
        );
        return canvas.toDataURL("image/jpeg");
      },
      annotate: (marks) => {
        const region = exportedRegion.current;
        if (!region) return null;
        const kept = pathsRef.current.filter(
          (path) => path.strokeColor !== MARK_COLOR
        );
        const added = buildMarkPaths(
          marks,
          region,
          { width: BOARD_WIDTH, height: BOARD_HEIGHT },
          kept
        );
        if (added.length === 0) return null;

        showPaths([...kept, ...added]);
        notify();
        return JSON.stringify([...kept, ...added]);
      },
    }));

    // track the stylus touching and lifting, wherever on the page it happens
    useEffect(() => {
      const onDown = (event: PointerEvent) => {
        // ignore the events this component dispatches itself
        if (redispatching.current) return;
        if (event.pointerType === "pen") {
          penDown.current = true;
        } else {
          // a finger or mouse took over: the pen's button no longer applies
          eraseFromHover.current = false;
          setPenErasing(false);
        }
      };
      const onLift = (event: PointerEvent) => {
        if (redispatching.current || event.pointerType !== "pen") return;
        penDown.current = false;
        // without hover to say the button was released, the eraser only
        // lasts until the pen is lifted
        if (!eraseFromHover.current) setPenErasing(false);
      };
      document.addEventListener("pointerdown", onDown, true);
      document.addEventListener("pointerup", onLift);
      document.addEventListener("pointercancel", onLift);
      return () => {
        document.removeEventListener("pointerdown", onDown, true);
        document.removeEventListener("pointerup", onLift);
        document.removeEventListener("pointercancel", onLift);
      };
    }, []);

    // Starts erasing for a stylus whose eraser button is held. When the button
    // is pressed part-way through a pen stroke, that stroke is ended first.
    const startPenErase = (native: PointerEvent, midStroke: boolean) => {
      if (midStroke && native.target) {
        // the stroke goes in the undo history now, before the eraser changes the board
        addToHistory(pathsRef.current.slice(0, -1));
        strokeAlreadyInHistory.current = true;
        redispatching.current = true;
        try {
          native.target.dispatchEvent(clonePointerEvent("pointerup", native));
        } finally {
          redispatching.current = false;
        }
      }
      setPenErasing(true);
      startErasing(native);
    };

    // while full screen: Escape leaves it, and the page behind doesn't scroll
    useEffect(() => {
      if (!isFullscreen) return;
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") setIsFullscreen(false);
      };
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", onKeyDown);
      return () => {
        document.body.style.overflow = previousOverflow;
        document.removeEventListener("keydown", onKeyDown);
      };
    }, [isFullscreen]);

    return (
      <div
        className={
          isFullscreen
            ? "fixed inset-0 z-50 bg-white p-4 flex gap-4 select-none"
            : "select-none"
        }
      >
        <div className="flex flex-col gap-3 flex-1 min-w-0 min-h-0">
        {isFullscreen && fullscreenHeader && (
          <div className="max-h-[25vh] overflow-y-auto text-[#333333] shrink-0">
            {fullscreenHeader}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="Pen"
              onClick={() => setTool("pen")}
              className={toolButton(tool === "pen" && !penErasing)}
            >
              <FaPen size={13} />
            </button>
            <button
              type="button"
              title="Eraser"
              onClick={() => setTool("eraser")}
              className={toolButton(erasing)}
            >
              <FaEraser size={14} />
            </button>
            <button
              type="button"
              title="Move around (drag to scroll)"
              onClick={() => setTool("pan")}
              className={toolButton(tool === "pan")}
            >
              <FaRegHandPaper size={14} />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {COLORS.map((swatch) => (
              <button
                key={swatch}
                type="button"
                title="Pen color"
                onClick={() => {
                  setColor(swatch);
                  if (tool !== "pen") setTool("pen");
                }}
                style={{ backgroundColor: swatch }}
                className={`w-6 h-6 shrink-0 rounded-full outline-none !border-2 ${
                  color === swatch
                    ? "!border-[#333333] ring-2 ring-offset-1 ring-[#333333]"
                    : "!border-white"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              title="Undo"
              onClick={undo}
              className={toolButton(false)}
            >
              <FaUndo size={13} />
            </button>
            <button
              type="button"
              title="Redo"
              onClick={redo}
              className={toolButton(false)}
            >
              <FaRedo size={13} />
            </button>
            <button
              type="button"
              title="Clear the board"
              onClick={clear}
              className={toolButton(false)}
            >
              <FaTrash size={13} />
            </button>
          </div>

          {isFullscreen && fullscreenSide && (
            <button
              type="button"
              title={`${isSideOpen ? "Hide" : "Show"} ${fullscreenSideLabel}`}
              onClick={() => setIsSideOpen(!isSideOpen)}
              className={`${toolButton(isSideOpen)} ml-auto`}
            >
              <FaRegCommentDots size={15} />
            </button>
          )}

          <button
            type="button"
            title={isFullscreen ? "Exit full screen (Esc)" : "Full screen"}
            onClick={() => setIsFullscreen(!isFullscreen)}
            className={`${toolButton(false)} ${
              isFullscreen && fullscreenSide ? "" : "ml-auto"
            }`}
          >
            {isFullscreen ? <FaCompress size={14} /> : <FaExpand size={14} />}
          </button>
        </div>

        {/* Scrollable view onto the board */}
        <div
          ref={viewportRef}
          onPointerDownCapture={(event) => {
            const native = event.nativeEvent;
            if (
              redispatching.current ||
              erasing ||
              tool === "pan" ||
              !isPenEraser(native)
            ) {
              return;
            }
            event.stopPropagation();
            startPenErase(native, false);
          }}
          onPointerMoveCapture={(event) => {
            const native = event.nativeEvent;
            if (
              redispatching.current ||
              native.pointerType !== "pen" ||
              tool === "pan"
            ) {
              return;
            }
            if (penDown.current) {
              // button pressed part-way through a pen stroke
              if (!erasing && !eraseGesture.current && isPenEraser(native)) {
                startPenErase(native, true);
              }
              return;
            }
            // hovering: a press of the S Pen's button switches pen <-> eraser
            const clickHeld = isHoveringPenClick(native);
            if (clickHeld !== hoverClickHeld.current) {
              hoverClickHeld.current = clickHeld;
              if (clickHeld) {
                setTool((current) => (current === "eraser" ? "pen" : "eraser"));
              }
            }
            // other pens: be erasing (or not) before the pen lands
            const held = isPenEraser(native);
            if (held !== eraseFromHover.current || held !== penErasing) {
              eraseFromHover.current = held;
              setPenErasing(held);
            }
          }}
          // a pen's side button otherwise opens the right-click menu
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={(event) => {
            if (erasing && tool !== "pan") {
              startErasing(event.nativeEvent);
              return;
            }
            // touch scrolls natively in pan mode
            if (tool !== "pan" || event.pointerType === "touch") return;
            const viewport = event.currentTarget;
            panStart.current = {
              x: event.clientX,
              y: event.clientY,
              left: viewport.scrollLeft,
              top: viewport.scrollTop,
            };
            viewport.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (eraseGesture.current) {
              eraseTo(boardPoint(event));
              return;
            }
            if (!panStart.current) return;
            const viewport = event.currentTarget;
            viewport.scrollLeft =
              panStart.current.left - (event.clientX - panStart.current.x);
            viewport.scrollTop =
              panStart.current.top - (event.clientY - panStart.current.y);
          }}
          onPointerUp={() => {
            stopErasing();
            panStart.current = null;
          }}
          onPointerCancel={() => {
            stopErasing();
            panStart.current = null;
          }}
          // while erasing, a finger dragged over the board erases instead of scrolling
          style={erasing && tool !== "pan" ? { touchAction: "none" } : undefined}
          className={`overflow-auto overscroll-contain border border-[#333333] rounded-lg shadow-[2px_3px_0_0px_rgba(51,51,51,1)] ${
            isFullscreen
              ? "flex-1 min-h-0"
              : "h-[30vh] min-h-[150px] resize-y [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          } ${
            tool === "pan"
              ? "cursor-grab active:cursor-grabbing"
              : erasing
              ? "cursor-cell"
              : "cursor-crosshair"
          }`}
        >
          <div
            ref={boardRef}
            // the canvas only gets the pointer to draw; moving around and erasing are handled here
            className={tool === "pan" || erasing ? "pointer-events-none" : ""}
            style={{ width: BOARD_WIDTH, height: BOARD_HEIGHT }}
          >
            <ReactSketchCanvas
              ref={canvasRef}
              id={BOARD_ID}
              width={`${BOARD_WIDTH}px`}
              height={`${BOARD_HEIGHT}px`}
              style={{ border: "none" }}
              strokeColor={color}
              strokeWidth={STROKE_WIDTH}
              onChange={(paths) => {
                pathsRef.current = paths;
              }}
              onStroke={() => {
                // a finished pen stroke can be undone
                if (strokeAlreadyInHistory.current) {
                  strokeAlreadyInHistory.current = false;
                } else {
                  addToHistory(pathsRef.current.slice(0, -1));
                }
                notify();
              }}
            />
          </div>
        </div>
        </div>

        {isFullscreen && fullscreenSide && isSideOpen && (
          <div className="w-[min(440px,45vw)] shrink-0 min-h-0 select-text">
            {fullscreenSide}
          </div>
        )}
      </div>
    );
  }
);

export default DrawingBoard;
