import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

const getSessionId = () => {
  let sessionId = sessionStorage.getItem('analytics_session');
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('analytics_session', sessionId);
  }
  return sessionId;
};

const getVisitorId = () => {
  // Check URL for visitor ID passed from home page
  const urlParams = new URLSearchParams(window.location.search);
  const urlVisitorId = urlParams.get('vid');
  
  if (urlVisitorId) {
    localStorage.setItem('analytics_visitor', urlVisitorId);
    // Clean up URL without refreshing
    const url = new URL(window.location);
    url.searchParams.delete('vid');
    window.history.replaceState({}, '', url);
    return urlVisitorId;
  }
  
  let visitorId = localStorage.getItem('analytics_visitor');
  if (!visitorId) {
    visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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

export const track = async (eventName, eventData = {}) => {
  try {
    await supabase.from('analytics').insert({
      session_id: getSessionId(),
      event_name: eventName,
      event_data: {
        ...eventData,
        visitor_id: getVisitorId()
      },
      device_type: getDeviceType(),
      screen_width: window.innerWidth,
      screen_height: window.innerHeight
    });
  } catch (err) {
    console.error('Analytics error:', err);
  }
};

export const trackPageView = (page) => track('page_view', { page, timestamp: Date.now() });
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