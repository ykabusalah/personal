import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// Use service role key for moderation (bypasses RLS entirely)
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_SERVICE_KEY
);

// These credentials are stored in environment variables, not in code
const SECRET_KEY = process.env.REACT_APP_SECRET_KEY;
const MODERATOR_EMAIL = process.env.REACT_APP_MODERATOR_EMAIL;
const MODERATOR_PASSWORD = process.env.REACT_APP_MODERATOR_PASSWORD;

export default function ModerationPanel() {
  const [drawings, setDrawings] = useState([]);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [processingIds, setProcessingIds] = useState(new Set());
  const [loggedIn, setLoggedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get('key');
    if (key === SECRET_KEY) {
      setAuthorized(true);
    }
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    setLoginError('');
    
    if (email === MODERATOR_EMAIL && password === MODERATOR_PASSWORD) {
      setLoggedIn(true);
      fetchDrawings();
    } else {
      setLoginError('Invalid credentials');
    }
  };

  const handleLogout = () => {
    setLoggedIn(false);
    setEmail('');
    setPassword('');
    setDrawings([]);
  };

  const fetchDrawings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('drawings')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Fetch error:', error);
        alert('Error fetching drawings: ' + error.message);
      } else {
        setDrawings(data || []);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      alert('Unexpected error occurred while fetching drawings');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, status) => {
    if (processingIds.has(id)) return;
    
    setProcessingIds(prev => new Set([...prev, id]));
    
    try {
      const { data, error } = await supabase
        .from('drawings')
        .update({ status })
        .eq('id', id)
        .select();

      if (error) {
        console.error('Update error:', error);
        alert(`Error updating status: ${error.message}`);
        return;
      }

      if (!data || data.length === 0) {
        alert('No drawing was updated. It may have been modified by another user.');
        return;
      }

      setDrawings(prev => prev.filter(d => d.id !== id));
      
    } catch (err) {
      console.error('Unexpected error during update:', err);
      alert('Unexpected error occurred while updating status');
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  if (!authorized) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-white text-black">
        <div className="text-center">
          <p className="text-lg mb-2">Not authorized to view this page.</p>
          <p className="text-sm text-gray-600">Please use the correct URL with access key.</p>
        </div>
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-white text-black">
        <div className="bg-white p-8 rounded shadow-lg border max-w-md w-full">
          <h1 className="text-2xl font-bold mb-6 text-center">Moderator Login</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                {loginError}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-black text-white py-2 rounded hover:bg-gray-800 transition-colors"
            >
              Sign In
            </button>
          </form>
          <p className="text-xs text-gray-500 mt-4 text-center">
            Secure moderator access only
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-white text-black px-6 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Moderation Panel</h1>
          <div className="flex gap-2 items-center">
            <span className="text-sm text-gray-600">Logged in as moderator</span>
            <button
              onClick={fetchDrawings}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
            <button
              onClick={handleLogout}
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
            >
              Sign Out
            </button>
          </div>
        </div>
        
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