import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Users, Image, MousePointer, TrendingUp, Clock, 
  RefreshCw, Undo2, Paintbrush, LogOut, Calendar, UserCheck, Home, ExternalLink
} from 'lucide-react';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

export default function Statistics() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(7);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      if (session?.user) fetchStats();
      else setLoading(false);
    };
    getSession();
  }, []);

  useEffect(() => { if (user) fetchStats(); }, [timeRange]);

  const fetchStats = async () => {
    setLoading(true);
    const since = new Date();
    since.setDate(since.getDate() - timeRange);

    const { data: events } = await supabase
      .from('analytics')
      .select('*')
      .gte('created_at', since.toISOString());

    const { data: drawings } = await supabase
      .from('drawings')
      .select('*')
      .gte('created_at', since.toISOString());

    const { data: allDrawings } = await supabase.from('drawings').select('*');
    const { data: allEvents } = await supabase.from('analytics').select('*');

    if (events && drawings) {
      const uniqueSessions = [...new Set(events.map(e => e.session_id))].length;
      const pageViews = events.filter(e => e.event_name === 'page_view');
      const homeViews = pageViews.filter(e => e.event_data?.page === 'home').length;
      const drawLinkClicks = events.filter(e => e.event_name === 'draw_link_click').length;
      const infoViews = pageViews.filter(e => e.event_data?.page === 'info').length;
      const drawViews = pageViews.filter(e => e.event_data?.page === 'draw').length;
      const submissions = events.filter(e => e.event_name === 'submit_success').length;
      
      // Home to draw click-through rate
      const homeClickThrough = homeViews > 0 ? ((drawLinkClicks / homeViews) * 100).toFixed(1) : 0;

      // Direct vs Referred visitors
      const sessionsWithHomeView = [...new Set(pageViews.filter(e => e.event_data?.page === 'home').map(e => e.session_id))];
      const sessionsWithInfoView = [...new Set(pageViews.filter(e => e.event_data?.page === 'info').map(e => e.session_id))];
      const referredToInfo = sessionsWithInfoView.filter(s => sessionsWithHomeView.includes(s)).length;
      const directToInfo = sessionsWithInfoView.filter(s => !sessionsWithHomeView.includes(s)).length;
      const referredRate = sessionsWithInfoView.length > 0 ? ((referredToInfo / sessionsWithInfoView.length) * 100).toFixed(1) : 0;
      const directRate = sessionsWithInfoView.length > 0 ? ((directToInfo / sessionsWithInfoView.length) * 100).toFixed(1) : 0;

      // Step-by-step conversion rates
      const sessionsWithDrawClick = [...new Set(events.filter(e => e.event_name === 'draw_link_click').map(e => e.session_id))];
      const sessionsWithDrawView = [...new Set(pageViews.filter(e => e.event_data?.page === 'draw').map(e => e.session_id))];
      const sessionsWithSubmit = [...new Set(events.filter(e => e.event_name === 'submit_success').map(e => e.session_id))];
      
      // Home → Click
      const homeToClickRate = homeViews > 0 ? ((drawLinkClicks / homeViews) * 100).toFixed(1) : 0;
      // Click → Info (sessions that clicked and viewed info)
      const clickedAndViewedInfo = sessionsWithDrawClick.filter(s => sessionsWithInfoView.includes(s)).length;
      const clickToInfoRate = sessionsWithDrawClick.length > 0 ? ((clickedAndViewedInfo / sessionsWithDrawClick.length) * 100).toFixed(1) : 0;
      // Info → Draw
      const infoAndViewedDraw = sessionsWithInfoView.filter(s => sessionsWithDrawView.includes(s)).length;
      const infoToDrawRate = sessionsWithInfoView.length > 0 ? ((infoAndViewedDraw / sessionsWithInfoView.length) * 100).toFixed(1) : 0;
      // Draw → Submit
      const drawAndSubmitted = sessionsWithDrawView.filter(s => sessionsWithSubmit.includes(s)).length;
      const drawToSubmitRate = sessionsWithDrawView.length > 0 ? ((drawAndSubmitted / sessionsWithDrawView.length) * 100).toFixed(1) : 0;

      // Home → Info drop-off (clicked draw but left on info page)
      const clickedButLeftOnInfo = sessionsWithDrawClick.filter(s => sessionsWithInfoView.includes(s) && !sessionsWithDrawView.includes(s)).length;
      const clickToInfoDropoff = sessionsWithDrawClick.length > 0 ? ((clickedButLeftOnInfo / sessionsWithDrawClick.length) * 100).toFixed(1) : 0;

      // Bounce rates
      const bouncedFromInfo = sessionsWithInfoView.filter(s => !sessionsWithDrawView.includes(s)).length;
      const bounceRateInfo = sessionsWithInfoView.length > 0 ? ((bouncedFromInfo / sessionsWithInfoView.length) * 100).toFixed(1) : 0;
      const bouncedFromHome = sessionsWithHomeView.filter(s => !sessionsWithDrawClick.includes(s)).length;
      const bounceRateHome = sessionsWithHomeView.length > 0 ? ((bouncedFromHome / sessionsWithHomeView.length) * 100).toFixed(1) : 0;

      // Undo/Redo frequency
      const undoCount = events.filter(e => e.event_name === 'undo').length;
      const redoCount = events.filter(e => e.event_name === 'redo').length;
      const undoPerSession = uniqueSessions > 0 ? (undoCount / uniqueSessions).toFixed(1) : 0;

      // Brush size stats
      const brushChanges = events.filter(e => e.event_name === 'brush_size_change');
      const brushSizes = brushChanges.map(e => e.event_data?.size).filter(Boolean);
      const brushSizeFrequency = brushSizes.reduce((acc, size) => {
        acc[size] = (acc[size] || 0) + 1;
        return acc;
      }, {});
      const mostPopularBrushSize = Object.entries(brushSizeFrequency)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
      const brushChangesPerSession = uniqueSessions > 0 ? (brushChanges.length / uniqueSessions).toFixed(1) : 0;

      // Average time on draw page before submitting
      let avgTimeToSubmit = 0;
      if (sessionsWithSubmit.length > 0) {
        const times = sessionsWithSubmit.map(sessionId => {
          const sessionEvents = events.filter(e => e.session_id === sessionId);
          const drawPageView = sessionEvents.find(e => e.event_name === 'page_view' && e.event_data?.page === 'draw');
          const submitEvent = sessionEvents.find(e => e.event_name === 'submit_success');
          if (drawPageView && submitEvent) {
            return new Date(submitEvent.created_at) - new Date(drawPageView.created_at);
          }
          return null;
        }).filter(Boolean);
        if (times.length > 0) {
          avgTimeToSubmit = Math.round(times.reduce((a, b) => a + b, 0) / times.length / 1000 / 60);
        }
      }

      // Activity by day of week
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const activityByDay = events.reduce((acc, e) => {
        const day = new Date(e.created_at).getDay();
        acc[day] = (acc[day] || 0) + 1;
        return acc;
      }, {});

      // Activity by month
      const activityByMonth = (allEvents || []).reduce((acc, e) => {
        const month = new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        acc[month] = (acc[month] || 0) + 1;
        return acc;
      }, {});

      // Returning visitors
      const visitorIds = [...new Set((allEvents || []).map(e => e.event_data?.visitor_id).filter(Boolean))];
      const visitorSessions = visitorIds.map(vid => {
        const visitorEvents = (allEvents || []).filter(e => e.event_data?.visitor_id === vid);
        const uniqueDays = [...new Set(visitorEvents.map(e => new Date(e.created_at).toDateString()))];
        return { visitorId: vid, visits: uniqueDays.length };
      });
      const returningVisitors = visitorSessions.filter(v => v.visits > 1).length;
      const returningRate = visitorIds.length > 0 ? ((returningVisitors / visitorIds.length) * 100).toFixed(1) : 0;

      // Modal abandonment
      const modalOpens = events.filter(e => e.event_name === 'submit_start').length;
      const modalCloses = events.filter(e => e.event_name === 'modal_close').length;
      const modalAbandonRate = modalOpens > 0 ? ((modalCloses / modalOpens) * 100).toFixed(1) : 0;

      // Drawing completion rate
      const drawingStarts = events.filter(e => e.event_name === 'drawing_start').length;
      const completionRate = drawingStarts > 0 ? ((submissions / drawingStarts) * 100).toFixed(1) : 0;

      // Canvas clears
      const canvasClears = events.filter(e => e.event_name === 'canvas_clear').length;

      // Exit tracking
      const exitConfirmed = events.filter(e => e.event_name === 'exit' && e.event_data?.confirmed === true).length;
      const exitCancelled = events.filter(e => e.event_name === 'exit' && e.event_data?.confirmed === false).length;

      // Peak hours
      const hourCounts = events.reduce((acc, e) => {
        const hour = new Date(e.created_at).getHours();
        acc[hour] = (acc[hour] || 0) + 1;
        return acc;
      }, {});

      // Approval stats
      const approved = allDrawings?.filter(d => d.status === 'approved').length || 0;
      const rejected = allDrawings?.filter(d => d.status === 'rejected').length || 0;
      const pending = allDrawings?.filter(d => d.status === 'pending').length || 0;

      setStats({
        uniqueSessions,
        totalPageViews: pageViews.length,
        homeViews,
        drawLinkClicks,
        homeClickThrough,
        infoViews,
        drawViews,
        submissions,
        conversionRate: infoViews > 0 ? ((submissions / infoViews) * 100).toFixed(1) : 0,
        fullFunnelRate: homeViews > 0 ? ((submissions / homeViews) * 100).toFixed(1) : 0,
        // Direct vs Referred
        referredToInfo,
        directToInfo,
        referredRate,
        directRate,
        // Step-by-step conversion
        homeToClickRate,
        clickToInfoRate,
        infoToDrawRate,
        drawToSubmitRate,
        clickToInfoDropoff,
        clickedButLeftOnInfo,
        // Bounce rates
        bounceRateHome,
        bounceRateInfo,
        // Drawing behavior
        undoCount,
        redoCount,
        undoPerSession,
        brushChanges: brushChanges.length,
        brushChangesPerSession,
        mostPopularBrushSize,
        brushSizeFrequency,
        avgTimeToSubmit,
        // Activity
        activityByDay,
        dayNames,
        activityByMonth,
        hourCounts,
        // Visitors
        returningVisitors,
        totalVisitors: visitorIds.length,
        returningRate,
        // Modal & completion
        modalAbandonRate,
        completionRate,
        canvasClears,
        exitConfirmed,
        exitCancelled,
        // Approval
        approved,
        rejected,
        pending,
        totalDrawings: allDrawings?.length || 0,
        approvalRate: (approved + rejected) > 0 ? ((approved / (approved + rejected)) * 100).toFixed(1) : 0
      });
    }
    setLoading(false);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-6">Please sign in through the moderation panel.</p>
          <button onClick={() => navigate('/moderate')} className="bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition">
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  const StatCard = ({ icon: Icon, label, value, subtext, color = "slate" }) => (
    <div className={`bg-${color}-50 border border-${color}-200 rounded-2xl p-5`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm font-medium text-${color}-600`}>{label}</p>
          <p className={`text-3xl font-bold text-${color}-700 mt-1`}>{value}</p>
          {subtext && <p className={`text-xs text-${color}-500 mt-1`}>{subtext}</p>}
        </div>
        <div className={`w-12 h-12 bg-${color}-100 rounded-xl flex items-center justify-center`}>
          <Icon className={`w-6 h-6 text-${color}-600`} />
        </div>
      </div>
    </div>
  );

  const maxHour = stats ? Math.max(...Object.values(stats.hourCounts), 1) : 1;
  const maxDay = stats ? Math.max(...Object.values(stats.activityByDay), 1) : 1;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate('/moderate')} className="p-2 hover:bg-slate-100 rounded-lg transition">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Statistics Dashboard</h1>
                <p className="text-sm text-slate-500">Analytics & Insights</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(Number(e.target.value))}
                className="px-4 py-2 border border-slate-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
                <option value={365}>All time</option>
              </select>
              <button onClick={fetchStats} disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : stats && (
          <>
            {/* Top Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              <StatCard icon={Home} label="Home Views" value={stats.homeViews} color="indigo" />
              <StatCard icon={MousePointer} label="Draw Clicks" value={stats.drawLinkClicks} subtext={`${stats.homeClickThrough}% CTR`} color="cyan" />
              <StatCard icon={Users} label="Sessions" value={stats.uniqueSessions} color="blue" />
              <StatCard icon={Image} label="Submissions" value={stats.submissions} color="emerald" />
              <StatCard icon={TrendingUp} label="Full Funnel" value={`${stats.fullFunnelRate}%`} subtext="home → submit" color="violet" />
            </div>

            {/* Traffic Source & Step-by-Step Conversion */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {/* Direct vs Referred */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <ExternalLink className="w-5 h-5" /> Traffic Source to Info Page
                </h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center p-4 bg-indigo-50 rounded-xl">
                    <p className="text-3xl font-bold text-indigo-700">{stats.referredToInfo}</p>
                    <p className="text-sm text-indigo-600">From Home</p>
                    <p className="text-xs text-indigo-500">{stats.referredRate}%</p>
                  </div>
                  <div className="text-center p-4 bg-slate-100 rounded-xl">
                    <p className="text-3xl font-bold text-slate-700">{stats.directToInfo}</p>
                    <p className="text-sm text-slate-600">Direct Visit</p>
                    <p className="text-xs text-slate-500">{stats.directRate}%</p>
                  </div>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex">
                  <div className="h-full bg-indigo-500" style={{ width: `${stats.referredRate}%` }} />
                  <div className="h-full bg-slate-400" style={{ width: `${stats.directRate}%` }} />
                </div>
              </div>

              {/* Step-by-Step Conversion */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" /> Step-by-Step Conversion
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-2 bg-indigo-50 rounded-lg">
                    <span className="text-sm text-slate-700">Home → Click</span>
                    <span className="font-bold text-indigo-700">{stats.homeToClickRate}%</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                    <span className="text-sm text-slate-700">Click → Info</span>
                    <span className="font-bold text-blue-700">{stats.clickToInfoRate}%</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-cyan-50 rounded-lg">
                    <span className="text-sm text-slate-700">Info → Draw</span>
                    <span className="font-bold text-cyan-700">{stats.infoToDrawRate}%</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-emerald-50 rounded-lg">
                    <span className="text-sm text-slate-700">Draw → Submit</span>
                    <span className="font-bold text-emerald-700">{stats.drawToSubmitRate}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Full Funnel Visualization */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-8">
              <h3 className="font-semibold text-slate-900 mb-4">Full Conversion Funnel</h3>
              <div className="space-y-3">
                {[
                  { label: 'Home Page Views', value: stats.homeViews, pct: 100, color: 'bg-indigo-500' },
                  { label: 'Draw Link Clicks', value: stats.drawLinkClicks, pct: stats.homeViews ? (stats.drawLinkClicks / stats.homeViews * 100) : 0, color: 'bg-blue-500' },
                  { label: 'Info Page Views', value: stats.infoViews, pct: stats.homeViews ? (stats.infoViews / stats.homeViews * 100) : 0, color: 'bg-cyan-500' },
                  { label: 'Draw Page Views', value: stats.drawViews, pct: stats.homeViews ? (stats.drawViews / stats.homeViews * 100) : 0, color: 'bg-teal-500' },
                  { label: 'Submitted', value: stats.submissions, pct: stats.homeViews ? (stats.submissions / stats.homeViews * 100) : 0, color: 'bg-emerald-500' },
                ].map((step, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600">{step.label}</span>
                      <span className="font-medium">{step.value} ({step.pct.toFixed(1)}%)</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${step.color} rounded-full transition-all`} style={{ width: `${step.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-4 text-center">
                Full funnel: {stats.fullFunnelRate}% of home visitors submit a drawing
              </p>
            </div>

            {/* Drop-off Analysis & Visitor Loyalty */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <LogOut className="w-5 h-5" /> Drop-off Analysis
                </h3>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="text-center p-3 bg-indigo-50 rounded-xl">
                    <p className="text-2xl font-bold text-indigo-700">{stats.bounceRateHome}%</p>
                    <p className="text-xs text-indigo-600">Home Bounce</p>
                    <p className="text-xs text-indigo-500">Didn't click draw</p>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-xl">
                    <p className="text-2xl font-bold text-blue-700">{stats.clickToInfoDropoff}%</p>
                    <p className="text-xs text-blue-600">Info Drop-off</p>
                    <p className="text-xs text-blue-500">Clicked but left on info</p>
                  </div>
                  <div className="text-center p-3 bg-amber-50 rounded-xl">
                    <p className="text-2xl font-bold text-amber-700">{stats.bounceRateInfo}%</p>
                    <p className="text-xs text-amber-600">Info Bounce</p>
                    <p className="text-xs text-amber-500">Didn't go to draw</p>
                  </div>
                  <div className="text-center p-3 bg-rose-50 rounded-xl">
                    <p className="text-2xl font-bold text-rose-700">{stats.modalAbandonRate}%</p>
                    <p className="text-xs text-rose-600">Modal Abandon</p>
                    <p className="text-xs text-rose-500">Didn't submit</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500 text-center">
                  {stats.clickedButLeftOnInfo} visitors clicked draw but left on info page
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <UserCheck className="w-5 h-5" /> Visitor Loyalty
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-xl">
                    <p className="text-3xl font-bold text-blue-700">{stats.totalVisitors}</p>
                    <p className="text-sm text-blue-600">Total Visitors</p>
                  </div>
                  <div className="text-center p-4 bg-emerald-50 rounded-xl">
                    <p className="text-3xl font-bold text-emerald-700">{stats.returningRate}%</p>
                    <p className="text-sm text-emerald-600">Returning Rate</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-3 text-center">
                  {stats.returningVisitors} visitors have come back multiple times (all time)
                </p>
              </div>
            </div>

            {/* Drawing Behavior */}
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Undo2 className="w-5 h-5" /> Undo/Redo Usage
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Total Undos</span>
                    <span className="font-semibold">{stats.undoCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Total Redos</span>
                    <span className="font-semibold">{stats.redoCount}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-slate-600">Avg Undos/Session</span>
                    <span className="font-semibold text-violet-600">{stats.undoPerSession}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Paintbrush className="w-5 h-5" /> Brush Size
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Most Popular Size</span>
                    <span className="font-semibold text-lg">{stats.mostPopularBrushSize}px</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Total Changes</span>
                    <span className="font-semibold">{stats.brushChanges}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-slate-600">Changes/Session</span>
                    <span className="font-semibold text-violet-600">{stats.brushChangesPerSession}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5" /> Time & Actions
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Avg Time to Submit</span>
                    <span className="font-semibold">{stats.avgTimeToSubmit} min</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Canvas Clears</span>
                    <span className="font-semibold">{stats.canvasClears}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-slate-600">Completion Rate</span>
                    <span className="font-semibold text-emerald-600">{stats.completionRate}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Approval Stats */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-8">
              <h3 className="font-semibold text-slate-900 mb-4">Approval Stats (All Time)</h3>
              <div className="flex items-center gap-6 mb-4">
                <div className="text-center">
                  <p className="text-4xl font-bold text-emerald-600">{stats.approvalRate}%</p>
                  <p className="text-sm text-slate-500">Approval Rate</p>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-emerald-600">Approved</span>
                    <span className="font-medium">{stats.approved}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-rose-600">Rejected</span>
                    <span className="font-medium">{stats.rejected}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-amber-600">Pending</span>
                    <span className="font-medium">{stats.pending}</span>
                  </div>
                </div>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex">
                <div className="h-full bg-emerald-500" style={{ width: `${stats.totalDrawings ? (stats.approved / stats.totalDrawings * 100) : 0}%` }} />
                <div className="h-full bg-rose-500" style={{ width: `${stats.totalDrawings ? (stats.rejected / stats.totalDrawings * 100) : 0}%` }} />
                <div className="h-full bg-amber-500" style={{ width: `${stats.totalDrawings ? (stats.pending / stats.totalDrawings * 100) : 0}%` }} />
              </div>
            </div>

            {/* Activity Charts */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-4">Activity by Hour</h3>
                <div className="flex gap-1">
                  {Array.from({ length: 24 }, (_, hour) => {
                    const count = stats.hourCounts[hour] || 0;
                    const intensity = count / maxHour;
                    return (
                      <div key={hour} className="flex-1 text-center">
                        <div
                          className="h-16 rounded mb-1 transition-colors"
                          style={{ backgroundColor: `rgba(99, 102, 241, ${0.1 + intensity * 0.9})` }}
                          title={`${hour}:00 - ${count} events`}
                        />
                        <span className="text-xs text-slate-400">{hour % 6 === 0 ? hour : ''}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-500 mt-2 text-center">Hour of day (24h)</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-4">Activity by Day of Week</h3>
                <div className="flex gap-2">
                  {stats.dayNames.map((day, i) => {
                    const count = stats.activityByDay[i] || 0;
                    const intensity = count / maxDay;
                    return (
                      <div key={day} className="flex-1 text-center">
                        <div
                          className="h-20 rounded-lg mb-2 transition-colors flex items-end justify-center pb-2"
                          style={{ backgroundColor: `rgba(16, 185, 129, ${0.1 + intensity * 0.9})` }}
                        >
                          <span className="text-xs font-medium" style={{ color: intensity > 0.5 ? 'white' : '#64748b' }}>
                            {count}
                          </span>
                        </div>
                        <span className="text-xs font-medium text-slate-600">{day}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Activity by Month */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-8">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5" /> Activity by Month (All Time)
              </h3>
              {Object.keys(stats.activityByMonth).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(stats.activityByMonth)
                    .sort((a, b) => new Date(a[0]) - new Date(b[0]))
                    .map(([month, count]) => {
                      const maxMonth = Math.max(...Object.values(stats.activityByMonth));
                      const pct = (count / maxMonth) * 100;
                      return (
                        <div key={month}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-slate-600">{month}</span>
                            <span className="font-medium">{count} events</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-violet-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p className="text-slate-500 text-sm">No monthly data yet</p>
              )}
            </div>

            {/* Exit Behavior */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-4">Exit Button Behavior</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-rose-50 rounded-xl">
                  <p className="text-3xl font-bold text-rose-700">{stats.exitConfirmed}</p>
                  <p className="text-sm text-rose-600">Confirmed Exits</p>
                </div>
                <div className="text-center p-4 bg-emerald-50 rounded-xl">
                  <p className="text-3xl font-bold text-emerald-700">{stats.exitCancelled}</p>
                  <p className="text-sm text-emerald-600">Cancelled (Stayed)</p>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}