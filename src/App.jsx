import { useRef, useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
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

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

// Google Analytics tracking function
const trackEvent = (eventName, parameters = {}) => {
  if (typeof gtag !== 'undefined') {
    gtag('event', eventName, parameters);
    console.log('📊 GA Event:', eventName, parameters);
  } else {
    console.log('📊 GA not loaded, would track:', eventName, parameters);
  }
};

// Improved device detection function
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
  const [hasDrawingContent, setHasDrawingContent] = useState(false);
  const [savedDrawingData, setSavedDrawingData] = useState(null);
  const [showResizeMessage, setShowResizeMessage] = useState(false);
  const [sessionTracked, setSessionTracked] = useState(false);

  // Memoized handlers to avoid stale closures in keyboard shortcuts
  const handleToolChange = useCallback((newTool) => {
    trackEvent('tool_changed', {
      event_category: 'drawing_interaction',
      event_label: `tool_${newTool}`,
      previous_tool: tool
    });
    setTool(newTool);
  }, [tool]);

  const handleBrushSizeChange = useCallback((newSize) => {
    trackEvent('brush_size_changed', {
      event_category: 'drawing_interaction',
      event_label: `size_${newSize}`,
      brush_size: newSize
    });
    setBrushSize(newSize);
  }, []);

  const handleUndo = useCallback(() => {
    setUndoStack((prevUndo) => {
      if (prevUndo.length === 0) return prevUndo;
      
      trackEvent('undo_used', {
        event_category: 'drawing_interaction',
        event_label: 'canvas_undo',
        undo_stack_depth: prevUndo.length
      });
      
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
      
      trackEvent('redo_used', {
        event_category: 'drawing_interaction',
        event_label: 'canvas_redo',
        redo_stack_depth: prevRedo.length
      });
      
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
    trackEvent('canvas_cleared', {
      event_category: 'drawing_interaction',
      event_label: 'clear_all_drawing',
      had_content: hasDrawingContent
    });
    
    const canvas = canvasRef.current;
    ctxRef.current.clearRect(0, 0, canvas.width, canvas.height);
    setUndoStack([]);
    setRedoStack([]);
    setHasDrawingContent(false);
    setSavedDrawingData(null);
    setShowResizeMessage(false);
  }, [hasDrawingContent]);

  const handleSaveClick = useCallback(() => {
    trackEvent('save_button_clicked', {
      event_category: 'conversion',
      event_label: 'save_drawing_attempt',
      has_content: hasDrawingContent
    });
    setShowModal(true);
  }, [hasDrawingContent]);

  const handleExitClick = () => {
    trackEvent('exit_button_click', {
      event_category: 'navigation',
      event_label: 'drawing_app_exit_attempt'
    });
    setShowExitPrompt(true);
  };
  
  const confirmExit = () => {
    trackEvent('exit_confirmed', {
      event_category: 'navigation',
      event_label: 'drawing_app_exit_confirmed'
    });
    window.location.href = "https://filmishmish.substack.com/";
  };
  
  const cancelExit = () => {
    trackEvent('exit_cancelled', {
      event_category: 'navigation', 
      event_label: 'drawing_app_exit_cancelled'
    });
    setShowExitPrompt(false);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger shortcuts when typing in input fields
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      // Handle Escape for modals first
      if (e.key === 'Escape') {
        if (showModal) {
          setShowModal(false);
          return;
        }
        if (showExitPrompt) {
          setShowExitPrompt(false);
          return;
        }
      }
      
      // Don't trigger other shortcuts when modals are open
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

  useEffect(() => {
    if (!sessionTracked) {
      trackEvent('drawing_app_visit', {
        event_category: 'engagement',
        event_label: 'drawing_canvas_loaded',
        screen_width: window.innerWidth,
        screen_height: window.innerHeight,
        device_type: detectDeviceType() ? 'mobile' : 'desktop'
      });
      setSessionTracked(true);
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctxRef.current = ctx;

    const checkScreenSize = () => {
      const isActualMobile = detectDeviceType();
      setIsMobile(isActualMobile);

      if (isActualMobile) {
        setIsFullscreen(false);
        setShowResizeMessage(false);
        return;
      }

      const minWidth = 800;
      const minHeight = 600;
      const newIsFullscreen = window.innerWidth >= minWidth && window.innerHeight >= minHeight;
      
      if (hasDrawingContent) {
        if (isFullscreen && !newIsFullscreen) {
          saveDrawingForResize();
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
      const tempImageData = hasDrawingContent && ctxRef.current ? 
        ctxRef.current.getImageData(0, 0, canvas.width, canvas.height) : null;
      
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      if (tempImageData && hasDrawingContent) {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = tempImageData.width;
        tempCanvas.height = tempImageData.height;
        tempCtx.putImageData(tempImageData, 0, 0);
        
        ctxRef.current.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, 
                                  0, 0, canvas.width, canvas.height);
      }
      
      checkScreenSize();
    };

    setTimeout(checkScreenSize, 100);
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('pointerup', () => setIsDrawing(false));
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointerup', () => setIsDrawing(false));
    };
  }, [isFullscreen, hasDrawingContent, savedDrawingData, sessionTracked]);

  useEffect(() => {
    if (ctxRef.current) {
      ctxRef.current.globalCompositeOperation =
        tool === 'eraser' ? 'destination-out' : 'source-over';
      ctxRef.current.strokeStyle = tool === 'eraser' ? '#fff' : '#000';
      ctxRef.current.lineWidth = brushSize;
    }
  }, [tool, brushSize]);

  const saveDrawingForResize = () => {
    if (canvasRef.current && ctxRef.current) {
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setSavedDrawingData({
        imageData,
        width: canvas.width,
        height: canvas.height,
        undoStack: [...undoStack],
        redoStack: [...redoStack]
      });
    }
  };

  const restoreDrawingAfterResize = () => {
    if (canvasRef.current && ctxRef.current && savedDrawingData) {
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      tempCanvas.width = savedDrawingData.width;
      tempCanvas.height = savedDrawingData.height;
      
      tempCtx.putImageData(savedDrawingData.imageData, 0, 0);
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, 0, 0, canvas.width, canvas.height);
      
      setUndoStack(savedDrawingData.undoStack);
      setRedoStack(savedDrawingData.redoStack);
      setHasDrawingContent(true);
    }
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
    if (!isFullscreen) return;
    
    trackEvent('drawing_started', {
      event_category: 'drawing_interaction',
      event_label: `start_${tool}`,
      tool: tool,
      brush_size: brushSize
    });
    
    saveState();
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctxRef.current.beginPath();
    ctxRef.current.moveTo(x, y);
    setIsDrawing(true);
  };

  const handleSave = async () => {
    trackEvent('drawing_submission_started', {
      event_category: 'conversion',
      event_label: 'submission_process_start',
      name_provided: name.length > 0
    });
    
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
        trackEvent('drawing_submission_failed', {
          event_category: 'conversion',
          event_label: 'upload_error',
          error_message: error.message.substring(0, 50)
        });
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
        trackEvent('drawing_submission_failed', {
          event_category: 'conversion',
          event_label: 'database_error',
          error_message: insertError.message.substring(0, 50)
        });
        alert("Error saving metadata to Supabase.");
        return;
      }

      trackEvent('drawing_submission_success', {
        event_category: 'conversion',
        event_label: 'drawing_submitted_successfully',
        name_length: name.length,
        canvas_width: canvas.width,
        canvas_height: canvas.height
      });

      clearCanvas();
      setShowModal(false);
      confetti();
      window.location.href = '/thank-you';
    }, 'image/png');
  };

  return (
    <div className="w-screen h-screen bg-white relative touch-none">
      <canvas
        ref={canvasRef}
        onPointerDown={handleDrawingStart}
        onPointerUp={() => {
          ctxRef.current.closePath();
          setIsDrawing(false);
        }}
        onPointerMove={(e) => {
          if (!isDrawing || !isFullscreen) return;
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
        <div className="flex flex-col items-center border border-black rounded overflow-hidden">

          {/* Brush Size with Triangle Wedge */}
          <div className="w-16 h-20 flex justify-center items-center p-2 border-b border-black bg-white" title="Brush Size ( [ / ] )">
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

          {/* Pencil */}
          <button
            className={`w-16 h-12 flex items-center justify-center border-b border-black ${tool === 'pencil' ? 'bg-black text-white' : ''}`}
            title="Pencil (P)"
            onClick={() => handleToolChange('pencil')}
          >
            <Pencil className="w-5 h-5" />
          </button>

          {/* Eraser */}
          <button
            className={`w-16 h-12 flex items-center justify-center border-b border-black ${tool === 'eraser' ? 'bg-black text-white' : ''}`}
            title="Eraser (E)"
            onClick={() => handleToolChange('eraser')}
          >
            <Eraser className="w-5 h-5" />
          </button>

          {/* Undo */}
          <button
            type="button"
            className="w-16 h-12 flex items-center justify-center border-b border-black bg-white text-black active:bg-black active:text-white transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Undo (Ctrl+Z)"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
          >
            <Undo2 className="w-5 h-5" />
          </button>

          {/* Redo */}
          <button
            type="button"
            className="w-16 h-12 flex items-center justify-center border-b border-black bg-white text-black active:bg-black active:text-white transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Redo (Ctrl+Shift+Z)"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
          >
            <Redo2 className="w-5 h-5" />
          </button>

          {/* Trash */}
          <button
            type="button"
            className="w-16 h-12 flex items-center justify-center border-b border-black bg-white text-black active:bg-black active:text-white transition-colors duration-150"
            title="Clear (Delete)"
            onClick={clearCanvas}
          >
            <Trash2 className="w-5 h-5" />
          </button>

          {/* Save */}
          <button
            type="button"
            className="w-16 h-12 flex items-center justify-center border-b border-black bg-white text-black active:bg-black active:text-white transition-colors duration-150"
            title="Save (Ctrl+S)"
            onClick={handleSaveClick}
          >
            <Save className="w-5 h-5" />
          </button>

          {/* Exit */}
          <button
            type="button"
            className="w-16 h-12 flex items-center justify-center bg-white text-black active:bg-black active:text-white transition-colors duration-150"
            title="Exit (Esc to cancel)"
            onClick={handleExitClick}
          >
            <X className="w-5 h-5" />
          </button>
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

      {showResizeMessage && hasDrawingContent && (
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

      {!isFullscreen && !showResizeMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded shadow w-[90%] max-w-lg text-black text-center">
            {isMobile ? (
              <>
                <h2 className="text-2xl font-bold mb-4">📱 Mobile Device Detected</h2>
                <p className="text-lg mb-4">
                  The experience is far better on PC. I promise!
                </p>
                <p className="text-sm text-gray-600 mb-6">
                  Please visit this page on a desktop or laptop computer for the best drawing experience.
                </p>
                <button
                  onClick={confirmExit}
                  className="bg-black text-white px-6 py-3 rounded hover:bg-gray-800"
                >
                  Go Back
                </button>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}