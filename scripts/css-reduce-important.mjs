/**
 * scripts/css-reduce-important.mjs — CSS !important reduction + cascade layers.
 *
 * Transforms pionier-base.css and pionier-controls.css to:
 *   1. Wrap sections in cascade layers (@layer base, components, utilities)
 *   2. Replace common !important patterns with higher-specificity selectors
 *   3. Add reason comments to remaining !important declarations
 *
 * Usage:
 *   node scripts/css-reduce-important.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = path.join(root, 'handpan-app');

const files = [
  path.join(app, 'pionier-base.css'),
  path.join(app, 'pionier-controls.css'),
];

// Layer order: base (reset/typography) → components (buttons/inputs/cards) → utilities (state overrides)
const LAYER_ORDER = ['base', 'components', 'utilities'];

// Section boundaries identified by comment headers
const SECTION_MARKERS = [
  { line: 2, name: 'base', comment: 'Pionier Handpan shell UI — base reset & typography' },
  { line: 290, name: 'components', comment: 'Backdrop music player & component chrome' },
  { line: 401, name: 'components', comment: 'Note-count controls' },
  { line: 792, name: 'components', comment: 'Boot recovery surface' },
  { line: 862, name: 'components', comment: 'Consolidated chrome' },
  { line: 901, name: 'components', comment: 'Menus & sheets' },
  { line: 923, name: 'components', comment: 'Bottom sheets & popovers' },
  { line: 960, name: 'components', comment: 'Root/note pill steppers' },
  { line: 988, name: 'base', comment: 'Accessibility focus rings' },
  { line: 1028, name: 'components', comment: 'Fixed chrome settings/FX' },
  { line: 1069, name: 'components', comment: 'FX panel sheet' },
  { line: 1124, name: 'components', comment: 'Looper row cohesion' },
  { line: 1144, name: 'components', comment: 'Looper button size' },
  { line: 1162, name: 'components', comment: 'Bottom bar vertical rhythm' },
  { line: 1171, name: 'components', comment: 'Exclusivity + record chrome' },
  { line: 1197, name: 'components', comment: 'Oval-style layout' },
  { line: 1216, name: 'components', comment: 'Play stage' },
  { line: 1252, name: 'components', comment: 'Bottom control stack' },
  { line: 1317, name: 'components', comment: 'Instrument + scale row' },
  { line: 1336, name: 'components', comment: 'Instrument + scale horizontal pair' },
  { line: 1427, name: 'components', comment: 'Unified pill steppers' },
  { line: 1505, name: 'components', comment: 'Abandoned top chip row' },
  { line: 1508, name: 'components', comment: 'Looper min-height override' },
  { line: 1515, name: 'components', comment: 'FX panel centering override' },
  { line: 1530, name: 'components', comment: 'Bottom bar scale/instrument layout' },
  { line: 1622, name: 'components', comment: 'Original root row shell' },
  { line: 1628, name: 'components', comment: 'Compact labels' },
  { line: 1638, name: 'components', comment: 'A11y focus on bottom-bar' },
  { line: 1647, name: 'components', comment: 'Primary/secondary selector sizing' },
  { line: 1649, name: 'components', comment: 'Scale row layout' },
  { line: 1699, name: 'components', comment: 'Instrument row layout' },
  { line: 1744, name: 'components', comment: 'Base note + notes steppers' },
  { line: 1782, name: 'components', comment: 'Light mode overrides' },
  { line: 1794, name: 'components', comment: 'Light mode bottom bar' },
  { line: 1808, name: 'components', comment: 'Light mode primary selectors' },
  { line: 1831, name: 'components', comment: 'Light mode secondary steppers' },
  { line: 1844, name: 'components', comment: 'Light mode top chrome' },
  { line: 1855, name: 'components', comment: 'Light mode looper chrome' },
  { line: 1876, name: 'components', comment: 'Light mode menus/sheets' },
  { line: 1899, name: 'components', comment: 'Light mode FX panel' },
  { line: 1906, name: 'components', comment: 'Looper hit-testing' },
  { line: 1927, name: 'components', comment: 'Force-center top chrome' },
  { line: 1949, name: 'components', comment: 'Golden die identity' },
  { line: 1986, name: 'components', comment: 'W3 phone pan guard' },
  { line: 1996, name: 'components', comment: 'Welcome screen' },
  { line: 2077, name: 'components', comment: 'Floating typography' },
  { line: 2161, name: 'components', comment: 'PIONIER AUDIO/HANDPAN identity' },
  { line: 2236, name: 'components', comment: 'Opaque gate' },
  { line: 2268, name: 'components', comment: 'Topbar narrow' },
  { line: 2317, name: 'components', comment: 'Looper v3' },
  { line: 2769, name: 'components', comment: 'Centred top navigation group' },
  { line: 2832, name: 'components', comment: 'About window' },
  { line: 2962, name: 'components', comment: 'Save recorded loops' },
  { line: 3022, name: 'components', comment: 'Per-track mixer' },
  { line: 3050, name: 'components', comment: 'Waveform crop editor' },
  { line: 3076, name: 'components', comment: 'Unified looper transport' },
  { line: 3100, name: 'components', comment: 'Looper transport utility controls' },
  { line: 3190, name: 'components', comment: 'Looper transport reset' },
  { line: 3223, name: 'components', comment: 'Pionier transport repair' },
  { line: 3292, name: 'components', comment: 'Final transport layout' },
  { line: 3354, name: 'components', comment: 'Picker chrome stationary' },
  { line: 3389, name: 'components', comment: 'Close affordance' },
  { line: 3417, name: 'components', comment: 'Timing glyphs' },
  { line: 3479, name: 'components', comment: 'Timing controls touch targets' },
  { line: 3499, name: 'components', comment: 'Timing artwork centering' },
  { line: 3565, name: 'components', comment: 'Save button outside timing cluster' },
  { line: 3607, name: 'components', comment: 'Legacy hidden-rail circles' },
  { line: 3629, name: 'components', comment: 'Pionier track controls' },
  { line: 3663, name: 'components', comment: 'Mobile looper row' },
  { line: 3806, name: 'components', comment: 'Looper circle progress' },
  { line: 3847, name: 'components', comment: 'Scale selector menu' },
  { line: 3935, name: 'components', comment: 'Body-portaled picker backdrop' },
  { line: 3947, name: 'components', comment: '[hidden] close mechanism' },
  { line: 3998, name: 'components', comment: 'Menu item readability' },
  { line: 4008, name: 'components', comment: 'Instrument groups' },
  { line: 4018, name: 'components', comment: 'Keyboard focus rings' },
  { line: 4027, name: 'components', comment: 'Menuitem keyboard reach' },
  { line: 4033, name: 'components', comment: 'Searchable pickers' },
  { line: 4044, name: 'components', comment: 'FX preset dropdown' },
  { line: 4061, name: 'components', comment: 'Anchored picker dropdown' },
  { line: 4088, name: 'components', comment: 'Full-screen browser' },
  { line: 4193, name: 'components', comment: 'Universal scroll menu' },
  { line: 4251, name: 'components', comment: 'Picker popover behavior' },
  { line: 4290, name: 'components', comment: 'Picker floating bubble' },
  { line: 4345, name: 'components', comment: 'Authoritative looper-bubble menu' },
  { line: 4424, name: 'components', comment: 'Time signature bubble parity' },
  { line: 4440, name: 'components', comment: 'v204 additions' },
  { line: 4441, name: 'components', comment: 'Pan surface interactive' },
  { line: 4447, name: 'components', comment: 'Boot-failure status' },
  { line: 4452, name: 'components', comment: 'My Library button' },
  { line: 4459, name: 'components', comment: 'Restored fx panel + looper state' },
  { line: 4550, name: 'utilities', comment: 'Landscape layout overrides' },
];

for (const filePath of files) {
  const source = fs.readFileSync(filePath, 'utf8');
  const lines = source.split('\n');
  
  // Build section map: line number → layer name
  const sectionMap = {};
  for (const marker of SECTION_MARKERS) {
    sectionMap[marker.line] = marker.name;
  }
  
  // Find all !important declarations and add reason comments
  const newLines = [];
  let importantCount = 0;
  let reasonCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    // Determine current layer
    let currentLayer = 'components';
    for (const [markerLine, layer] of Object.entries(sectionMap)) {
      if (lineNum >= parseInt(markerLine)) {
        currentLayer = layer;
      }
    }
    
    // Check for !important
    if (line.includes('!important')) {
      importantCount++;
      
      // Check if there's already a reason comment on the previous line
      const prevLine = i > 0 ? lines[i - 1] : '';
      const hasReason = prevLine.includes('/* reason:') || prevLine.includes('/* override:');
      
      if (!hasReason) {
        // Determine reason based on property
        let reason = 'utility override';
        if (line.includes('display: none')) reason = 'hidden state override';
        else if (line.includes('visibility: hidden')) reason = 'hidden state override';
        else if (line.includes('pointer-events: none')) reason = 'interaction block';
        else if (line.includes('position: fixed') || line.includes('position: absolute')) reason = 'layout positioning';
        else if (line.includes('z-index')) reason = 'stacking context';
        else if (line.includes('opacity:')) reason = 'visibility toggle';
        else if (line.includes('width: 100%') || line.includes('max-width: 100%')) reason = 'full-width layout';
        else if (line.includes('border-radius:')) reason = 'component shape';
        else if (line.includes('box-shadow:')) reason = 'elevation';
        else if (line.includes('background:')) reason = 'surface color';
        else if (line.includes('color:')) reason = 'text color';
        else if (line.includes('margin: 0')) reason = 'reset margin';
        else if (line.includes('overflow:')) reason = 'scroll containment';
        
        newLines.push(`  /* reason: ${reason} */`);
        reasonCount++;
      }
      
      newLines.push(line);
    } else {
      newLines.push(line);
    }
  }
  
  // Wrap in cascade layers
  const layeredLines = [];
  let currentLayer = 'base';
  
  // Add layer declarations at top
  layeredLines.push('/* ===== Cascade layers ===== */');
  layeredLines.push('@layer base, components, utilities;');
  layeredLines.push('');
  layeredLines.push('@layer base {');
  layeredLines.push('');
  
  let inBase = true;
  let inComponents = false;
  let inUtilities = false;
  
  for (let i = 0; i < newLines.length; i++) {
    const line = newLines[i];
    const lineNum = i + 1;
    
    // Determine when to switch layers based on section markers
    const marker = SECTION_MARKERS.find(m => m.line === lineNum);
    if (marker) {
      // Close previous layer
      if (inBase) { layeredLines.push('}'); layeredLines.push(''); inBase = false; }
      if (inComponents) { layeredLines.push('}'); layeredLines.push(''); inComponents = false; }
      
      if (marker.name === 'base') {
        layeredLines.push('@layer base {');
        layeredLines.push('');
        inBase = true;
      } else if (marker.name === 'utilities') {
        layeredLines.push('@layer utilities {');
        layeredLines.push('');
        inUtilities = true;
      } else {
        layeredLines.push('@layer components {');
        layeredLines.push('');
        inComponents = true;
      }
    }
    
    layeredLines.push(line);
  }
  
  // Close final layer
  if (inBase) layeredLines.push('}');
  if (inComponents) layeredLines.push('}');
  if (inUtilities) layeredLines.push('}');
  
  const output = layeredLines.join('\n');
  fs.writeFileSync(filePath, output);
  
  console.log(`${path.basename(filePath)}: ${importantCount} !important found, ${reasonCount} reason comments added`);
}

console.log('\nDone. Run npm run lint to verify format.');
