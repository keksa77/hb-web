// Fronta ke schválení registračních mailů.
// Rozhodnutí se zapisuje do web_maily_ke_schvaleni; kdo a kdy rozhodl, doplní databáze.
// Limit 5 týmů na variantu 1, zákaz varianty 2 pro fakturované týmy a zákaz pokynů před 1. 1.
// u plnění 2027 hlídají triggery v databázi — tady se jen ukáže jejich hláška.
(function () {
  var e = HBA.esc, VAR = { zakladni: "Varianta 1", zvlastni: "Varianta 2" };
  var ucty = {}, radky = [];

  function el(id) { return document.getElementById(id); }
  function hlaska(id, text) {
    ["adm-chyba", "adm-ok"].forEach(function (x) { el(x).hidden = true; });
    if (text) { el(id).textContent = text; el(id).hidden = false; }
  }

  async function nacti() {
    var stav = el("f-stav").value, skupina = el("f-skupina").value, test = el("f-test").checked;
    var q = "web_v_fronta_mailu?select=*&order=vytvoreno.asc&testovaci=is." + (test ? "true" : "false");
    if (stav === "ceka") q += "&stav=eq.ceka";
    if (stav === "vyrizene") q += "&stav=neq.ceka";
    if (skupina !== "vse") q += "&skupina=eq." + encodeURIComponent(skupina);
    radky = await HBA.db(q);
    vykresli();
    await souhrn(test);
  }

  async function souhrn(test) {
    var vse = await HBA.db("web_v_fronta_mailu?select=stav,skupina,varianta&testovaci=is." + (test ? "true" : "false"));
    var ceka = vse.filter(function (r) { return r.stav === "ceka"; });
    var zbyva = await HBA.rpc("web_v1_zbyva", { p_rok: "HB27", p_testovaci: test });
    el("adm-souhrn").innerHTML =
      '<div><b>' + ceka.length + '</b><span>čeká na rozhodnutí</span></div>' +
      '<div><b>' + ceka.filter(function (r) { return r.skupina === "faktura"; }).length + '</b><span>z toho s fakturou</span></div>' +
      '<div><b>' + (zbyva == null ? "–" : zbyva) + '</b><span>volných míst na variantu 1<br>před 1. 1. 2027 (z 5)</span></div>' +
      (test ? '<div class="adm-test"><b>TEST</b><span>zobrazené jsou zkušební přihlášky</span></div>' : "");
  }

  function vykresli() {
    if (!radky.length) { el("adm-seznam").innerHTML = '<p class="adm-sub">Nic tu není.</p>'; return; }
    el("adm-seznam").innerHTML = radky.map(karta).join("");
  }

  function karta(r) {
    var v = r.varianta, u = ucty[v] || {};
    var fakt = r.fakturovat
      ? '<dl class="adm-dl">' +
          '<dt>Odběratel</dt><dd>' + e(r.odberatel_nazev) + (r.odberatel_ic ? ", IČ " + e(r.odberatel_ic) : "") + '</dd>' +
          '<dt>Plnění</dt><dd>' + e(r.duzp_rok) + ' · faktura ' + HBA.datum(r.datum_faktury) + '</dd>' +
          (r.pokyny_nejdriv ? '<dt>Pokyny k platbě</dt><dd>nejdřív ' + HBA.datum(r.pokyny_nejdriv) + '</dd>' : "") +
          '<dt>Limit 5</dt><dd>' + (r.pocita_se_do_limitu ? "počítá se" : "nepočítá se") + '</dd>' +
        '</dl>'
      : '<p class="adm-sub">Bez faktury.</p>';
    var rozhodnuto = r.stav !== "ceka"
      ? '<p class="adm-sub">' + ({ schvaleno: "Schváleno", zamitnuto: "Zamítnuto", odeslano: "Odesláno" }[r.stav] || e(r.stav)) +
        ' · ' + e(r.rozhodl || "?") + ' · ' + HBA.cas(r.rozhodnuto) + '</p>'
      : "";
    var tl = r.stav === "ceka"
      ? '<button class="adm-tlacitko" data-akce="schvalit" data-var="' + v + '">Schválit – ' + VAR[v] + '</button>' +
        (r.fakturovat ? "" :
          '<button class="adm-male" data-akce="schvalit" data-var="' + (v === "zakladni" ? "zvlastni" : "zakladni") + '">Schválit jako ' +
          VAR[v === "zakladni" ? "zvlastni" : "zakladni"] + '</button>') +
        '<button class="adm-male adm-male-cervene" data-akce="zamitnout">Zamítnout</button>'
      : '<button class="adm-male" data-akce="vratit">Vrátit do fronty</button>';

    return '<article class="adm-karta adm-polozka adm-' + (r.fakturovat ? "faktura" : "bez") + '" data-id="' + r.id + '">' +
      '<header><h2>' + e(r.tym) + '</h2><span class="adm-vs">' + e(r.vs || "bez VS") + '</span>' +
        '<span class="adm-stitek adm-stitek-' + v + '">' + VAR[v] + (u.cislo_uctu ? " · " + e(u.cislo_uctu) : "") + '</span></header>' +
      '<div class="adm-mrizka">' +
        '<div><h3>Kapitán</h3><p>' + e(r.kapitan) + '<br><a href="mailto:' + e(r.email) + '">' + e(r.email) + '</a>' +
          (r.telefon ? '<br>' + e(r.telefon) : "") + '</p>' +
          '<p class="adm-sub">Přihláška ' + HBA.cas(r.vytvoreno) + '</p></div>' +
        '<div><h3>Faktura</h3>' + fakt + '</div>' +
        '<div><h3>Běželi</h3><p>' + (r.rocniky_ucasti && r.rocniky_ucasti.length ? e(r.rocniky_ucasti.join(", ")) : "poprvé") + '</p>' +
          (r.fakturovat_upozorneni ? '<p class="adm-upozorneni">' + e(r.fakturovat_upozorneni) + '</p>' : "") + '</div>' +
      '</div>' +
      rozhodnuto +
      '<label class="adm-pole adm-poznamka">Poznámka<input data-poznamka value="' + e(r.poznamka || "") + '"></label>' +
      '<div class="adm-akce">' + tl + '</div>' +
    '</article>';
  }

  async function rozhodni(id, akce, varianta, poznamka) {
    var telo = { poznamka: poznamka || null };
    if (akce === "schvalit") { telo.stav = "schvaleno"; telo.varianta_schvalena = varianta; }
    if (akce === "zamitnout") { telo.stav = "zamitnuto"; }
    if (akce === "vratit") { telo.stav = "ceka"; telo.varianta_schvalena = null; }
    var vysl = await HBA.db("web_maily_ke_schvaleni?id=eq." + id, { metoda: "PATCH", telo: telo, vratit: true });
    if (!vysl || !vysl.length) throw new Error("Změna se neuložila — nejspíš na ni nemáte práva.");
  }

  document.addEventListener("click", async function (ev) {
    var b = ev.target.closest("button[data-akce]"); if (!b) return;
    var k = b.closest("[data-id]"), id = k.getAttribute("data-id");
    var pozn = k.querySelector("[data-poznamka]").value.trim();
    b.disabled = true; hlaska();
    try {
      await rozhodni(id, b.dataset.akce, b.dataset.var, pozn);
      hlaska("adm-ok", "Uloženo: " + k.querySelector("h2").textContent + ".");
      await nacti();
    } catch (err) {
      hlaska("adm-chyba", err.message);
      b.disabled = false;
      el("adm-chyba").scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });

  document.addEventListener("DOMContentLoaded", async function () {
    var j = await HBA.vyzadovat(); if (!j) return;
    try {
      (await HBA.db("rocnik_ucet?select=varianta,cislo_uctu&rok=eq.HB27")).forEach(function (u) { ucty[u.varianta] = u; });
    } catch (err) { /* účet je jen pro informaci */ }
    ["f-stav", "f-skupina", "f-test"].forEach(function (x) { el(x).addEventListener("change", function () { nacti().catch(function (err) { hlaska("adm-chyba", err.message); }); }); });
    el("f-obnovit").addEventListener("click", function () { nacti().catch(function (err) { hlaska("adm-chyba", err.message); }); });
    nacti().catch(function (err) { hlaska("adm-chyba", err.message); });
  });
})();
