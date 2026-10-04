// Texty mailů (tabulka web_mail_sablony) – předmět, text a zapnutí každé šablony.
// Vypnutá šablona se nikomu nepošle. Mail 1 (registrace_zadost) po zapnutí odchází sám
// hned po registraci; ostatní se připraví do Odchozích mailů a odesílají se ručně.
(function () {
  var e = HBA.esc;
  var VAR = { zakladni: "Varianta 1", zvlastni: "Varianta 2" };
  function an(b) { return b == null ? "" : b ? "ano" : "ne"; }
  async function zapnout(r, ano) {
    var v = await HBA.db("web_mail_sablony?id=eq." + r.id, { metoda: "PATCH", telo: { aktivni: ano }, vratit: true });
    if (!v || !v.length) throw new Error("Změna se neuložila — šablony smí měnit jen organizátor.");
  }
  function nahled(r) {
    var w = window.open("", "_blank");
    if (!w) throw new Error("Prohlížeč zablokoval nové okno — povol vyskakovací okna pro tuto stránku.");
    w.document.write('<!doctype html><meta charset="utf-8"><title>' + e(r.nazev) + '</title>' +
      '<body style="font:15px/1.6 Arial,sans-serif;max-width:680px;margin:24px auto;padding:0 16px;color:#2A2621">' +
      '<p style="color:#6E665B;font-size:13px"><b>' + e(r.nazev) + '</b> (' + e(r.kod) + ', ' + e(VAR[r.varianta] || r.varianta) + ')<br><b>Předmět:</b> ' + e(r.predmet) + '</p>' +
      '<pre style="white-space:pre-wrap;font:inherit;border-top:1px solid #E3DCD0;padding-top:12px">' + e(r.telo || "(bez textu)") + '</pre>' +
      '<p style="color:#6E665B;font-size:13px">Značky ve složených závorkách doplní databáze za každý tým zvlášť.</p></body>');
    w.document.close();
    return Promise.resolve();
  }

  document.addEventListener("DOMContentLoaded", async function () {
    var j = await HBA.vyzadovat(); if (!j) return;
    HBT({
      sekce: "maily",
      nazev: "Texty mailů",
      idPole: "id",
      sirkaAkci: 170,
      nacist: function () { return HBA.db("web_mail_sablony?select=*&order=poradi,kod,varianta"); },
      pripravit: function (r) {
        r.zapnuto = an(r.aktivni);
        r.varianta_text = VAR[r.varianta] || r.varianta;
        r.upraveno_m = HBT.mistniCas(r.upraveno);
        r.ma_text = r.telo ? "ano" : "ne";
        return r;
      },
      popisRadku: function (r) { return r.nazev + " · " + (VAR[r.varianta] || r.varianta); },
      sloupce: [
        { pole: "zapnuto", nazev: "Zapnuto", typ: "bool", sirka: 90,
          uprava: { tabulka: "web_mail_sablony", klic: "id", sloupec: "aktivni" } },
        { pole: "nazev", nazev: "Mail", sirka: 200 },
        { pole: "varianta_text", nazev: "Varianta", typ: "vycet", sirka: 100 },
        { pole: "kdy", nazev: "Kdy se posílá", sirka: 260 },
        { pole: "predmet", nazev: "Předmět", sirka: 280, uprava: { tabulka: "web_mail_sablony", klic: "id" } },
        { pole: "telo", nazev: "Text", sirka: 260, uprava: { tabulka: "web_mail_sablony", klic: "id", dlouhy: true } },
        { pole: "ma_text", nazev: "Má text", typ: "bool", sirka: 85 },
        { pole: "kod", nazev: "Kód", sirka: 150, skryty: true },
        { pole: "upraveno_m", nazev: "Upraveno", typ: "cas", sirka: 130 }
      ],
      akceRadku: function (r) {
        var h = '<button type="button" class="adm-mini" data-akce="nahled" title="Celý text">Náhled</button>';
        return h + (r.aktivni
          ? '<button type="button" class="adm-mini adm-mini-cervene" data-akce="zapnout" data-arg="ne" title="Vypnout — mail se přestane posílat">Vypnout</button>'
          : '<button type="button" class="adm-mini adm-mini-hlavni" data-akce="zapnout" data-arg="ano" title="Zapnout — mail se začne posílat">Zapnout</button>');
      },
      akce: {
        nahled: function (r) { return nahled(r); },
        zapnout: function (r, arg) { return zapnout(r, arg === "ano"); }
      },
      historie: function (r) { return [{ tabulka: "web_mail_sablony", id: r.id }]; },
      info: function () {
        return Promise.resolve("<b>Zapnuto</b> = mail se posílá. Mail 1 „Žádost o registraci přijata“ po zapnutí odchází <b>sám hned</b> po registraci; " +
          "ostatní se připraví do <a href=\"" + HB.zaklad + "/admin/odchozi/\">Odchozích mailů</a> a odesíláš je ručně. " +
          "Značky ve {složených závorkách} doplní databáze za každý tým — nemaž je.");
      }
    });
  });
})();
