// Kapitánská sekce – Převzetí týmu odkazem z e-mailu (Keksa 11. 10. 2026). Kdo dostal odkaz, přihlásí se e-mailem,
// na který odkaz přišel, a potvrdí převzetí. Token se pamatuje v prohlížeči, aby přežil přihlášení odkazem z mailu.
// Databáze: web_prevzeti_info (jde i bez přihlášení), web_k_prevzit_tym.
(function () {
  var e = HBK.esc, KLIC = "hb_prevzeti_token";
  function token() {
    var t = new URLSearchParams(location.search).get("t");
    try { if (t) localStorage.setItem(KLIC, t); else t = localStorage.getItem(KLIC); } catch (err) {}
    return t;
  }
  function zapomen() { try { localStorage.removeItem(KLIC); } catch (err) {} }
  function obsah(h) { document.getElementById("k-obsah").innerHTML = h; }

  async function nacti() {
    var t = token();
    if (!t) return obsah('<div class="k-karta"><p>Odkaz na převzetí chybí. Otevři ho prosím znovu z e-mailu.</p></div>');
    var prihlasen = await HBK.platnyToken();
    var lista = document.getElementById("k-lista"); if (lista) { lista.hidden = !prihlasen; var tm = document.getElementById("k-tym"); if (tm) tm.textContent = ""; }
    if (prihlasen) { try { await HBK.rpc("web_prihlaseni_dokonci"); } catch (err) {} }
    var i = null;
    try { i = await HBK.rpc("web_prevzeti_info", { p_token: t }); } catch (err) { return obsah('<p class="k-chyba">' + e(err.message) + "</p>"); }
    var STAV = { neznamy: "Tenhle odkaz na převzetí neznáme.", zruseno: "Kapitán předání zrušil.", vyprselo: "Odkaz vypršel. Požádej kapitána, ať předání pošle znovu.",
                 prijato: "Tým už je převzatý." };
    if (i.stav !== "ceka") { zapomen(); return obsah('<div class="k-karta"><p>' + e(STAV[i.stav] || i.stav) + "</p>" +
      (i.stav === "prijato" ? '<div class="k-akce"><a class="k-tlacitko" href="' + HB.zaklad + '/kapitan/">Do kapitánské sekce</a></div>' : "") + "</div>"); }
    var h = '<div class="k-karta"><h2>' + e((i.cislo ? i.cislo + " · " : "") + i.tym) + "</h2><p>" + e(i.od || "Kapitán") +
      " ti předává vedení týmu. Jako kapitán budeš spravovat soupisku, rozdělení etap a platbu. Odkaz platí do " + e(HBK.cas(i.plati_do)) + ".</p>";
    if (!prihlasen) {
      h += '<p>Nejdřív se přihlas e-mailem, na který odkaz přišel (' + e(i.email) + ').</p><div class="k-akce"><a class="k-tlacitko" href="' + HB.zaklad +
        "/kapitan/prihlaseni/?zpet=" + encodeURIComponent(HB.zaklad + "/kapitan/prevzeti/") + '">Přihlásit se</a></div>';
    } else if (!i.ja) {
      h += '<p class="k-chyba">Jsi přihlášený jiným e-mailem. Odkaz patří adrese ' + e(i.email) + '. Odhlas se a přihlas se jí.</p>' +
        '<div class="k-akce"><button type="button" class="k-vedlejsi" id="k-odhlasit">Odhlásit</button></div>';
    } else {
      h += '<p class="k-hlaska" id="pr-stav" role="status"></p><div class="k-akce"><button type="button" class="k-tlacitko" id="pr-prevzit">Převzít tým</button></div>';
    }
    obsah(h + "</div>");
  }

  document.addEventListener("click", async function (ev) {
    var t = ev.target && ev.target.closest && ev.target.closest("button"); if (!t || t.id !== "pr-prevzit") return;
    t.disabled = true;
    try {
      await HBK.rpc("web_k_prevzit_tym", { p_token: token() });
      zapomen();
      try { sessionStorage.setItem("hb_k_toast", "Tým je tvůj. Jsi kapitán."); } catch (err) {}
      location.href = HB.zaklad + "/kapitan/";
    } catch (err) { HBK.hlaska("pr-stav", err.message, true); t.disabled = false; }
  });

  document.addEventListener("DOMContentLoaded", nacti);
})();
