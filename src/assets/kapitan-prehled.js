// Kapitánská sekce – přehled týmu: stav registrace a platby, soupiska, etapy, upozornění a potvrzení.
(function () {
  var e = HBK.esc;
  function bezcu(n) { n = Number(n); return n + " " + (n === 1 ? "běžec" : n >= 2 && n <= 4 ? "běžci" : "běžců"); }
  var BLOKUJE = { etapy_chybi: 1, tretiny: 1, bez_etapy: 1, neuplne: 1 };   // bez nich nejde soupisku a etapy potvrdit

  function vykresli(p) {
    var vede = p.role !== "bezec";
    var u = p.upozorneni || [];
    var blok = u.filter(function (x) { return BLOKUJE[x.druh]; });
    var h = [];
    h.push('<div class="k-mrizka">');
    h.push('<div class="k-karta"><h2>Tým</h2><dl class="k-dl">' +
      "<dt>Název</dt><dd>" + e(p.nazev) + "</dd>" +
      "<dt>Číslo týmu</dt><dd>" + (p.cislo ? e(p.cislo) : "přidělíme později") + "</dd>" +
      "<dt>Ročník</dt><dd>" + e(p.rocnik) + "</dd>" +
      "<dt>Registrace</dt><dd>" + (p.stav === "nahradnik" ? "náhradník" : p.stav === "zruseno" ? "zrušená" : "přijatá") + "</dd>" +
      "<dt>Start</dt><dd>" + (p.start_cas ? HBK.cas(p.start_cas) : "čas startu pošleme nejpozději týden před závodem") + "</dd>" +
      "</dl></div>");
    // Startovné: QR platba, údaje pro ruční zadání malým písmem pod ní (Keksa 4. 10. 2026).
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

    h.push('<div class="k-karta"><h2>Soupiska a etapy</h2><dl class="k-dl">' +
      "<dt>Běžci na soupisce</dt><dd>" + e(p.bezcu) + " z nejvýš " + e(p.max_bezcu) + ' · <a href="' + HB.zaklad + '/kapitan/soupiska/">upravit soupisku</a></dd>' +
      "<dt>Konečný počet běžců</dt><dd>" + (p.pocet_potvrzen ? '<span class="k-stitek k-stitek-ok">' + e(bezcu(p.pocet_konecny)) + ", potvrzeno " + e(HBK.cas(p.pocet_potvrzen)) + "</span>"
                                    : '<span class="k-stitek k-stitek-ne">nepotvrzený</span> · <a href="' + HB.zaklad + '/kapitan/soupiska/">potvrdit na soupisce</a>') + "</dd>" +
      "<dt>Obsazené etapy</dt><dd>" + e(p.obsazenych_etap) + ' z 30 · <a href="' + HB.zaklad + '/kapitan/etapy/">rozdělit etapy</a></dd>' +
      "<dt>Změny do</dt><dd>" + (p.soupiska_do ? e(HBK.cas(p.soupiska_do)) : "termín ještě oznámíme") +
        (p.soupiska_otevrena ? "" : " · <b>uzavřeno</b>") + "</dd>" +
      "<dt>Potvrzeno</dt><dd>" + (p.soupiska_potvrzena ? '<span class="k-stitek k-stitek-ok">ano, ' + e(HBK.cas(p.soupiska_potvrzena)) + "</span>"
                                                       : '<span class="k-stitek k-stitek-ne">ne</span>') + "</dd>" +
      "</dl>");
    if (u.length) {
      h.push("<h3>Co ještě nesedí</h3><ul class=\"k-upozorneni\">" +
        u.map(function (x) { return "<li>" + e(x.text) + "</li>"; }).join("") + "</ul>");
    } else {
      h.push('<p class="k-ok">Soupiska i rozdělení etap jsou v pořádku.</p>');
    }
    if (vede && p.soupiska_otevrena) {
      h.push('<div class="k-akce"><button type="button" class="k-tlacitko" id="k-potvrdit"' + (blok.length || p.soupiska_potvrzena ? " disabled" : "") +
        ">Potvrdit soupisku a etapy</button>" +
        '<span class="pocet">' + (p.soupiska_potvrzena ? "Potvrzeno. Každá další změna potvrzení zruší."
          : blok.length ? "Potvrdit půjde, až budou u všech běžců vyplněné údaje, obsazené všechny etapy a každý běžec bude mít etapu z 1–10, 11–20 i 21–30."
          : "Potvrzením nám dáš vědět, že soupisku a etapy máš hotové.") + "</span></div>" +
        '<p class="k-hlaska" id="k-hlaska" role="status"></p>');
    }
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

  document.addEventListener("click", async function (ev) {
    if (!ev.target || ev.target.id !== "k-potvrdit") return;
    ev.target.disabled = true;
    try {
      await HBK.rpc("web_k_potvrd_soupisku", {});
      vykresli(await HBK.rpc("web_k_prehled"));
      HBK.hlaska("k-hlaska", "Potvrzeno, děkujeme.");
    } catch (err) { HBK.hlaska("k-hlaska", err.message, true); ev.target.disabled = false; }
  });

  document.addEventListener("DOMContentLoaded", async function () {
    var p = await HBK.vyzadovat(); if (!p) return;
    vykresli(p);
  });
})();
