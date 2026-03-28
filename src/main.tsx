// HC Gateway: Critical fix for "Cannot set property fetch of #<Window> which has only a getter"
// This occurs when libraries like magic-sdk or cross-fetch try to polyfill fetch
// in environments where window.fetch is a read-only getter.
// This MUST run before any other imports that might use fetch.
(function() {
  if (typeof window === 'undefined') return;
  try {
    var _fetch = window.fetch;
    Object.defineProperty(window, 'fetch', {
      get: function() { return _fetch; },
      set: function(v) { _fetch = v; },
      configurable: true,
      enumerable: true
    });
  } catch (e) {
    console.warn('HC Gateway: Early fetch fix failed in main.tsx', e);
  }
})();

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
