import { useRef, useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import confetti from 'canvas-confetti';
import {
  Pencil,
  Eraser,
  Undo2,
  Trash2,
  Save,
  X
} from 'lucide-react';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

export default function App() {

  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const handleExitClick = () => setShowExitPrompt(true);
  const confirmExit = () => {
    window.location.href = "https://filmishmish.substack.com/";
  };
  const cancelExit = () => setShowExitPrompt(false);

  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState('pencil');
  const [brushSize, setBrushSize] = useState(4);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [undoStack, setUndoStack] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctxRef.current = ctx;

    const checkScreenSize = () => {
      // First, check if it's actually a mobile device (not just small window)
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i.test(userAgent);
      
      // Also check for touch capability as additional mobile indicator
      const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      // Combine both checks - must be mobile device AND have touch
      const isActualMobile = isMobileDevice && hasTouchScreen;
      
      setIsMobile(isActualMobile);

      // If it's a real mobile device, block drawing
      if (isActualMobile) {
        setIsFullscreen(false);
        return;
      }

      // For desktop devices, check window size requirements
      const minWidth = 800;
      const minHeight = 600;
      setIsFullscreen(window.innerWidth >= minWidth && window.innerHeight >= minHeight);
    };

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      checkScreenSize();
    };

    // Small delay to ensure DOM is ready
    setTimeout(checkScreenSize, 100);
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('pointerup', () => setIsDrawing(false));
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointerup', () => setIsDrawing(false));
    };
  }, []);

  useEffect(() => {
    if (ctxRef.current) {
      ctxRef.current.globalCompositeOperation =
        tool === 'eraser' ? 'destination-out' : 'source-over';
      ctxRef.current.strokeStyle = tool === 'eraser' ? '#fff' : '#000';
      ctxRef.current.lineWidth = brushSize;
    }
  }, [tool, brushSize]);

  const saveState = () => {
  const canvas = canvasRef.current;
  const ctx = ctxRef.current;
  const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
  setUndoStack((prev) => [...prev, snapshot]);
};

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    ctxRef.current.clearRect(0, 0, canvas.width, canvas.height);
    setUndoStack([]);
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
        alert("Error saving metadata to Supabase.");
        return;
      }

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
        onPointerDown={(e) => {
          if (!isFullscreen) return; // Prevent drawing if not fullscreen
          saveState();
          const rect = canvasRef.current.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          ctxRef.current.beginPath();
          ctxRef.current.moveTo(x, y);
          setIsDrawing(true);
        }}
        onPointerUp={() => {
          ctxRef.current.closePath();
          setIsDrawing(false);
        }}
        onPointerMove={(e) => {
          if (!isDrawing || !isFullscreen) return; // Prevent drawing if not fullscreen
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

          {/* Brush Size */}
          <div className="w-16 flex justify-center items-center p-2 border-b border-black">
            <input
              type="range"
              min="1"
              max="20"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className="h-32 w-2 appearance-none bg-black rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-1 [&::-webkit-slider-thumb]:w-1 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full mt-[-2px]"
              style={{
                writingMode: 'bt-lr',
                WebkitAppearance: 'slider-vertical',
                accentColor: 'black'
              }}
            />
          </div>

          {/* Pencil */}
          <button
            className={`w-16 h-12 flex items-center justify-center border-b border-black ${tool === 'pencil' ? 'bg-black text-white' : ''}`}
            title="Pencil"
            onClick={() => setTool('pencil')}
          >
            <Pencil className="w-5 h-5" />
          </button>

          {/* Eraser */}
          <button
            className={`w-16 h-12 flex items-center justify-center border-b border-black ${tool === 'eraser' ? 'bg-black text-white' : ''}`}
            title="Eraser"
            onClick={() => setTool('eraser')}
          >
            <Eraser className="w-5 h-5" />
          </button>

          {/* Undo */}
          <button
  type="button"
  className="w-16 h-12 flex items-center justify-center border-b border-black bg-white text-black active:bg-black active:text-white transition-colors duration-150"
  title="Undo"
  onClick={() => {
    if (undoStack.length > 0) {
      const lastImage = undoStack[undoStack.length - 1];
      ctxRef.current.putImageData(lastImage, 0, 0);
      setUndoStack((prev) => prev.slice(0, -1));
    }
  }}
>
  <Undo2 className="w-5 h-5" />
</button>

          {/* Trash */}
          <button
  type="button"
  className="w-16 h-12 flex items-center justify-center border-b border-black bg-white text-black active:bg-black active:text-white transition-colors duration-150"
  title="Clear"
  onClick={clearCanvas}
>
  <Trash2 className="w-5 h-5" />
</button>

          {/* Save */}
          <button
  type="button"
  className="w-16 h-12 flex items-center justify-center border-b border-black bg-white text-black active:bg-black active:text-white transition-colors duration-150"
  title="Save"
  onClick={() => setShowModal(true)}
>
  <Save className="w-5 h-5" />
</button>

          {/* Exit */}
          <button
  type="button"
  className="w-16 h-12 flex items-center justify-center bg-white text-black active:bg-black active:text-white transition-colors duration-150"
  title="Exit"
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

      {!isFullscreen && (
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
                <h2 className="text-2xl font-bold mb-4">📏 Window Too Small</h2>
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