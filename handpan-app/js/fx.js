/**
 * DEPRECATED — legacy FxChain
 *
 * Replaced by js/fx-engine.js (FxEngine) with four modules × 10 algorithms
 * and Low/Mid/Bass/Master tone stage.
 *
 * Kept as an empty module so any stale dynamic import does not 404.
 * Do not add new code here.
 */
export class FxChain {
  constructor() {
    console.warn('[Pionier] FxChain is deprecated; use FxEngine from fx-engine.js');
  }
  seedDefaults() {}
  setValue() {}
  setBypass() {}
  setMaster() {}
  dispose() {}
}
export default FxChain;
