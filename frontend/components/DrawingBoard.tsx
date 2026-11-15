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
  // a JPEG data URL of the drawing, cropped to what was drawn
  exportImage: () => Promise<string>;
}

interface DrawingBoardProps {
  // called with the paths as JSON ("" when the board is empty) after each change
  onChange: (paths: string) => void;
  // shown above the board while it is full screen, e.g. the question
  fullscreenHeader?: ReactNode;
}

// The region that was drawn on, so the exported image isn't mostly empty board.
function drawnRegion(paths: CanvasPath[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const path of paths) {
    if (!path.drawMode) continue;
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

// A stylus asking to erase: its eraser end / eraser button (button 5), or its
// side (barrel) button, which is how some pens report theirs.
function isPenEraser(event: PointerEvent) {
  return (
    event.pointerType === "pen" &&
    (event.button === 5 ||
      event.button === 2 ||
      (event.buttons & 32) !== 0 ||
      (event.buttons & 2) !== 0)
  );
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
    const erasing = tool === "eraser" || penErasing;

    const notify = () => {
      const paths = pathsRef.current;
      onChange(paths.length > 0 ? JSON.stringify(paths) : "");
    };

    useImperativeHandle(ref, () => ({
      load: (paths) => {
        canvasRef.current?.resetCanvas();
        canvasRef.current?.loadPaths(paths);
        viewportRef.current?.scrollTo({ left: 0, top: 0 });
      },
      exportImage: async () => {
        const svg = await canvasRef.current?.exportSvg();
        if (!svg) throw new Error("Drawing board is not ready");

        const image = new window.Image();
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error("Could not render drawing"));
          image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
            svg
          )}`;
        });

        const region = drawnRegion(pathsRef.current);
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
    }));

    useEffect(() => {
      canvasRef.current?.eraseMode(erasing);
    }, [erasing]);

    // the stylus eraser only lasts until the pen is lifted
    useEffect(() => {
      if (!penErasing) return;
      const stop = () => setPenErasing(false);
      document.addEventListener("pointerup", stop);
      document.addEventListener("pointercancel", stop);
      return () => {
        document.removeEventListener("pointerup", stop);
        document.removeEventListener("pointercancel", stop);
      };
    }, [penErasing]);

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
            ? "fixed inset-0 z-50 bg-white p-4 flex flex-col gap-3"
            : "flex flex-col gap-3"
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
            // The canvas decides pen vs eraser when the stroke starts, so
            // switch to the eraser first and then hand it the event again.
            event.stopPropagation();
            flushSync(() => {
              setPenErasing(true);
              canvasRef.current?.eraseMode(true);
            });
            redispatching.current = true;
            try {
              native.target?.dispatchEvent(
                new PointerEvent("pointerdown", {
                  bubbles: true,
                  cancelable: true,
                  composed: true,
                  view: window,
                  pointerId: native.pointerId,
                  pointerType: native.pointerType,
                  isPrimary: native.isPrimary,
                  button: native.button,
                  buttons: native.buttons,
                  clientX: native.clientX,
                  clientY: native.clientY,
                  screenX: native.screenX,
                  screenY: native.screenY,
                  pressure: native.pressure,
                })
              );
            } finally {
              redispatching.current = false;
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
