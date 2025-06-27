
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gzdhidrwwwztbbyropqh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6ZGhpZHJ3d3d6dGJieXJvcHFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3MjEyOTYsImV4cCI6MjA2NjI5NzI5Nn0.ZRX0_tXgqho-0i_mXZ2g44MD3r_ZuuZvdHIM9jJg-uI'
);


const SECRET_KEY = 'knafehbloop421';

export default function ModerationPanel() {
  const [drawings, setDrawings] = useState([]);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get('key');
    if (key === SECRET_KEY) {
      setAuthorized(true);
      fetchDrawings();
    }
  }, []);

  const fetchDrawings = async () => {
    const { data, error } = await supabase
      .from('drawings')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    console.log('🎯 Moderation fetched:', data);
    if (!error) setDrawings(data);
    else console.error('❌ Fetch error:', error);
  };

  const updateStatus = async (id, status) => {
    const { error } = await supabase
      .from('drawings')
      .update({ status })
      .eq('id', id);

    if (!error) {
      setDrawings((prev) => prev.filter((d) => d.id !== id));
    }
  };

  if (!authorized) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-white text-black">
        <p className="text-lg">Not authorized to view this page.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-white text-black px-6 py-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Moderation Panel</h1>
        {drawings.length === 0 ? (
          <p>No drawings to review.</p>
        ) : (
          <div className="space-y-6">
            {drawings.map((drawing) => (
              <div
                key={drawing.id}
                className="border p-4 rounded shadow flex flex-col md:flex-row items-start md:items-center justify-between bg-white"
              >
                <div className="flex items-center gap-4">
                  <a href={drawing.image_url} target="_blank" rel="noreferrer">
                    <img
                      src={drawing.image_url}
                      alt="drawing"
                      className="w-24 h-24 object-contain border hover:scale-105 transition-transform"
                    />
                  </a>
                  <div>
                    <p className="font-semibold">{drawing.name || 'No Name'}</p>
                    <p className="text-sm text-gray-600">Status: {drawing.status}</p>
                  </div>
                </div>
                <div className="mt-4 md:mt-0 flex gap-2">
                  <button
                    onClick={() => updateStatus(drawing.id, 'approved')}
                    className="bg-green-600 text-white px-3 py-1 rounded"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => updateStatus(drawing.id, 'rejected')}
                    className="bg-red-600 text-white px-3 py-1 rounded"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
