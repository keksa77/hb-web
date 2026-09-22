// Nastavení – parametry z tabulek parametr_definice a parametr_hodnota.
// Dvě stránky: „Nastavení ročníku“ (hodnota pro každý ročník, vedle loňská) a „Obecné nastavení“ (trvalé).
// Typ a rozsah hlídá databáze; nesmyslná hodnota se neuloží a vrátí se hláška, jak ji zadat.
(function () {
  var TYP = { cele: "celé číslo", cislo: "číslo", cas: "čas", datum: "datum", datumcas: "datum a čas", trvani: "doba",
              text: "text", email: "e-mail", odkaz: "odkaz", ano_ne: "ano / ne", seznam_cisel: "čísla", rocnik: "ročník" };
  var PRAVA = { organizator: "organizátor", admin: "jen správce", nikdo: "jen ke čtení" };
  function zobraz(typ, v) {
    if (v == null || v === "") return "";
    if (typ === "datum" || typ === "datumcas") return HBT.ceskeDatum(v);
    if (typ === "cislo") return String(v).replace(".", ",");
    if (typ === "cas") return String(v).replace(/^0(\d):/, "$1:");
    return String(v);
  }
  function rozsah(r) {
    if (r.min == null && r.max == null) return "";
    return String(r.min ?? "").replace(".", ",") + " – " + String(r.max ?? "").replace(".", ",");
  }
  async function uloz(r, v) {
    var x = await HBA.db("parametr_hodnota?id=eq." + r.id, { metoda: "PATCH", telo: { hodnota: v === "" ? null : v }, vratit: true });
    if (!x || !x.length) throw new Error("Změna se neuložila — tenhle parametr smí měnit " + (PRAVA[r.prava] || r.prava) + ".");
  }

  document.addEventListener("DOMContentLoaded", async function () {
    var j = await HBA.vyzadovat(); if (!j) return;
    var rocni = document.body.dataset.nastaveni !== "obecne";
    var sloupce = [];
    if (rocni) sloupce.push({ pole: "rok", nazev: "Ročník", typ: "vycet", sirka: 70 });
    sloupce = sloupce.concat([
      { pole: "skupina", nazev: "Skupina", typ: "vycet", sirka: 170 },
      { pole: "oddil", nazev: "Oddíl", typ: "vycet", sirka: 130 },
      { pole: "nazev", nazev: "Parametr", sirka: 280 },
      { pole: "hodnota_t", nazev: "Hodnota", sirka: 150, zarovnat: "right",
        napoveda: "Dvojklik upraví. Čas 6:30, datum 17. 11. 2026, datum a čas 17. 11. 2026 10:00, ano/ne.",
        uprava: { klic: "id", ulozit: uloz } },
      { pole: "jednotka", nazev: "Jednotka", typ: "vycet", sirka: 80 }
    ]);
    if (rocni) sloupce.push({ pole: "predchozi_t", nazev: "Loni", sirka: 120, zarovnat: "right", napoveda: "Hodnota v předchozím ročníku" });
    sloupce = sloupce.concat([
      { pole: "popis", nazev: "Jak se používá", sirka: 360 },
      { pole: "typ_t", nazev: "Typ", typ: "vycet", sirka: 95, skryty: true },
      { pole: "rozsah", nazev: "Rozsah", sirka: 90, skryty: true },
      { pole: "prava_t", nazev: "Kdo smí měnit", typ: "vycet", sirka: 110, skryty: true },
      { pole: "upravil", nazev: "Změnil", sirka: 120 },
      { pole: "upraveno_m", nazev: "Změněno", typ: "cas", sirka: 125 },
      { pole: "puvodne", nazev: "Původně uloženo", sirka: 170, skryty: true }
    ]);

    HBT({
      sekce: rocni ? "nastaveni" : "nastaveni-obecne",
      nazev: rocni ? "Nastavení ročníku" : "Obecné nastavení",
      idPole: "id",
      nacist: function () {
        return HBA.db((rocni ? "web_v_nastaveni_rocnik" : "web_v_nastaveni_obecne") + "?select=*&order=poradi.asc" + (rocni ? ",rok.desc" : ""));
      },
      pripravit: function (r) {
        r.hodnota_t = zobraz(r.typ, r.hodnota);
        r.predchozi_t = zobraz(r.typ, r.predchozi);
        r.typ_t = TYP[r.typ] || r.typ;
        r.prava_t = PRAVA[r.prava] || r.prava;
        r.rozsah = rozsah(r);
        r.upraveno_m = HBT.mistniCas(r.upraveno);
        return r;
      },
      popisRadku: function (r) { return r.nazev + (r.rok ? " · " + r.rok : ""); },
      pridat: rocni ? {
        nazev: "Založit ročník",
        napoveda: "Nový ročník převezme všechna nastavení z vybraného ročníku. Registrace od–do a PDF výsledků zůstanou prázdné.",
        pole: [
          { pole: "rok", nazev: "Nový ročník (např. HB28)", povinne: true },
          { pole: "nazev", nazev: "Název (např. Hory Bory 2028)" },
          { pole: "z", nazev: "Zkopírovat z ročníku", povinne: true, hodnoty: async function () {
              var r = await HBA.db("rocnik?select=rok&order=rok.desc");
              return r.map(function (x) { return { value: x.rok, label: x.rok }; });
            } }
        ],
        ulozit: function (d) { return HBA.rpc("web_zaloz_rocnik", { p_rok: d.rok.toUpperCase(), p_nazev: d.nazev, p_z: d.z }); }
      } : null,
      sloupce: sloupce,
      historie: function (r) { return [{ tabulka: "parametr_hodnota", id: r.id }]; },
      info: async function () {
        return rocni ? "Otevírá se aktivní ročník, ostatní vyberte ve filtru Ročník. Dvojklik na hodnotu ji upraví; typ a rozsah hlídá databáze."
                     : "Trvalá nastavení bez vazby na ročník.";
      }
    });
  });
})();
