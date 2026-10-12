// Galerie ročníku: záložky Start/Trasa/Cíl a fotka přes celou obrazovku (šipky, swipe, Esc). Keksa 12. 10. 2026.
(function () {
  var mrizka = document.getElementById("gal-mrizka");
  if (!mrizka) return;
  var odkazy = Array.prototype.slice.call(mrizka.querySelectorAll("a"));

  // Záložky
  Array.prototype.forEach.call(document.querySelectorAll(".gal-zalozka"), function (b) {
    b.addEventListener("click", function () {
      var s = b.getAttribute("data-sekce");
      Array.prototype.forEach.call(document.querySelectorAll(".gal-zalozka"), function (x) { x.classList.toggle("gal-aktivni", x === b); });
      odkazy.forEach(function (a) { a.hidden = !!s && a.getAttribute("data-s") !== s; });
    });
  });

  // Prohlížeč
  var box = document.createElement("div");
  box.className = "gal-box"; box.hidden = true;
  box.innerHTML = '<button type="button" class="gal-zavrit" aria-label="Zavřít">×</button>' +
    '<button type="button" class="gal-pred" aria-label="Předchozí">‹</button>' +
    '<figure><img alt=""><figcaption></figcaption></figure>' +
    '<button type="button" class="gal-dalsi-f" aria-label="Další">›</button>';
  document.body.appendChild(box);
  var img = box.querySelector("img"), popis = box.querySelector("figcaption"), i = 0;
  function viditelne() { return odkazy.filter(function (a) { return !a.hidden; }); }
  function ukaz(n) {
    var v = viditelne(); if (!v.length) return;
    i = (n + v.length) % v.length;
    var a = v[i];
    img.src = a.getAttribute("href");
    popis.textContent = (i + 1) + " / " + v.length + (a.getAttribute("data-a") ? " · foto " + a.getAttribute("data-a") : "");
    box.hidden = false; document.body.style.overflow = "hidden";
  }
  function zavri() { box.hidden = true; img.removeAttribute("src"); document.body.style.overflow = ""; }
  mrizka.addEventListener("click", function (e) {
    var a = e.target.closest("a"); if (!a) return;
    e.preventDefault(); ukaz(viditelne().indexOf(a));
  });
  box.querySelector(".gal-zavrit").addEventListener("click", zavri);
  box.querySelector(".gal-pred").addEventListener("click", function () { ukaz(i - 1); });
  box.querySelector(".gal-dalsi-f").addEventListener("click", function () { ukaz(i + 1); });
  box.addEventListener("click", function (e) { if (e.target === box) zavri(); });
  document.addEventListener("keydown", function (e) {
    if (box.hidden) return;
    if (e.key === "Escape") zavri(); else if (e.key === "ArrowLeft") ukaz(i - 1); else if (e.key === "ArrowRight") ukaz(i + 1);
  });
  var x0 = null;
  box.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  box.addEventListener("touchend", function (e) {
    if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 40) ukaz(dx < 0 ? i + 1 : i - 1);
  });
})();
