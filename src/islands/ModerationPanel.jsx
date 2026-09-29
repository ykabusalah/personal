import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Check, X, RefreshCw, LogOut, Clock, User, BarChart3 } from 'lucide-react';


// Once I've signed in on a browser, my own visits there stop counting in the stats (lib/events.js
// checks this). It's set here, not by importing the tracking code, which ad blockers may block.
const markMine = () => {
  try {
    localStorage.setItem('site_owner', '1');
  } catch {}
};

export default function ModerationPanel() {
  const [drawings, setDrawings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processingIds, setProcessingIds] = useState(new Set());
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      if (session?.user) {
        markMine();
        fetchDrawings();
        fetchStats();
      }
    };
    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        markMine();
        fetchDrawings();
        fetchStats();
      } else {
        setDrawings([]);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setLoginError(error.message);
      else if (data.user) { setEmail(''); setPassword(''); }
    } catch (err) {
      setLoginError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setEmail(''); setPassword(''); setDrawings([]);
  };

  const fetchStats = async () => {
    // Ask for the counts alone: listing the rows would stop at Supabase's per-request row limit.
    const count = async (status) => {
      const { count: n } = await supabase.from('drawings').select('id', { count: 'exact', head: true }).eq('status', status);
      return n || 0;
    };
    const [pending, approved, rejected] = await Promise.all(['pending', 'approved', 'rejected'].map(count));
    setStats({ pending, approved, rejected });
  };

  const fetchDrawings = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('drawings')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) alert('Error fetching drawings: ' + error.message);
      else setDrawings(data || []);
    } catch (err) {
      alert('Unexpected error occurred while fetching drawings');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, status) => {
    if (processingIds.has(id) || !user) return;
    setProcessingIds(prev => new Set([...prev, id]));
    try {
      const { data, error } = await supabase
        .from('drawings')
        .update({ status })
        .eq('id', id)
        .select();
      if (error) { alert(`Error updating status: ${error.message}`); return; }
      if (!data || data.length === 0) { alert('No drawing was updated.'); return; }
      setDrawings(prev => prev.filter(d => d.id !== id));
      fetchStats();
    } catch (err) {
      alert('Unexpected error occurred while updating status');
    } finally {
      setProcessingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Login Screen
  if (!user) {
    return (
      <div className="max-w-md">
        <h1 className="page-title"><span className="mark">Moderation</span></h1>
        <p className="text-muted mb-8">Sign in to review submissions.</p>

        <form onSubmit={handleLogin} className="space-y-5">
          {loginError && (
            <p className="border border-line border-l-4 border-l-accent rounded-lg px-4 py-3 text-sm">
              {loginError}
            </p>
          )}
          <label className="block">
            <span className="admin-label block mb-2">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              disabled={loading}
            />
          </label>
          <label className="block">
            <span className="admin-label block mb-2">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              disabled={loading}
            />
          </label>
          <button type="submit" disabled={loading} className="button w-full justify-center disabled:opacity-50">
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    );
  }

  const tiles = [
    { label: 'Waiting on me', value: stats.pending, icon: Clock },
    { label: 'Approved', value: stats.approved, icon: Check },
    { label: 'Rejected', value: stats.rejected, icon: X },
  ];

  // Main Panel
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="page-title !mb-2"><span className="mark">Moderation</span></h1>
          <p className="admin-label m-0">Signed in as {user.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/stats" className="admin-btn no-underline">
            <BarChart3 />
            Stats
          </a>
          <button onClick={() => { fetchDrawings(); fetchStats(); }} disabled={loading} className="admin-btn">
            <RefreshCw className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button onClick={handleLogout} className="admin-btn">
            <LogOut />
            Sign out
          </button>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-3 mb-10">
        {tiles.map(({ label, value, icon: Icon }) => (
          <div key={label} className="admin-card">
            <p className="admin-label flex items-center gap-2 m-0"><Icon className="w-4 h-4" />{label}</p>
            <p className="admin-num mt-2 mb-0">{value}</p>
          </div>
        ))}
      </div>

      {/* Drawings Grid */}
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="section-title !m-0">Waiting for review</h2>
        <span className="admin-label">{drawings.length} {drawings.length === 1 ? 'drawing' : 'drawings'}</span>
      </div>

      {loading ? (
        <div className="admin-card text-center py-12">
          <RefreshCw className="w-7 h-7 text-muted animate-spin mx-auto mb-3" />
          <p className="text-muted m-0">Loading submissions...</p>
        </div>
      ) : drawings.length === 0 ? (
        <div className="admin-card text-center py-12">
          <p className="font-hand text-3xl m-0">All caught up!</p>
          <p className="admin-label mt-1 mb-0">No drawings waiting on you.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {drawings.map((drawing) => (
            <div key={drawing.id} className="group admin-card !p-0 overflow-hidden">
              {/* Image Preview */}
              <button
                type="button"
                className="block w-full aspect-square bg-white border-b border-line cursor-zoom-in overflow-hidden"
                onClick={() => setSelectedImage(drawing)}
              >
                <img
                  src={drawing.image_url}
                  alt={`Drawing by ${drawing.name || 'Anonymous'}`}
                  className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                />
              </button>

              {/* Info & Actions */}
              <div className="p-4">
                <p className="flex items-center gap-2 font-medium truncate m-0">
                  <User className="w-4 h-4 text-muted" />
                  {drawing.name || 'Anonymous'}
                </p>
                <p className="admin-label flex items-center gap-2 mt-1 mb-4">
                  <Clock className="w-3 h-3" />
                  {formatDate(drawing.created_at)}
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() => updateStatus(drawing.id, 'approved')}
                    disabled={processingIds.has(drawing.id)}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-ink text-white font-medium rounded-lg hover:opacity-85 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Check className="w-4 h-4" />
                    {processingIds.has(drawing.id) ? '...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => updateStatus(drawing.id, 'rejected')}
                    disabled={processingIds.has(drawing.id)}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-line font-medium rounded-lg hover:border-ink transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <X className="w-4 h-4" />
                    {processingIds.has(drawing.id) ? '...' : 'Reject'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image Preview Modal. Drawings have see-through backgrounds, so they sit on white. */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-8"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-full bg-white rounded-xl overflow-hidden">
            <img
              src={selectedImage.image_url}
              alt={`Drawing by ${selectedImage.name || 'Anonymous'}`}
              className="max-w-full max-h-[80vh] object-contain"
            />
            <div className="border-t border-line px-4 py-3">
              <p className="font-medium m-0">{selectedImage.name || 'Anonymous'}</p>
              <p className="admin-label m-0">{formatDate(selectedImage.created_at)}</p>
            </div>
            <button
              onClick={() => setSelectedImage(null)}
              aria-label="Close"
              className="absolute top-3 right-3 w-9 h-9 bg-white border border-line rounded-full flex items-center justify-center hover:border-ink transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
