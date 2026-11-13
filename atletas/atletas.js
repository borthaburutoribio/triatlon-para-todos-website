/* Área de atletas · Triatlón Para Todos
   Cada ficha está cifrada con la clave del atleta (ver _build/atletas.mjs).
   El navegador baja el archivo y lo abre con la clave: si no coincide, no hay nada que leer. */
(() => {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const $ = (s, r = document) => r.querySelector(s);
  const views = { login: $('[data-view="login"]'), dash: $('[data-view="dash"]') };
  const SESSION = 'tpt:sesion';
  const DEMO = { usuario: 'prueba', clave: 'tpt-ejemplo-2027' }; // ficha de ejemplo, pública a propósito
  const DISC = { natacion: 'Natación', bici: 'Bici', running: 'Running', fuerza: 'Fuerza' };
  const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }
  };

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
  const form = $('.login-form');
  const err = $('.login-error');
  const go = $('.login-go');
  const passToggle = $('.pass-toggle');

  passToggle.addEventListener('click', () => {
    const inp = $('#c');
    const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    passToggle.textContent = show ? 'Ocultar' : 'Ver';
    passToggle.setAttribute('aria-pressed', show);
    passToggle.setAttribute('aria-label', show ? 'Ocultar clave' : 'Mostrar clave');
  });

  async function login(usuario, clave) {
    err.hidden = true;
    if (!usuario.trim() || !clave) { err.textContent = 'Completá usuario y clave.'; err.hidden = false; return; }
    go.disabled = true; go.textContent = 'Abriendo tu ficha…';
    try {
      const s = await open(usuario, clave);
      try { sessionStorage.setItem(SESSION, JSON.stringify(s)); } catch (_) {}
      show(s);
    } catch (_) {
      err.textContent = 'Usuario o clave incorrectos. Revisalos o pedíselos a tu coach.';
      err.hidden = false;
      $('#c').select();
    } finally {
      go.disabled = false; go.textContent = 'Entrar';
    }
  }
  form.addEventListener('submit', (e) => { e.preventDefault(); login($('#u').value, $('#c').value); });
  $('[data-demo]').addEventListener('click', () => { $('#u').value = DEMO.usuario; $('#c').value = DEMO.clave; login(DEMO.usuario, DEMO.clave); });
  $('[data-logout]').addEventListener('click', () => {
    try { sessionStorage.removeItem(SESSION); } catch (_) {}
    location.reload();
  });

  /* ---------- Panel ---------- */
  const fmtDate = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
  const fmtMin = (m) => (m >= 60 ? Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') : m + ' min');

  function show({ id, data }) {
    views.login.hidden = true;
    views.dash.hidden = false;
    $('[data-logout]').hidden = false;
    const first = data.nombre.split(' ')[0];
    document.title = 'Ficha de ' + first + ' · Área de atletas TPT';
    $('[data-hello]').textContent = 'Hola, ' + first;
    $('[data-meta]').textContent = [data.objetivo, data.modalidad, data.sede].filter(Boolean).join(' · ');
    $('[data-sample]').hidden = !data.ejemplo;
    $('[data-message]').textContent = data.mensaje || 'Sin mensajes nuevos.';

    $('[data-goals]').innerHTML = (data.objetivos || []).map((o) => `<li class="${o.hecho ? 'done' : ''}"><span class="tick" aria-hidden="true"></span><span>${esc(o.texto)}<span class="sr-only">${o.hecho ? ' (cumplido)' : ''}</span></span></li>`).join('');
    $('[data-notes]').innerHTML = (data.notas || []).map((n) => `<li><b>${esc(fmtDate(n.fecha))}</b>${esc(n.texto)}</li>`).join('') || '<li>Todavía no hay notas.</li>';

    if (data.carrera && data.carrera.fecha) {
      const days = Math.ceil((new Date(data.carrera.fecha + 'T07:00:00') - new Date()) / 864e5);
      if (days >= 0) {
        $('[data-race]').hidden = false;
        $('[data-race-days]').textContent = days === 0 ? 'Hoy' : days;
        $('[data-race-label]').textContent = days === 0 ? 'es el día' : days === 1 ? 'día para tu carrera' : 'días para tu carrera';
        $('[data-race-name]').textContent = data.carrera.nombre + ' · ' + fmtDate(data.carrera.fecha);
      }
    }

    renderWall(id, data, first);

    renderWeek(id, data);
    requestAnimationFrame(() => views.dash.classList.add('in'));
  }

  /* ---------- Muro del equipo ----------
     Hoy los mensajes nuevos y los aplausos se guardan en el navegador de cada uno.
     Para que los vea todo el equipo hace falta una base de datos: se conecta acá, en save(). */
  function renderWall(id, data, first) {
    const list = $('[data-wall]');
    const kMine = 'tpt:muro:' + id, kClap = 'tpt:aplausos:' + id;
    let mine = store.get(kMine) || [];
    const claps = store.get(kClap) || {};
    const save = () => { store.set(kMine, mine); store.set(kClap, claps); };
    $('[data-wall-note]').textContent = data.ejemplo ? 'En la ficha de ejemplo tu mensaje queda guardado solo en este navegador.' : 'Lo ve todo el equipo. Máximo 280 caracteres.';
    const paint = () => {
      const all = [...mine.map((p) => ({ ...p, k: 'm' + p.t, mine: 1 })), ...(data.muro || []).map((p, i) => ({ ...p, k: 'e' + i }))];
      list.innerHTML = all.map((p) => `<li class="${p.mine ? 'wall-mine' : ''}"><p>${esc(p.texto)}</p><footer><span>${esc(p.autor)}${p.sede ? ' · ' + esc(p.sede) : ''} · ${esc(fmtDate(p.fecha))}</span><button type="button" class="clap" data-clap="${p.k}" aria-pressed="${!!claps[p.k]}">${claps[p.k] ? 'Aplaudiste' : 'Aplaudir'}</button></footer></li>`).join('') || '<li><p>Todavía no hay nada en el muro. Estrenalo vos.</p></li>';
    };
    list.addEventListener('click', (e) => { const b = e.target.closest('[data-clap]'); if (!b) return; if (claps[b.dataset.clap]) delete claps[b.dataset.clap]; else claps[b.dataset.clap] = 1; save(); paint(); });
    $('[data-wall-form]').addEventListener('submit', (e) => {
      e.preventDefault();
      const t = $('#w-t'); const texto = t.value.trim(); if (!texto) return;
      mine = [{ t: Date.now(), texto, autor: first, sede: data.sede, fecha: new Date().toISOString().slice(0, 10) }, ...mine];
      t.value = ''; save(); paint();
    });
    paint();
  }

  function renderWeek(id, data) {
    const key = 'tpt:' + id + ':' + data.actualizado;
    const done = store.get(key) || {};
    const days = data.semana || [];
    const tabs = $('[data-days]');
    const body = $('[data-day]');
    const vol = $('[data-vol]');
    const todayName = new Date().toLocaleDateString('es-AR', { weekday: 'long' }).toLowerCase();
    let current = Math.max(0, days.findIndex((d) => d.dia.toLowerCase() === todayName));

    tabs.innerHTML = days.map((d, i) => `<button type="button" role="tab" id="tab-${i}" aria-controls="dia" data-i="${i}">${esc(d.dia)}</button>`).join('');
    body.id = 'dia';

    // Minutos de la semana por disciplina: la barra se llena con lo que vas tildando.
    const total = {};
    days.forEach((d) => d.sesiones.forEach((s) => { total[s.disc] = (total[s.disc] || 0) + (s.min || 0); }));
    const discs = Object.keys(DISC).filter((k) => total[k]);
    vol.innerHTML = discs.map((k) => `<div class="vol-i" data-c="${k}"><div class="vol-t"><span>${DISC[k]}</span><b>${fmtMin(total[k])}</b></div><div class="vol-bar"><span data-vol-fill="${k}"></span></div></div>`).join('');
    const paintVol = () => {
      const made = {};
      days.forEach((d, di) => d.sesiones.forEach((s, si) => { if (done[di + '-' + si]) made[s.disc] = (made[s.disc] || 0) + (s.min || 0); }));
      discs.forEach((k) => { $(`[data-vol-fill="${k}"]`).style.transform = 'scaleX(' + (made[k] || 0) / total[k] + ')'; });
    };

    const progress = () => {
      const all = days[current].sesiones.map((_, si) => current + '-' + si);
      const n = all.filter((k) => done[k]).length;
      $('[data-progress-text]').textContent = n === all.length ? 'Día completo, ' + n + ' de ' + all.length : n + ' de ' + all.length + ' hechas';
      $('[data-progress]').style.transform = 'scaleX(' + (all.length ? n / all.length : 0) + ')';
      paintVol();
    };

    const paint = () => {
      [...tabs.children].forEach((b, i) => { b.setAttribute('aria-selected', i === current); b.tabIndex = i === current ? 0 : -1; });
      body.setAttribute('aria-labelledby', 'tab-' + current);
      const d = days[current];
      body.innerHTML = `<p class="day-focus">${esc(d.foco || '')}</p><ul class="ses">` + d.sesiones.map((s, si) => {
        const k = current + '-' + si;
        return `<li data-c="${esc(s.disc)}"><label class="${done[k] ? 'done' : ''}"><input type="checkbox" data-k="${k}" ${done[k] ? 'checked' : ''}><span class="box" aria-hidden="true"></span><span class="it"><span class="it-disc">${esc(DISC[s.disc] || s.disc)}</span><span class="it-name">${esc(s.nombre)} <span>· ${esc(s.dosis || '')}</span></span>${s.nota ? `<span class="it-note">${esc(s.nota)}</span>` : ''}</span></label></li>`;
      }).join('') + '</ul>';
      progress();
    };

    tabs.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (!b) return; current = +b.dataset.i; paint(); });
    tabs.addEventListener('keydown', (e) => {
      if (!['ArrowRight', 'ArrowLeft'].includes(e.key)) return;
      current = (current + (e.key === 'ArrowRight' ? 1 : days.length - 1)) % days.length;
      paint(); tabs.children[current].focus(); e.preventDefault();
    });
    body.addEventListener('change', (e) => {
      const k = e.target.dataset.k; if (!k) return;
      if (e.target.checked) done[k] = 1; else delete done[k];
      e.target.closest('label').classList.toggle('done', e.target.checked);
      store.set(key, done);
      progress();
    });
    paint();
  }

  /* ---------- Calculadora de ritmo ---------- */
  // Distancias oficiales por carrera: natación en metros, bici y running en km.
  const RACES = [
    { id: 'Sprint', natacion: 750, bici: 20, running: 5 },
    { id: 'Olímpico', natacion: 1500, bici: 40, running: 10 },
    { id: '70.3', natacion: 1900, bici: 90, running: 21.1 },
    { id: 'Ironman', natacion: 3800, bici: 180, running: 42.2 }
  ];
  const PACE = ['running', 'bici', 'natacion'];
  let disc = 'running';
  const dIn = $('[data-d]'), hIn = $('[data-h]'), mIn = $('[data-m]'), sIn = $('[data-s]'), out = $('[data-pace]');
  const mmss = (sec) => { const t = Math.round(sec); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };

  $('[data-disc]').innerHTML = PACE.map((k) => `<button type="button" role="radio" aria-checked="${k === disc}" data-k="${k}">${DISC[k]}</button>`).join('');
  $('[data-dist]').innerHTML = RACES.map((r) => `<button type="button" data-r="${r.id}">${r.id}</button>`).join('');

  function calc() {
    const d = parseFloat(dIn.value);
    const t = (+hIn.value || 0) * 3600 + (+mIn.value || 0) * 60 + (+sIn.value || 0);
    if (!(d > 0) || !(t > 0)) { out.textContent = 'Poné distancia y tiempo objetivo.'; return; }
    if (disc === 'running') out.innerHTML = `<b>${mmss(t / d)}</b>minutos por kilómetro`;
    else if (disc === 'natacion') out.innerHTML = `<b>${mmss(t / (d / 100))}</b>cada 100 metros`;
    else out.innerHTML = `<b>${(d / (t / 3600)).toFixed(1).replace('.', ',')}</b>km/h de promedio`;
  }
  $('[data-disc]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-k]'); if (!b) return;
    disc = b.dataset.k;
    [...b.parentElement.children].forEach((x) => x.setAttribute('aria-checked', x === b));
    $('[data-unit]').textContent = disc === 'natacion' ? 'm' : 'km';
    dIn.value = ''; calc();
  });
  $('[data-dist]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-r]'); if (!b) return;
    dIn.value = RACES.find((r) => r.id === b.dataset.r)[disc]; calc();
  });
  [dIn, hIn, mIn, sIn].forEach((i) => i.addEventListener('input', calc));

  /* ---------- Sesión abierta en esta pestaña ---------- */
  try {
    const s = JSON.parse(sessionStorage.getItem(SESSION));
    if (s && s.data) show(s);
  } catch (_) {}
  // atletas/#ejemplo abre directo la ficha de ejemplo (para mostrarla con un link).
  if (location.hash === '#ejemplo' && views.dash.hidden) login(DEMO.usuario, DEMO.clave);
  if (!crypto.subtle) { err.textContent = 'Este navegador no puede abrir fichas cifradas. Probá con Chrome o Safari actualizados.'; err.hidden = false; }
})();
