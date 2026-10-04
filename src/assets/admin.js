// Administrace Hory Bory – společný základ: přihlášení, relace, volání databáze.
// Přihlašuje se stejným účtem jako plánovač (Supabase Auth, e-mail a heslo).
// Co kdo smí, hlídá databáze (pravidla RLS a úroveň role), ne tenhle soubor.
(function () {
  var KLIC_RELACE = "hb_admin_relace";

  function nactiRelaci() {
    try { return JSON.parse(localStorage.getItem(KLIC_RELACE) || "null"); } catch (e) { return null; }
  }
  function ulozRelaci(r) {
    try {
      if (r) localStorage.setItem(KLIC_RELACE, JSON.stringify(r));
      else localStorage.removeItem(KLIC_RELACE);
    } catch (e) { /* bez úložiště se jen nepamatuje přihlášení */ }
  }
  function zRelace(j) {
    return { access_token: j.access_token, refresh_token: j.refresh_token,
             vyprsi: Date.now() + (j.expires_in || 3600) * 1000 };
  }

  async function auth(cesta, telo) {
    var r = await fetch(HB.url + "/auth/v1/" + cesta, {
      method: "POST",
      headers: { apikey: HB.klic, "Content-Type": "application/json" },
      body: JSON.stringify(telo)
    });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) {
      var zprava = j.error_description || j.msg || j.message || ("Chyba " + r.status);
      if (/invalid login credentials/i.test(zprava)) zprava = "Nesprávný e-mail nebo heslo.";
      throw new Error(zprava);
    }
    return j;
  }

  async function prihlasit(email, heslo) {
    var j = await auth("token?grant_type=password", { email: email, password: heslo });
    ulozRelaci(zRelace(j));
  }

  async function platnyToken() {
    var r = nactiRelaci();
    if (!r) return null;
    if (Date.now() < r.vyprsi - 60000) return r.access_token;
    try {
      var j = await auth("token?grant_type=refresh_token", { refresh_token: r.refresh_token });
      var n = zRelace(j); ulozRelaci(n); return n.access_token;
    } catch (e) { ulozRelaci(null); return null; }
  }

  async function odhlasit() {
    var t = await platnyToken();
    if (t) {
      fetch(HB.url + "/auth/v1/logout", { method: "POST",
        headers: { apikey: HB.klic, Authorization: "Bearer " + t } }).catch(function () {});
    }
    ulozRelaci(null);
    location.href = HB.zaklad + "/admin/";
  }

  // Volání REST API databáze za přihlášeného uživatele.
  async function db(cesta, volby) {
    volby = volby || {};
    var t = await platnyToken();
    if (!t) throw new Error("Přihlášení chybí nebo vypršelo. Přihlas se znovu.");
    var hlavicky = { apikey: HB.klic, Authorization: "Bearer " + t, "Content-Type": "application/json" };
    var prefer = [];
    if (volby.vratit) prefer.push("return=representation");
    if (volby.prefer) prefer.push(volby.prefer);
    if (prefer.length) hlavicky.Prefer = prefer.join(",");
    var r = await fetch(HB.url + "/rest/v1/" + cesta, {
      method: volby.metoda || "GET", headers: hlavicky,
      body: volby.telo ? JSON.stringify(volby.telo) : undefined
    });
    var text = await r.text();
    var j = text ? JSON.parse(text) : null;
    if (!r.ok) throw new Error((j && (j.message || j.hint)) || ("Chyba " + r.status));
    return j;
  }
  function rpc(fce, data) { return db("rpc/" + fce, { metoda: "POST", telo: data || {} }); }

  // Kdo je přihlášený. Vrátí null, když není nebo nemá organizátorská práva.
  async function ja() {
    if (!(await platnyToken())) return null;
    try { return await rpc("web_ja"); } catch (e) { return null; }
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function datum(d) {
    if (!d) return "–";
    var x = new Date(d.length === 10 ? d + "T12:00:00" : d);
    return x.getDate() + ". " + (x.getMonth() + 1) + ". " + x.getFullYear();
  }
  function cas(d) {
    if (!d) return "–";
    var x = new Date(d);
    return datum(d) + " " + String(x.getHours()).padStart(2, "0") + ":" + String(x.getMinutes()).padStart(2, "0");
  }

  // Práva přihlášeného: { kod: "uprava" | "cteni" } (web_ja → web_moje_prava; „kod:cteni“ = jen čtení).
  function mojePrava(j) {
    var m = {};
    (j && j.prava || []).forEach(function (p) {
      var x = String(p).split(":"); m[x[0]] = x[1] === "cteni" ? "cteni" : "uprava";
    });
    return m;
  }
  function maPristup(j) { return (j.uroven || 0) >= 30 || Object.keys(mojePrava(j)).length > 0; }

  // Hlavička: jméno, menu, odhlášení. Stránky, které přihlášení vyžadují, zavolají HBA.vyzadovat().
  // Vstup do administrace má každý, kdo má aspoň jedno právo (stránka Role a práva); menu ukáže jen jeho stránky.
  async function vyzadovat() {
    var j = await ja();
    if (!j || !j.osoba_id) { location.href = HB.zaklad + "/admin/?zpet=" + encodeURIComponent(location.pathname + location.hash); return null; }
    var hl = document.querySelector(".adm-hlavni");
    if (!maPristup(j)) {
      hl.innerHTML = '<p class="adm-chyba">Tvůj účet zatím nemá žádné právo v administraci. Požádej správce o přidělení práva.</p>';
      zobrazKdo(j); return null;
    }
    zobrazKdo(j);
    var tady = document.querySelector('#adm-menu a[aria-current="page"]');
    var kod = tady && tady.getAttribute("data-pravo");
    if (kod) {
      var p = mojePrava(j), rozsah = p.vse || p[kod];
      if (p.vse === "cteni" && p[kod] === "uprava") rozsah = "uprava";
      if (!rozsah) {
        hl.innerHTML = '<p class="adm-chyba">Na tuhle stránku nemáš právo („' + esc(tady.textContent.trim()) + '“). Požádej správce o přidělení.</p>';
        return null;
      }
      if (rozsah === "cteni") {
        var b = document.createElement("p");
        b.className = "adm-jen-cteni";
        b.style.cssText = "margin:8px 16px 0;padding:6px 10px;background:#F6EEDC;border-left:3px solid #78212E;font-size:13px";
        b.textContent = "Máš tu jen čtení — změny databáze neuloží.";
        hl.insertBefore(b, hl.firstChild);
      }
    }
    return j;
  }
  function zobrazKdo(j) {
    document.getElementById("adm-jmeno").textContent = (j.jmeno || j.email) + (j.role ? " · " + j.role : "");
    document.getElementById("adm-kdo").hidden = false;
    var p = mojePrava(j), pristup = maPristup(j);
    document.getElementById("adm-menu").hidden = !pristup;
    if (!pristup) return;
    // v menu jen stránky, na které má právo (čtení nebo úpravy)
    Array.prototype.forEach.call(document.querySelectorAll("#adm-menu a[data-pravo]"), function (a) {
      a.hidden = !(p.vse || p[a.getAttribute("data-pravo")]);
    });
    // skupina bez viditelných odkazů se schová
    Array.prototype.forEach.call(document.querySelectorAll("#adm-menu .adm-menu-skupina"), function (s) {
      var n = s.nextElementSibling, vidi = false;
      while (n && !n.classList.contains("adm-menu-skupina")) { if (n.tagName === "A" && !n.hidden) vidi = true; n = n.nextElementSibling; }
      if (!vidi && s.nextElementSibling && s.nextElementSibling.tagName === "A") s.hidden = true;
    });
    if (p.vse || p.fronta_mailu) {
      // Počet čekajících ostrých mailů v menu (zkušební přihlášky se nepočítají).
      // Připomínka místo mailu: když nejstarší čeká déle než nastavený počet hodin
      // (Nastavení → Připomínka fronty), počet zčervená — týmům slibujeme potvrzení do 24 hodin.
      Promise.all([
        db("web_maily_ke_schvaleni?select=id,vytvoreno,web_tym!inner(testovaci)&stav=eq.ceka&web_tym.testovaci=is.false&order=vytvoreno.asc"),
        db("parametr_hodnota?select=hodnota&klic=eq.pripominka_fronty_po_hodinach&rok=eq." + (HB.rocnik || "HB27")).catch(function () { return []; })
      ]).then(function (v) {
        var r = v[0], hod = Number((v[1][0] || {}).hodnota) || 12;
        var el = document.getElementById("adm-pocet-fronta");
        if (!el) return;
        el.textContent = r.length ? "(" + r.length + ")" : "";
        var stari = r.length ? (Date.now() - new Date(r[0].vytvoreno).getTime()) / 3600000 : 0;
        if (stari > hod) {
          el.style.color = "#A3302B"; el.style.fontWeight = "700";
          el.title = "Nejstarší registrace čeká na schválení " + Math.floor(stari) + " h — slib zní do 24 hodin.";
        }
      }).catch(function () {});
    }
    if (p.vse || p.odchozi_maily || p.fronta_mailu) {
      db("web_mail_fronta?select=id&stav=eq.ceka").then(function (r) {
        var el = document.getElementById("adm-pocet-odchozi");
        if (el) el.textContent = r.length ? "(" + r.length + ")" : "";
      }).catch(function () {});
    }
  }
  document.addEventListener("click", function (e) {
    if (e.target && e.target.id === "adm-odhlasit") odhlasit();
  });

  window.HBA = { prihlasit: prihlasit, odhlasit: odhlasit, db: db, rpc: rpc, ja: ja, token: platnyToken,
                 vyzadovat: vyzadovat, zobrazKdo: zobrazKdo, mojePrava: mojePrava, esc: esc, datum: datum, cas: cas };
})();
