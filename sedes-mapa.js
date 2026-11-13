/* Mapa de sedes. Puntos aproximados: confirmar cada uno con TPT antes de publicar el sitio final. */
(() => {
  const el = document.getElementById('sedesMap');
  if (!el || !window.L) return;
  const SEDES = [
    { n: 1, nombre: 'Plaza Irlanda', dir: 'Av. Gaona 2101, Caballito', ll: [-34.6128, -58.4586], z: 'ba' },
    { n: 2, nombre: 'Plaza Gurruchaga', dir: 'Gurruchaga 1070, Villa Crespo', ll: [-34.5937, -58.4405], z: 'ba' },
    { n: 3, nombre: 'Barrancas de Belgrano', dir: 'Arcos 1514, Belgrano', ll: [-34.5607, -58.4496], z: 'ba' },
    { n: 4, nombre: 'Puerto Madero', dir: 'Aimé Painé 1401', ll: [-34.6127, -58.3613], z: 'ba' },
    { n: 6, nombre: 'Plaza Ejército de los Andes', dir: 'Av. Rivadavia 10300, Villa Luro', ll: [-34.6386, -58.5020], z: 'ba' },
    { n: 7, nombre: 'Sede Saavedra', dir: 'Av. García del Río y Av. Melián', ll: [-34.5545, -58.4790], z: 'ba' },
    { n: 8, nombre: 'Sede Tigre', dir: 'Montes de Oca 201, Tigre', ll: [-34.4250, -58.5800], z: 'ba' },
    { n: 9, nombre: 'Sede Mendoza', dir: 'Guaymallén, Mendoza', ll: [-32.8980, -68.7870], z: 'mza' }
  ];
  const map = L.map(el, { scrollWheelZoom: false });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap' }).addTo(map);
  SEDES.forEach((s) => {
    L.marker(s.ll, { icon: L.divIcon({ className: '', html: '<div class="sedes-pin">' + s.n + '</div>', iconSize: [30, 30], iconAnchor: [15, 15] }) })
      .addTo(map)
      .bindPopup('<b>' + s.nombre + '</b>' + s.dir + '<br><a href="https://www.google.com/maps/search/?api=1&query=' + s.ll.join(',') + '" target="_blank" rel="noopener">Cómo llegar</a>');
  });
  const go = (z) => {
    const pts = SEDES.filter((s) => s.z === z).map((s) => s.ll);
    if (pts.length > 1) map.fitBounds(pts, { padding: [40, 40] }); else map.setView(pts[0], 12);
  };
  go('ba');
  document.querySelectorAll('.map-chip').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.map-chip').forEach((x) => x.classList.toggle('is-on', x === b));
    go(b.dataset.zone);
  }));
})();
