import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatDuration } from '../lib/drawing-totals';
import { 
  ArrowLeft, Users, Image, MousePointer, TrendingUp, Clock, 
  RefreshCw, Undo2, Paintbrush, LogOut, Calendar, UserCheck, Home, ExternalLink
} from 'lucide-react';


export default function Statistics() {
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

  // Supabase hands back a limited number of rows per request (1,000 by default), and every stroke
  // is an event, so read each table a page at a time, oldest first. null if a request fails.
  const fetchAll = async (table) => {
    const rows = [];
    for (;;) {
      const { data, error } = await supabase.from(table).select('*').order('created_at').range(rows.length, rows.length + 999);
      if (error || !data) return null;
      if (data.length === 0) return rows;
      rows.push(...data);
    }
  };

  const fetchStats = async () => {
    setLoading(true);
    const [allEvents, allDrawings] = await Promise.all([fetchAll('analytics'), fetchAll('drawings')]);

    // 0 is all time.
    const since = new Date();
    since.setDate(since.getDate() - timeRange);
    const inRange = (row) => !timeRange || new Date(row.created_at) >= since;
    const events = allEvents?.filter(inRange);
    const drawings = allDrawings?.filter(inRange);

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
      // Visits where someone actually drew. drawing_start fires on every stroke, so count visits, not events.
      const sessionsWithDrawing = [...new Set(events.filter(e => e.event_name === 'drawing_start').map(e => e.session_id))];

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
      // Per visit that drew, not per visit: most visits never open the canvas.
      const undoPerSession = sessionsWithDrawing.length > 0 ? (undoCount / sessionsWithDrawing.length).toFixed(1) : 0;

      // Brush size stats
      const brushChanges = events.filter(e => e.event_name === 'brush_size_change');
      const brushSizes = brushChanges.map(e => e.event_data?.size).filter(Boolean);
      const brushSizeFrequency = brushSizes.reduce((acc, size) => {
        acc[size] = (acc[size] || 0) + 1;
        return acc;
      }, {});
      const mostPopularBrushSize = Object.entries(brushSizeFrequency)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
      const brushChangesPerSession = sessionsWithDrawing.length > 0 ? (brushChanges.length / sessionsWithDrawing.length).toFixed(1) : 0;

      // Typical time from first stroke to submitting, per visit that submitted. The median, so a
      // tab left open overnight doesn't drag it out. Same as the public number on the project page.
      const drawTimes = sessionsWithSubmit.map(sessionId => {
        const sessionEvents = events.filter(e => e.session_id === sessionId);
        const firstStroke = sessionEvents.find(e => e.event_name === 'drawing_start');
        const submitEvent = sessionEvents.find(e => e.event_name === 'submit_success');
        if (!firstStroke || !submitEvent) return null;
        const seconds = (new Date(submitEvent.created_at) - new Date(firstStroke.created_at)) / 1000;
        return seconds > 0 ? seconds : null;
      }).filter(Boolean).sort((a, b) => a - b);
      const middle = Math.floor(drawTimes.length / 2);
      const medianDrawSeconds = drawTimes.length === 0 ? null
        : drawTimes.length % 2 ? drawTimes[middle] : (drawTimes[middle - 1] + drawTimes[middle]) / 2;
      const timeToSubmit = medianDrawSeconds === null ? 'N/A' : formatDuration(medianDrawSeconds);

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

      // Drawing completion rate: of the visits where someone drew, the share that submitted.
      const drewAndSubmitted = sessionsWithDrawing.filter(s => sessionsWithSubmit.includes(s)).length;
      const completionRate = sessionsWithDrawing.length > 0 ? ((drewAndSubmitted / sessionsWithDrawing.length) * 100).toFixed(1) : 0;

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
        timeToSubmit,
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
      <div className="max-w-md">
        <h1 className="page-title"><span className="mark">Stats</span></h1>
        <p className="text-muted mb-8">Sign in through the moderation page to see these.</p>
        <a href="/moderate" className="button">Go to sign in</a>
      </div>
    );
  }

  // A number in a box, and a label/value line; the pieces most of the page is made of.
  const Tile = ({ icon: Icon, label, value, note }) => (
    <div className="admin-card">
      <p className="admin-label flex items-center gap-2 m-0"><Icon className="w-4 h-4" />{label}</p>
      <p className="admin-num mt-2 mb-0">{value}</p>
      {note && <p className="admin-label mt-1 mb-0">{note}</p>}
    </div>
  );
  const Mini = ({ value, label, note }) => (
    <div className="border border-line rounded-xl p-4 text-center">
      <p className="font-display text-3xl leading-none m-0">{value}</p>
      <p className="text-sm mt-2 mb-0">{label}</p>
      {note && <p className="admin-label m-0">{note}</p>}
    </div>
  );
  const Row = ({ label, value, strong }) => (
    <div className="flex justify-between items-center gap-4 py-2 border-b border-line last:border-0">
      <span className="text-muted">{label}</span>
      <span className={`font-semibold ${strong ? 'text-accent-ink' : ''}`}>{value}</span>
    </div>
  );
  // Busier hours and days get more of the accent color.
  const heat = (share) => `color-mix(in srgb, var(--accent) ${Math.round(8 + share * 92)}%, #fff)`;

  const maxHour = stats ? Math.max(...Object.values(stats.hourCounts), 1) : 1;
  const maxDay = stats ? Math.max(...Object.values(stats.activityByDay), 1) : 1;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="page-title !mb-2"><span className="mark">Stats</span></h1>
          <p className="admin-label m-0">How people find the drawing canvas, and what they do there</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/moderate" className="admin-btn no-underline">
            <ArrowLeft />
            Moderation
          </a>
          <select value={timeRange} onChange={(e) => setTimeRange(Number(e.target.value))} className="admin-btn" aria-label="Time range">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last 365 days</option>
            <option value={0}>All time</option>
          </select>
          <button onClick={fetchStats} disabled={loading} className="admin-btn" aria-label="Refresh">
            <RefreshCw className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 animate-spin text-muted" />
        </div>
      ) : stats && (
        <>
          {/* Top Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <Tile icon={Home} label="Home views" value={stats.homeViews} />
            <Tile icon={MousePointer} label="Draw clicks" value={stats.drawLinkClicks} note={`${stats.homeClickThrough}% of home views`} />
            <Tile icon={Users} label="Visits" value={stats.uniqueSessions} />
            <Tile icon={Image} label="Submissions" value={stats.submissions} />
            <Tile icon={TrendingUp} label="Full funnel" value={`${stats.fullFunnelRate}%`} note="home → submit" />
          </div>

          {/* Traffic Source & Step-by-Step Conversion */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="admin-card">
              <h3><ExternalLink /> How people get to the draw intro</h3>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <Mini value={stats.referredToInfo} label="From Home" note={`${stats.referredRate}%`} />
                <Mini value={stats.directToInfo} label="Straight there" note={`${stats.directRate}%`} />
              </div>
              <div className="h-3 bg-line rounded-full overflow-hidden flex">
                <div className="h-full bg-accent" style={{ width: `${stats.referredRate}%` }} />
              </div>
            </div>

            <div className="admin-card">
              <h3><TrendingUp /> Step by step</h3>
              <Row label="Home → clicked draw" value={`${stats.homeToClickRate}%`} />
              <Row label="Clicked → draw intro" value={`${stats.clickToInfoRate}%`} />
              <Row label="Draw intro → canvas" value={`${stats.infoToDrawRate}%`} />
              <Row label="Canvas → submitted" value={`${stats.drawToSubmitRate}%`} strong />
            </div>
          </div>

          {/* Full Funnel Visualization */}
          <div className="admin-card mb-6">
            <h3>The whole funnel</h3>
            <div className="space-y-3">
              {[
                { label: 'Home page views', value: stats.homeViews },
                { label: 'Draw link clicks', value: stats.drawLinkClicks },
                { label: 'Draw intro views', value: stats.infoViews },
                { label: 'Canvas views', value: stats.drawViews },
                { label: 'Submitted', value: stats.submissions },
              ].map((step) => {
                const pct = stats.homeViews ? (step.value / stats.homeViews) * 100 : 0;
                return (
                  <div key={step.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted">{step.label}</span>
                      <span className="font-medium">{step.value} ({pct.toFixed(1)}%)</span>
                    </div>
                    <div className="h-2 bg-line rounded-full overflow-hidden">
                      <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="admin-label mt-4 mb-0 text-center">
              {stats.fullFunnelRate}% of home page views end in a submitted drawing
            </p>
          </div>

          {/* Drop-off Analysis & Visitor Loyalty */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="admin-card">
              <h3><LogOut /> Where people drop off</h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <Mini value={`${stats.bounceRateHome}%`} label="Left Home" note="didn't click draw" />
                <Mini value={`${stats.clickToInfoDropoff}%`} label="Clicked, then left" note="stopped at the draw intro" />
                <Mini value={`${stats.bounceRateInfo}%`} label="Left the draw intro" note="never opened the canvas" />
                <Mini value={`${stats.modalAbandonRate}%`} label="Backed out of saving" note="closed the save box" />
              </div>
              <p className="admin-label text-center m-0">
                {stats.clickedButLeftOnInfo} visits clicked draw but left on the draw intro
              </p>
            </div>

            <div className="admin-card">
              <h3><UserCheck /> Coming back</h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <Mini value={stats.totalVisitors} label="Visitors" note="all time" />
                <Mini value={`${stats.returningRate}%`} label="Came back" note="on another day" />
              </div>
              <p className="admin-label text-center m-0">
                {stats.returningVisitors} visitors have come back more than once
              </p>
            </div>
          </div>

          {/* Drawing Behavior */}
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            <div className="admin-card">
              <h3><Undo2 /> Undo and redo</h3>
              <Row label="Undos" value={stats.undoCount} />
              <Row label="Redos" value={stats.redoCount} />
              <Row label="Undos per drawing visit" value={stats.undoPerSession} strong />
            </div>

            <div className="admin-card">
              <h3><Paintbrush /> Brush size</h3>
              <Row label="Most picked size" value={`${stats.mostPopularBrushSize}px`} />
              <Row label="Size changes" value={stats.brushChanges} />
              <Row label="Changes per drawing visit" value={stats.brushChangesPerSession} strong />
            </div>

            <div className="admin-card">
              <h3><Clock /> Finishing</h3>
              <Row label="Typical time to submit" value={stats.timeToSubmit} />
              <Row label="Canvas clears" value={stats.canvasClears} />
              <Row label="Finished their drawing" value={`${stats.completionRate}%`} strong />
            </div>
          </div>

          {/* Approval Stats */}
          <div className="admin-card mb-6">
            <h3>Approvals (all time)</h3>
            <div className="flex items-center gap-8 mb-4">
              <div className="text-center">
                <p className="admin-num !text-5xl m-0">{stats.approvalRate}%</p>
                <p className="admin-label mt-1 mb-0">approval rate</p>
              </div>
              <div className="flex-1">
                <Row label={<><span className="inline-block w-2.5 h-2.5 rounded-full bg-accent mr-2" />Approved</>} value={stats.approved} />
                <Row label={<><span className="inline-block w-2.5 h-2.5 rounded-full bg-ink mr-2" />Rejected</>} value={stats.rejected} />
                <Row label={<><span className="inline-block w-2.5 h-2.5 rounded-full bg-line mr-2" />Waiting</>} value={stats.pending} />
              </div>
            </div>
            <div className="h-3 bg-line rounded-full overflow-hidden flex">
              <div className="h-full bg-accent" style={{ width: `${stats.totalDrawings ? (stats.approved / stats.totalDrawings * 100) : 0}%` }} />
              <div className="h-full bg-ink" style={{ width: `${stats.totalDrawings ? (stats.rejected / stats.totalDrawings * 100) : 0}%` }} />
            </div>
          </div>

          {/* Activity Charts */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="admin-card">
              <h3>Busiest hours</h3>
              <div className="flex gap-1">
                {Array.from({ length: 24 }, (_, hour) => {
                  const count = stats.hourCounts[hour] || 0;
                  return (
                    <div key={hour} className="flex-1 text-center">
                      <div className="h-16 rounded mb-1" style={{ backgroundColor: heat(count / maxHour) }} title={`${hour}:00, ${count} events`} />
                      <span className="text-xs text-muted">{hour % 6 === 0 ? hour : ''}</span>
                    </div>
                  );
                })}
              </div>
              <p className="admin-label mt-2 mb-0 text-center">Hour of the day, in your time zone</p>
            </div>

            <div className="admin-card">
              <h3>Busiest days</h3>
              <div className="flex gap-2">
                {stats.dayNames.map((day, i) => {
                  const count = stats.activityByDay[i] || 0;
                  return (
                    <div key={day} className="flex-1 text-center">
                      <div className="h-20 rounded-lg mb-2 flex items-end justify-center pb-2" style={{ backgroundColor: heat(count / maxDay) }}>
                        <span className="text-xs font-medium">{count}</span>
                      </div>
                      <span className="text-xs text-muted">{day}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Activity by Month */}
          <div className="admin-card mb-6">
            <h3><Calendar /> Month by month (all time)</h3>
            {Object.keys(stats.activityByMonth).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(stats.activityByMonth)
                  .sort((a, b) => new Date(a[0]) - new Date(b[0]))
                  .map(([month, count]) => {
                    const maxMonth = Math.max(...Object.values(stats.activityByMonth));
                    return (
                      <div key={month}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted">{month}</span>
                          <span className="font-medium">{count} events</span>
                        </div>
                        <div className="h-2 bg-line rounded-full overflow-hidden">
                          <div className="h-full bg-accent rounded-full" style={{ width: `${(count / maxMonth) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <p className="text-muted text-sm m-0">No monthly data yet</p>
            )}
          </div>

          {/* Exit Behavior */}
          <div className="admin-card">
            <h3>The exit button</h3>
            <div className="grid grid-cols-2 gap-3">
              <Mini value={stats.exitConfirmed} label="Left the canvas" />
              <Mini value={stats.exitCancelled} label="Changed their mind" note="and kept drawing" />
            </div>
          </div>
        </>
      )}
    </>
  );
}
