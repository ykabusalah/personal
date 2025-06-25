
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://YOUR_SUPABASE_URL.supabase.co',
  'YOUR_SUPABASE_ANON_KEY'
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
      .order('created_at', { ascending: false });

    if (!error) setDrawings(data);
    else console.error('Fetch error:', error);
  };

  const updateStatus = async (id, status) => {
    const { error } = await supabase
      .from('drawings')
      .update({ status })
      .eq('id', id);

    if (!error) {
      setDrawings((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status } : d))
      );
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
    <div className="max-w-4xl mx-auto py-12 px-6 text-black">
      <h1 className="text-2xl font-bold mb-6">Moderation Panel</h1>
      <div className="space-y-6">
        {drawings.map((drawing) => (
          <div
            key={drawing.id}
            className="border p-4 rounded shadow flex flex-col md:flex-row items-start md:items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <img
                src={drawing.image_url}
                alt="drawing"
                className="w-24 h-24 object-contain border"
              />
              <div>
                <p className="font-semibold">{drawing.name || 'No Name'}</p>
                <p className="text-sm text-gray-600">
                  Status:{' '}
                  <span
                    className={`font-bold ${
                      drawing.status === 'approved'
                        ? 'text-green-600'
                        : drawing.status === 'rejected'
                        ? 'text-red-600'
                        : 'text-yellow-600'
                    }`}
                  >
                    {drawing.status}
                  </span>
                </p>
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
    </div>
  );
}
