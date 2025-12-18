import { useEffect, useRef } from "react";
import { apiFetch } from '@/lib/api';
import { useLocation } from "react-router-dom";

// Analytics will post to backend /api/analytics/visits

// Générer ou récupérer un session ID unique (persistant entre onglets)
const getSessionId = () => {
  // prefer localStorage so the session id persists across tabs and reloads
  let sessionId = localStorage.getItem("analytics_session_id");
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem("analytics_session_id", sessionId);
  }
  return sessionId;
};

export const useAnalytics = () => {
  const location = useLocation();
  const hasTrackedInitialPage = useRef(false);

  useEffect(() => {
    const trackVisit = async () => {
      // Ne tracker qu'une fois par session
      if (hasTrackedInitialPage.current) return;
      hasTrackedInitialPage.current = true;

      const sessionId = getSessionId();
      // try to get user via backend if session token exists
      let userId = null;
      const token = localStorage.getItem('sessionToken');
      if (token) {
        try {
          const resp = await apiFetch('/api/users/me', { headers: { Authorization: `Bearer ${token}` } });
          if (resp.ok) {
            const p = await resp.json();
            userId = p.user?.id || null;
          }
        } catch (e) {
          // ignore
        }
      }

      try {
        await apiFetch('/api/analytics/visits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId, user_id: userId, page_path: location.pathname, referrer: document.referrer || null, user_agent: navigator.userAgent })
        });
      } catch (error) {
        console.error('Analytics tracking error:', error);
      }
    };

    trackVisit();
  }, [location.pathname]);

  return { sessionId: getSessionId() };
};
