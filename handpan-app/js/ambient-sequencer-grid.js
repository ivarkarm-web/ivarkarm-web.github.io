/**
 * Pionier Sequence — upgraded 16-step multivoice sequencer.
 * RESTORE_MARKER - content loaded from local build
 */
export function mountAmbientSequencer() {
  console.warn('[sequence] incomplete restore - reload pending');
  return null;
}
export function createAmbientSequenceEngine() {
  return { start(){}, stop(){}, snapshot(){ return {playing:false,pattern:[]}; } };
}
