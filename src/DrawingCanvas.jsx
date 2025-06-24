import { useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import confetti from 'canvas-confetti';

const supabase = createClient(
  'https://gzdhidrwwwztbbyropqh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6ZGhpZHJ3d3d6dGJieXJvcHFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3MjEyOTYsImV4cCI6MjA2NjI5NzI5Nn0.ZRX0_tXgqho-0i_mXZ2g44MD3r_ZuuZvdHIM9jJg-uI'
);

export default function DrawingCanvas() {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState('pencil');
  const [brushSize, setBrushSize] = useState(4);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');

  const startDrawing = ({ nativeEvent }) => {
    const { offsetX, offsetY } = nativeEvent;
    ctxRef.current.beginPath();
    ctxRef.current.moveTo(offsetX, offsetY);
    setIsDrawing(true);
  };

  const finishDrawing = () => {
    ctxRef.current.closePath();
    setIsDrawing(false);
  };

  const draw = ({ nativeEvent }) => {
    if (!isDrawing) return;
    const { offsetX, offsetY } = nativeEvent;
    ctxRef.current.lineTo(offsetX, offsetY);
    ctxRef.current.stroke();
  };

  const initCanvas = (canvas) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.strokeStyle = tool === 'eraser' ? '#fff' : '#000';
    ctx.lineWidth = brushSize;
    ctxRef.current = ctx;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    ctxRef.current.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSave = async () => {
    const canvas = canvasRef.current;
    canvas.toBlob(async (blob) => {
      const filename = `drawing-${Date.now()}.png`;
      const { data, error } = await supabase.storage.from('drawings').upload(filename, blob);
      if (error) return alert('Upload error');
      const { data: urlData } = supabase.storage.from('drawings').getPublicUrl(filename);
      await supabase.from('drawings').insert([{ name, image_url: urlData.publicUrl, status: 'pending' }]);
      clearCanvas();
      setShowModal(false);
      confetti();
      alert('Drawing submitted!');
    });
  };

  return (
    <div className="w-screen h-screen bg-white relative">
      <canvas
        ref={(canvas) => {
          canvasRef.current = canvas;
          if (canvas) {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            initCanvas(canvas);
          }
        }}
        onMouseDown={startDrawing}
        onMouseUp={finishDrawing}
        onMouseMove={draw}
        className="absolute top-0 left-0 z-0"
      />

      {/* Toolbar */}
      <div className="fixed right-4 top-1/2 transform -translate-y-1/2 flex flex-col items-center gap-4 z-10">
        <input type="range" min="1" max="20" value={brushSize} onChange={e => setBrushSize(Number(e.target.value))} className="rotate-[-90deg] w-32" />
        <button onClick={() => setTool('pencil')}><img src="https://img.icons8.com/ios/50/000000/pencil-tip.png" alt="pencil" /></button>
        <button onClick={() => setTool('eraser')}><img src="https://img.icons8.com/ios/50/000000/eraser.png" alt="eraser" /></button>
        <button onClick={() => ctxRef.current.undo?.()}><img src="https://img.icons8.com/ios/50/000000/undo.png" alt="undo" /></button>
        <button onClick={() => ctxRef.current.redo?.()}><img src="https://img.icons8.com/ios/50/000000/redo.png" alt="redo" /></button>
        <button onClick={clearCanvas}><img src="https://img.icons8.com/ios/50/000000/delete.png" alt="clear" /></button>
        <button onClick={() => setShowModal(true)}><img src="https://img.icons8.com/ios/50/000000/save.png" alt="save" /></button>
        <button onClick={clearCanvas}><img src="https://img.icons8.com/ios/50/000000/cancel.png" alt="cancel" /></button>
        <button onClick={() => window.location.href = '/'}><img src="https://img.icons8.com/ios/50/000000/hand.png" alt="home" /></button>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20">
          <div className="bg-white p-6 rounded shadow w-[90%] max-w-md text-black">
            <h2 className="text-xl font-bold mb-4">Submit Your Drawing</h2>
            <p className="mb-2">By submitting, you agree to the <a href="/terms.html" target="_blank" className="underline">Terms & Conditions</a>.</p>
            <input
              type="text"
              placeholder="Your Name"
              className="w-full p-2 border mb-4"
              value={name}
              onChange={e => setName(e.target.value)}
            />
            <button onClick={handleSave} className="bg-black text-white px-4 py-2 rounded mr-2">I agree & submit</button>
            <button onClick={() => setShowModal(false)} className="ml-2 underline">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
