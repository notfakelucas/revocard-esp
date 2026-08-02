/*
 * RevolutBank funnel — conversion event tracking.
 *
 * window.trackEvent(name, params) is the generic entry point: it fires the
 * named Meta Pixel event client-side and relays the same event, with the
 * same event_id, to /api/capi so Meta's Conversions API gets a deduped
 * server-side copy (better match quality, survives ad blockers).
 *
 * window.trackPurchase(...) (guarded with `if (window.trackPurchase)`) is
 * kept as a thin wrapper for existing call sites (9.html, upsell pages).
 */
(function () {
  'use strict';

  function getCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }

  function getFbp() {
    return getCookie('_fbp') || localStorage.getItem('fb_fbp') || '';
  }

  function getFbc() {
    var fbc = getCookie('_fbc');
    if (fbc) return fbc;
    var stored = localStorage.getItem('fb_fbc');
    if (stored) return stored;
    var params = new URLSearchParams(window.location.search);
    var fbclid = params.get('fbclid');
    if (fbclid) return 'fb.1.' + Date.now() + '.' + fbclid;
    return '';
  }

  // Best-effort step label so callers have something to fall back to
  // when a call site doesn't pass its own content_id/content_name.
  window.getFunnelStepParams = window.getFunnelStepParams || function () {
    var page = document.title || 'RevolutBank';
    return { content_id: 'revolutbank-step', content_name: page };
  };

  window.trackEvent = function (eventName, params) {
    params = params || {};
    var value = Number(params.value) || 0;
    var currency = params.currency || 'EUR';
    var contentId = params.content_id || 'revolutbank-' + eventName.toLowerCase();
    var contentName = params.content_name || 'RevolutBank';
    var eventId = params.eventId || params.transactionId || (eventName.toLowerCase() + '_' + Date.now());

    if (typeof fbq === 'function') {
      fbq('track', eventName, {
        value: value,
        currency: currency,
        content_ids: [contentId],
        content_name: contentName,
        content_type: 'product'
      }, { eventID: eventId });
    }

    try {
      fetch('/api/capi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_name: eventName,
          event_id: eventId,
          event_source_url: window.location.href,
          user_data: {
            email: localStorage.getItem('email') || '',
            phone: localStorage.getItem('telefone') || localStorage.getItem('telephone') || localStorage.getItem('phone') || '',
            fbp: getFbp(),
            fbc: getFbc()
          },
          custom_data: {
            value: value,
            currency: currency,
            content_ids: [contentId],
            content_name: contentName,
            content_type: 'product',
            description: params.description || ''
          }
        })
      }).catch(function () { /* CAPI relay is best-effort; pixel already fired above */ });
    } catch (e) { /* fetch not available or blocked — pixel-side event still stands */ }
  };

  window.trackPurchase = function (params) {
    params = params || {};
    window.trackEvent('Purchase', {
      value: params.value,
      currency: params.currency,
      content_id: params.content_id || 'revolutbank-purchase',
      content_name: params.content_name,
      eventId: params.transactionId,
      description: params.description
    });
  };
})();
