// Plain fetch instead of supabase-js so light pages (like Home) can track without loading the client library.
const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

const makeId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

const getSessionId = () => {
  let sessionId = sessionStorage.getItem('analytics_session');
  if (!sessionId) {
    sessionId = makeId('sess');
    sessionStorage.setItem('analytics_session', sessionId);
  }
  return sessionId;
};

const getVisitorId = () => {
  let visitorId = localStorage.getItem('analytics_visitor');
  if (!visitorId) {
    visitorId = makeId('visitor');
    localStorage.setItem('analytics_visitor', visitorId);
  }
  return visitorId;
};

const getDeviceType = () => {
  const ua = navigator.userAgent;
  if (/Android.*Mobile|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return 'mobile';
  if (/iPad|Android(?!.*Mobile)/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'tablet';
  return 'desktop';
};

// Local testing shouldn't pollute the production analytics table.
const IS_LOCAL = ['localhost', '127.0.0.1'].includes(window.location.hostname);

export const track = async (eventName, eventData = {}) => {
  if (IS_LOCAL) {
    console.debug('[analytics:local]', eventName, eventData);
    return;
  }
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/analytics`, {
      method: 'POST',
      // keepalive lets the event finish sending when the click navigates away.
      keepalive: true,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        session_id: getSessionId(),
        event_name: eventName,
        event_data: { ...eventData, visitor_id: getVisitorId() },
        device_type: getDeviceType(),
        screen_width: window.innerWidth,
        screen_height: window.innerHeight,
      }),
    });
  } catch (err) {
    console.error('Analytics error:', err);
  }
};

export const trackPageView = (page) => track('page_view', { page, timestamp: Date.now() });
export const trackDrawLinkClick = () => track('draw_link_click', { timestamp: Date.now() });
export const trackDrawingStart = (tool, brushSize) => track('drawing_start', { tool, brush_size: brushSize });
export const trackToolChange = (tool, previousTool) => track('tool_change', { tool, previous_tool: previousTool });
export const trackBrushSize = (size) => track('brush_size_change', { size });
export const trackUndo = () => track('undo');
export const trackRedo = () => track('redo');
export const trackClear = () => track('canvas_clear');
export const trackSubmitStart = () => track('submit_start', { timestamp: Date.now() });
export const trackSubmitSuccess = (hasName) => track('submit_success', { has_name: hasName, timestamp: Date.now() });
export const trackSubmitError = (error) => track('submit_error', { error });
export const trackExit = (confirmed) => track('exit', { confirmed });
export const trackModalClose = () => track('modal_close');
