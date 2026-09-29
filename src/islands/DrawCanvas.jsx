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
const detectDeviceType = () => {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;

  const isDesktopOS = /Windows NT|Macintosh|Mac OS X|Linux x86_64|Linux i686|CrOS/i.test(userAgent)
                      && !/Android/i.test(userAgent);

  const isMobilePhone = /Android.*Mobile|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

  const isIPad = /iPad/i.test(userAgent) ||
               (navigator.platform === 'MacIntel' &&
                navigator.maxTouchPoints > 1 &&
                !window.matchMedia('(pointer: fine)').matches);

  const isAndroidTablet = /Android/i.test(userAgent) && !/Mobile/i.test(userAgent);

  const isMobile = !isDesktopOS && (isMobilePhone || isIPad || isAndroidTablet);
  const isMobileOrTablet = isMobile || isIPad;

  return isMobileOrTablet;
};

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
          trackModalClose();
          setShowModal(false);
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
  }, [showModal, showExitPrompt, handleToolChange, handleUndo, handleRedo, handleSaveClick, clearCanvas]);

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

  const handleSave = async () => {
    const canvas = canvasRef.current;
    canvas.toBlob(async (blob) => {
      const filename = `drawing-${Date.now()}.png`;
      const { data, error } = await supabase
        .storage
        .from('drawing-bucket')
        .upload(filename, blob, {
          contentType: 'image/png',
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        trackSubmitError(error.message);
        alert('Upload error: ' + error.message);
        return;
      }

      const { data: urlData } = supabase
        .storage
        .from('drawing-bucket')
        .getPublicUrl(filename);

      const { error: insertError } = await supabase
        .from('drawings')
        .insert([{ name, image_url: urlData.publicUrl, status: 'pending' }]);

      if (insertError) {
        trackSubmitError(insertError.message);
        alert("Error saving metadata to Supabase.");
        return;
      }

      trackSubmitSuccess(name.length > 0);

      clearCanvas();
      setShowModal(false);
      confetti();
      window.location.href = '/thank-you';
    }, 'image/png');
  };

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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow w-[90%] max-w-md text-black">
            <h2 className="text-xl font-bold mb-4">Submit Your Drawing</h2>
            <input
              type="text"
              placeholder="Your Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded mb-4"
            />
            <div className="flex justify-between items-center">
              <a href="/terms.html" target="_blank" className="text-sm underline">
                Terms & Conditions
              </a>
              <button
                onClick={handleSave}
                className="bg-black text-white px-4 py-2 rounded"
              >
                I agree & Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {showExitPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow w-[90%] max-w-md text-black">
            <h2 className="text-xl font-bold mb-4">Are you sure you'd like to leave?</h2>
            <div className="flex justify-end space-x-4">
              <button onClick={confirmExit} className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800">Yes</button>
              <button onClick={cancelExit} className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">No</button>
            </div>
          </div>
        </div>
      )}

      {/* Phones held upright: turn sideways to draw. The phone in the picture turns to show how. */}
      {isMobile && !isFullscreen && (
        <div className="fixed inset-0 bg-white flex flex-col items-center justify-center gap-4 z-50 p-8 text-center">
          <svg className="w-28 h-28" viewBox="0 0 64 64" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M46 5.8 A28 28 0 0 0 7.8 16" stroke="var(--accent)" strokeWidth="2.5" />
            <path d="M12.3 13.9 L7.8 16 L7.4 11" stroke="var(--accent)" strokeWidth="2.5" />
            <g className="turn-phone" stroke="currentColor" strokeWidth="2.5">
              <rect x="21" y="9" width="22" height="42" rx="4" fill="#fff" />
              <path d="M29 45.5h6" />
            </g>
          </svg>
          <h2 className="font-display text-4xl leading-tight">Turn your phone sideways</h2>
          <p className="text-gray-600 max-w-xs">
            {hasDrawingContent
              ? "Your drawing's safe. Turn it back to keep going."
              : 'You get the whole screen to draw on, the same shape as the Home page.'}
          </p>
          <a href="/info" className="text-sm text-gray-600 underline">Go back</a>
        </div>
      )}

      {!isMobile && showResizeMessage && hasDrawingContent && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded shadow w-[90%] max-w-lg text-black text-center">
            <h2 className="text-2xl font-bold mb-4">🎨 Keep Drawing!</h2>
            <p className="text-lg mb-4">
              Your masterpiece is safely preserved!
            </p>
            <p className="text-sm text-gray-600 mb-6">
              Go back to full-screen to finish your drawing.
            </p>
            <p className="text-xs text-gray-500">
              Minimum size: 800px wide × 600px tall
            </p>
          </div>
        </div>
      )}

      {!isMobile && !isFullscreen && !showResizeMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded shadow w-[90%] max-w-lg text-black text-center">
            <h2 className="text-2xl font-bold mb-4">🔍 Window Too Small</h2>
            <p className="text-lg mb-4">
              Please make your browser window fullscreen or larger to draw properly.
            </p>
            <p className="text-sm text-gray-600 mb-6">
              This ensures your drawing looks great when displayed on the website!
            </p>
            <p className="text-xs text-gray-500">
              Minimum size: 800px wide × 600px tall
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
