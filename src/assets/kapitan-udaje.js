// Kapitánská sekce – přidání běžce, krok B „Údaje běžce“ (a úprava běžce ze soupisky).
// ?id=… úprava, ?z=historie vybraný člověk z minulých ročníků (předaný ze stránky Kdo poběží?), ?novy=1 nový běžec.
// Povinné je vše kromě poznámky; po uložení se jde zpět na soupisku (Keksa 4. 10. 2026).
(function () {
  var e = HBK.esc;
  var P = null, KRAJE = [], VELIKOSTI = [], UPRAVUJI = null, ZDROJ = null;
  var param = new URLSearchParams(location.search);

  function vyber(id, moznosti, hodnota) {
    return '<select id="' + id + '"><option value="">— vyber —</option>' + moznosti.map(function (m) {
      return '<option value="' + e(m[0]) + '"' + (m[0] === hodnota ? " selected" : "") + ">" + e(m[1]) + "</option>"; }).join("") + "</select>";
  }

  function formular(r) {
    var ja = r && r.jsem_to_ja && P.role === "bezec";
    r = r || {};
    return (ZDROJ ? '<p class="k-zdroj">Vyplněno z ročníku ' + e(ZDROJ.rocnik) + ": <b>" + e(ZDROJ.jmeno) + "</b>. Zkontroluj údaje" +
        (ZDROJ.vykonnost_skutecna ? ", čas na 10 km je skutečný z " + e(ZDROJ.skutecna_rocnik) + " (hlášeno bylo " + e(HBK.vykonnost(ZDROJ.vykonnost_10km)) + ")" : "") + ".</p>" : "") +
      '<form class="k-karta" id="k-form" novalidate><div class="k-formular">' +
      '<label class="k-pole" for="f-jmeno">Jméno *<input id="f-jmeno" value="' + e(r.jmeno || "") + '" required></label>' +
      '<label class="k-pole" for="f-prijmeni">Příjmení *<input id="f-prijmeni" value="' + e(r.prijmeni || "") + '" required></label>' +
      '<label class="k-pole" for="f-email">E-mail *<input id="f-email" type="email" value="' + e(r.email || "") + '"' + (ja ? " disabled" : "") + " required>" +
        (ja ? "<small>E-mail změní kapitán.</small>" : "<small>Na něj přijde běžci odkaz do sekce.</small>") + "</label>" +
      '<label class="k-pole" for="f-telefon">Telefon *<input id="f-telefon" type="tel" value="' + e(r.telefon || "") + '" placeholder="777 123 456" required></label>' +
      '<label class="k-pole" for="f-rok">Rok narození *<input id="f-rok" inputmode="numeric" maxlength="4" value="' + e(r.rok_narozeni || "") + '" placeholder="1990" required></label>' +
      '<label class="k-pole" for="f-pohlavi">Pohlaví *' + vyber("f-pohlavi", [["zena", "žena"], ["muz", "muž"], ["jine", "jiné"]], r.pohlavi) + "</label>" +
      '<label class="k-pole" for="f-kraj">Kraj *' + vyber("f-kraj", KRAJE.map(function (k) { return [k.kod, k.nazev]; }), r.kraj) + "</label>" +
      '<label class="k-pole" for="f-mesto">Město *<input id="f-mesto" value="' + e(r.mesto || "") + '" required></label>' +
      '<label class="k-pole" for="f-velikost">Velikost trička *' + vyber("f-velikost", VELIKOSTI.map(function (v) { return [v.rada + "|" + v.kod, v.rada + " " + v.kod]; }),
        r.velikost ? r.velikost_rada + "|" + r.velikost : "") + "</label>" +
      '<label class="k-pole" for="f-vykonnost">Čas na 10 km *<input id="f-vykonnost" value="' + e(HBK.vykonnost(r.vykonnost_10km)) + '" placeholder="52:30" required>' +
        "<small>Minuty:sekundy, např. 52:30, nebo 1:02:30. Čas na rovině v závodním tempu.</small></label>" +
      '<label class="k-pole" for="f-poznamka">Poznámka<input id="f-poznamka" value="' + e(r.poznamka || "") + '"></label>' +
      "</div>" +
      '<details class="k-proc" id="k-proc" hidden><summary>Proč zadat čas na 10 km co nejpřesněji</summary><div class="k-text" id="k-proc-text"></div></details>' +
      '<p class="pocet">Pole s hvězdičkou jsou povinná.</p>' +
      '<div class="k-akce k-akce-hlavni"><button type="submit" class="k-tlacitko k-tlacitko-s-napovedou">' +
        (UPRAVUJI ? "Uložit změny" : "Přidat na soupisku") + "<small>Uloží běžce a vrátí tě na soupisku.</small></button></div>" +
      '<p class="k-hlaska" id="k-hlaska" role="status"></p></form>';
  }

  async function nactiText() {
    try {
      var t = await HBK.db("web_texty?select=web_texty_preklady(titulek,obsah,jazyk)&kod=eq.kapitan_vykonnost_proc");
      var p = (t[0] && t[0].web_texty_preklady || []).filter(function (x) { return x.jazyk === "cs"; })[0];
      if (p) { document.getElementById("k-proc-text").innerHTML = p.obsah; document.getElementById("k-proc").hidden = false; }  // text z redakce webu
    } catch (err) {}
  }

  // Doplnění z minulých ročníků: rozdělí jméno, najde kraj a velikost v číselníku.
  function zHistorie(h) {
    var j = String(h.jmeno || "").trim(), mezera = j.lastIndexOf(" ");
    var kraj = KRAJE.filter(function (k) { return k.kod === h.kraj || k.nazev === h.kraj; })[0];
    var vel = VELIKOSTI.filter(function (v) { return (v.rada + " " + v.kod).toLowerCase() === String(h.velikost || "").toLowerCase(); })[0];
    return { jmeno: mezera > 0 ? j.slice(0, mezera) : j, prijmeni: mezera > 0 ? j.slice(mezera + 1) : "", email: h.email, telefon: h.telefon,
      rok_narozeni: h.rok_narozeni, pohlavi: h.pohlavi, kraj: kraj ? kraj.kod : "", mesto: h.mesto,
      velikost_rada: vel ? vel.rada : null, velikost: vel ? vel.kod : null, vykonnost_10km: h.vykonnost_skutecna || h.vykonnost_10km };
  }

  function hodnota(id) { var el = document.getElementById(id); return el && !el.disabled ? el.value.trim() : null; }
  var POVINNE = [["f-jmeno", "Vyplň jméno."], ["f-prijmeni", "Vyplň příjmení."], ["f-email", "Vyplň e-mail."], ["f-telefon", "Vyplň telefon."],
    ["f-rok", "Vyplň rok narození."], ["f-pohlavi", "Vyber pohlaví."], ["f-kraj", "Vyber kraj."], ["f-mesto", "Vyplň město."],
    ["f-velikost", "Vyber velikost trička."], ["f-vykonnost", "Vyplň čas na 10 km."]];
  function oznac(id, text) {
    var el = document.getElementById(id); if (!el) return;
    var lab = el.closest(".k-pole"), m = lab.querySelector(".k-chyba-pole");
    el.classList.toggle("k-chybi", !!text); el.setAttribute("aria-invalid", text ? "true" : "false");
    if (text) { if (!m) { m = document.createElement("small"); m.className = "k-chyba-pole"; lab.appendChild(m); } m.textContent = text; }
    else if (m) m.remove();
  }
  function zkontroluj(tise) {
    var chyby = [], rok = hodnota("f-rok"), v = hodnota("f-vykonnost"), em = hodnota("f-email"), letos = new Date().getFullYear();
    POVINNE.forEach(function (p) {
      var el = document.getElementById(p[0]), t = el && !el.disabled && !el.value.trim() ? (tise ? "Chybí, doplň." : p[1]) : "";
      oznac(p[0], t); if (t) chyby.push(p[0]);
    });
    if (rok && !(/^\d{4}$/.test(rok) && Number(rok) >= 1930 && Number(rok) <= letos - 10)) { oznac("f-rok", "Rok narození napiš čtyřmi číslicemi, např. 1990."); chyby.push("f-rok"); }
    if (v && !/^(\d{1,2}:)?\d{1,3}(:\d{2})?$/.test(v)) { oznac("f-vykonnost", "Čas napiš jako minuty:sekundy, např. 52:30."); chyby.push("f-vykonnost"); }
    if (em && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { oznac("f-email", "E-mail napiš ve tvaru jmeno@domena.cz."); chyby.push("f-email"); }
    if (chyby.length && !tise) { var prvni = document.getElementById(chyby[0]); prvni.focus(); prvni.scrollIntoView({ behavior: "smooth", block: "center" }); }
    return !chyby.length;
  }
  function opravPole(ev) { var t = ev.target; if (t && t.classList && t.classList.contains("k-chybi") && String(t.value).trim()) oznac(t.id, ""); }
  document.addEventListener("input", opravPole);
  document.addEventListener("change", opravPole);

  document.addEventListener("submit", async function (ev) {
    if (ev.target.id !== "k-form") return;
    ev.preventDefault();
    if (!zkontroluj()) { HBK.hlaska("k-hlaska", "Doplň označená pole.", true); return; }
    var b = ev.target.querySelector("button[type=submit]"); b.disabled = true;
    var vel = hodnota("f-velikost") || "", rok = hodnota("f-rok");
    var data = {
      p_jmeno: hodnota("f-jmeno"), p_prijmeni: hodnota("f-prijmeni"), p_email: hodnota("f-email"), p_telefon: hodnota("f-telefon"),
      p_rok_narozeni: rok ? Number(rok) : null, p_pohlavi: hodnota("f-pohlavi"), p_kraj: hodnota("f-kraj"), p_mesto: hodnota("f-mesto"),
      p_velikost_rada: vel ? vel.split("|")[0] : "", p_velikost: vel ? vel.split("|")[1] : "",
      p_vykonnost: hodnota("f-vykonnost"), p_poznamka: hodnota("f-poznamka")
    };
    try {
      var id;
      if (UPRAVUJI) { data.p_soupiska = UPRAVUJI; await HBK.rpc("web_k_uprav_bezce", data); id = UPRAVUJI; HBK.hlaskaDal("Uloženo: " + data.p_jmeno + " " + data.p_prijmeni, id); }
      else { var novy = await HBK.rpc("web_k_pridej_bezce", data); id = novy && novy.soupiska_id; HBK.hlaskaDal(data.p_jmeno + " " + data.p_prijmeni + " je na soupisce.", id); }
      try { sessionStorage.removeItem("hb_k_vybrany"); } catch (err) {}
      location.href = HB.zaklad + "/kapitan/soupiska/";
    } catch (err) { HBK.hlaska("k-hlaska", err.message, true); b.disabled = false; }
  });

  document.addEventListener("DOMContentLoaded", async function () {
    P = await HBK.vyzadovat(); if (!P) return;
    var obsah = document.getElementById("k-obsah");
    try {
      var v = await Promise.all([
        HBK.rpc("web_k_soupiska"),
        HBK.db("web_kraj?select=kod,nazev&aktivni=eq.true&order=poradi"),
        HBK.db("velikosti?select=rada,kod,poradi&aktivni=eq.true&order=rada,poradi")
      ]);
      KRAJE = v[1] || []; VELIKOSTI = v[2] || [];
      var r = null;
      if (param.get("id")) {
        UPRAVUJI = Number(param.get("id"));
        r = (v[0] || []).filter(function (x) { return x.soupiska_id === UPRAVUJI; })[0];
        if (!r) { obsah.innerHTML = '<p class="k-chyba">Tenhle běžec na soupisce tvého týmu není.</p>'; return; }
        document.querySelector("h1").textContent = "Údaje běžce: " + r.jmeno + " " + r.prijmeni;
      } else if (param.get("z") === "historie") {
        try { ZDROJ = JSON.parse(sessionStorage.getItem("hb_k_vybrany") || "null"); } catch (err) { ZDROJ = null; }
        if (ZDROJ) r = zHistorie(ZDROJ);
      }
      HBK.navigace(P, UPRAVUJI ? { zpet: { n: "Soupiska", url: "/kapitan/soupiska/", hint: "Bez uložení změn." } }
                               : { zpet: { n: "Kdo poběží?", url: "/kapitan/bezec/", hint: "Vybrat někoho jiného." } });
      if (!P.soupiska_otevrena) { obsah.innerHTML = '<p class="k-pozn">Soupiska je uzavřená. Změny řeší pořadatel na info@horybory.cz.</p>'; return; }
      obsah.innerHTML = formular(r);
      if (r) zkontroluj(true);   // co v historii nebo u běžce chybí, je hned vidět
      nactiText();
    } catch (err) { obsah.innerHTML = '<p class="k-chyba">' + e(err.message) + "</p>"; }
  });
})();
