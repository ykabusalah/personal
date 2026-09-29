import { useRef, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import confetti from 'canvas-confetti';
import {
  Pencil,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Save,
  X
} from 'lucide-react';
import {
  trackPageView,
  trackDrawingStart,
  trackToolChange,
  trackBrushSize,
  trackUndo,
  trackRedo,
  trackClear,
  trackSubmitStart,
  trackSubmitSuccess,
  trackSubmitError,
  trackExit,
  trackModalClose
} from '../lib/events';


// Phones and tablets. They draw with the screen turned sideways, so every drawing has the same
// wide shape as one made on a computer and fills the Home page the same way.
// A finger as the main pointer is what makes a phone or tablet; the name check backs it up in
// browsers that don't say. (Checking names alone got iPhones wrong: they call themselves
// "like Mac OS X", so they were treated as computers and told their window was too small.)
const detectDeviceType = () =>
  window.matchMedia('(pointer: coarse)').matches ||
  /Android|iPhone|iPod|iPad|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1 && !window.matchMedia('(pointer: fine)').matches);

// Computers need a window at least this big to draw in.
const MIN_WIDTH = 800;
const MIN_HEIGHT = 600;

// Screens shorter than this (phones on their side) get the two-column toolbar, which fits.
const COMPACT_HEIGHT = 520;

/** Redraw saved pixels on a canvas of a new size, scaled evenly from the top left so they never stretch. */
const drawScaled = (ctx, imageData) => {
  const copy = document.createElement('canvas');
  copy.width = imageData.width;
  copy.height = imageData.height;
  copy.getContext('2d').putImageData(imageData, 0, 0);
  const scale = Math.min(ctx.canvas.width / copy.width, ctx.canvas.height / copy.height);
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(copy, 0, 0, copy.width * scale, copy.height * scale);
  ctx.restore();
};

export default function App() {
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState('pencil');
  const [brushSize, setBrushSize] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [compact, setCompact] = useState(false);
  const [hasDrawingContent, setHasDrawingContent] = useState(false);
  const [savedDrawingData, setSavedDrawingData] = useState(null);
  const [showResizeMessage, setShowResizeMessage] = useState(false);
  // Resizing a canvas resets its pen settings, so this counts resizes to set them again.
  const [canvasVersion, setCanvasVersion] = useState(0);
  // Sending a drawing. The ref stops a second tap from slipping in before the screen updates.
  const sendingRef = useRef(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  const handleToolChange = useCallback((newTool) => {
    trackToolChange(newTool, tool);
    setTool(newTool);
  }, [tool]);

  const handleBrushSizeChange = useCallback((newSize) => {
    trackBrushSize(newSize);
    setBrushSize(newSize);
  }, []);

  const handleUndo = useCallback(() => {
    setUndoStack((prevUndo) => {
      if (prevUndo.length === 0) return prevUndo;

      trackUndo();

      const canvas = canvasRef.current;
      const ctx = ctxRef.current;

      const currentState = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setRedoStack((prev) => [...prev, currentState]);

      const lastState = prevUndo[prevUndo.length - 1];
      ctx.putImageData(lastState, 0, 0);

      return prevUndo.slice(0, -1);
    });
  }, []);

  const handleRedo = useCallback(() => {
    setRedoStack((prevRedo) => {
      if (prevRedo.length === 0) return prevRedo;

      trackRedo();

      const canvas = canvasRef.current;
      const ctx = ctxRef.current;

      const currentState = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setUndoStack((prev) => [...prev, currentState]);

      const redoState = prevRedo[prevRedo.length - 1];
      ctx.putImageData(redoState, 0, 0);

      return prevRedo.slice(0, -1);
    });
  }, []);

  const clearCanvas = useCallback(() => {
    trackClear();

    const canvas = canvasRef.current;
    ctxRef.current.clearRect(0, 0, canvas.width, canvas.height);
    setUndoStack([]);
    setRedoStack([]);
    setHasDrawingContent(false);
    setSavedDrawingData(null);
    setShowResizeMessage(false);
  }, []);

  const handleSaveClick = useCallback(() => {
    trackSubmitStart();
    setShowModal(true);
  }, []);

  // Back to drawing, unless the drawing is already on its way.
  const closeModal = useCallback(() => {
    if (sendingRef.current) return;
    trackModalClose();
    setShowModal(false);
    setSendError('');
  }, []);

  const handleExitClick = () => {
    setShowExitPrompt(true);
  };

  const confirmExit = () => {
    trackExit(true);
    window.location.href = "https://filmishmish.substack.com/";
  };

  const cancelExit = () => {
    trackExit(false);
    setShowExitPrompt(false);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'Escape') {
        if (showModal) {
          closeModal();
          return;
        }
        if (showExitPrompt) {
          setShowExitPrompt(false);
          return;
        }
      }

      if (showModal || showExitPrompt) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      switch (e.key.toLowerCase()) {
        case 'p':
          if (!modifier) {
            e.preventDefault();
            handleToolChange('pencil');
          }
          break;
        case 'e':
          if (!modifier) {
            e.preventDefault();
            handleToolChange('eraser');
          }
          break;
        case 'z':
          if (modifier && e.shiftKey) {
            e.preventDefault();
            handleRedo();
          } else if (modifier) {
            e.preventDefault();
            handleUndo();
          }
          break;
        case 'y':
          if (modifier) {
            e.preventDefault();
            handleRedo();
          }
          break;
        case '[':
          e.preventDefault();
          setBrushSize(prev => Math.max(1, prev - 1));
          break;
        case ']':
          e.preventDefault();
          setBrushSize(prev => Math.min(20, prev + 1));
          break;
        case 's':
          if (modifier) {
            e.preventDefault();
            handleSaveClick();
          }
          break;
        case 'delete':
        case 'backspace':
          if (!modifier && !e.shiftKey) {
            e.preventDefault();
            clearCanvas();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showModal, showExitPrompt, handleToolChange, handleUndo, handleRedo, handleSaveClick, clearCanvas, closeModal]);

  // Size the canvas once, when the page opens. Resizing a canvas wipes it, so after this it only
  // changes size when the window does (below), and the drawing is copied over when it does.
  useEffect(() => {
    trackPageView('draw');

    const canvas = canvasRef.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctxRef.current = canvas.getContext('2d');
    setCanvasVersion((v) => v + 1);

    const stopDrawing = () => setIsDrawing(false);
    window.addEventListener('pointerup', stopDrawing);
    return () => window.removeEventListener('pointerup', stopDrawing);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;

    // `before` is the drawing as it was before a resize, at its full size.
    const checkScreenSize = (before) => {
      const isActualMobile = detectDeviceType();
      setIsMobile(isActualMobile);
      setCompact(window.innerHeight < COMPACT_HEIGHT);

      // Phones and tablets draw sideways; computers need a big enough window.
      const newIsFullscreen = isActualMobile
        ? window.innerWidth > window.innerHeight
        : window.innerWidth >= MIN_WIDTH && window.innerHeight >= MIN_HEIGHT;

      if (hasDrawingContent) {
        if (isFullscreen && !newIsFullscreen) {
          saveDrawingForResize(before);
          setShowResizeMessage(true);
        } else if (!isFullscreen && newIsFullscreen && savedDrawingData) {
          setTimeout(() => {
            restoreDrawingAfterResize();
            setShowResizeMessage(false);
            setSavedDrawingData(null);
          }, 200);
        }
      }

      setIsFullscreen(newIsFullscreen);
    };

    const handleResize = () => {
      const before = hasDrawingContent && ctxRef.current
        ? ctxRef.current.getImageData(0, 0, canvas.width, canvas.height)
        : null;

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      if (before) drawScaled(ctxRef.current, before);
      setCanvasVersion((v) => v + 1);

      checkScreenSize(before);
    };

    const firstCheck = setTimeout(() => checkScreenSize(null), 100);
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(firstCheck);
      window.removeEventListener('resize', handleResize);
    };
  }, [isFullscreen, hasDrawingContent, savedDrawingData]);

  // The pen. Set again after every resize, since resizing the canvas resets it.
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = tool === 'eraser' ? '#fff' : '#000';
    ctx.lineWidth = brushSize;
  }, [tool, brushSize, canvasVersion]);

  const saveDrawingForResize = (imageData) => {
    const canvas = canvasRef.current;
    if (!canvas || !ctxRef.current) return;
    setSavedDrawingData({
      imageData: imageData ?? ctxRef.current.getImageData(0, 0, canvas.width, canvas.height),
      undoStack: [...undoStack],
      redoStack: [...redoStack]
    });
  };

  const restoreDrawingAfterResize = () => {
    const ctx = ctxRef.current;
    if (!ctx || !savedDrawingData) return;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    drawScaled(ctx, savedDrawingData.imageData);
    setUndoStack(savedDrawingData.undoStack);
    setRedoStack(savedDrawingData.redoStack);
    setHasDrawingContent(true);
  };

  const saveState = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setUndoStack((prev) => [...prev, snapshot]);
    setRedoStack([]);
    setHasDrawingContent(true);
  };

  const handleDrawingStart = (e) => {
    // One finger draws; a second one touching down doesn't start another line.
    if (!isFullscreen || !e.isPrimary) return;

    trackDrawingStart(tool, brushSize);

    saveState();
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctxRef.current.beginPath();
    ctxRef.current.moveTo(x, y);
    setIsDrawing(true);
  };

  // Sends the drawing once, however many times the button's tapped. On a slow phone connection a
  // second tap used to send it again, and that copy, cut off when the page moved on to the thank-you
  // page, popped up "Load failed".
  const handleSave = () => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setSendError('');

    const fail = (message) => {
      trackSubmitError(message);
      setSendError("That didn't go through. Check your connection and try again.");
      sendingRef.current = false;
      setSending(false);
    };

    canvasRef.current.toBlob(async (blob) => {
      try {
        const filename = `drawing-${Date.now()}.png`;
        const { error } = await supabase
          .storage
          .from('drawing-bucket')
          .upload(filename, blob, {
            contentType: 'image/png',
            cacheControl: '3600',
            upsert: false
          });
        if (error) return fail(error.message);

        const { data: urlData } = supabase
          .storage
          .from('drawing-bucket')
          .getPublicUrl(filename);

        const { error: insertError } = await supabase
          .from('drawings')
          .insert([{ name, image_url: urlData.publicUrl, status: 'pending' }]);
        if (insertError) return fail(insertError.message);
      } catch (err) {
        return fail(err.message);
      }

      trackSubmitSuccess(name.length > 0);
      confetti();
      window.location.href = '/thank-you';
    }, 'image/png');
  };

  // Popups look like the rest of the site: a white card with a thin border, a serif title, and the
  // accent color on the main button. max-h-full keeps a card scrollable on a phone on its side.
  const popup = 'fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-body text-ink';
  const card = 'bg-white rounded-xl border border-line shadow-xl w-full max-w-md max-h-full overflow-auto p-6';
  const title = 'font-display text-4xl leading-tight mb-2';
  const primaryButton = 'px-5 py-2.5 rounded-lg bg-accent text-on-accent font-medium hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-wait';
  const secondaryButton = 'px-4 py-2.5 rounded-lg border border-line bg-white hover:border-ink transition-colors disabled:opacity-60';

  // The toolbar: one column on computers, two on short screens like a phone on its side.
  const toolbarClass = compact
    ? 'grid grid-cols-2 gap-px bg-black border border-black rounded overflow-hidden'
    : 'flex flex-col items-center border border-black rounded overflow-hidden';
  const cell = compact ? 'w-12 h-11' : 'w-16 h-12 border-b border-black last:border-b-0';
  // Unavailable buttons fade their icon, not the whole button, so the lines between buttons stay solid.
  const pressable = 'bg-white text-black active:bg-black active:text-white transition-colors duration-150 disabled:text-black/40 disabled:active:bg-white disabled:cursor-not-allowed';
  const tools = [
    { name: 'pencil', title: 'Pencil (P)', Icon: Pencil },
    { name: 'eraser', title: 'Eraser (E)', Icon: Eraser },
  ];
  const actions = [
    { title: 'Undo (Ctrl+Z)', Icon: Undo2, onClick: handleUndo, disabled: undoStack.length === 0 },
    { title: 'Redo (Ctrl+Shift+Z)', Icon: Redo2, onClick: handleRedo, disabled: redoStack.length === 0 },
    { title: 'Clear (Delete)', Icon: Trash2, onClick: clearCanvas },
    { title: 'Save (Ctrl+S)', Icon: Save, onClick: handleSaveClick },
    { title: 'Exit (Esc to cancel)', Icon: X, onClick: handleExitClick, wide: true },
  ];

  return (
    // overflow-hidden: while a phone is upright, the still-wide canvas mustn't make the page zoom out.
    <div className="w-screen h-screen bg-white relative touch-none overflow-hidden">
      <canvas
        ref={canvasRef}
        onPointerDown={handleDrawingStart}
        onPointerUp={() => {
          ctxRef.current.closePath();
          setIsDrawing(false);
        }}
        onPointerMove={(e) => {
          if (!isDrawing || !isFullscreen || !e.isPrimary) return;
          const rect = canvasRef.current.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          ctxRef.current.lineTo(x, y);
          ctxRef.current.stroke();
        }}
        onPointerLeave={() => setIsDrawing(false)}
        className="absolute top-0 left-0 z-0 touch-none"
      />

      <div className="fixed top-1/2 right-4 -translate-y-1/2 transform z-40">
        <div className={toolbarClass}>

          <div
            className={compact ? 'row-span-2 w-12 flex justify-center items-center bg-white' : 'w-16 h-20 flex justify-center items-center p-2 border-b border-black bg-white'}
            title="Brush Size ( [ / ] )"
          >
            <div className="relative h-16 w-6 flex justify-center">
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'linear-gradient(to bottom, transparent 0%, transparent 5%, #e5e7eb 5%, #e5e7eb 95%, transparent 95%)',
                  clipPath: 'polygon(15% 5%, 85% 5%, 50% 95%)'
                }}
              />

              <input
                type="range"
                min="1"
                max="20"
                value={21 - brushSize}
                onChange={(e) => handleBrushSizeChange(21 - parseInt(e.target.value))}
                className="brush-slider-triangle"
                orient="vertical"
              />
            </div>
          </div>

          {tools.map(({ name: toolName, title, Icon }) => (
            <button
              key={toolName}
              className={`${cell} flex items-center justify-center ${tool === toolName ? 'bg-black text-white' : 'bg-white'}`}
              title={title}
              onClick={() => handleToolChange(toolName)}
            >
              <Icon className="w-5 h-5" />
            </button>
          ))}

          {actions.map(({ title, Icon, onClick, disabled, wide }) => (
            <button
              key={title}
              type="button"
              className={`${cell} ${compact && wide ? 'col-span-2 !w-auto' : ''} flex items-center justify-center ${pressable}`}
              title={title}
              onClick={onClick}
              disabled={disabled}
            >
              <Icon className="w-5 h-5" />
            </button>
          ))}
        </div>
      </div>

      {showModal && (
        <div className={popup} onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <form
            className={card}
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            <h2 className={title}>Submit your drawing</h2>
            <p className="text-sm text-muted mb-5">
              If it makes the cut, it shows up on the Home page with your name in the corner.
            </p>
            <label className="block text-sm text-muted mb-2" htmlFor="drawing-name">Your name (optional)</label>
            <input
              id="drawing-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              disabled={sending}
              className="w-full px-3.5 py-3 border border-line rounded-lg mb-5 focus:outline-none focus:border-ink"
            />
            {sendError && (
              <p className="border border-line border-l-4 border-l-accent rounded-lg px-4 py-3 text-sm mb-5" role="alert">
                {sendError}
              </p>
            )}
            <p className="text-xs text-muted mb-4">
              By submitting, you agree to the{' '}
              <a href="/terms.html" target="_blank" className="underline underline-offset-2">Terms & Conditions</a>.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeModal} disabled={sending} className={secondaryButton}>
                Keep drawing
              </button>
              <button type="submit" disabled={sending} className={primaryButton}>
                {sending ? 'Sending...' : 'I agree & submit'}
              </button>
            </div>
          </form>
        </div>
      )}

      {showExitPrompt && (
        <div className={popup} onClick={(e) => e.target === e.currentTarget && cancelExit()}>
          <div className={card}>
            <h2 className={title}>Leave the canvas?</h2>
            <p className="text-sm text-muted mb-6">Your drawing won't be saved.</p>
            <div className="flex justify-end gap-2">
              <button onClick={confirmExit} className={secondaryButton}>Leave</button>
              <button onClick={cancelExit} className={primaryButton}>Keep drawing</button>
            </div>
          </div>
        </div>
      )}

      {/* Phones held upright: turn sideways to draw. The phone in the picture turns to show how. */}
      {isMobile && !isFullscreen && (
        <div className="fixed inset-0 bg-white flex flex-col items-center justify-center gap-4 z-50 p-8 text-center font-body text-ink">
          <svg className="w-28 h-28" viewBox="0 0 64 64" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M46 5.8 A28 28 0 0 0 7.8 16" stroke="var(--accent)" strokeWidth="2.5" />
            <path d="M12.3 13.9 L7.8 16 L7.4 11" stroke="var(--accent)" strokeWidth="2.5" />
            <g className="turn-phone" stroke="currentColor" strokeWidth="2.5">
              <rect x="21" y="9" width="22" height="42" rx="4" fill="#fff" />
              <path d="M29 45.5h6" />
            </g>
          </svg>
          <h2 className="font-display text-4xl leading-tight">Turn your phone sideways</h2>
          <p className="text-muted max-w-xs">
            {hasDrawingContent
              ? "Your drawing's safe. Turn it back to keep going."
              : 'You get the whole screen to draw on, the same shape as the Home page.'}
          </p>
          <a href="/info" className="text-sm text-muted underline underline-offset-2">Go back</a>
        </div>
      )}

      {!isMobile && showResizeMessage && hasDrawingContent && (
        <div className={popup}>
          <div className={`${card} text-center`}>
            <h2 className={title}>🎨 Keep drawing!</h2>
            <p className="mb-2">Your masterpiece is safely preserved.</p>
            <p className="text-sm text-muted mb-4">Make the window full screen again to finish it.</p>
            <p className="text-xs text-muted">Minimum size: 800px wide × 600px tall</p>
          </div>
        </div>
      )}

      {!isMobile && !isFullscreen && !showResizeMessage && (
        <div className={popup}>
          <div className={`${card} text-center`}>
            <h2 className={title}>🔍 Window too small</h2>
            <p className="mb-2">Make your browser window full screen, or bigger, to draw.</p>
            <p className="text-sm text-muted mb-4">That way your drawing looks great when it's shown on the site.</p>
            <p className="text-xs text-muted">Minimum size: 800px wide × 600px tall</p>
          </div>
        </div>
      )}
    </div>
  );
}
