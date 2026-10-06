const atBeats = (targets, spacing = 1) => targets.map((target, index) => ({ at: index * spacing, targets: Array.isArray(target) ? target : [target] }));
const pattern = (entries) => entries.map(([at, targets]) => ({ at, targets: Array.isArray(targets) ? targets : [targets] }));

export const LESSONS = [
  { id:'first-touch', level:1, levelName:'First Notes', name:'First Touch', description:'Meet five notes one at a time.', bpm:64, steps:atBeats([0,1,2,3,2,1,0]) },
  { id:'home-away', level:1, levelName:'First Notes', name:'Home & Away', description:'Return to the home note between small steps.', bpm:66, steps:atBeats([0,1,0,2,0,3,0]) },
  { id:'small-arc', level:1, levelName:'First Notes', name:'Small Arc', description:'Trace a gentle rise and fall across the centre.', bpm:68, steps:atBeats([0,2,1,3,2,4,3,2]) },
  { id:'five-tone-path', level:1, levelName:'First Notes', name:'Five-Tone Path', description:'Walk up five notes, then return.', bpm:70, steps:atBeats([0,1,2,3,4,3,2,1,0]) },
  { id:'steady-pulse', level:2, levelName:'Rhythms', name:'Steady Pulse', description:'Keep an even eighth-note pulse.', bpm:72, steps:atBeats([0,0,1,1,2,2,3,3], 0.5) },
  { id:'offbeat-steps', level:2, levelName:'Rhythms', name:'Offbeat Steps', description:'Leave space before the next note lands.', bpm:74, steps:pattern([[0,0],[0.5,1],[1.5,2],[2,1],[3,3],[3.5,2]]) },
  { id:'two-bar-echo', level:2, levelName:'Rhythms', name:'Two-Bar Echo', description:'Repeat a rhythm while changing its notes.', bpm:76, steps:pattern([[0,0],[0.5,2],[1,1],[1.5,3],[2.5,0],[3,2],[3.5,1],[4.5,0],[5,2],[5.5,1],[6.5,3],[7,2]]) },
  { id:'three-and-one', level:2, levelName:'Rhythms', name:'Three & One', description:'Feel three quick notes followed by a held space.', bpm:78, steps:pattern([[0,0],[0.5,1],[1,2],[2.5,1],[3,3],[3.5,2],[4.5,1],[5,0],[6.5,2]]) },
  { id:'open-fifths', level:3, levelName:'Phrases & Chords', name:'Open Fifths', description:'Play simple two-note shapes with a steady pulse.', bpm:74, steps:pattern([[0,[0,2]],[1,[1,3]],[2,[2,4]],[3,[1,3]],[4,[0,2]],[5,[2,4]]]) },
  { id:'bell-and-body', level:3, levelName:'Phrases & Chords', name:'Bell & Body', description:'Alternate single notes with small chord answers.', bpm:76, steps:pattern([[0,0],[1,[1,3]],[2,2],[3,[0,2]],[4,3],[5,[2,4]],[6,1],[7,[0,3]]]) },
  { id:'split-chords', level:3, levelName:'Phrases & Chords', name:'Split Chords', description:'Move between low and high paired shapes.', bpm:78, steps:pattern([[0,[0,3]],[1.5,4],[2,[1,4]],[3.5,2],[4,[0,4]],[5.5,3],[6,[1,3]]]) },
  { id:'flowing-pair', level:3, levelName:'Phrases & Chords', name:'Flowing Pair', description:'Let a two-note shape resolve into a short phrase.', bpm:80, steps:pattern([[0,[0,2]],[1,1],[1.5,3],[2,[1,3]],[3,2],[3.5,4],[4,[2,4]],[5,1],[5.5,2],[6,[0,2]]]) },
  { id:'dawn-path', level:4, levelName:'Short Pieces', name:'Dawn Path', description:'A complete original phrase with space and return.', bpm:72, steps:pattern([[0,0],[1,1],[2,[2,4]],[3,1],[4,3],[5,2],[6,[1,3]],[7,0],[8,2],[9,3],[10,[2,4]],[11,1],[12,0]]) },
  { id:'river-turn', level:4, levelName:'Short Pieces', name:'River Turn', description:'A longer flowing study with two contrasting halves.', bpm:78, steps:pattern([[0,0],[0.5,1],[1,2],[1.5,3],[2,[1,3]],[3,4],[4,3],[4.5,2],[5,1],[5.5,0],[6,[0,2]],[7,1],[8,2],[8.5,3],[9,[2,4]],[10,3],[11,1],[12,0]]) },
  { id:'golden-spiral', level:4, levelName:'Short Pieces', name:'Golden Spiral', description:'Circle through the scale with repeating inner shapes.', bpm:82, steps:pattern([[0,[0,2]],[1,1],[1.5,3],[2,2],[3,[1,4]],[4,3],[4.5,2],[5,1],[6,[0,3]],[7,2],[7.5,4],[8,3],[9,[1,3]],[10,2],[10.5,1],[11,0],[12,[0,2]]]) },
  { id:'open-circle', level:4, levelName:'Short Pieces', name:'Open Circle', description:'A final original study that resolves back to home.', bpm:84, steps:pattern([[0,0],[1,2],[2,[1,3]],[3,4],[4,3],[4.5,2],[5,1],[6,[0,2]],[7,3],[8,4],[9,[2,4]],[10,3],[10.5,1],[11,2],[12,[0,3]],[13,1],[14,0]]) }
];

export function lessonsByLevel(level) { return LESSONS.filter((lesson) => lesson.level === level); }
