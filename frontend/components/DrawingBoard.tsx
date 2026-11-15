"use client";
import {
  forwardRef,
  ReactNode,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
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
const ERASER_WIDTH = 20;
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
  function DrawingBoard({ onChange, fullscreenHeader }, ref) {
    const canvasRef = useRef<ReactSketchCanvasRef>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const pathsRef = useRef<CanvasPath[]>([]);
    // the part of the board the last exported image showed, which is what the
    // grader's marks are positioned against
    const exportedRegion = useRef<Region | null>(null);
    // set by undo/redo/clear, which don't end with a stroke to report
    const notifyOnNextChange = useRef(false);
    const panStart = useRef<{
      x: number;
      y: number;
      left: number;
      top: number;
    } | null>(null);

    const [tool, setTool] = useState<Tool>("pen");
    const [color, setColor] = useState(COLORS[0]);
    const [isFullscreen, setIsFullscreen] = useState(false);
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

    useImperativeHandle(ref, () => ({
      load: (paths) => {
        // marks for the drawing that was here don't belong on this one
        exportedRegion.current = null;
        canvasRef.current?.resetCanvas();
        canvasRef.current?.loadPaths(paths);
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

        notifyOnNextChange.current = true;
        if (kept.length === pathsRef.current.length) {
          canvasRef.current?.loadPaths(added);
        } else {
          // earlier marks can only be taken off by loading the board again
          canvasRef.current?.resetCanvas();
          canvasRef.current?.loadPaths([...kept, ...added]);
        }
        return JSON.stringify([...kept, ...added]);
      },
    }));

    useEffect(() => {
      canvasRef.current?.eraseMode(erasing);
    }, [erasing]);

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

    // Starts an eraser stroke for a stylus whose eraser button is held. The
    // canvas decides pen vs eraser when a stroke starts, so switch it to the
    // eraser first and then hand it the pointer-down again. When the button
    // is pressed part-way through a stroke, that stroke is ended first.
    const startPenErase = (native: PointerEvent, midStroke: boolean) => {
      const target = native.target;
      if (!target) return;
      redispatching.current = true;
      try {
        if (midStroke) {
          target.dispatchEvent(clonePointerEvent("pointerup", native));
        }
        flushSync(() => {
          setPenErasing(true);
          canvasRef.current?.eraseMode(true);
        });
        target.dispatchEvent(clonePointerEvent("pointerdown", native));
      } finally {
        redispatching.current = false;
      }
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

    const withNotify = (action: () => void) => () => {
      notifyOnNextChange.current = true;
      action();
    };

    return (
      <div
        className={
          isFullscreen
            ? "fixed inset-0 z-50 bg-white p-4 flex flex-col gap-3 select-none"
            : "flex flex-col gap-3 select-none"
        }
      >
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
              onClick={withNotify(() => canvasRef.current?.undo())}
              className={toolButton(false)}
            >
              <FaUndo size={13} />
            </button>
            <button
              type="button"
              title="Redo"
              onClick={withNotify(() => canvasRef.current?.redo())}
              className={toolButton(false)}
            >
              <FaRedo size={13} />
            </button>
            <button
              type="button"
              title="Clear the board"
              onClick={withNotify(() => canvasRef.current?.clearCanvas())}
              className={toolButton(false)}
            >
              <FaTrash size={13} />
            </button>
          </div>

          <button
            type="button"
            title={isFullscreen ? "Exit full screen (Esc)" : "Full screen"}
            onClick={() => setIsFullscreen(!isFullscreen)}
            className={`${toolButton(false)} ml-auto`}
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
              if (!erasing && isPenEraser(native)) startPenErase(native, true);
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
            if (!panStart.current) return;
            const viewport = event.currentTarget;
            viewport.scrollLeft =
              panStart.current.left - (event.clientX - panStart.current.x);
            viewport.scrollTop =
              panStart.current.top - (event.clientY - panStart.current.y);
          }}
          onPointerUp={() => {
            panStart.current = null;
          }}
          onPointerCancel={() => {
            panStart.current = null;
          }}
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
            className={tool === "pan" ? "pointer-events-none" : ""}
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
              eraserWidth={ERASER_WIDTH}
              onChange={(paths) => {
                pathsRef.current = paths;
                if (notifyOnNextChange.current) {
                  notifyOnNextChange.current = false;
                  notify();
                }
              }}
              onStroke={notify}
            />
          </div>
        </div>
      </div>
    );
  }
);

export default DrawingBoard;
