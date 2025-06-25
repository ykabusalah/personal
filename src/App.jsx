
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
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6ZGhpZHJ3d3d6dGJieXJvcHFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3MjEyOTYsImV4cCI6MjA2NjI5NzI5Nn0.ZRX0_tXgqho-0i_mXZ2g44MD3r_ZuuZvdHIM9jJg-uI'
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
      ctxRef.current.strokeStyle = tool === 'eraser' ? 'rgba(0,0,0,1)' : '#000';
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
      console.log("Uploading to Supabase:", filename);

      const { data, error } = await supabase
        .storage
        .from('drawing-bucket')
        .upload(filename, blob, {
          contentType: 'image/png',
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('❌ Upload error:', error.message, error);
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
        console.error("❌ Insert to drawings table failed:", insertError);
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

      <div className="fixed top-1/2 right-4 -translate-y-1/2 transform flex flex-col items-center gap-4 z-40">
        <div className="flex items-center justify-center h-12 mb-4">
          <input
            type="range"
            min="1"
            max="20"
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="rotate-[-90deg] w-20 h-1 bg-gray-300"
          />
        </div>
        <button onClick={() => setTool('pencil')}><Pencil /></button>
        <button onClick={() => setTool('eraser')}><Eraser /></button>
        <button onClick={() => {
          if (undoStack.length > 0) {
            const prev = undoStack.pop();
            const img = new Image();
            img.src = prev;
            img.onload = () => ctxRef.current.drawImage(img, 0, 0);
            setUndoStack([...undoStack]);
            setRedoStack((prev) => [...prev, canvasRef.current.toDataURL()]);
          }
        }}><Undo2 /></button>
        <button onClick={() => {
          if (redoStack.length > 0) {
            const next = redoStack.pop();
            const img = new Image();
            img.src = next;
            img.onload = () => ctxRef.current.drawImage(img, 0, 0);
            setRedoStack([...redoStack]);
            setUndoStack((prev) => [...prev, canvasRef.current.toDataURL()]);
          }
        }}><Redo2 /></button>
        <button onClick={clearCanvas}><Trash2 /></button>
        <button onClick={() => setShowModal(true)}><Save /></button>
        <button onClick={() => (window.location.href = '/')}><X /></button>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow w-[90%] max-w-md text-black">
            <h2 className="text-xl font-bold mb-4">Submit Your Drawing</h2>
            <p className="mb-2">
              By submitting, you agree to the{' '}
              <a href="/terms.html" target="_blank" className="underline">
                Terms & Conditions
              </a>.
            </p>
            <input
              type="text"
              placeholder="Your Name"
              className="w-full p-2 border mb-4 text-black"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button onClick={handleSave} className="bg-black text-white px-4 py-2 rounded mr-2">
              Let's Draw!
            </button>
            <button onClick={() => setShowModal(false)} className="ml-2 underline">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
