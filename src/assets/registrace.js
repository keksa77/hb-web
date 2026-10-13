// Registrace týmu (Keksa 13. 10. 2026).
// Do otevření ukáže termín a odpočet, po otevření formulář, po uzávěrce oznámení.
// Přihlášku zapíše funkce web_registrace; ta sama hlídá termín, kapacitu (náhradníci) i údaje.
(function () {
  "use strict";
  var C = window.HB_REG || {};
  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c];
    });
  }
  function hlavicky(json) {
    var h = { apikey: C.klic, Authorization: "Bearer " + C.klic };
    if (json) h["Content-Type"] = "application/json";
    return h;
  }
  function rpc(fce, data) {
    return fetch(C.url + "/rest/v1/rpc/" + fce, { method: "POST", headers: hlavicky(true), body: JSON.stringify(data || {}) })
      .then(function (r) {
        return r.json().then(function (j) {
          if (!r.ok) throw new Error((j && (j.message || j.hint)) || ("Chyba " + r.status));
          return j;
        });
      });
  }
  function cist(cesta) {
    return fetch(C.url + "/rest/v1/" + cesta, { headers: hlavicky(false) }).then(function (r) {
      if (!r.ok) throw new Error("Nepodařilo se načíst číselník.");
      return r.json();
    });
  }
  function ukaz(id, ano) { el(id).classList.toggle("rg-skryte", !ano); }
  function kdy(d) {
    var dny = ["neděle", "pondělí", "úterý", "středa", "čtvrtek", "pátek", "sobota"];
    return dny[d.getDay()] + " " + d.getDate() + ". " + (d.getMonth() + 1) + ". " + d.getFullYear() +
      " v " + d.getHours() + ":" + String(d.getMinutes()).padStart(2, "0");
  }
  function sklon(n, a, b, c) { return n === 1 ? a : (n >= 2 && n <= 4 ? b : c); }

  var form = el("rg-form");
  var OD = null, DO = null, ROK = "", casovac = null, nacteno = false;

  // --- Termín registrace ---
  rpc("web_rocnik_webu").then(function (rok) {
    ROK = rok;
    return Promise.all([
      rpc("web_param_cas", { p_klic: "registrace_od", p_rok: rok }),
      rpc("web_param_cas", { p_klic: "registrace_do", p_rok: rok })
    ]);
  }).then(function (t) {
    OD = t[0] ? new Date(t[0]) : null;
    DO = t[1] ? new Date(t[1]) : null;
    ukaz("rg-nacitam", false);
    stav();
    casovac = setInterval(stav, 1000);
  }).catch(function () {
    el("rg-nacitam").textContent = "Termín registrace se nepodařilo načíst. Zkus stránku obnovit, případně napiš na info@horybory.cz.";
  });

  function stav() {
    var ted = new Date();
    if (!OD || !DO) {
      el("rg-od").textContent = "brzy – termín ještě oznámíme";
      el("rg-odpocet").textContent = "";
      ukaz("rg-pred", true); ukaz("rg-form", false); ukaz("rg-po", false);
      return;
    }
    if (ted < OD) {
      el("rg-od").textContent = kdy(OD);
      var s = Math.floor((OD - ted) / 1000);
      var d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
      el("rg-odpocet").textContent = (d ? d + " " + sklon(d, "den", "dny", "dní") + " " : "") +
        String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":" + String(x).padStart(2, "0");
      ukaz("rg-pred", true); ukaz("rg-form", false); ukaz("rg-po", false);
    } else if (ted > DO) {
      el("rg-rok-po").textContent = ROK;
      ukaz("rg-pred", false); ukaz("rg-form", false); ukaz("rg-po", true);
      clearInterval(casovac);
    } else {
      ukaz("rg-pred", false); ukaz("rg-po", false);
      if (el("rg-vysledek").classList.contains("rg-skryte")) ukaz("rg-form", true);
      if (!nacteno) { nacteno = true; ciselniky(); }
    }
  }

  // --- Číselníky ---
  var ZEME = { CZ: "Česko", SK: "Slovensko", PL: "Polsko" };
  var POPIS = {};
  function ciselniky() {
    cist("web_kraj?select=kod,nazev,zeme&aktivni=eq.true&order=poradi").then(function (r) {
      var sel = el("rg-kraj"), zeme = null, cil = sel;
      sel.innerHTML = '<option value="">— vyber —</option>';
      r.forEach(function (k) {
        if (k.zeme !== zeme) { zeme = k.zeme; cil = document.createElement("optgroup"); cil.label = ZEME[zeme] || zeme; sel.appendChild(cil); }
        var o = document.createElement("option"); o.value = k.kod; o.textContent = k.nazev; cil.appendChild(o);
      });
    }).catch(function () { el("rg-kraj").innerHTML = '<option value="">Číselník se nenačetl – obnov stránku</option>'; });
    cist("web_kategorie?select=kod,nazev,popis&aktivni=eq.true&order=poradi").then(function (r) {
      var sel = el("rg-kategorie");
      sel.innerHTML = '<option value="">— vyber —</option>';
      r.forEach(function (k) {
        POPIS[k.kod] = k.popis || "";
        var o = document.createElement("option"); o.value = k.kod; o.textContent = k.nazev; sel.appendChild(o);
      });
    }).catch(function () { el("rg-kategorie").innerHTML = '<option value="">Číselník se nenačetl – obnov stránku</option>'; });
  }

  form.addEventListener("change", function () {
    ukaz("rg-faktura", form.faktura.value === "ano");
    el("rg-popis-kategorie").textContent = POPIS[form.kategorie.value] || "";
  });

  // --- Odeslání ---
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    ukaz("rg-chyba", false);
    var f = form, ano = f.faktura.value === "ano";
    var data = {
      p_nazev: f.nazev.value, p_jmeno: f.jmeno.value, p_prijmeni: f.prijmeni.value,
      p_email: f.email.value, p_telefon: f.telefon.value,
      p_zastupce_jmeno: f.zastupce_jmeno.value, p_zastupce_prijmeni: f.zastupce_prijmeni.value,
      p_zastupce_email: f.zastupce_email.value, p_zastupce_telefon: f.zastupce_telefon.value,
      p_kraj: f.kraj.value || null, p_kategorie: f.kategorie.value || null, p_fakturovat: ano,
      p_odberatel_nazev: ano ? f.odberatel_nazev.value : null, p_odberatel_ic: ano ? f.odberatel_ic.value : null,
      p_odberatel_dic: ano ? f.odberatel_dic.value : null, p_odberatel_adresa: ano ? f.odberatel_adresa.value : null,
      p_duzp_rok: ano ? parseInt(f.duzp.value, 10) : null,
      p_poznamka: f.poznamka.value, p_bezim: f.bezim.checked
    };
    el("rg-odeslat").disabled = true;
    el("rg-odeslat").textContent = "Odesílám…";
    rpc("web_registrace", data).then(function (v) {
      var nahradnik = v.stav === "nahradnik";
      el("rg-vysledek").innerHTML =
        "<h2>Přihláška týmu " + esc(v.tym) + " dorazila</h2>" +
        (nahradnik
          ? "<p>Kapacita závodu je už naplněná, proto jsme tvůj tým zapsali mezi <strong>náhradníky</strong>. Startovné zatím neplať.</p>"
          : (v.ceka_na_schvaleni
            ? "<p>Na <strong>" + esc(v.email) + "</strong> ti hned přijde e-mail, že přihláška dorazila. Potvrzení registrace a pokyny k platbě startovného pošleme do 24 hodin.</p>"
            : "<p>Na <strong>" + esc(v.email) + "</strong> ti právě posíláme potvrzení registrace a pokyny k platbě startovného.</p>")) +
        "<p>Do <a href=\"" + C.zaklad + "/kapitan/prihlaseni/\">kapitánské sekce</a> se přihlásíš e-mailem z přihlášky.</p>" +
        "<p>Když e-mail nedorazí, podívej se i do složky s nevyžádanou poštou, případně napiš na <a href=\"mailto:info@horybory.cz\">info@horybory.cz</a>.</p>";
      ukaz("rg-form", false);
      ukaz("rg-vysledek", true);
      el("rg-vysledek").scrollIntoView({ behavior: "smooth", block: "start" });
    }).catch(function (err) {
      el("rg-chyba").textContent = err.message;
      ukaz("rg-chyba", true);
      el("rg-chyba").scrollIntoView({ behavior: "smooth", block: "center" });
    }).then(function () {
      el("rg-odeslat").disabled = false;
      el("rg-odeslat").textContent = "Odeslat přihlášku";
    });
  });
})();
