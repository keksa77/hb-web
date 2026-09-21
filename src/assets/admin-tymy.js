// Týmy – tabulka všech týmů s kapitánem, fakturačními údaji a stavem registračního mailu.
// Údaje týmu se zapisují do web_tym, údaje kapitána do web_osoba.
// Příznak faktury a rok plnění smí měnit jen organizátor (hlídá trigger v databázi).
(function () {
  function an(b) { return b == null ? "" : b ? "ano" : "ne"; }
  var STAV = { ceka: "čeká", schvaleno: "schváleno", zamitnuto: "zamítnuto", odeslano: "odesláno" };
  var VAR = { zakladni: "Varianta 1", zvlastni: "Varianta 2" };
  var T = { tabulka: "web_tym", klic: "id" };
  var O = { tabulka: "web_osoba", klic: "kapitan_id" };
  function t(sloupec, x) { return Object.assign({ sloupec: sloupec }, T, x || {}); }
  function o(sloupec, x) { return Object.assign({ sloupec: sloupec }, O, x || {}); }

  document.addEventListener("DOMContentLoaded", async function () {
    var j = await HBA.vyzadovat(); if (!j) return;
    HBT({
      sekce: "tymy",
      nazev: "Týmy",
      idPole: "id",
      nacist: function () { return HBA.db("web_v_tymy_admin?select=*&order=vytvoreno.asc"); },
      pripravit: function (r) {
        r.zaplaceno_t = an(r.zaplaceno);
        r.na_startu_t = an(r.na_startu);
        r.fakturovat_t = an(r.fakturovat);
        r.testovaci_t = an(r.testovaci);
        r.ucasti = (r.rocniky_ucasti || []).join(", ");
        r.pocet_ucasti = (r.rocniky_ucasti || []).length;
        r.mail_stav_t = STAV[r.mail_stav] || r.mail_stav || "";
        r.mail_varianta_t = VAR[r.mail_varianta] || r.mail_varianta || "";
        r.vytvoreno_m = HBT.mistniCas(r.vytvoreno);
        r.upraveno_m = HBT.mistniCas(r.upraveno);
        r.start_cas_m = HBT.mistniCas(r.start_cas);
        return r;
      },
      popisRadku: function (r) { return r.nazev + (r.vs ? " (" + r.vs + ")" : ""); },
      sloupce: [
        { pole: "rok", nazev: "Ročník", typ: "vycet", sirka: 75 },
        { pole: "vs", nazev: "VS", sirka: 80 },
        { pole: "nazev", nazev: "Tým", sirka: 190, uprava: t("nazev") },
        { pole: "kategorie", nazev: "Kategorie", typ: "vycet", sirka: 100, uprava: t("kategorie") },
        { pole: "stav_registrace", nazev: "Stav registrace", typ: "vycet", sirka: 120, uprava: t("stav_registrace") },
        { pole: "mail_stav_t", nazev: "Mail", typ: "vycet", sirka: 90, napoveda: "Stav registračního mailu ve frontě" },
        { pole: "mail_varianta_t", nazev: "Varianta", typ: "vycet", sirka: 100 },
        { pole: "kapitan_jmeno", nazev: "Kapitán – jméno", sirka: 110, uprava: o("jmeno") },
        { pole: "kapitan_prijmeni", nazev: "Kapitán – příjmení", sirka: 120, uprava: o("prijmeni") },
        { pole: "email", nazev: "E-mail", sirka: 190, uprava: o("email"), napoveda: "E-mail kapitána = přihlašovací jméno do kapitánské sekce" },
        { pole: "telefon", nazev: "Telefon", sirka: 115, uprava: o("telefon") },
        { pole: "zaplaceno_t", nazev: "Zaplaceno", typ: "bool", sirka: 90, uprava: t("zaplaceno") },
        { pole: "zaplaceno_dne", nazev: "Zaplaceno dne", typ: "datum", sirka: 115, uprava: t("zaplaceno_dne") },
        { pole: "castka_kc", nazev: "Částka Kč", typ: "cislo", sirka: 95, uprava: t("castka_kc") },
        { pole: "fakturovat_t", nazev: "Faktura", typ: "bool", sirka: 80, uprava: t("fakturovat") },
        { pole: "duzp_rok", nazev: "Plnění", typ: "vycet", sirka: 75, uprava: t("duzp_rok", { hodnoty: ["2026", "2027"] }) },
        { pole: "datum_faktury", nazev: "Datum faktury", typ: "datum", sirka: 115 },
        { pole: "odberatel_nazev", nazev: "Odběratel", sirka: 160, uprava: t("odberatel_nazev") },
        { pole: "odberatel_ic", nazev: "IČ", sirka: 90, uprava: t("odberatel_ic") },
        { pole: "odberatel_dic", nazev: "DIČ", sirka: 100, uprava: t("odberatel_dic") },
        { pole: "odberatel_adresa", nazev: "Adresa odběratele", sirka: 200, uprava: t("odberatel_adresa", { dlouhy: true }) },
        { pole: "fakturovat_poznamka", nazev: "Poznámka k faktuře", sirka: 160, uprava: t("fakturovat_poznamka", { dlouhy: true }) },
        { pole: "fakturovat_upozorneni", nazev: "Upozornění", sirka: 200 },
        { pole: "ucasti", nazev: "Účasti", sirka: 120 },
        { pole: "pocet_ucasti", nazev: "Počet účastí", typ: "cislo", sirka: 90 },
        { pole: "kraj", nazev: "Kraj", typ: "vycet", sirka: 110, uprava: t("kraj") },
        { pole: "na_startu_t", nazev: "Na startu", typ: "bool", sirka: 85, uprava: t("na_startu"), skryty: true },
        { pole: "start_cas_m", nazev: "Start", typ: "cas", sirka: 120, skryty: true },
        { pole: "cislo", nazev: "Startovní číslo", typ: "cislo", sirka: 90, uprava: t("cislo"), skryty: true },
        { pole: "poznamka", nazev: "Poznámka", sirka: 180, uprava: t("poznamka", { dlouhy: true }) },
        { pole: "stav_poznamka", nazev: "Poznámka ke stavu", sirka: 160, uprava: t("stav_poznamka", { dlouhy: true }), skryty: true },
        { pole: "testovaci_t", nazev: "Zkušební", typ: "bool", sirka: 85 },
        { pole: "vytvoreno_m", nazev: "Přihlášeno", typ: "cas", sirka: 130 },
        { pole: "upraveno_m", nazev: "Upraveno", typ: "cas", sirka: 130, skryty: true }
      ],
      historie: function (r) {
        var h = [{ tabulka: "web_tym", id: r.id }];
        if (r.kapitan_id) h.push({ tabulka: "web_osoba", id: r.kapitan_id });
        return h;
      },
      info: async function () {
        return "Dvojklik na buňku ji upraví, klik na řádek otevře celý tým vpravo. Údaje kapitána se ukládají k jeho osobě.";
      }
    });
  });
})();
