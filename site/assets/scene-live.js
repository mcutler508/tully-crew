// Brings the pub painting to life. The picture is drawn through a WebGL
// shader that nudges small parts of it: each "mover" is an ellipse of the
// painting that slides, swings or flickers, solid in the middle and fading
// into the surroundings at the edge, so nothing tears. Offsets snap to whole
// pixels of the painting, so it stays crisp pixel art.
//
// While the song plays, the band and crowd move to its real beats
// (assets/beats.js); otherwise they idle. If WebGL isn't available (or the
// page is opened straight from disk, where browsers won't hand the image to
// WebGL), the plain picture stays and nothing breaks.

(() => {
  if (reduceMotion) return;
  const scene = document.getElementById('scene');
  const img = scene.querySelector('img');
  const W = 1672, H = 941;            // painting size; every coordinate below is in its pixels
  const N = 64;                       // most movers the shader takes

  /* ---------- the movers ---------- */
  // kind 0: slide by (x, y)   1: slide + spread from the centre by z (claps)
  // kind 2: swing like a pendulum: x = angle, y = pivot height   3: fire
  const movers = [];
  const add = (kind, cx, cy, rx, ry, core, fn) => movers.push({ kind, a: [cx, cy, rx, ry], core, fn });
  const TAU = Math.PI * 2;
  const fr = x => x - Math.floor(x);
  const hit = (ph, k = 6) => Math.exp(-k * fr(ph));            // sharp on the beat, then eases off
  const swing = (ph) => Math.sin(Math.PI * ph);                // one side per beat

  // s: { t seconds, b beat count (fractional), p 0 idle .. 1 song playing, e loudness 0..1 }
  const band = (x, headY, strum, opts = {}) => {
    const { sway = 0, nod = 1.4, strumAmp = 2, strumRate = 2, phase = 0, body = true } = opts;
    // whole body: a little knee bounce on the beat (feet stay planted), or a sway
    if (body) add(0, x, headY + 30, 46, 105, .4, s => [
      sway * swing(s.b / 2 + phase) * (0.4 + s.p * s.e) + (1 - s.p) * .6 * Math.sin(s.t * .9 + x),
      s.p * (0.4 + s.e) * 1.1 * hit(s.b + phase, 5)]);
    // head nod
    add(0, x, headY, 24, 26, .5, s => [0, (s.p * (0.5 + s.e) * nod) * hit(s.b + phase, 5) + (1 - s.p) * .5 * (Math.sin(s.t * 1.3 + x) > .6 ? 1 : 0)]);
    // picking / strumming hand
    if (strum) add(0, strum[0], strum[1], 15, 14, .45, s => {
      const a = s.p * strumAmp * (0.5 + s.e);
      return [0, a * Math.sin(TAU * s.b * strumRate) + (1 - s.p) * .6 * Math.sin(s.t * 2.2 + x)];
    });
  };
  band(625, 318, [592, 392], { strumAmp: 1.2, strumRate: 2, nod: 1.6 });          // bass
  band(747, 320, [720, 392], { strumAmp: 1.4, strumRate: 4, phase: .1 });          // mandolin
  band(862, 325, [828, 392], { strumAmp: 1.8, strumRate: 2 });                     // guitar
  band(1020, 330, null, { nod: 2, body: false });                                  // drums (the kit stays put)
  band(1170, 318, [1148, 390], { strumAmp: 1.8, strumRate: 2, phase: .05 });       // guitar
  band(1315, 330, null, { sway: 1.6, nod: .8 });                                   // tin whistle
  band(1427, 330, null, { sway: 1.2, nod: .9, phase: .5 });                        // fiddle

  // drummer: right stick on every beat, left stick on the backbeat, cymbal shiver
  add(0, 1047, 392, 14, 14, .4, s => [0, s.p * (3 * swing(fr(s.b) * .999) * -1)]);
  add(0, 972, 356, 13, 28, .35, s => [0, s.p * -3.5 * swing(fr((s.b + 1) / 2) * .999)]);
  add(0, 958, 393, 28, 8, .4, s => [0, s.p * 1.2 * hit((s.b + 1) / 2, 3) * Math.sin(s.t * 40)]);
  // whistle fingers
  add(0, 1318, 378, 12, 20, .4, s => [s.p * .8 * Math.sign(Math.sin(s.t * 11.3) + Math.sin(s.t * 7.1)), 0]);
  // fiddle bow: slide along its own line, so only the bow (and bowing hand) move
  const bowDir = [0.52, -0.85];
  [[1433, 391, 13], [1442, 375, 8], [1451, 360, 7], [1460, 345, 7], [1469, 330, 7], [1478, 315, 7]].forEach(([x, y, r]) =>
    add(0, x, y, r, r, .35, s => {
      const d = (s.p * 5 * (0.5 + s.e) + (1 - s.p) * 1.5) * Math.sin(Math.PI * (s.p ? s.b : s.t * .8));
      return [bowDir[0] * d, bowDir[1] * d];
    }));

  // the crowd: heads nod (not everyone on the same beat), some clap, some drink
  [[410, 595, 0], [545, 570, .5], [730, 635, 0], [65, 695, .25], [947, 625, .5], [1290, 580, 0], [1560, 615, .25], [1645, 585, .5]]
    .forEach(([x, y, ph], i) => add(0, x, y, 30, 30, .5, s => [
      (0.5 + s.p * .6) * Math.sin(s.t * (0.7 + i * .07) + i),
      s.p * (0.4 + s.e) * 1.3 * hit(s.b + ph, 4)]));
  // clapping hands: they spread between beats and meet on the beat
  [[610, 600, 20, 22], [785, 685, 18, 20], [1505, 655, 22, 20]].forEach(([x, y, rx, ry]) =>
    add(1, x, y, rx, ry, .45, s => [0, s.p * hit(s.b, 8) * 1.5, s.p * s.e > .05 ? .16 * swing(fr(s.b)) * s.p : 0]));
  // a raised pint now and then
  const cheers = (t, every, at) => { const k = fr((t + at) / every) * every; return k < 1.6 ? Math.sin(Math.PI * k / 1.6) : 0; };
  add(0, 1215, 635, 22, 26, .4, s => [0, -5 * cheers(s.t, 9, 0)]);
  add(0, 150, 755, 24, 30, .4, s => [0, -4 * cheers(s.t, 11, 5)]);

  // the barman, polishing a glass
  add(0, 147, 340, 30, 32, .5, s => [.6 * Math.sin(s.t * .7), s.p * .9 * hit(s.b, 4)]);
  add(0, 183, 410, 26, 24, .45, s => [1.6 * Math.cos(s.t * 2.4), 1.1 * Math.sin(s.t * 2.4)]);

  // lanterns swing gently from their chains: [x, pivot y, lantern centre y, radius]
  [[105, 22, 183, 38], [250, 65, 230, 30], [335, 95, 260, 25], [390, 105, 290, 18], [447, 120, 250, 28],
   [675, 90, 170, 18], [807, 105, 192, 18], [852, 2, 80, 28], [1260, 30, 93, 35], [1171, 105, 190, 18], [1390, 55, 175, 20]]
    .forEach(([x, pivot, cy, r], i) => {
      const len = cy + r - pivot, amp = 2.4 / len, w = 2.6 + (i % 4) * .45;
      add(2, x, (pivot + cy + r) / 2, r + 8, (cy + r - pivot) / 2 + 6, .6, s => [amp * Math.sin(s.t * TAU / w + i * 1.7), pivot]);
    });
  // hanging ivy stirs in the warm air
  [[230, 15, 135, 26], [925, 0, 140, 46], [1045, 0, 85, 26], [1255, 140, 235, 40]].forEach(([x, top, bot, rx], i) => {
    const amp = 1.6 / (bot - top);
    add(2, x, (top + bot) / 2, rx, (bot - top) / 2 + 4, .5, s => [amp * Math.sin(s.t * .9 + i * 2.1) + amp * .4 * Math.sin(s.t * 2.3 + i), top]);
  });
  // the fire
  add(3, 1622, 425, 34, 42, .3, () => [0, 0, 1]);

  if (movers.length > N) throw new Error('too many movers');

  /* ---------- WebGL ---------- */
  const cv = document.createElement('canvas');
  cv.id = 'live';
  cv.width = W; cv.height = H;
  cv.setAttribute('aria-hidden', 'true');
  cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;opacity:0;transition:opacity .6s';
  const gl = cv.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: false });
  if (!gl || gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS) < N * 2 + 8) return;

  const vs = `attribute vec2 p; varying vec2 uv; void main(){ uv = vec2(p.x, -p.y) * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
  const fs = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
  #else
  precision mediump float;
  #endif
  varying vec2 uv;
  uniform sampler2D tex;
  uniform vec2 res;
  uniform float time;
  uniform int count;
  uniform vec4 A[${N}];   // centre xy, radius xy
  uniform vec4 B[${N}];   // per-frame values; w = kind + core/2
  void main(){
    vec2 p = uv * res;
    vec2 off = vec2(0.);
    for (int i = 0; i < ${N}; i++) {
      if (i >= count) break;
      vec4 a = A[i];
      vec2 q = (p - a.xy) / a.zw;
      float d = dot(q, q);
      if (d >= 1.) continue;
      vec4 b = B[i];
      float kind = floor(b.w);
      float w = 1. - smoothstep(fract(b.w) * 2., 1., sqrt(d));
      if (kind < .5) off += b.xy * w;
      else if (kind < 1.5) off += (b.xy + (p - a.xy) * b.z) * w;
      else if (kind < 2.5) off.x += b.x * (p.y - b.y) * w;
      else {
        float h = clamp((a.y + a.w - p.y) / (2. * a.w), 0., 1.);
        vec2 n = vec2(sin(p.y * .35 - time * 9. + sin(p.x * .2 + time * 3.)) * 1.6,
                      -abs(sin(p.x * .3 + time * 7.)) * 2.4 - 1.);
        off += n * h * w * b.z;
      }
    }
    gl_FragColor = texture2D(tex, (floor(p - off) + .5) / res);
  }`;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (e) { console.warn('Live scene off:', e); return; }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = n => gl.getUniformLocation(prog, n);
  gl.uniform2f(U('res'), W, H);
  gl.uniform1i(U('count'), movers.length);
  const Aarr = new Float32Array(N * 4), Barr = new Float32Array(N * 4);
  movers.forEach((m, i) => Aarr.set(m.a, i * 4));
  gl.uniform4fv(U('A[0]'), Aarr);
  const uB = U('B[0]'), uTime = U('time');
  gl.viewport(0, 0, W, H);

  /* ---------- the song's beat ---------- */
  const map = window.TULLY_BEATS;
  const beats = map ? map.beats : [];
  let bi = 0;
  const beatAt = t => {                       // fractional beat count at song time t
    if (beats.length < 2) return t * 1.8;
    if (bi >= beats.length - 1 || beats[bi] > t) bi = 0;
    while (bi < beats.length - 2 && beats[bi + 1] <= t) bi++;
    const a = beats[bi], b = beats[bi + 1];
    return t < a ? t / a - 1 : bi + Math.min(1, (t - a) / (b - a));
  };
  const loudAt = t => { if (!map) return .6; const c = map.env.charCodeAt(Math.min(map.env.length - 1, Math.floor(t * map.envRate))) - 48; return c / 9; };

  /* ---------- run ---------- */
  let play = 0, loud = 0, idleBeat = 0, last = 0, lastFrame = 0, ready = false;
  const frame = now => {
    requestAnimationFrame(frame);
    if (!ready || paused || !heroVisible || document.hidden) { last = now; return; }
    if (now - lastFrame < 32) return;         // ~30fps is plenty for pixel art
    lastFrame = now;
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    const on = !music.paused;
    play += ((on ? 1 : 0) - play) * Math.min(1, dt * 3);
    loud += ((on ? loudAt(music.currentTime) : 0) - loud) * Math.min(1, dt * 6);
    idleBeat += dt * 1.5;
    const t = now / 1000;
    const s = { t, b: on ? beatAt(music.currentTime) : idleBeat, p: play < .01 ? 0 : play, e: loud };
    movers.forEach((m, i) => {
      const v = m.fn(s);
      Barr[i * 4] = v[0] || 0; Barr[i * 4 + 1] = v[1] || 0; Barr[i * 4 + 2] = v[2] || 0;
      Barr[i * 4 + 3] = m.kind + m.core / 2;
    });
    gl.uniform4fv(uB, Barr);
    gl.uniform1f(uTime, t);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  const pic = new Image();
  pic.onload = () => {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pic); }
    catch (e) { console.info('Live scene needs the page served over http(s); showing the still picture.'); return; }
    img.closest('picture').after(cv);
    ready = true;
    requestAnimationFrame(t => { last = t; frame(t); requestAnimationFrame(() => cv.style.opacity = 1); });
  };
  pic.src = img.currentSrc || img.src;
})();
