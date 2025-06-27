import { useRef, useState, useEffect } from 'react';
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
  'https://gzdhidrwwwztbbyropqh.supabase.co',
  'YOUR_SUPABASE_ANON_KEY'
);

export default function App() {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState('pencil');
  const [brushSize, setBrushSize] = useState(4);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctxRef.current = ctx;

    window.addEventListener('pointerup', () => setIsDrawing(false));
    return () => {
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
    setUndoStack((prev) => [...prev, canvas.toDataURL()]);
    setRedoStack([]);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    ctxRef.current.clearRect(0, 0, canvas.width, canvas.height);
    setUndoStack([]);
    setRedoStack([]);
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
          if (!isDrawing) return;
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
            <Pencil />
          </button>

          {/* Eraser */}
          <button
            className={`w-16 h-12 flex items-center justify-center border-b border-black ${tool === 'eraser' ? 'bg-black text-white' : ''}`}
            title="Eraser"
            onClick={() => setTool('eraser')}
          >
            <Eraser />
          </button>

          {/* Undo */}
          <button
            className="w-16 h-12 flex items-center justify-center border-b border-black"
            title="Undo"
            onClick={() => {
              if (undoStack.length > 0) {
                const img = new Image();
                const last = undoStack[undoStack.length - 1];
                img.onload = () => {
                  clearCanvas();
                  ctxRef.current.drawImage(img, 0, 0);
                };
                img.src = last;
                setRedoStack((r) => [...r, canvasRef.current.toDataURL()]);
                setUndoStack((prev) => prev.slice(0, -1));
              }
            }}
          >
            <Undo2 />
          </button>

          {/* Redo */}
          <button
            className="w-16 h-12 flex items-center justify-center border-b border-black"
            title="Redo"
            onClick={() => {
              if (redoStack.length > 0) {
                const img = new Image();
                const next = redoStack[redoStack.length - 1];
                img.onload = () => {
                  clearCanvas();
                  ctxRef.current.drawImage(img, 0, 0);
                };
                img.src = next;
                setUndoStack((u) => [...u, canvasRef.current.toDataURL()]);
                setRedoStack((r) => r.slice(0, -1));
              }
            }}
          >
            <Redo2 />
          </button>

          {/* Trash */}
          <button
            className="w-16 h-12 flex items-center justify-center border-b border-black"
            title="Clear"
            onClick={clearCanvas}
          >
            <Trash2 />
          </button>

          {/* Save */}
          <button
            className="w-16 h-12 flex items-center justify-center border-b border-black"
            title="Save"
            onClick={() => setShowModal(true)}
          >
            <Save />
          </button>

          {/* Exit */}
          <button
            className="w-16 h-12 flex items-center justify-center"
            title="Exit"
            onClick={clearCanvas}
          >
            <X />
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
    </div>
  );
}
