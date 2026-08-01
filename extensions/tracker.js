/*
 * RevolutBank funnel — Purchase tracking.
 *
 * The rest of the funnel calls `window.trackPurchase(...)` (guarded with
 * `if (window.trackPurchase)`) from every upsell's payment-confirmation flow
 * and from 9.html. This file is what makes that call real: it fires the
 * Meta Pixel Purchase event client-side and relays the same event, with the
 * same event_id, to /api/capi so Meta's Conversions API gets a deduped
 * server-side copy (better match quality, survives ad blockers).
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

  // Best-effort step label so trackPurchase() has something to fall back to
  // when a call site doesn't pass its own content_id/content_name.
  window.getFunnelStepParams = window.getFunnelStepParams || function () {
    var page = document.title || 'RevolutBank';
    return { content_id: 'revolutbank-step', content_name: page };
  };

  window.trackPurchase = function (params) {
    params = params || {};
    var value = Number(params.value) || 0;
    var currency = params.currency || 'EUR';
    var contentId = params.content_id || 'revolutbank-purchase';
    var contentName = params.content_name || 'RevolutBank';
    var eventId = params.transactionId || ('purchase_' + Date.now());

    if (typeof fbq === 'function') {
      fbq('track', 'Purchase', {
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
          event_name: 'Purchase',
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
})();
