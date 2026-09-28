// Bankovní účty ročníku (tabulka rocnik_ucet) – podle varianty registračního mailu.
// Z nich se skládá číslo účtu, IBAN a QR platba v mailu. Měnit smí jen organizátor.
(function () {
  var ROK = "HB27";
  var VAR = { zakladni: "Varianta 1 (základní)", zvlastni: "Varianta 2 (zvláštní)" };
  async function uloz(r, pole, v) {
    var telo = {}; telo[pole] = String(v || "").trim() || null;
    var x = await HBA.db("rocnik_ucet?rok=eq." + encodeURIComponent(r.rok) + "&varianta=eq." + encodeURIComponent(r.varianta),
      { metoda: "PATCH", telo: telo, vratit: true });
    if (!x || !x.length) throw new Error("Změna se neuložila — účty smí měnit jen organizátor.");
  }
  function upr(pole) { return { ulozit: function (r, v) { return uloz(r, pole, v); } }; }

  document.addEventListener("DOMContentLoaded", async function () {
    var j = await HBA.vyzadovat(); if (!j) return;
    try { ROK = (await HBA.rpc("web_rocnik_webu")) || ROK; } catch (err) {}
    HBT({
      sekce: "ucty",
      nazev: "Bankovní účty",
      idPole: "varianta",
      nacist: function () { return HBA.db("rocnik_ucet?select=*&rok=eq." + ROK + "&order=varianta"); },
      pripravit: function (r) { r.varianta_text = VAR[r.varianta] || r.varianta; return r; },
      popisRadku: function (r) { return r.varianta_text + " · " + r.rok; },
      sloupce: [
        { pole: "varianta_text", nazev: "Varianta mailu", sirka: 190 },
        { pole: "cislo_uctu", nazev: "Číslo účtu", sirka: 160, uprava: upr("cislo_uctu") },
        { pole: "iban", nazev: "IBAN", sirka: 260, uprava: upr("iban") },
        { pole: "bic", nazev: "BIC/SWIFT", sirka: 130, uprava: upr("bic") }
      ],
      info: function () {
        return Promise.resolve("Ročník <b>" + HBA.esc(ROK) + "</b>. Z těchto údajů se skládá číslo účtu, IBAN a QR platba v registračním mailu. " +
          "Kterou variantu tým dostane, se rozhoduje ve Frontě mailů.");
      }
    });
  });
})();
