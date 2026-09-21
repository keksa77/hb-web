// Fronta registračních mailů ke schválení – tabulka.
// Do 10. 1. 2027 čeká každý registrační mail s pokyny k platbě na rozhodnutí organizátora.
// Limit 5 týmů na variantu 1, zákaz varianty 2 pro fakturované týmy a zákaz pokynů před 1. 1.
// u plnění 2027 hlídají triggery v databázi – tabulka jen ukáže jejich hlášku.
(function () {
  var e = HBA.esc;
  var STAV = { ceka: "čeká", schvaleno: "schváleno", zamitnuto: "zamítnuto", odeslano: "odesláno" };
  var VAR = { zakladni: "Varianta 1", zvlastni: "Varianta 2" };
  function an(b) { return b == null ? "" : b ? "ano" : "ne"; }

  async function zmen(r, telo) {
    var v = await HBA.db("web_maily_ke_schvaleni?id=eq." + r.id, { metoda: "PATCH", telo: telo, vratit: true });
    if (!v || !v.length) throw new Error("Změna se neuložila — nejspíš na ni nemáte práva.");
  }

  document.addEventListener("DOMContentLoaded", async function () {
    var j = await HBA.vyzadovat(); if (!j) return;
    HBT({
      sekce: "fronta",
      nazev: "Fronta mailů",
      idPole: "id",
      sirkaAkci: 170,
      nacist: function () { return HBA.db("web_v_fronta_mailu?select=*&order=vytvoreno.asc"); },
      pripravit: function (r) {
        r.stav_text = STAV[r.stav] || r.stav;
        r.faktura = an(r.fakturovat);
        r.varianta_text = VAR[r.varianta] || r.varianta;
        r.navrh_text = VAR[r.varianta_navrh] || r.varianta_navrh;
        r.limit_text = an(r.pocita_se_do_limitu);
        r.testovaci_text = an(r.testovaci);
        r.ucasti = (r.rocniky_ucasti || []).join(", ");
        r.pocet_ucasti = (r.rocniky_ucasti || []).length;
        r.vytvoreno_m = HBT.mistniCas(r.vytvoreno);
        r.rozhodnuto_m = HBT.mistniCas(r.rozhodnuto);
        return r;
      },
      popisRadku: function (r) { return r.tym + (r.vs ? " (" + r.vs + ")" : ""); },
      vychozi: { h: [{ field: "stav_text", value: ["čeká"] }, { field: "testovaci_text", value: ["ne"] }] },
      sloupce: [
        { pole: "stav_text", nazev: "Stav", typ: "vycet", sirka: 95 },
        { pole: "tym", nazev: "Tým", sirka: 190 },
        { pole: "vs", nazev: "VS", sirka: 80 },
        { pole: "varianta_text", nazev: "Varianta", typ: "vycet", sirka: 105, napoveda: "Schválená varianta, dokud není schválená, tak navržená" },
        { pole: "navrh_text", nazev: "Návrh", typ: "vycet", sirka: 100, skryty: true },
        { pole: "faktura", nazev: "Faktura", typ: "bool", sirka: 80 },
        { pole: "duzp_rok", nazev: "Plnění", typ: "vycet", sirka: 80, napoveda: "Rok zdanitelného plnění na faktuře" },
        { pole: "datum_faktury", nazev: "Datum faktury", typ: "datum", sirka: 115 },
        { pole: "pokyny_nejdriv", nazev: "Pokyny nejdřív", typ: "datum", sirka: 115, napoveda: "Kdy nejdřív smí odejít pokyny k platbě" },
        { pole: "limit_text", nazev: "Do limitu 5", typ: "bool", sirka: 95 },
        { pole: "kapitan", nazev: "Kapitán", sirka: 150 },
        { pole: "email", nazev: "E-mail", sirka: 190 },
        { pole: "telefon", nazev: "Telefon", sirka: 115 },
        { pole: "ucasti", nazev: "Účasti", sirka: 120, napoveda: "Ročníky, kterých se tým nebo kapitán zúčastnil" },
        { pole: "pocet_ucasti", nazev: "Počet účastí", typ: "cislo", sirka: 90 },
        { pole: "odberatel_nazev", nazev: "Odběratel", sirka: 160 },
        { pole: "odberatel_ic", nazev: "IČ", sirka: 90 },
        { pole: "fakturovat_upozorneni", nazev: "Upozornění", sirka: 200 },
        { pole: "poznamka", nazev: "Poznámka", sirka: 180, uprava: { tabulka: "web_maily_ke_schvaleni", klic: "id", dlouhy: true } },
        { pole: "vytvoreno_m", nazev: "Přihlášeno", typ: "cas", sirka: 130 },
        { pole: "rozhodl", nazev: "Rozhodl", sirka: 120 },
        { pole: "rozhodnuto_m", nazev: "Rozhodnuto", typ: "cas", sirka: 130 },
        { pole: "rok", nazev: "Ročník", typ: "vycet", sirka: 75, skryty: true },
        { pole: "testovaci_text", nazev: "Zkušební", typ: "bool", sirka: 85 }
      ],
      akceRadku: function (r) {
        if (r.stav !== "ceka") return '<button type="button" class="adm-mini" data-akce="vratit">Vrátit do fronty</button>';
        var h = '<button type="button" class="adm-mini' + (r.varianta_navrh === "zakladni" ? " adm-mini-hlavni" : "") + '" data-akce="schvalit" data-arg="zakladni" title="Schválit – varianta 1">✓ V1</button>';
        if (!r.fakturovat) h += '<button type="button" class="adm-mini' + (r.varianta_navrh === "zvlastni" ? " adm-mini-hlavni" : "") + '" data-akce="schvalit" data-arg="zvlastni" title="Schválit – varianta 2">✓ V2</button>';
        return h + '<button type="button" class="adm-mini adm-mini-cervene" data-akce="zamitnout" title="Zamítnout">✗</button>';
      },
      akce: {
        schvalit: function (r, varianta) { return zmen(r, { stav: "schvaleno", varianta_schvalena: varianta || r.varianta_navrh }); },
        zamitnout: function (r) { return zmen(r, { stav: "zamitnuto" }); },
        vratit: function (r) { return zmen(r, { stav: "ceka", varianta_schvalena: null }); }
      },
      hromadne: [
        { nazev: "Schválit navrženou variantu", akce: "schvalit", jen: function (r) { return r.stav === "ceka"; } },
        { nazev: "Zamítnout", akce: "zamitnout", jen: function (r) { return r.stav === "ceka"; } },
        { nazev: "Vrátit do fronty", akce: "vratit", jen: function (r) { return r.stav !== "ceka"; } }
      ],
      historie: function (r) { return [{ tabulka: "web_maily_ke_schvaleni", id: r.id }]; },
      info: async function () {
        var h = [];
        try {
          var z = await HBA.rpc("web_v1_zbyva", { p_rok: "HB27", p_testovaci: false });
          h.push("Volná místa na variantu 1 před 1. 1. 2027: <b>" + e(z) + " z 5</b>");
        } catch (err) {}
        var vse = await HBA.db("web_v_fronta_mailu?select=stav,testovaci");
        var ostre = vse.filter(function (r) { return !r.testovaci; }).length;
        var test = vse.length - ostre;
        if (!ostre) h.push("Ostrá fronta je prázdná — registrace HB27 ještě nezačala." + (test ? " Zkušební přihlášky (" + test + ") uvidíte po zrušení filtru Zkušební." : ""));
        h.push("Maily se zatím skutečně neodesílají.");
        return h.join(" · ");
      }
    });
  });
})();
