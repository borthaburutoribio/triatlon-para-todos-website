/* Zona de atletas · Triatlón Para Todos
   El contenido está cifrado con la clave de cada atleta (ver _build/atletas.mjs):
   sin usuario y clave no se puede leer nada, aunque el archivo esté publicado.
   Muro, reacciones y "voy" se guardan hoy en el navegador de cada uno; con base de datos
   pasan a verse entre todos (se conecta en save()). */
(() => {
  const enc = new TextEncoder(), dec = new TextDecoder();
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const views = { login: $('[data-view="login"]'), dash: $('[data-view="dash"]') };
  const SESSION = 'tpt:sesion';
  const DEMO = { usuario: 'prueba', clave: 'tpt-ejemplo-2027' }; // usuario de muestra, público a propósito
  const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }
  };
  const num = (el) => +el.value || 0;

  async function fileId(usuario) {
    const h = await crypto.subtle.digest('SHA-256', enc.encode('tpt:' + usuario.trim().toLowerCase()));
    return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
  }
  async function open(usuario, clave) {
    const id = await fileId(usuario);
    const res = await fetch('data/' + id + '.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('nope');
    const box = await res.json();
    const base = await crypto.subtle.importKey('raw', enc.encode(clave), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: fromB64(box.salt), iterations: box.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(box.iv) }, key, fromB64(box.ct));
    return { id, data: JSON.parse(dec.decode(plain)) };
  }

  /* ---------- Ingreso ---------- */
  const form = $('.login-form'), err = $('.login-error'), go = $('.login-form .go'), passToggle = $('.pass-toggle');
  passToggle.addEventListener('click', () => {
    const inp = $('#c'); const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    passToggle.textContent = show ? 'Ocultar' : 'Ver';
    passToggle.setAttribute('aria-pressed', show);
  });
  async function login(usuario, clave) {
    err.hidden = true;
    if (!usuario.trim() || !clave) { err.textContent = 'Completá usuario y clave.'; err.hidden = false; return; }
    go.disabled = true; go.textContent = 'Entrando…';
    try {
      const s = await open(usuario, clave);
      try { sessionStorage.setItem(SESSION, JSON.stringify(s)); } catch (_) {}
      show(s);
    } catch (_) {
      err.textContent = 'Usuario o clave incorrectos. Revisalos o pedíselos a tu coach.';
      err.hidden = false; $('#c').select();
    } finally { go.disabled = false; go.textContent = 'Entrar'; }
  }
  form.addEventListener('submit', (e) => { e.preventDefault(); login($('#u').value, $('#c').value); });
  $('[data-demo]').addEventListener('click', () => login(DEMO.usuario, DEMO.clave));
  $('[data-logout]').addEventListener('click', () => { try { sessionStorage.removeItem(SESSION); } catch (_) {} location.hash = ''; location.reload(); });

  /* ---------- Zona ---------- */
  const D = (iso) => new Date(iso + 'T12:00:00');
  const fmtDate = (iso) => D(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });

  function show({ id, data }) {
    views.login.hidden = true; views.dash.hidden = false;
    $('[data-logout]').hidden = false; $('[data-tabs]').hidden = false;
    const first = data.nombre.split(' ')[0];
    document.title = 'Zona de atletas · TPT';
    $('[data-hello]').textContent = 'Hola, ' + first;
    $('[data-meta]').textContent = data.sede ? 'Sede ' + data.sede : '';
    wall(id, data, first); agenda(id, data);
    $('[data-lib]').innerHTML = (data.biblioteca || []).map((m) => `<div><h3>${esc(m.modulo)}</h3><ul>${m.items.map((i) => `<li><span>${esc(i.tipo)}</span><div><b>${esc(i.titulo)}</b><em>${esc(i.detalle || '')}</em></div></li>`).join('')}</ul></div>`).join('');
    $('[data-ben]').innerHTML = (data.beneficios || []).map((b) => `<li><span>${esc(b.etiqueta)}</span><b>${esc(b.titulo)}</b><i>${esc(b.precio || '')}</i><p>${esc(b.detalle)}</p></li>`).join('');
    requestAnimationFrame(() => views.dash.classList.add('in'));
  }

  /* Muro con reacciones */
  const RX = ['🔥', '💪', '👏', '🙌'];
  function wall(id, data, first) {
    const list = $('[data-wall]');
    const kMine = 'tpt:muro:' + id, kRx = 'tpt:rx:' + id;
    let mine = store.get(kMine) || []; const rx = store.get(kRx) || {};
    const save = () => { store.set(kMine, mine); store.set(kRx, rx); };
    const paint = () => {
      const all = [...mine.map((p) => ({ ...p, k: 'm' + p.t })), ...(data.muro || []).map((p, i) => ({ ...p, k: 'e' + i }))];
      list.innerHTML = all.map((p) => `<li><div class="who"><b>${esc(p.autor)}</b>${p.sede ? ' · ' + esc(p.sede) : ''} · ${esc(fmtDate(p.fecha))}</div><p>${esc(p.texto)}</p><div class="rx">${RX.map((e, i) => { const on = rx[p.k + ':' + i]; return `<button type="button" data-rx="${p.k}:${i}" aria-pressed="${!!on}" aria-label="Reaccionar con ${e}">${e}${on ? '<b>1</b>' : ''}</button>`; }).join('')}</div></li>`).join('');
    };
    list.addEventListener('click', (e) => { const b = e.target.closest('[data-rx]'); if (!b) return; const k = b.dataset.rx; if (rx[k]) delete rx[k]; else rx[k] = 1; save(); paint(); });
    $('[data-wall-form]').addEventListener('submit', (e) => {
      e.preventDefault();
      const t = $('#w-t'); const texto = t.value.trim(); if (!texto) return;
      mine = [{ t: Date.now(), texto, autor: first, sede: data.sede, fecha: new Date().toISOString().slice(0, 10) }, ...mine];
      t.value = ''; save(); paint();
    });
    paint();
  }

  /* Agenda con "voy" */
  function agenda(id, data) {
    const body = $('[data-agenda]'); const k = 'tpt:voy:' + id; const voy = store.get(k) || {};
    const today = new Date().toISOString().slice(0, 10);
    const items = (data.agenda || []).filter((a) => a.fecha >= today);
    const paint = () => {
      body.innerHTML = items.map((a) => `<tr><td class="dt"><b>${D(a.fecha).getDate()} ${D(a.fecha).toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')}</b><span>${D(a.fecha).toLocaleDateString('es-AR', { weekday: 'long' })} · ${esc(a.hora)}</span></td><td class="wt"><span>${esc(a.tipo)}</span><b>${esc(a.titulo)}</b></td><td class="wh">${esc(a.lugar)}</td><td class="act"><button type="button" class="voy" data-voy="${a.id}" aria-pressed="${!!voy[a.id]}">${voy[a.id] ? 'Voy ✓' : 'Voy'}</button></td></tr>`).join('') || '<tr><td colspan="4">No hay nada agendado por ahora.</td></tr>';
    };
    body.addEventListener('click', (e) => { const b = e.target.closest('[data-voy]'); if (!b) return; if (voy[b.dataset.voy]) delete voy[b.dataset.voy]; else voy[b.dataset.voy] = 1; store.set(k, voy); paint(); });
    paint();
  }

  /* ---------- Herramientas ---------- */
  const mmss = (sec) => { const t = Math.round(sec); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
  const hms = (sec) => { const t = Math.round(sec); const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60); return h + ' h ' + String(m).padStart(2, '0'); };
  const seg = (el, opts, on, cb) => {
    el.innerHTML = opts.map((o) => `<button type="button" role="radio" aria-checked="${o === on}" data-v="${o}">${o}</button>`).join('');
    el.addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (!b) return; $$('button', el).forEach((x) => x.setAttribute('aria-checked', x === b)); cb(b.dataset.v); });
  };
  // Distancias oficiales: natación en metros, bici y running en km. Cortes de las carreras marca Ironman.
  const RACES = {
    'Sprint': { sw: 750, bk: 20, rn: 5 },
    'Olímpico': { sw: 1500, bk: 40, rn: 10 },
    '70.3': { sw: 1900, bk: 90, rn: 21.1, cut: { sw: 70, bk: 330, fin: 510 } },
    'Ironman': { sw: 3800, bk: 180, rn: 42.2, cut: { sw: 140, bk: 630, fin: 1020 } }
  };

  // 1. ¿Llego al corte?
  let race = '70.3';
  function corte() {
    const r = RACES[race];
    const sw = (r.sw / 100) * (num($('[data-sw-m]')) * 60 + num($('[data-sw-s]')));
    const bk = num($('[data-bk]')) > 0 ? (r.bk / num($('[data-bk]'))) * 3600 : 0;
    const rn = r.rn * (num($('[data-rn-m]')) * 60 + num($('[data-rn-s]')));
    const tr = num($('[data-tr]')) * 60; const tot = sw + bk + rn + tr;
    if (!(sw > 0 && bk > 0 && rn > 0)) { $('[data-corte]').innerHTML = ''; $('[data-corte-n]').textContent = 'Completá los tres ritmos.'; return; }
    $('[data-split]').innerHTML = [[sw, 'var(--nat)'], [bk, 'var(--bic)'], [rn, 'var(--run)']].map(([v, c]) => `<i style="width:${(v / tot) * 100}%;background:${c}"></i>`).join('');
    $('[data-corte]').innerHTML = [['Natación', sw], ['Bici', bk], ['Running', rn]].map(([l, v]) => `<div><dt>${l}</dt><dd>${hms(v)}</dd></div>`).join('') + `<div class="tot"><dt>Total</dt><dd>${hms(tot)}</dd></div>`;
    const n = $('[data-corte-n]'); n.className = 'tool-n';
    if (!r.cut) { n.textContent = 'En Sprint y Olímpico el corte lo pone cada carrera: miralo en la guía del atleta.'; return; }
    const fails = [];
    if (sw > r.cut.sw * 60) fails.push('natación (' + hms(r.cut.sw * 60) + ')');
    if (sw + tr / 2 + bk > r.cut.bk * 60) fails.push('bici (' + hms(r.cut.bk * 60) + ' desde la largada)');
    if (tot > r.cut.fin * 60) fails.push('llegada (' + hms(r.cut.fin * 60) + ')');
    if (fails.length) { n.classList.add('no'); n.textContent = 'Con estos ritmos no pasás el corte de ' + fails.join(' ni el de ') + '. Hablalo con tu coach: se entrena.'; }
    else { n.classList.add('ok'); n.textContent = 'Llegás. Te sobran ' + hms(r.cut.fin * 60 - tot) + ' al corte final de ' + hms(r.cut.fin * 60) + '. Los cortes pueden cambiar según la carrera.'; }
  }
  seg($('[data-race]'), Object.keys(RACES), race, (v) => { race = v; corte(); });
  $$('[data-sw-m],[data-sw-s],[data-bk],[data-rn-m],[data-rn-s],[data-tr]').forEach((i) => i.addEventListener('input', corte));
  corte();

  // 2. Ritmo objetivo
  const DISC = { Running: 'rn', Bici: 'bk', 'Natación': 'sw' }; let disc = 'Running';
  const dIn = $('[data-d]'), out = $('[data-pace]');
  function ritmo() {
    const d = parseFloat(dIn.value); const t = num($('[data-h]')) * 3600 + num($('[data-m]')) * 60 + num($('[data-s]'));
    if (!(d > 0) || !(t > 0)) { out.textContent = 'Poné distancia y tiempo.'; return; }
    if (disc === 'Running') out.innerHTML = `<b>${mmss(t / d)}</b>minutos por kilómetro`;
    else if (disc === 'Natación') out.innerHTML = `<b>${mmss(t / (d / 100))}</b>cada 100 metros`;
    else out.innerHTML = `<b>${(d / (t / 3600)).toFixed(1).replace('.', ',')}</b>km/h de promedio`;
  }
  seg($('[data-disc]'), Object.keys(DISC), disc, (v) => { disc = v; $('[data-unit]').textContent = v === 'Natación' ? 'm' : 'km'; dIn.value = ''; ritmo(); });
  $('[data-dist]').innerHTML = Object.keys(RACES).map((r) => `<button type="button" data-r="${r}">${r}</button>`).join('');
  $('[data-dist]').addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (!b) return; dIn.value = RACES[b.dataset.r][DISC[disc]]; ritmo(); });
  $$('[data-d],[data-h],[data-m],[data-s]').forEach((i) => i.addEventListener('input', ritmo));

  // 3. CSS de natación: (T400 - T200) / 2 = ritmo cada 100 m
  function css() {
    const t4 = num($('[data-c4m]')) * 60 + num($('[data-c4s]')), t2 = num($('[data-c2m]')) * 60 + num($('[data-c2s]'));
    const o = $('[data-css]');
    if (!(t4 > t2 && t2 > 0)) { o.textContent = 'El tiempo de 400 m tiene que ser mayor que el de 200 m.'; return; }
    o.innerHTML = `<b>${mmss((t4 - t2) / 2)}</b>cada 100 metros es tu ritmo de umbral en el agua`;
  }
  $$('[data-c4m],[data-c4s],[data-c2m],[data-c2s]').forEach((i) => i.addEventListener('input', css)); css();

  // 4. Zonas
  let zd = 'Running';
  const ZR = [['Z1', 'Regenerativo', 1.29, null], ['Z2', 'Aeróbico', 1.14, 1.29], ['Z3', 'Tempo', 1.06, 1.13], ['Z4', 'Umbral', 0.99, 1.05], ['Z5', 'VO2 máx', null, 0.97]];
  const ZB = [['Z1', 'Recuperación', null, 0.55], ['Z2', 'Resistencia', 0.56, 0.75], ['Z3', 'Tempo', 0.76, 0.90], ['Z4', 'Umbral', 0.91, 1.05], ['Z5', 'VO2 máx', 1.06, 1.20], ['Z6', 'Anaeróbico', 1.21, null]];
  function zonas() {
    const o = $('[data-zonas]');
    $('[data-z-run]').hidden = zd !== 'Running'; $('[data-z-bike]').hidden = zd !== 'Bici';
    if (zd === 'Running') {
      const p = num($('[data-zm]')) * 60 + num($('[data-zs]')); if (!p) { o.innerHTML = ''; return; }
      o.innerHTML = ZR.map(([z, n, a, b]) => `<tr><td>${z}</td><td>${n}</td><td>${a && b ? mmss(p * b) + ' a ' + mmss(p * a) : a ? 'más lento que ' + mmss(p * a) : 'más rápido que ' + mmss(p * b)} /km</td></tr>`).join('');
    } else {
      const f = num($('[data-ftp]')); if (!f) { o.innerHTML = ''; return; }
      o.innerHTML = ZB.map(([z, n, a, b]) => `<tr><td>${z}</td><td>${n}</td><td>${a && b ? Math.round(f * a) + ' a ' + Math.round(f * b) : a ? 'más de ' + Math.round(f * a) : 'menos de ' + Math.round(f * b)} W</td></tr>`).join('');
    }
  }
  seg($('[data-zdisc]'), ['Running', 'Bici'], zd, (v) => { zd = v; zonas(); });
  $$('[data-zm],[data-zs],[data-ftp]').forEach((i) => i.addEventListener('input', zonas)); zonas();

  /* ---------- Sesión abierta / link directo ---------- */
  try { const s = JSON.parse(sessionStorage.getItem(SESSION)); if (s && s.data) show(s); } catch (_) {}
  // atletas/#ejemplo abre directo el usuario de muestra (para mostrarla con un link).
  if (location.hash === '#ejemplo' && views.dash.hidden) login(DEMO.usuario, DEMO.clave);
  if (!crypto.subtle) { err.textContent = 'Este navegador no puede abrir la zona. Probá con Chrome o Safari actualizados.'; err.hidden = false; }
})();
