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

  /* ---------- Sesión abierta / link directo ---------- */
  try { const s = JSON.parse(sessionStorage.getItem(SESSION)); if (s && s.data) show(s); } catch (_) {}
  // atletas/#ejemplo abre directo el usuario de muestra (para mostrarla con un link).
  if (location.hash === '#ejemplo' && views.dash.hidden) login(DEMO.usuario, DEMO.clave);
  if (!crypto.subtle) { err.textContent = 'Este navegador no puede abrir la zona. Probá con Chrome o Safari actualizados.'; err.hidden = false; }
})();
