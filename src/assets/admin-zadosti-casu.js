// Administrace – Žádosti o opravu času (Keksa 9. 10. 2026). Vidí právo Časy a výsledky (casy_vysledky) a správce.
// U žádosti podklady: zapsaný a požadovaný čas, rozdíl, předchozí a následující předávka týmu a jiné týmy zapsané
// na stejné předávce ±5 min (možná záměna týmů). Opravit čas = web_zapis_cas (starý čas přestane platit, nesmaže se),
// Zamítnout = jen uzavře žádost; odpověď kapitánovi je nepovinná. Databáze: web_admin_zadosti_cas, web_admin_zadost_cas_vyrid.
(function () {
  var esc = HBA.esc, data = [], hlaska = "", vsechny = false, otevreno = {};
  var DRUH = { chybi: "čas chybí", spatne: "čas je špatně", jiny_tym: "zapsali jiný tým", jine: "jiné" };
  var F_HMS = new Intl.DateTimeFormat("cs-CZ", { timeZone: "Europe/Prague", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  var F_DEN = new Intl.DateTimeFormat("cs-CZ", { timeZone: "Europe/Prague", weekday: "short", day: "numeric", month: "numeric" });
  function hms(iso) { return iso ? F_HMS.format(new Date(iso)) : "–"; }
  function denHms(iso) { return iso ? F_DEN.format(new Date(iso)) + " " + hms(iso) : "–"; }
  function rozdil(a, b) {
    if (!a || !b) return "";
    var s = Math.round((Date.parse(b) - Date.parse(a)) / 1000), z = s < 0 ? "dřív" : "později"; s = Math.abs(s);
    var t = Math.floor(s / 3600) ? Math.floor(s / 3600) + ":" + String(Math.floor(s / 60) % 60).padStart(2, "0") : String(Math.floor(s / 60));
    return "o " + t + ":" + String(s % 60).padStart(2, "0") + " " + z;
  }
  function pro(iso) { return iso ? new Date(iso).toLocaleString("sv-SE", { timeZone: "Europe/Prague" }).slice(0, 19) : ""; }
  function predavka(z, o) { return "P" + (z.etapa + 1 + (o || 0)); }

  function zadost(z) {
    var h = '<section class="hl-blok' + (z.stav === "ceka" ? " hl-pozor" : "") + '" id="zc-' + z.id + '">';
    h += "<h2>" + "<strong>" + esc(z.c != null ? z.c : "–") + "</strong> " + esc(z.n) + (z.testovaci ? ' <small class="adm-sub">(zkušební)</small>' : "") +
      " · " + predavka(z) + " " + esc(z.misto || "") + " · " + esc(DRUH[z.druh] || z.druh) + "</h2>";
    h += '<p class="adm-sub">Podal ' + esc(z.podal || "–") + " " + esc(HBA.cas(z.vytvoreno)) + (z.upraveno !== z.vytvoreno ? " · upraveno " + esc(HBA.cas(z.upraveno)) : "") + "</p>";
    h += '<table class="hl-tab zc-tab"><tbody>' +
      "<tr><th>Zapsaný čas</th><td>" + denHms(z.zapsano) + "</td></tr>" +
      "<tr><th>Žádá</th><td><b>" + (z.cas ? denHms(z.cas) : "bez času") + "</b>" + (z.cas_text ? ' <span class="adm-sub">(napsal „' + esc(z.cas_text) + "“)</span>" : "") +
        (z.zapsano && z.cas ? ' <span class="hl-cislo">' + rozdil(z.zapsano, z.cas) + "</span>" : "") + "</td></tr>" +
      "<tr><th>Okolní předávky týmu</th><td>" + predavka(z, -1) + " " + denHms(z.predchozi) + " · " + predavka(z, 1) + " " + denHms(z.nasledujici) +
        (z.cas && z.predchozi && Date.parse(z.cas) <= Date.parse(z.predchozi) ? ' <span class="hl-pozor-text">– požadovaný čas je dřív než předchozí předávka</span>' : "") +
        (z.cas && z.nasledujici && Date.parse(z.cas) >= Date.parse(z.nasledujici) ? ' <span class="hl-pozor-text">– požadovaný čas je později než další předávka</span>' : "") + "</td></tr>" +
      "<tr><th>Na " + predavka(z) + " ±5 min</th><td>" + ((z.okolni || []).length ? z.okolni.map(function (o) {
          return "<strong>" + esc(o.c != null ? o.c : "–") + "</strong> " + esc(o.n) + " " + hms(o.cas);
        }).join(" · ") + ' <span class="hl-pozor-text">– možná záměna týmů, zkontroluj i jejich čas</span>' : "nikdo jiný") + "</td></tr>" +
      '<tr><th>Popis</th><td class="zc-popis">' + esc(z.popis) + "</td></tr>" +
      (z.stav !== "ceka" ? "<tr><th>Vyřízeno</th><td>" + (z.stav === "opraveno" ? "opraveno" : "zamítnuto") + " · " + esc(z.vyridil || "–") + " " + esc(HBA.cas(z.vyrizeno)) +
        (z.odpoved ? "<br>Odpověď: " + esc(z.odpoved) : "") + "</td></tr>" : "") +
      "</tbody></table>";
    if (z.stav === "ceka") {
      if (otevreno[z.id]) {
        var a = otevreno[z.id];
        h += '<div class="zc-akce">' + (a === "opravit"
          ? '<label class="adm-pole">Zapsat čas<input id="zc-cas-' + z.id + '" value="' + esc(pro(z.cas)) + '" placeholder="2027-09-04 14:28:00"></label>'
          : "") +
          '<label class="adm-pole">Odpověď kapitánovi (nepovinné)<input id="zc-odp-' + z.id + '" maxlength="500"></label>' +
          '<button type="button" class="adm-tlacitko" data-potvrdit="' + z.id + '">' + (a === "opravit" ? "Zapsat opravený čas" : "Zamítnout žádost") + "</button> " +
          '<button type="button" class="adm-tlacitko-male" data-zpet="' + z.id + '">Zpět</button></div>';
      } else {
        h += '<p class="zc-akce"><button type="button" class="adm-tlacitko" data-akce="opravit" data-id="' + z.id + '">Opravit čas…</button> ' +
          '<button type="button" class="adm-tlacitko-male" data-akce="zamitnout" data-id="' + z.id + '">Zamítnout…</button></p>';
      }
    }
    return h + "</section>";
  }

  function vykresli() {
    var el = document.getElementById("zc-obsah"), ceka = data.filter(function (z) { return z.stav === "ceka"; });
    var h = '<p class="hl-souhrn">Čeká ' + ceka.length + " · " + (vsechny ? "zobrazené i starší vyřízené" : "vyřízené za posledních 7 dní") +
      ' · <button type="button" class="adm-odkaz-tmavy" id="zc-vse">' + (vsechny ? "Jen čekající a nedávné" : "Ukázat všechny") + "</button></p>";
    if (hlaska) h += '<p class="hl-hlaska">' + esc(hlaska) + "</p>";
    h += data.length ? data.map(zadost).join("") : "<p>Žádné žádosti.</p>";
    // rozepsaná pole se při obnově zachovají
    var pole = {}; Array.prototype.forEach.call(el.querySelectorAll("input[id^=zc-]"), function (i) { pole[i.id] = i.value; });
    el.innerHTML = h;
    Object.keys(pole).forEach(function (k) { var i = document.getElementById(k); if (i) i.value = pole[k]; });
  }

  async function nacti() {
    try { data = await HBA.rpc("web_admin_zadosti_cas", { p_jen_cekajici: !vsechny }); } catch (e) { hlaska = e.message; }
    vykresli();
  }

  document.addEventListener("click", async function (ev) {
    var t = ev.target && ev.target.closest && ev.target.closest("button"); if (!t) return;
    if (t.id === "zc-vse") { vsechny = !vsechny; return nacti(); }
    if (t.dataset.akce) { otevreno[t.dataset.id] = t.dataset.akce; return vykresli(); }
    if (t.dataset.zpet) { delete otevreno[t.dataset.zpet]; return vykresli(); }
    if (t.dataset.potvrdit) {
      var id = t.dataset.potvrdit, akce = otevreno[id], c = document.getElementById("zc-cas-" + id), o = document.getElementById("zc-odp-" + id);
      t.disabled = true;
      try {
        await HBA.rpc("web_admin_zadost_cas_vyrid", { p_id: Number(id), p_akce: akce, p_cas: c ? c.value.trim() || null : null, p_odpoved: o ? o.value.trim() || null : null });
        delete otevreno[id]; hlaska = akce === "opravit" ? "Čas je opravený, žádost vyřízená." : "Žádost je zamítnutá.";
      } catch (e) { hlaska = e.message; }
      return nacti();
    }
  });

  document.addEventListener("DOMContentLoaded", async function () {
    var j = await HBA.vyzadovat(); if (!j) return;
    await nacti();
    setInterval(function () { if (!document.hidden && !Object.keys(otevreno).length) nacti(); }, 60000);
  });
})();
