/**
 * Load looper from the same jsDelivr commit as pionier-core (832690dc).
 * Same-origin module graph => shared audio-core singleton => non-empty recordings.
 * Local UI stamps still come from pionier-app / shell.
 */
export * from 'https://cdn.jsdelivr.net/gh/ivarkarm-web/ivarkarm-web.github.io@832690dc/handpan-app/js/looper.js';
