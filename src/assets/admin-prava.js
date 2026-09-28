// Role a práva – kdo co smí v administraci a v databázi (tabulky web_pravo a web_osoba_pravo).
// Právo „Všechno“ zahrnuje všechna ostatní. Přidělovat a odebírat smí jen držitel práva „Role a práva“.
// Databáze nedovolí odebrat poslední právo ke správě práv.
(function () {
  var e = HBA.esc;
  function an(b) { return b == null ? "" : b ? "ano" : "ne"; }

  document.addEventListener("submit", async function (ev) {
    if (ev.target.id !== "prava-pridat") return;
    ev.preventDefault();
    var f = ev.target, hl = document.getElementById("prava-hlaska");
    try {
      var t = await HBA.rpc("web_pravo_pridat", { p_email: f.email.value, p_pravo: f.pravo.value, p_poznamka: f.poznamka.value });
      hl.textContent = t; hl.style.color = "#6E7338";
      f.email.value = ""; f.poznamka.value = "";
      var b = document.getElementById("t-obnovit"); if (b) b.click();
    } catch (err) { hl.textContent = err.message; hl.style.color = "#A3302B"; }
  });

  document.addEventListener("DOMContentLoaded", async function () {
    var j = await HBA.vyzadovat(); if (!j) return;
    HBT({
      sekce: "prava",
      nazev: "Role a práva",
      idPole: "id",
      sirkaAkci: 110,
      nacist: function () { return HBA.db("web_v_prava?select=*&order=jmeno,poradi"); },
      pripravit: function (r) {
        r.plati = r["do"] ? "ne" : "ano";
        r.ucet = an(r.ma_ucet);
        r.od_m = HBT.mistniCas(r.od);
        r.do_m = HBT.mistniCas(r["do"]);
        return r;
      },
      popisRadku: function (r) { return r.jmeno + " · " + r.pravo_nazev; },
      vychozi: { h: [{ field: "plati", value: ["ano"] }] },
      sloupce: [
        { pole: "jmeno", nazev: "Osoba", sirka: 150 },
        { pole: "email", nazev: "E-mail", sirka: 200 },
        { pole: "pravo_nazev", nazev: "Právo", typ: "vycet", sirka: 180 },
        { pole: "pravo_popis", nazev: "Co zahrnuje", sirka: 320 },
        { pole: "role", nazev: "Role", sirka: 110 },
        { pole: "ucet", nazev: "Má přihlašovací účet", typ: "bool", sirka: 120 },
        { pole: "plati", nazev: "Platí", typ: "bool", sirka: 75 },
        { pole: "od_m", nazev: "Od", typ: "cas", sirka: 130 },
        { pole: "do_m", nazev: "Do", typ: "cas", sirka: 130 },
        { pole: "udelil", nazev: "Udělil", sirka: 120 },
        { pole: "poznamka", nazev: "Poznámka", sirka: 240 }
      ],
      akceRadku: function (r) {
        return r["do"] ? "" : '<button type="button" class="adm-mini adm-mini-cervene" data-akce="odebrat" title="Odebrat toto právo">Odebrat</button>';
      },
      akce: { odebrat: function (r) { return HBA.rpc("web_pravo_odebrat", { p_id: r.id }); } },
      historie: function (r) { return [{ tabulka: "web_osoba_pravo", id: r.id }]; },
      info: async function () {
        var prava = await HBA.db("web_pravo?select=kod,nazev&order=poradi");
        return "Právo <b>Všechno</b> zahrnuje všechna ostatní. " +
          '<form id="prava-pridat" style="display:inline-flex;flex-wrap:wrap;gap:6px;align-items:center;margin-left:8px">' +
          '<input name="email" type="email" required placeholder="e-mail osoby" style="width:200px">' +
          '<select name="pravo">' + prava.map(function (p) { return '<option value="' + e(p.kod) + '">' + e(p.nazev) + '</option>'; }).join("") + '</select>' +
          '<input name="poznamka" placeholder="poznámka (nepovinná)" style="width:170px">' +
          '<button type="submit" class="adm-mini adm-mini-hlavni">Přidat právo</button>' +
          '<span id="prava-hlaska" style="font-weight:600"></span></form>';
      }
    });
  });
})();
