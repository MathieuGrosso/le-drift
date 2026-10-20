export const GAMEPLAY_CSS = `
.gp-root {
  --gp-serif: 'Fraunces', 'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif;
  --gp-hand: 'Caveat', 'Bradley Hand', 'Segoe Print', 'Snell Roundhand', cursive;
  --gp-ui: ui-rounded, 'SF Pro Rounded', 'Nunito', system-ui, sans-serif;
  --gp-texte: #f6f2e8;
  --gp-accent: #e8674a;
  --gp-souffle: #9ee6c9;
  --gp-souffle-bas: #f2c14e;
  --gp-abysse: #0e3b52;
  --gp-profond: #1b5e73;
  --gp-milieu: #3a8c98;
  --gp-clair: #7cc6bf;
  --gp-plafond: #cfefe3;
  --gp-papier: #efe3c4;
  --gp-encre: #4a3b2c;
  position: fixed; inset: 0; pointer-events: none !important;
  font-family: var(--gp-ui); color: var(--gp-texte);
  -webkit-font-smoothing: antialiased;
}
.gp-root * { box-sizing: border-box; }
.gp-root .gp-interactive { pointer-events: auto; }
.gp-hidden { opacity: 0 !important; pointer-events: none !important; }

.gp-hud { position: absolute; inset: 0; transition: opacity .6s ease; }
.gp-wheel { position: absolute; width: 64px; height: 64px; margin: -32px 0 0 -32px; transition: opacity .8s ease; opacity: 0; filter: drop-shadow(0 2px 6px rgba(14,59,82,.45)); }
.gp-wheel.show { opacity: 1; }
.gp-wheel.exhausted { animation: gp-pulse .7s ease-in-out infinite; }
@keyframes gp-pulse { 50% { transform: scale(1.12); } }

.gp-prompt { position: absolute; left: 50%; bottom: 13%; transform: translateX(-50%) translateY(6px); display: flex; align-items: center; gap: 10px;
  padding: 8px 18px 8px 8px; border-radius: 999px; background: linear-gradient(180deg, rgba(14,59,82,.62), rgba(14,59,82,.48));
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); font-size: 18px; letter-spacing: .01em; opacity: 0; transition: opacity .25s, transform .25s; }
.gp-prompt.show { opacity: 1; transform: translateX(-50%); }
.gp-key { min-width: 30px; height: 30px; padding: 0 8px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center;
  background: var(--gp-texte); color: var(--gp-abysse); font-weight: 800; font-size: 15px; box-shadow: 0 2px 0 rgba(14,59,82,.5); }
.gp-keywrap { position: relative; display: inline-flex; }
.gp-prompt svg { position: absolute; left: -5px; top: -5px; width: 40px; height: 40px; pointer-events: none; }
.gp-prompt.hold { padding-left: 16px; }
.gp-hold { font-size: 13px; letter-spacing: .12em; text-transform: uppercase; opacity: .8; }

.gp-toast { position: absolute; top: 26px; left: 30px; max-width: 46vw; display: flex; flex-direction: column; gap: 3px; opacity: 0; transform: translateX(-10px); transition: opacity .6s, transform .6s; }
.gp-toast.show { opacity: 1; transform: none; }
.gp-toast .k { font-size: 12px; letter-spacing: .22em; text-transform: uppercase; color: var(--gp-souffle); font-weight: 700; }
.gp-toast .t { font-family: var(--gp-serif); font-size: 22px; text-shadow: 0 2px 14px rgba(14,59,82,.6); }

.gp-tip { position: absolute; left: 50%; bottom: 22%; transform: translateX(-50%); padding: 8px 16px; border-radius: 12px; font-size: 15px;
  background: rgba(14,59,82,.42); opacity: 0; transition: opacity .6s; white-space: nowrap; }
.gp-tip.show { opacity: .95; }
.gp-waypoint { position: absolute; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; gap: 4px; opacity: 0; transition: opacity .6s; pointer-events: none; }
.gp-waypoint.show { opacity: 1; }
.gp-waypoint .mark { width: 14px; height: 14px; transform: rotate(45deg); border: 2px solid var(--gp-souffle); background: rgba(14,59,82,.55); box-shadow: 0 0 12px rgba(158,230,201,.7); }
.gp-waypoint .l { padding: 2px 10px; border-radius: 999px; font-size: 13px; background: rgba(14,59,82,.5); white-space: nowrap; }
.gp-tip .gp-key { min-width: 24px; height: 24px; margin: 0 2px; font-size: 13px; vertical-align: middle; }

.gp-place { position: absolute; left: 0; right: 0; top: 30%; text-align: center; opacity: 0; transition: opacity 1s ease; }
.gp-place.show { opacity: 1; }
.gp-place .t { font-family: var(--gp-serif); font-size: clamp(34px, 4.4vw, 58px); font-weight: 500; letter-spacing: .03em; text-shadow: 0 3px 24px rgba(14,59,82,.55); }
.gp-place .rule { width: 220px; height: 1px; margin: 10px auto; background: linear-gradient(90deg, transparent, rgba(246,242,232,.85), transparent); }
.gp-place .s { font-size: 15px; letter-spacing: .3em; text-transform: uppercase; opacity: .85; }

.gp-br { position: absolute; right: 26px; bottom: 24px; display: flex; align-items: flex-end; gap: 12px; transition: opacity .6s; }
.gp-br .info { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; font-size: 13px; letter-spacing: .04em; text-shadow: 0 1px 8px rgba(14,59,82,.7); }
.gp-br .row { display: flex; align-items: center; gap: 6px; }
.gp-mini { width: 150px; height: 150px; border-radius: 50%; overflow: hidden; border: 2px solid rgba(239,227,196,.85); box-shadow: 0 4px 22px rgba(14,59,82,.45); }
.gp-mini canvas { width: 100%; height: 100%; display: block; }

.gp-nacres { position: absolute; top: 96px; left: 30px; display: flex; gap: 6px; opacity: 0; transition: opacity .8s; }
.gp-nacres.show { opacity: 1; }
.gp-nacre { width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid rgba(246,242,232,.8); }
.gp-nacre.on { background: radial-gradient(circle at 35% 35%, #fff, #dfe9ff 40%, #b6a8ff 80%); box-shadow: 0 0 12px rgba(182,168,255,.8); }
.gp-buffs { position: absolute; left: 30px; bottom: 26px; display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
.gp-buff { padding: 4px 10px; border-radius: 999px; background: rgba(14,59,82,.45); }

.gp-dialogue { position: absolute; left: 50%; bottom: 6%; width: min(820px, 88vw); transform: translateX(-50%) translateY(14px); opacity: 0; transition: opacity .35s, transform .35s; }
.gp-dialogue.show { opacity: 1; transform: translateX(-50%); }
.gp-dialogue .box { position: relative; padding: 24px 32px 26px; border-radius: 22px; min-height: 110px;
  background: linear-gradient(180deg, rgba(14,59,82,.78), rgba(10,40,60,.86)); border: 1px solid rgba(207,239,227,.25);
  box-shadow: 0 18px 50px rgba(6,24,38,.45), inset 0 1px 0 rgba(255,255,255,.08); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
.gp-dialogue .name { position: absolute; top: -16px; left: 26px; padding: 5px 16px; border-radius: 999px; background: var(--gp-accent); color: #fff8ee;
  font-weight: 700; font-size: 15px; letter-spacing: .05em; box-shadow: 0 4px 14px rgba(232,103,74,.4); }
.gp-dialogue .text { font-size: 21px; line-height: 1.55; min-height: 2.6em; }
.gp-dialogue .next { position: absolute; right: 22px; bottom: 14px; width: 0; height: 0; border-left: 7px solid transparent; border-right: 7px solid transparent;
  border-top: 9px solid var(--gp-souffle); opacity: 0; animation: gp-bob 1s ease-in-out infinite; }
.gp-dialogue .next.show { opacity: 1; }
@keyframes gp-bob { 50% { transform: translateY(4px); } }
.gp-dialogue.narration .box { background: none; border: none; box-shadow: none; backdrop-filter: none; -webkit-backdrop-filter: none; text-align: center; }
.gp-dialogue.narration .text { font-family: var(--gp-serif); font-style: italic; font-size: 24px; text-shadow: 0 2px 18px rgba(6,24,38,.9), 0 0 2px rgba(6,24,38,.6); }
.gp-dialogue.narration .name { display: none; }

.gp-menu { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: auto;
  background: radial-gradient(ellipse at 50% 30%, rgba(27,94,115,.55), rgba(8,30,46,.82)); animation: gp-in .35s ease; }
@keyframes gp-in { from { opacity: 0; } }
.gp-panel { width: min(760px, 92vw); max-height: 86vh; overflow: auto; padding: 34px 40px; border-radius: 26px;
  background: linear-gradient(180deg, rgba(246,242,232,.97), rgba(236,226,200,.97)); color: #2c3a46; box-shadow: 0 30px 80px rgba(4,18,30,.5); }
.gp-panel h2 { margin: 0 0 4px; font-family: var(--gp-serif); font-weight: 600; font-size: 36px; color: var(--gp-abysse); }
.gp-panel .sub { margin: 0 0 22px; font-size: 14px; letter-spacing: .08em; color: #6b7a82; }
.gp-btn { font: inherit; font-size: 18px; padding: 12px 22px; border-radius: 14px; border: 1px solid rgba(14,59,82,.18); cursor: pointer;
  background: rgba(14,59,82,.06); color: var(--gp-abysse); transition: background .2s, transform .15s; text-align: left; }
.gp-btn:hover, .gp-btn:focus-visible { background: rgba(232,103,74,.14); outline: none; transform: translateX(3px); }
.gp-btn.primary { background: var(--gp-accent); color: #fff8ee; border-color: transparent; text-align: center; }
.gp-btn.primary:hover { background: #d95a3e; transform: none; }
.gp-btn:disabled { opacity: .4; cursor: default; transform: none; }
.gp-menu-aide { position: absolute; left: 0; right: 0; bottom: 4vh; text-align: center; font-size: 14px; letter-spacing: .06em; color: var(--gp-texte); opacity: .85; pointer-events: none; }
.gp-menu-aide .gp-key { min-width: 24px; height: 24px; margin: 0 4px; font-size: 13px; vertical-align: middle; }
.gp-menu :is(.gp-btn, .gp-tab, .gp-card.pick, .gp-slot.full, input):focus { outline: 3px solid var(--gp-abysse); outline-offset: 3px; }
.gp-stack { display: flex; flex-direction: column; gap: 10px; }
.gp-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.gp-objective { margin: 0 0 20px; padding: 12px 16px; border-left: 3px solid var(--gp-accent); background: rgba(232,103,74,.07); border-radius: 0 12px 12px 0; }
.gp-objective .k { font-size: 12px; letter-spacing: .2em; text-transform: uppercase; color: #8a6a5a; }
.gp-objective .t { font-family: var(--gp-serif); font-size: 20px; color: var(--gp-abysse); }
.gp-setting { display: flex; justify-content: space-between; align-items: center; gap: 20px; padding: 10px 0; border-bottom: 1px solid rgba(14,59,82,.1); font-size: 17px; }
.gp-setting input[type=range] { width: 200px; accent-color: var(--gp-accent); }
.gp-setting input[type=checkbox] { width: 22px; height: 22px; accent-color: var(--gp-accent); }
.gp-controls { display: grid; grid-template-columns: 1fr auto; gap: 8px 24px; font-size: 16px; }
.gp-controls .gp-key { background: var(--gp-abysse); color: var(--gp-texte); }

.gp-tabs { display: flex; gap: 6px; margin-bottom: 18px; border-bottom: 1px solid rgba(14,59,82,.12); }
.gp-tab { font: inherit; font-size: 16px; padding: 10px 16px; border: none; background: none; color: #6b7a82; cursor: pointer; border-bottom: 3px solid transparent; margin-bottom: -1px; }
.gp-tab.on { color: var(--gp-abysse); border-bottom-color: var(--gp-accent); font-weight: 700; }
.gp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.gp-card { padding: 14px 16px; border-radius: 16px; background: rgba(255,255,255,.55); border: 1px solid rgba(14,59,82,.1); display: flex; flex-direction: column; gap: 6px; }
.gp-card .n { font-family: var(--gp-serif); font-size: 19px; color: var(--gp-abysse); display: flex; justify-content: space-between; gap: 8px; }
.gp-card .c { font-family: var(--gp-ui); font-weight: 700; color: var(--gp-accent); }
.gp-card .d { font-size: 14px; color: #55636b; line-height: 1.4; }
.gp-card .gp-btn { font-size: 14px; padding: 7px 12px; align-self: flex-start; }
.gp-card.pick { cursor: pointer; transition: transform .15s, background .2s; }
.gp-card.pick:hover { transform: translateY(-2px); background: rgba(232,103,74,.1); }
.gp-pot { display: flex; gap: 10px; margin: 6px 0 20px; }
.gp-slot { width: 74px; height: 74px; border-radius: 50%; border: 2px dashed rgba(14,59,82,.25); display: flex; align-items: center; justify-content: center;
  text-align: center; font-size: 12px; padding: 6px; color: var(--gp-abysse); background: rgba(255,255,255,.4); }
.gp-slot.full { border-style: solid; border-color: var(--gp-accent); background: rgba(232,103,74,.1); cursor: pointer; }
.gp-result { margin-top: 16px; font-family: var(--gp-serif); font-size: 22px; color: var(--gp-accent); min-height: 1.4em; }
.gp-note { font-size: 14px; color: #6b7a82; margin: 4px 0 14px; }
.gp-board { font-family: var(--gp-hand); font-size: 34px; line-height: 1.4; color: #f6f2e8; background: #2f4a44; padding: 26px 30px; border-radius: 12px;
  border: 10px solid #8a6a4a; box-shadow: inset 0 0 40px rgba(0,0,0,.35); }

.gp-chart { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: auto;
  background: radial-gradient(ellipse at 50% 40%, rgba(27,94,115,.5), rgba(6,24,38,.88)); animation: gp-in .4s ease; }
.gp-chart .sheet { position: relative; height: min(84vh, 60vw); aspect-ratio: 1; border-radius: 6px; box-shadow: 0 30px 90px rgba(0,0,0,.55); transform: rotate(-.6deg); }
.gp-chart canvas { position: absolute; inset: 0; width: 100%; height: 100%; border-radius: 6px; }
.gp-chart .side { position: absolute; right: 3vw; bottom: 5vh; display: flex; flex-direction: column; gap: 10px; align-items: stretch; width: min(240px, 17vw); }
.gp-chart .title { position: absolute; left: 3vw; top: 5vh; max-width: 17vw; font-family: var(--gp-serif); font-size: clamp(20px, 2.2vw, 32px); text-shadow: 0 2px 20px rgba(0,0,0,.5); }
.gp-chart .legend { position: absolute; left: 3vw; bottom: 5vh; max-width: 17vw; font-size: 14px; opacity: .85; line-height: 1.5; }
.gp-chart .gp-btn:not(.primary) { background: rgba(246,242,232,.92); }
.gp-chart.peek { background: none; pointer-events: none; }
.gp-chart.peek .sheet { height: min(64vh, 70vw); animation: gp-rise .8s cubic-bezier(.2,.8,.2,1); }
.gp-chart .sheet.plan { aspect-ratio: 1040 / 640; height: auto; width: min(66vw, 120vh); }
.gp-chart.peek .sheet:has(canvas[width="1040"]) { aspect-ratio: 1040 / 640; height: auto; width: min(64vw, 110vh); }
.gp-chart-tabs { position: absolute; top: 5vh; left: 50%; transform: translateX(-50%); border: 0; margin: 0; }
.gp-chart-tabs .gp-tab { background: rgba(246,242,232,.92); color: #4a3b2c; border-radius: 999px; padding: 6px 18px; }
.gp-chart-tabs .gp-tab.on { background: #4a3b2c; color: #efe3c4; }
.gp-counter { position: absolute; top: 26px; right: 30px; padding: 7px 16px; border-radius: 999px; font-size: 15px; letter-spacing: .04em;
  background: rgba(14,59,82,.42); border: 1px solid rgba(207,239,227,.35); opacity: 0; transition: opacity .5s; }
.gp-counter.show { opacity: 1; }
@keyframes gp-rise { from { transform: translateY(40px) rotate(-.6deg); opacity: 0; } }

.gp-fade { position: absolute; inset: 0; opacity: 0; pointer-events: none; transition-property: opacity; transition-timing-function: ease; }
.gp-card-act { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; opacity: 0; transition: opacity 1.2s ease; pointer-events: none; }
.gp-card-act.show { opacity: 1; }
.gp-card-act .t { font-family: var(--gp-serif); font-size: clamp(20px, 2vw, 26px); letter-spacing: .5em; text-transform: uppercase; opacity: .85; }
.gp-card-act .s { font-family: var(--gp-serif); font-size: clamp(48px, 7vw, 96px); font-weight: 500; margin-top: 6px; text-shadow: 0 4px 40px rgba(6,24,38,.6); }
.gp-card-act .s.long { font-size: clamp(26px, 3vw, 40px); font-style: italic; max-width: 70vw; text-align: center; }
.gp-narrate { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 0 12vw; pointer-events: auto;
  background: radial-gradient(ellipse at 50% 40%, rgba(14,59,82,.45), rgba(8,30,46,.78) 75%); transition: opacity .6s ease; }
.gp-narrate .p { font-family: var(--gp-serif); font-size: clamp(22px, 2.3vw, 32px); line-height: 1.55; text-align: center; max-width: 900px; opacity: 0; transition: opacity .45s ease; text-shadow: 0 2px 18px rgba(6,24,38,.9); }
.gp-narrate .p.show { opacity: 1; }
.gp-narrate .hint { position: absolute; bottom: 7vh; white-space: pre; font-size: 13px; letter-spacing: .25em; text-transform: uppercase; opacity: .55; }
.gp-credits { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center; color: var(--gp-abysse); pointer-events: none; }
.gp-credits .c { opacity: 0; transition: opacity 1.6s ease; position: absolute; }
.gp-credits .c.show { opacity: 1; }
.gp-credits .a { font-family: var(--gp-serif); font-size: clamp(36px, 5vw, 70px); }
.gp-credits .b { font-family: var(--gp-serif); font-style: italic; font-size: clamp(18px, 1.8vw, 24px); margin-top: 10px; opacity: .8; }

.gp-clap { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; padding-bottom: 12vh; gap: 18px; pointer-events: none; }
.gp-clap .verse { font-family: var(--gp-serif); font-size: clamp(26px, 3vw, 40px); text-shadow: 0 2px 20px rgba(6,24,38,.8); }
.gp-clap .verse span { opacity: .45; transition: opacity .15s, color .15s; }
.gp-clap .verse span.on { opacity: 1; color: #ffd9a0; }
.gp-clap .ring { position: relative; width: 120px; height: 120px; }
.gp-clap .ring div { position: absolute; left: 50%; top: 50%; border-radius: 50%; transform: translate(-50%, -50%); }
.gp-clap .target { width: 70px; height: 70px; border: 3px solid rgba(246,242,232,.85); }
.gp-clap .closing { border: 3px solid var(--gp-souffle); }
.gp-clap .flash { width: 70px; height: 70px; background: radial-gradient(circle, rgba(255,217,160,.95), rgba(255,217,160,0) 70%); opacity: 0; transition: opacity .25s; }
.gp-clap .flash.on { opacity: 1; transition: none; }
.gp-clap .help { font-size: 15px; opacity: .85; }
.gp-clap .score { font-size: 14px; letter-spacing: .2em; opacity: .7; }
`
