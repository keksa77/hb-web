// Seznamka – správa vlastního inzerátu běžce odkazem z e-mailu (Keksa 11. 10. 2026): zveřejnit, upravit, stáhnout.
// Databáze: web_seznamka_muj, web_seznamka_muj_uloz (bez přihlášení, odkaz s tokenem).
(function () {
  var el = document.getElementById("seznamka-muj"), t = new URLSearchParams(location.search).get("t"), M = null, esc = HBS.esc;
  function obsah(h) { el.innerHTML = h; }
  function zpet() { return '<p><a href="' + HB.zaklad + '/seznamka/">Zpět do seznamky</a></p>'; }
  function hlaska(t, chyba) { var h = el.querySelector(".sz-hlaska"); if (h) { h.textContent = t; h.className = "sz-hlaska" + (t ? (chyba ? " chyba" : " ok") : ""); } }

  function vykresli(text) {
    if (!M) return obsah('<p class="sz-hlaska chyba">Odkaz na inzerát neznáme. Otevři ho prosím znovu z e-mailu.</p>' + zpet());
    var STAV = { neovereno: "čeká na zveřejnění", zverejneno: "zveřejněný", stazeno: "stažený" };
    var h = '<p class="sz-pozn">Inzerát: <b>' + esc(M.jmeno) + " " + esc((M.prijmeni || "").slice(0, 1)) + ".</b> · " + esc(STAV[M.stav] || M.stav) + "</p>";
    if (text) h += '<p class="sz-hlaska ok">' + esc(text) + "</p>";
    if (!M.otevreno) return obsah(h + '<p class="sz-prazdno">Seznamka letos skončila.</p>' + zpet());
    if (M.stav === "neovereno") h += '<p>Inzerát se ukáže v seznamce, až ho zveřejníš.</p><p><button type="button" class="sz-tlacitko" id="m-zverejnit">Zveřejnit inzerát</button></p>';
    h += '<form class="sz-form" id="m-form" novalidate><h2>Upravit</h2>' +
      '<div class="sz-radek"><label>Kraj' + HBS.krajSelect("m-kraj", M.kraj) + '</label><label>Výkonnost na 10 km<input name="vykonnost" value="' + esc(M.vykonnost || "") + '" placeholder="52:30"></label>' +
      '<label>Kolik etap zvládneš<input name="etap" type="number" min="1" max="30" value="' + esc(M.etap || "") + '"></label></div>' +
      '<label>O mně *<textarea name="text" rows="4" maxlength="1000">' + esc(M.text || "") + "</textarea></label>" +
      '<p class="sz-hlaska" role="status"></p><button type="submit" class="sz-tlacitko">' + (M.stav === "zverejneno" ? "Uložit změny" : "Uložit a zveřejnit") + "</button></form>";
    if (M.stav !== "stazeno") h += '<p><button type="button" class="sz-vedlejsi" id="m-stahnout">Stáhnout inzerát – už tým mám</button></p>';
    obsah(h + zpet());
  }

  async function nacti(text) { M = await HBS.rpc("web_seznamka_muj", { p_token: t }); vykresli(text); }

  el.addEventListener("click", async function (ev) {
    var b = ev.target.closest("button"); if (!b || !b.id) return;
    var akce = { "m-zverejnit": "zverejnit", "m-stahnout": "stahnout" }[b.id]; if (!akce) return;
    b.disabled = true;
    try { await HBS.rpc("web_seznamka_muj_uloz", { p_token: t, p_akce: akce }); await nacti(akce === "zverejnit" ? "Inzerát je zveřejněný." : "Inzerát je stažený."); }
    catch (e) { hlaska(e.message, true); b.disabled = false; }
  });
  el.addEventListener("input", function () { hlaska(""); });
  el.addEventListener("submit", async function (ev) {
    ev.preventDefault(); var f = ev.target, v = function (n) { return (f.elements[n].value || "").trim(); }, b = f.querySelector("button[type=submit]");
    if (v("vykonnost") && !/^\d{1,2}:\d{2}$/.test(v("vykonnost"))) return hlaska("Výkonnost napiš jako čas na 10 km, např. 52:30.", true);
    if (!v("text")) return hlaska("Napiš pár slov o sobě.", true);
    b.disabled = true;
    try { await HBS.rpc("web_seznamka_muj_uloz", { p_token: t, p_akce: "ulozit", p_kraj: document.getElementById("m-kraj").value || null, p_vykonnost: v("vykonnost") || null,
        p_etap: v("etap") ? Number(v("etap")) : null, p_text: v("text") }); await nacti("Inzerát je uložený a zveřejněný."); }
    catch (e) { hlaska(e.message, true); b.disabled = false; }
  });

  if (!t) { vykresli(); return; }
  HBS.kraje().then(function () { return nacti(); }).catch(function (e) { obsah('<p class="sz-hlaska chyba">' + esc(e.message) + "</p>"); });
})();
