// Mobile menu toggle
const menuToggle = document.getElementById("menuToggle");
const mobileMenu = document.getElementById("mobileMenu");

if (menuToggle && mobileMenu) {
  menuToggle.addEventListener("click", () => {
    mobileMenu.classList.toggle("open");
    menuToggle.textContent = mobileMenu.classList.contains("open") ? "✕" : "☰";
  });

  mobileMenu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      mobileMenu.classList.remove("open");
      menuToggle.textContent = "☰";
    });
  });
}

// Contact form -> opens the user's email client with the data pre-filled
const contactForm = document.getElementById("contactForm");

if (contactForm) {
  contactForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const nombre = document.getElementById("nombre").value.trim();
    const email = document.getElementById("email").value.trim();
    const nivel = document.getElementById("nivel").value;
    const plan = document.getElementById("plan").value;
    const mensaje = document.getElementById("mensaje").value.trim();

    const destinatario = "info@triatlonparatodos.com.ar";
    const asunto = `Consulta de ${nombre} — Plan ${plan}`;
    const cuerpo =
      `Nombre: ${nombre}\n` +
      `Email: ${email}\n` +
      `Nivel actual: ${nivel}\n` +
      `Plan de interés: ${plan}\n\n` +
      `Mensaje:\n${mensaje}`;

    window.location.href =
      `mailto:${destinatario}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
  });
}
