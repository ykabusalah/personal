import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { Check, X, RefreshCw, LogOut, Image, Clock, User, BarChart3 } from 'lucide-react';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

export default function ModerationPanel() {
  const navigate = useNavigate();
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
        fetchDrawings();
        fetchStats();
      }
    };
    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
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
    const { data: pending } = await supabase.from('drawings').select('id', { count: 'exact' }).eq('status', 'pending');
    const { data: approved } = await supabase.from('drawings').select('id', { count: 'exact' }).eq('status', 'approved');
    const { data: rejected } = await supabase.from('drawings').select('id', { count: 'exact' }).eq('status', 'rejected');
    setStats({
      pending: pending?.length || 0,
      approved: approved?.length || 0,
      rejected: rejected?.length || 0
    });
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
      <div className="min-h-screen bg-white flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Moderation Panel</h1>
            <p className="text-gray-600 text-lg">Sign in to review submissions</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            {loginError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {loginError}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition"
                placeholder="admin@example.com"
                required
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition"
                placeholder="••••••••"
                required
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gray-900 text-white font-medium rounded-lg text-lg hover:bg-gray-800 transition-colors duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Main Panel
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-10 h-10 bg-slate-900 rounded-xl">
                <Image className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Moderation Panel</h1>
                <p className="text-sm text-slate-500">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/stats')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-violet-100 text-violet-700 rounded-lg hover:bg-violet-200 transition"
              >
                <BarChart3 className="w-4 h-4" />
                Stats
              </button>
              <button
                onClick={() => { fetchDrawings(); fetchStats(); }}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-600">Pending Review</p>
                <p className="text-3xl font-bold text-amber-700 mt-1">{stats.pending}</p>
              </div>
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-600">Approved</p>
                <p className="text-3xl font-bold text-emerald-700 mt-1">{stats.approved}</p>
              </div>
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <Check className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </div>
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-rose-600">Rejected</p>
                <p className="text-3xl font-bold text-rose-700 mt-1">{stats.rejected}</p>
              </div>
              <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center">
                <X className="w-6 h-6 text-rose-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Drawings Grid */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Pending Submissions</h2>
            <span className="text-sm text-slate-500">{drawings.length} items</span>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-8 h-8 text-slate-400 animate-spin mx-auto mb-3" />
              <p className="text-slate-500">Loading submissions...</p>
            </div>
          ) : drawings.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-600 font-medium">All caught up!</p>
              <p className="text-slate-400 text-sm mt-1">No pending drawings to review</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
              {drawings.map((drawing) => (
                <div
                  key={drawing.id}
                  className="group bg-slate-50 rounded-xl overflow-hidden border border-slate-200 hover:border-slate-300 hover:shadow-lg transition-all duration-200"
                >
                  {/* Image Preview */}
                  <div 
                    className="aspect-square bg-white border-b border-slate-200 cursor-pointer overflow-hidden"
                    onClick={() => setSelectedImage(drawing)}
                  >
                    <img
                      src={drawing.image_url}
                      alt="Drawing submission"
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  
                  {/* Info & Actions */}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <User className="w-4 h-4 text-slate-400" />
                      <span className="font-medium text-slate-900 truncate">
                        {drawing.name || 'Anonymous'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
                      <Clock className="w-3 h-3" />
                      {formatDate(drawing.created_at)}
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateStatus(drawing.id, 'approved')}
                        disabled={processingIds.has(drawing.id)}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 text-white font-medium rounded-lg hover:bg-emerald-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Check className="w-4 h-4" />
                        {processingIds.has(drawing.id) ? '...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => updateStatus(drawing.id, 'rejected')}
                        disabled={processingIds.has(drawing.id)}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-500 text-white font-medium rounded-lg hover:bg-rose-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
        </div>
      </main>

      {/* Image Preview Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-8"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-full">
            <img
              src={selectedImage.image_url}
              alt="Full size preview"
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-4 -right-4 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 rounded-b-lg">
              <p className="text-white font-medium">{selectedImage.name || 'Anonymous'}</p>
              <p className="text-white/70 text-sm">{formatDate(selectedImage.created_at)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}