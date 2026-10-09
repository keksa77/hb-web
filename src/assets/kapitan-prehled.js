// Kapitánská sekce – krok 1: přehled týmu a startovné (QR platba). Soupiska, počet, etapy a potvrzení
// mají vlastní kroky; tady je jen tým, platba a krátký stav, dál se jde tlačítkem „Dál“ (Keksa 4. 10. 2026).
(function () {
  var e = HBK.esc;

  // Údaje k platbě: každý řádek jde zkopírovat jedním klepnutím (na telefonu QR naskenovat nejde). UX revize 5. 10. 2026.
  function radekKopie(nazev, hodnota, kopie) {
    return "<dt>" + nazev + '</dt><dd class="k-kopie"><span>' + e(hodnota || "–") + "</span>" +
      (hodnota ? '<button type="button" class="k-odkaz" data-kopie="' + e(kopie || hodnota) + '" aria-label="Zkopírovat ' + nazev.toLowerCase() + '">Zkopírovat</button>' : "") + "</dd>";
  }
  function platba(p) {
    return '<div class="k-platba"><dl class="k-dl k-dl-platba">' +
      radekKopie("Účet", p.ucet) + radekKopie("Variabilní symbol", p.vs) +
      radekKopie("Částka", HBK.kc(p.castka_kc), String(p.castka_kc || "")) + "</dl>" +
      (p.qr_spayd ? '<div class="k-qr"><div id="k-qr-obr" aria-label="QR kód pro platbu startovného"></div><small>Na počítači naskenuj QR kód v bankovní aplikaci.</small></div>' : "") +
      "</div>";
  }
  document.addEventListener("click", function (ev) {
    var b = ev.target && ev.target.closest && ev.target.closest("[data-kopie]"); if (!b) return;
    var hotovo = function () { var t = b.textContent; b.textContent = "Zkopírováno"; setTimeout(function () { b.textContent = t; }, 1500); };
    try { navigator.clipboard.writeText(b.dataset.kopie).then(hotovo, function () {}); } catch (err) {}
  });

  function vykresli(p) {
    var h = [];
    h.push('<div class="k-mrizka">');
    h.push('<div class="k-karta"><h2>Tým</h2><dl class="k-dl">' +
      "<dt>Název</dt><dd>" + e(p.nazev) + "</dd>" +
      "<dt>Číslo týmu</dt><dd>" + (p.cislo ? e(p.cislo) : "přidělíme později") + "</dd>" +
      "<dt>Ročník</dt><dd>" + e(p.rocnik) + "</dd>" +
      "<dt>Registrace</dt><dd>" + (p.stav === "nahradnik" ? "náhradník" : p.stav === "zruseno" ? "zrušená" : "přijatá") + "</dd>" +
      "<dt>Start</dt><dd>" + (p.start_cas ? HBK.cas(p.start_cas) : "čas startu pošleme nejpozději týden před závodem") + "</dd>" +
      "<dt>Soupiska a etapy</dt><dd>" + (p.soupiska_otevrena ? "měnit jde " + (p.soupiska_do ? "do " + e(HBK.cas(p.soupiska_do)) : "do termínu, který ještě oznámíme")
                                                         : "<b>uzavřené</b>, změny řeší pořadatel na info@horybory.cz") + "</dd>" +
      "</dl></div>");
    // Startovné: QR platba, údaje pro ruční zadání malým písmem pod ní.
    h.push('<div class="k-karta"><h2>Startovné</h2><dl class="k-dl">' +
      "<dt>Stav</dt><dd>" + (p.zaplaceno ? '<span class="k-stitek k-stitek-ok">zaplaceno ' + e(HBK.datum(p.zaplaceno_dne)) + "</span>"
                                         : '<span class="k-stitek k-stitek-ne">zatím nezaplaceno</span>') + "</dd>" +
      (p.zaplaceno ? "<dt>Částka</dt><dd>" + e(HBK.kc(p.castka_kc)) + "</dd>" : "") +
      "</dl>" +
      (!p.zaplaceno ? platba(p) : "") +
      "</div>");
    h.push("</div>");
    document.getElementById("k-obsah").innerHTML = h.join("");
    if (!p.zaplaceno && p.qr_spayd) nakresliQr(p.qr_spayd);
  }

  // QR kód kreslí knihovna qrcode-generator (MIT), uložená na webu; načte se jen tady.
  function nakresliQr(text) {
    function kresli() {
      var cil = document.getElementById("k-qr-obr"); if (!cil || !window.qrcode) return;
      var q = window.qrcode(0, "M"); q.addData(text); q.make();
      cil.innerHTML = q.createImgTag(6, 0);
      var img = cil.querySelector("img"); if (img) img.alt = "QR kód pro platbu startovného";
    }
    if (window.qrcode) return kresli();
    var s = document.createElement("script"); s.src = HB.zaklad + "/assets/qrcode.min.js"; s.onload = kresli; document.head.appendChild(s);
  }

  document.addEventListener("DOMContentLoaded", async function () {
    var p = await HBK.vyzadovat(); if (!p) return;
    vykresli(p);
    oprava();
  });

  // Oprava času (9. 10. 2026): od startu závodu, nebo když už tým nějakou žádost má, odkaz na stránku Oprava času.
  async function oprava() {
    var o = null;
    try { o = await HBK.rpc("web_k_oprava_casu"); } catch (err) { return; }
    if (!o || (!o.otevreno && !(o.zadosti || []).length)) return;
    var ceka = o.zadosti.filter(function (z) { return z.stav === "ceka"; }).length, vyr = o.zadosti.length - ceka;
    var m = document.querySelector(".k-mrizka"); if (!m) return;
    m.insertAdjacentHTML("beforeend", '<div class="k-karta"><h2>Oprava času</h2><p>' +
      (o.zadosti.length ? "Žádosti: " + (ceka ? ceka + " čeká" : "") + (ceka && vyr ? ", " : "") + (vyr ? vyr + " vyřízeno" : "") + "."
                        : "Je některý čas na předávce špatně nebo chybí? Napiš nám.") + "</p>" +
      '<div class="k-akce"><a class="k-tlacitko" href="' + HB.zaklad + '/kapitan/oprava-casu/">' + (o.zadosti.length ? "Žádosti o opravu času" : "Požádat o opravu času") + "</a></div></div>");
  }
})();
