// Odchozí maily – všechno, co databáze připravila k odeslání (tabulka web_mail_fronta).
// Nic se neposílá samo: organizátor si mail prohlédne a odešle ho tlačítkem (zadání Keksy 28. 9. 2026).
// Odeslání dělá funkce poslat-maily v Supabase přes schránku info@horybory.cz.
(function () {
  var e = HBA.esc;
  var STAV = { ceka: "čeká na odeslání", odesilam: "odesílá se", odeslano: "odesláno", chyba: "chyba", zruseno: "zrušeno" };
  var VAR = { zakladni: "Varianta 1", zvlastni: "Varianta 2" };
  function an(b) { return b == null ? "" : b ? "ano" : "ne"; }

  async function odeslat(ids) {
    var t = await HBA.token();
    if (!t) throw new Error("Přihlášení chybí nebo vypršelo. Přihlas se znovu.");
    var r = await fetch(HB.url + "/functions/v1/poslat-maily", {
      method: "POST",
      headers: { apikey: HB.klic, Authorization: "Bearer " + t, "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ids })
    });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(j.chyba || ("Chyba " + r.status));
    if (j.potize && j.potize.length) throw new Error("Neodešlo se: " + j.potize.map(function (p) { return p.chyba; }).join(" · "));
    if (!j.odeslano) throw new Error(j.zprava || "Nic se neodeslalo.");
    return j;
  }

  function nahled(r) {
    var w = window.open("", "_blank");
    if (!w) throw new Error("Prohlížeč zablokoval nové okno — povol vyskakovací okna pro tuto stránku.");
    var telo = String(r.telo || "").replace(/\[\[QR:[^\]]*\]\]/g, "[zde bude QR kód pro platbu]");
    w.document.write('<!doctype html><meta charset="utf-8"><title>' + e(r.predmet) + '</title>' +
      '<body style="font:15px/1.6 Arial,sans-serif;max-width:680px;margin:24px auto;padding:0 16px;color:#2A2621">' +
      '<p style="color:#6E665B;font-size:13px"><b>Komu:</b> ' + e(r.komu) + '<br><b>Předmět:</b> ' + e(r.predmet) + '</p>' +
      '<pre style="white-space:pre-wrap;font:inherit;border-top:1px solid #E3DCD0;padding-top:12px">' + e(telo) + '</pre></body>');
    w.document.close();
    return Promise.resolve();
  }

  document.addEventListener("DOMContentLoaded", async function () {
    var j = await HBA.vyzadovat(); if (!j) return;
    HBT({
      sekce: "odchozi",
      nazev: "Odchozí maily",
      idPole: "id",
      sirkaAkci: 190,
      nacist: function () { return HBA.db("web_v_odchozi_maily?select=*&order=vytvoreno.asc"); },
      pripravit: function (r) {
        r.stav_text = STAV[r.stav] || r.stav;
        r.varianta_text = VAR[r.varianta] || r.varianta;
        r.testovaci_text = an(r.testovaci);
        r.vytvoreno_m = HBT.mistniCas(r.vytvoreno);
        r.odeslano_m = HBT.mistniCas(r.odeslano);
        r.druh = r.sablona_nazev || r.sablona;
        return r;
      },
      popisRadku: function (r) { return r.predmet; },
      vychozi: { h: [{ field: "stav_text", value: ["čeká na odeslání"] }] },
      sloupce: [
        { pole: "stav_text", nazev: "Stav", typ: "vycet", sirka: 135 },
        { pole: "druh", nazev: "Mail", typ: "vycet", sirka: 190 },
        { pole: "predmet", nazev: "Předmět", sirka: 280 },
        { pole: "komu", nazev: "Komu", sirka: 200 },
        { pole: "tym", nazev: "Tým", sirka: 160 },
        { pole: "vs", nazev: "VS", sirka: 80 },
        { pole: "varianta_text", nazev: "Varianta", typ: "vycet", sirka: 100 },
        { pole: "vytvoreno_m", nazev: "Připraveno", typ: "cas", sirka: 130 },
        { pole: "odeslano_m", nazev: "Odesláno", typ: "cas", sirka: 130 },
        { pole: "pokusy", nazev: "Nepovedené pokusy", typ: "cislo", sirka: 90 },
        { pole: "chyba", nazev: "Chyba", sirka: 220 },
        { pole: "testovaci_text", nazev: "Zkušební", typ: "bool", sirka: 85 }
      ],
      akceRadku: function (r) {
        var h = '<button type="button" class="adm-mini" data-akce="nahled" title="Zobrazit celý text mailu">Náhled</button>';
        if (r.stav === "ceka") {
          h += '<button type="button" class="adm-mini adm-mini-hlavni" data-akce="odeslat" title="Odeslat tento mail">Odeslat</button>';
          h += '<button type="button" class="adm-mini adm-mini-cervene" data-akce="zrusit" title="Neodesílat">Zrušit</button>';
        }
        return h;
      },
      akce: {
        nahled: function (r) { return nahled(r); },
        odeslat: function (r) { return odeslat([r.id]); },
        zrusit: async function (r) {
          var v = await HBA.db("web_mail_fronta?id=eq." + r.id + "&stav=eq.ceka", { metoda: "PATCH", telo: { stav: "zruseno" }, vratit: true });
          if (!v || !v.length) throw new Error("Mail už nečeká — nejspíš ho mezitím někdo odeslal nebo zrušil.");
        }
      },
      potvrdit: {
        odeslat: function (n) { return n === 1 ? "Odeslat tento mail? Odeslání nejde vrátit." : "Odeslat " + n + " mailů? Odeslání nejde vrátit."; },
        zrusit: function (n) { return n === 1 ? "Zrušit tento mail? Neodejde." : "Zrušit " + n + " mailů? Neodejdou."; }
      },
      hromadne: [
        { nazev: "Odeslat vybrané", akce: "odeslat", jen: function (r) { return r.stav === "ceka"; } },
        { nazev: "Zrušit (neodesílat)", akce: "zrusit", jen: function (r) { return r.stav === "ceka"; } }
      ],
      info: async function () {
        var vse = await HBA.db("web_v_odchozi_maily?select=stav");
        var ceka = vse.filter(function (r) { return r.stav === "ceka"; }).length;
        return "Nic se neposílá samo: mail odejde, až ho tady odešleš. Čeká na odeslání: <b>" + ceka + "</b>. " +
          "Registrační maily sem přijdou po schválení ve Frontě mailů.";
      }
    });
  });
})();
