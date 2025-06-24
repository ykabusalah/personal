
// [Identical content to previously provided App.jsx]
// Only difference is in handleSave — final line is now:
// window.location.href = '/thank-you';

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

  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas && ctxRef.current) {
      const imageData = ctxRef.current.getImageData(0, 0, canvas.width, canvas.height);
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      ctxRef.current.putImageData(imageData, 0, 0);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.lineCap = 'round';
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      ctxRef.current = ctx;
    }

    window.addEventListener('resize', resizeCanvas);
    const handlePointerUp = () => setIsDrawing(false);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('pointerup', handlePointerUp);
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

  const restoreState = (imgData) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    const img = new Image();
    img.src = imgData;
    img.onload = () => ctx.drawImage(img, 0, 0);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    const newUndo = [...undoStack];
    const lastState = newUndo.pop();
    setUndoStack(newUndo);
    setRedoStack((prev) => [...prev, canvas.toDataURL()]);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    restoreState(lastState);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    const newRedo = [...redoStack];
    const nextState = newRedo.pop();
    setRedoStack(newRedo);
    setUndoStack((prev) => [...prev, canvas.toDataURL()]);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    restoreState(nextState);
  };

  const startDrawing = (e) => {
    e.preventDefault();
    saveState();
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    ctxRef.current.beginPath();
    ctxRef.current.moveTo(x, y);
    setIsDrawing(true);
  };

  const finishDrawing = () => {
    ctxRef.current.closePath();
    setIsDrawing(false);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    ctxRef.current.lineTo(x, y);
    ctxRef.current.stroke();
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
      const { error } = await supabase.storage.from('drawings-bucket').upload(filename, blob);
      if (error) return alert('Upload error');
      const { data: urlData } = supabase.storage.from('drawings-bucket').getPublicUrl(filename);
      await supabase.from('drawings-bucket').insert([{ name, image_url: urlData.publicUrl, status: 'pending' }]);
      clearCanvas();
      setShowModal(false);
      confetti();
      window.location.href = '/thank-you';
    });
  };

  return (
    <div className="w-screen h-screen bg-white relative touch-none">
      <canvas
        ref={canvasRef}
        onPointerDown={startDrawing}
        onPointerUp={finishDrawing}
        onPointerMove={draw}
        onPointerLeave={finishDrawing}
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
            className="rotate-[-90deg] w-20 h-1 appearance-none bg-gray-300 rounded-full
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
              [&::-webkit-slider-thumb]:bg-black
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:cursor-pointer"
          />
        </div>
        <button onClick={() => setTool('pencil')}><Pencil size={20} className="text-black" /></button>
        <button onClick={() => setTool('eraser')}><Eraser size={20} className="text-black" /></button>
        <button onClick={handleUndo}><Undo2 size={20} className="text-black" /></button>
        <button onClick={handleRedo}><Redo2 size={20} className="text-black" /></button>
        <button onClick={clearCanvas}><Trash2 size={20} className="text-black" /></button>
        <button onClick={() => setShowModal(true)}><Save size={20} className="text-black" /></button>
        <button onClick={() => (window.location.href = '/')}><X size={20} className="text-black" /></button>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow w-[90%] max-w-md text-black">
            <h2 className="text-xl font-bold mb-4">Submit Your Drawing</h2>
            <p className="mb-2">
              By submitting, you agree to the{' '}
              <a href="/terms.html" target="_blank" className="underline">
                Terms & Conditions
              </a>, which includes your consent to allow your drawing to be used publicly on the website, possibly as part of its background or design. You also confirm that you are the original creator of the drawing and that it does not contain offensive or copyrighted material.
            </p>
            <input
              type="text"
              placeholder="Your Name"
              className="w-full p-2 border mb-4 text-black"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button onClick={handleSave} className="bg-black text-white px-4 py-2 rounded mr-2">
              I agree & submit
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
