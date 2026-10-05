// Kapitánská sekce – přidání běžce, krok A „Kdo poběží?“: výběr z lidí, které databáze zná z minulých ročníků
// týmu (web_k_nabidka_bezcu), nebo „Nový běžec“. Vybraný člověk se předá na stránku Údaje běžce (Keksa 4. 10. 2026).
(function () {
  var e = HBK.esc;
  var NABIDKA = [];

  function vykresli(P, soupiska) {
    var na = {};
    soupiska.forEach(function (r) { na[String(r.email || "").toLowerCase()] = 1; na[(r.jmeno + " " + r.prijmeni).toLowerCase()] = 1; });
    var videno = {};
    NABIDKA = NABIDKA.filter(function (h) {
      var k = String(h.email || h.jmeno || "").toLowerCase();
      if (!k || videno[k] || na[String(h.email || "").toLowerCase()] || na[String(h.jmeno || "").toLowerCase()]) return false;
      videno[k] = 1; return true;
    });
    var h = [], k = HBK.konceptNacti(HBK.konceptKlic(P.tym_id, null));
    if (k) h.push('<p class="k-koncept">Máš rozepsaného běžce' + (k.jmeno ? " <b>" + e(k.jmeno) + "</b>" : "") + ", zatím není na soupisce. " +
      '<a href="' + HB.zaklad + '/kapitan/bezec/udaje/?novy=1">Pokračovat v údajích →</a></p>');
    if (NABIDKA.length) {
      h.push('<p class="k-uvod">Tyhle lidi z minulých ročníků tvého týmu databáze zná. Vyber, koho chceš přidat, údaje se vyplní samy a jen je zkontroluješ. ' +
        "Když na seznamu není, přidej nového běžce.</p>");
      if (NABIDKA.length > 8) h.push('<label class="k-pole k-hledat" for="k-hledat">Hledat jméno<input id="k-hledat" type="search" autocomplete="off" placeholder="např. Nováková"></label>');
      h.push('<ul class="k-vyber">' + NABIDKA.map(function (x, i) {
        return '<li data-jmeno="' + e(String(x.jmeno || "").toLowerCase()) + '"><button type="button" class="k-vyber-polozka" data-vybrat="' + i + '">' +
          "<b>" + e(x.jmeno) + "</b><span>" + e(x.rocniky || x.rocnik) + (x.mesto ? " · " + e(x.mesto) : "") + "</span>" +
          (x.roky && x.roky.length
            ? '<span class="k-roky"><span class="k-roky-titulek">Výkonnost na 10 km:</span>' + HBK.rokyVykonnosti(x.roky).map(function (t) { return "<span>" + t + "</span>"; }).join("") + "</span>"
            : x.vykonnost_10km ? "<span>hlášená výkonnost " + e(HBK.vykonnost(x.vykonnost_10km)) + " na 10 km</span>" : "") +
          "<small>Vybrat a zkontrolovat údaje →</small></button></li>";
      }).join("") + "</ul>");
    } else {
      h.push('<p class="k-uvod">Z minulých ročníků tvého týmu nikoho dalšího neznáme. Přidej nového běžce a vyplň jeho údaje.</p>');
    }
    h.push('<div class="k-akce k-akce-hlavni"><a class="' + (NABIDKA.length ? "k-vedlejsi k-tlacitko-s-napovedou" : "k-tlacitko k-tlacitko-s-napovedou") +
      '" href="' + HB.zaklad + '/kapitan/bezec/udaje/?novy=1">Nový běžec' + (NABIDKA.length ? " – není v seznamu" : "") +
      "<small>Všechny údaje vyplníš ručně.</small></a></div>");
    document.getElementById("k-obsah").innerHTML = h.join("");
  }

  document.addEventListener("input", function (ev) {
    if (!ev.target || ev.target.id !== "k-hledat") return;
    var q = ev.target.value.trim().toLowerCase();
    [].forEach.call(document.querySelectorAll(".k-vyber li"), function (li) { li.hidden = q && li.getAttribute("data-jmeno").indexOf(q) < 0; });
  });

  document.addEventListener("click", function (ev) {
    var b = ev.target && ev.target.closest && ev.target.closest("[data-vybrat]"); if (!b) return;
    try { sessionStorage.setItem("hb_k_vybrany", JSON.stringify(NABIDKA[Number(b.dataset.vybrat)])); } catch (err) {}
    location.href = HB.zaklad + "/kapitan/bezec/udaje/?z=historie";
  });

  document.addEventListener("DOMContentLoaded", async function () {
    var P = await HBK.vyzadovat(); if (!P) return;
    HBK.navigace(P, { zpet: { n: "Soupiska", url: "/kapitan/soupiska/", hint: "Bez přidání běžce." } });
    if (P.role === "bezec" || !P.soupiska_otevrena || P.pocet_potvrzen || P.bezcu >= P.max_bezcu) {
      document.getElementById("k-obsah").innerHTML = '<p class="k-pozn">' + (P.role === "bezec" ? "Běžce přidává kapitán nebo zástupce týmu."
        : !P.soupiska_otevrena ? "Soupiska je uzavřená. Změny řeší pořadatel na info@horybory.cz."
        : P.pocet_potvrzen ? "Konečný počet máš potvrzený. Když chceš přidat běžce, nejdřív ho změň v kroku Konečný počet."
        : "Soupiska je plná.") + "</p>";
      return;
    }
    try {
      var v = await Promise.all([HBK.rpc("web_k_nabidka_bezcu"), HBK.rpc("web_k_soupiska")]);
      NABIDKA = v[0] || []; vykresli(P, v[1] || []);
    } catch (err) { document.getElementById("k-obsah").innerHTML = '<p class="k-chyba">' + e(err.message) + "</p>"; }
  });
})();
