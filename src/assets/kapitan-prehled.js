// Kapitánská sekce – krok 1: přehled týmu a startovné (QR platba). Soupiska, počet, etapy a potvrzení
// mají vlastní kroky; tady je jen tým, platba a krátký stav, dál se jde tlačítkem „Dál“ (Keksa 4. 10. 2026).
(function () {
  var e = HBK.esc;

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
      "<dt>Částka</dt><dd>" + e(HBK.kc(p.castka_kc)) + "</dd>" +
      "</dl>" +
      (!p.zaplaceno && p.qr_spayd
        ? '<div class="k-qr"><div id="k-qr-obr" aria-label="QR kód pro platbu startovného"></div>' +
          "<small>Naskenuj v bankovní aplikaci.<br>Účet " + e(p.ucet || "–") + " · VS " + e(p.vs || "–") + " · " + e(HBK.kc(p.castka_kc)) + "</small></div>"
        : !p.zaplaceno ? '<p class="k-qr"><small>Účet ' + e(p.ucet || "–") + " · VS " + e(p.vs || "–") + "</small></p>" : "") +
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
  });
})();
