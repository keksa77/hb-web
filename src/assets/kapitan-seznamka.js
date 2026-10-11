// Kapitánská sekce – poptávka týmu v seznamce „Hledáme běžce“ (Keksa 11. 10. 2026). Zadává kapitán nebo zástupce,
// zveřejní se hned v seznamce (/seznamka/). Zájemci píšou přes formulář na webu, zprávy chodí e-mailem tomu, kdo poptávku
// naposledy uložil. Zmizí po skončení závodu. Databáze: web_k_seznamka, web_k_seznamka_uloz.
(function () {
  var e = HBK.esc, D = null, KRAJE = [];
  function krajSelect(vybrany) {
    var Z = { CZ: "Česko", SK: "Slovensko", PL: "Polsko" }, z = null, h = '<select id="s-kraj"><option value="">— neuvádíme —</option>';
    KRAJE.forEach(function (k) { if (k.zeme !== z) { if (z) h += "</optgroup>"; z = k.zeme; h += '<optgroup label="' + e(Z[z] || z) + '">'; }
      h += '<option value="' + e(k.kod) + '"' + (k.kod === vybrany ? " selected" : "") + ">" + e(k.nazev) + "</option>"; });
    return h + (z ? "</optgroup>" : "") + "</select>";
  }
  function vykresli() {
    var h = [], p = D && D.poptavka;
    if (!D) { document.getElementById("k-obsah").innerHTML = '<div class="k-karta"><p>Tým jsme nenašli.</p></div>'; return; }
    h.push('<p class="k-uvod">Chybí vám běžci? Dejte poptávku do <a href="' + HB.zaklad + '/seznamka/">seznamky</a>. Ukáže se s názvem týmu, ' +
      "e-mail nikde. Kdo má zájem, napíše přes formulář a zprávu vám pošleme e-mailem. Poptávka zmizí po skončení závodu.</p>");
    if (p) h.push('<div class="k-karta"><h2>Poptávka je zveřejněná</h2><p>Hledáte ' + p.pocet + (p.pocet === 1 ? " běžce" : p.pocet < 5 ? " běžce" : " běžců") + " · upraveno " + e(HBK.cas(p.upraveno)) +
      (p.zprav ? " · přišlo zpráv: " + p.zprav : "") + "</p></div>");
    if (!D.muze) h.push('<div class="k-karta"><p>Poptávku za tým zadává kapitán nebo zástupce.</p></div>');
    else if (!D.otevreno) h.push('<div class="k-karta"><p>Seznamka letos skončila.</p></div>');
    else {
      h.push('<form class="k-karta" id="k-seznamka-form" novalidate><h2>' + (p ? "Upravit poptávku" : "Nová poptávka") + "</h2>" +
        '<label class="k-pole" for="s-pocet">Kolik běžců hledáte *<input id="s-pocet" type="number" min="1" max="30" inputmode="numeric" value="' + e(p ? p.pocet : "") + '"></label>' +
        '<label class="k-pole" for="s-kraj">Odkud by měli být' + krajSelect(p && p.kraj) + "</label>" +
        '<label class="k-pole" for="s-vykonnost">Výkonnost na 10 km<input id="s-vykonnost" inputmode="numeric" placeholder="55:00" value="' + e(p && p.vykonnost || "") + '"><small>Nepovinné. Přibližný čas, který hledáte.</small></label>' +
        '<label class="k-pole" for="s-text">Co hledáte *<textarea id="s-text" rows="4" maxlength="1000" placeholder="Jaké etapy, jestli máte místo v autě…">' + e(p ? p.text : "") + "</textarea></label>" +
        '<p class="k-hlaska" id="s-stav" role="status"></p><div class="k-akce"><button type="submit" class="k-tlacitko" id="s-ulozit">' + (p ? "Uložit změny" : "Zveřejnit poptávku") + "</button>" +
        (p ? ' <button type="button" class="k-vedlejsi" id="s-stahnout">Stáhnout poptávku</button>' : "") + "</div></form>");
    }
    document.getElementById("k-obsah").innerHTML = h.join("");
  }
  async function obnov(t) { D = await HBK.rpc("web_k_seznamka"); vykresli(); if (t) HBK.toast(t); }
  document.addEventListener("input", function (ev) { if (ev.target.closest && ev.target.closest("#k-seznamka-form")) HBK.hlaska("s-stav", ""); });
  document.addEventListener("submit", async function (ev) {
    if (ev.target.id !== "k-seznamka-form") return; ev.preventDefault();
    var pocet = Number(document.getElementById("s-pocet").value), vyk = document.getElementById("s-vykonnost").value.trim(), text = document.getElementById("s-text").value.trim();
    var chyba = !(pocet >= 1 && pocet <= 30) ? "Napiš, kolik běžců hledáte (1 až 30)." : vyk && !/^\d{1,2}:\d{2}$/.test(vyk) ? "Výkonnost napiš jako čas na 10 km, např. 55:00." : !text ? "Napiš, koho hledáte." : null;
    if (chyba) return HBK.hlaska("s-stav", chyba, true);
    var b = document.getElementById("s-ulozit"); b.disabled = true;
    try { await HBK.rpc("web_k_seznamka_uloz", { p_akce: "ulozit", p_pocet: pocet, p_kraj: document.getElementById("s-kraj").value || null, p_vykonnost: vyk || null, p_text: text });
      await obnov("Poptávka je v seznamce."); }
    catch (err) { HBK.hlaska("s-stav", err.message, true); b.disabled = false; }
  });
  document.addEventListener("click", async function (ev) {
    var t = ev.target && ev.target.closest && ev.target.closest("#s-stahnout"); if (!t) return;
    t.disabled = true;
    try { await HBK.rpc("web_k_seznamka_uloz", { p_akce: "stahnout" }); await obnov("Poptávka je stažená."); } catch (err) { HBK.toast(err.message); t.disabled = false; }
  });
  document.addEventListener("DOMContentLoaded", async function () {
    var P = await HBK.vyzadovat(); if (!P) return;
    HBK.navigace(P, { zpet: { n: "Přehled týmu", url: "/kapitan/", hint: "Zpět na přehled týmu." } });
    try { KRAJE = await HBK.db("web_kraj?select=kod,nazev,zeme&aktivni=eq.true&order=poradi"); D = await HBK.rpc("web_k_seznamka"); }
    catch (err) { document.getElementById("k-obsah").innerHTML = '<p class="k-chyba">' + e(err.message) + "</p>"; return; }
    vykresli();
  });
})();
