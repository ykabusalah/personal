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
  const [loading, setLoading] = useState(false);
  const [processingIds, setProcessingIds] = useState(new Set());
  const [debugInfo, setDebugInfo] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get('key');
    if (key === SECRET_KEY) {
      setAuthorized(true);
      fetchDrawings();
    }
  }, []);

  const addDebugInfo = (info) => {
    setDebugInfo(prev => prev + '\n' + new Date().toLocaleTimeString() + ': ' + info);
    console.log('🐛 DEBUG:', info);
  };

  const fetchDrawings = async () => {
    setLoading(true);
    addDebugInfo('Starting to fetch drawings...');
    
    try {
      const { data, error, count } = await supabase
        .from('drawings')
        .select('*', { count: 'exact' })
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      addDebugInfo(`Fetch result - Error: ${error ? error.message : 'none'}, Count: ${count}, Data length: ${data ? data.length : 0}`);
      
      if (error) {
        console.error('❌ Fetch error:', error);
        alert('Error fetching drawings: ' + error.message);
        addDebugInfo(`Fetch error details: ${JSON.stringify(error)}`);
      } else {
        setDrawings(data || []);
        addDebugInfo(`Successfully loaded ${data?.length || 0} drawings`);
        
        // Log the structure of the first drawing for debugging
        if (data && data.length > 0) {
          addDebugInfo(`First drawing structure: ${JSON.stringify(data[0])}`);
        }
      }
    } catch (err) {
      console.error('❌ Unexpected error:', err);
      alert('Unexpected error occurred while fetching drawings');
      addDebugInfo(`Unexpected fetch error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const checkDrawingExists = async (id) => {
    try {
      const { data, error } = await supabase
        .from('drawings')
        .select('*')
        .eq('id', id)
        .single();
      
      addDebugInfo(`Drawing ${id} check - exists: ${!!data}, status: ${data?.status}, error: ${error?.message || 'none'}`);
      return { data, error };
    } catch (err) {
      addDebugInfo(`Error checking drawing ${id}: ${err.message}`);
      return { data: null, error: err };
    }
  };

  const updateStatus = async (id, status) => {
    if (processingIds.has(id)) return;
    
    setProcessingIds(prev => new Set([...prev, id]));
    addDebugInfo(`Starting update for drawing ${id} to status: ${status}`);
    
    try {
      // First, check if the drawing still exists and get its current status
      const existsCheck = await checkDrawingExists(id);
      
      if (existsCheck.error) {
        alert(`Error checking drawing existence: ${existsCheck.error.message}`);
        return;
      }
      
      if (!existsCheck.data) {
        alert('Drawing not found. It may have been deleted.');
        addDebugInfo(`Drawing ${id} not found in database`);
        // Remove from local state since it doesn't exist
        setDrawings(prev => prev.filter(d => d.id !== id));
        return;
      }
      
      addDebugInfo(`Current drawing status: ${existsCheck.data.status}`);
      
      // Proceed with the update
      const { data, error } = await supabase
        .from('drawings')
        .update({ status })
        .eq('id', id)
        .select();

      addDebugInfo(`Update result - Error: ${error ? error.message : 'none'}, Updated rows: ${data ? data.length : 0}`);

      if (error) {
        console.error('❌ Update error:', error);
        alert(`Error updating status: ${error.message}`);
        addDebugInfo(`Update error details: ${JSON.stringify(error)}`);
        return;
      }

      if (!data || data.length === 0) {
        console.error('❌ No rows updated');
        alert('No drawing was updated. It may have been modified by another user.');
        addDebugInfo(`No rows updated for ID ${id}`);
        
        // Check if drawing still exists with different status
        const recheckResult = await checkDrawingExists(id);
        if (recheckResult.data) {
          addDebugInfo(`Drawing still exists with status: ${recheckResult.data.status}`);
        }
        return;
      }

      console.log('✅ Successfully updated:', data);
      addDebugInfo(`Successfully updated drawing ${id} to ${status}`);
      
      // Only remove from local state if the update was successful
      setDrawings(prev => prev.filter(d => d.id !== id));
      
    } catch (err) {
      console.error('❌ Unexpected error during update:', err);
      alert('Unexpected error occurred while updating status');
      addDebugInfo(`Unexpected update error: ${err.message}`);
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const clearDebugInfo = () => setDebugInfo('');

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
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Moderation Panel</h1>
          <div className="flex gap-2">
            <button
              onClick={fetchDrawings}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
            <button
              onClick={clearDebugInfo}
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
            >
              Clear Debug
            </button>
          </div>
        </div>

        {/* Debug Info Panel */}
        {debugInfo && (
          <div className="mb-6 p-4 bg-gray-100 rounded">
            <h3 className="font-bold mb-2">Debug Information:</h3>
            <pre className="text-xs whitespace-pre-wrap max-h-40 overflow-y-auto bg-white p-2 rounded border">
              {debugInfo}
            </pre>
          </div>
        )}
        
        {loading ? (
          <p>Loading drawings...</p>
        ) : drawings.length === 0 ? (
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
                    <p className="text-xs text-gray-500">ID: {drawing.id}</p>
                    <p className="text-xs text-gray-400">Type: {typeof drawing.id}</p>
                  </div>
                </div>
                <div className="mt-4 md:mt-0 flex gap-2">
                  <button
                    onClick={() => updateStatus(drawing.id, 'approved')}
                    disabled={processingIds.has(drawing.id)}
                    className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processingIds.has(drawing.id) ? 'Processing...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => updateStatus(drawing.id, 'rejected')}
                    disabled={processingIds.has(drawing.id)}
                    className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processingIds.has(drawing.id) ? 'Processing...' : 'Reject'}
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