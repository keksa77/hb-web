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
    if (!t) throw new Error("Nejste přihlášen.");
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

  // Hlavička: jméno, menu, odhlášení. Stránky, které přihlášení vyžadují, zavolají HBA.vyzadovat().
  async function vyzadovat() {
    var j = await ja();
    if (!j || !j.osoba_id) { location.href = HB.zaklad + "/admin/?zpet=" + encodeURIComponent(location.pathname + location.hash); return null; }
    if ((j.uroven || 0) < 30) {
      document.querySelector(".adm-hlavni").innerHTML =
        '<p class="adm-chyba">Váš účet nemá organizátorská práva. Požádejte správce o přidělení role.</p>';
      zobrazKdo(j); return null;
    }
    zobrazKdo(j);
    return j;
  }
  function zobrazKdo(j) {
    document.getElementById("adm-jmeno").textContent = (j.jmeno || j.email) + (j.role ? " · " + j.role : "");
    document.getElementById("adm-kdo").hidden = false;
    var jeOrg = (j.uroven || 0) >= 30;
    document.getElementById("adm-menu").hidden = !jeOrg;
    if (jeOrg) {
      // Počet čekajících ostrých mailů v menu (zkušební přihlášky se nepočítají).
      db("web_maily_ke_schvaleni?select=id,web_tym!inner(testovaci)&stav=eq.ceka&web_tym.testovaci=is.false").then(function (r) {
        var el = document.getElementById("adm-pocet-fronta");
        if (el) el.textContent = r.length ? "(" + r.length + ")" : "";
      }).catch(function () {});
    }
  }
  document.addEventListener("click", function (e) {
    if (e.target && e.target.id === "adm-odhlasit") odhlasit();
  });

  window.HBA = { prihlasit: prihlasit, odhlasit: odhlasit, db: db, rpc: rpc, ja: ja,
                 vyzadovat: vyzadovat, zobrazKdo: zobrazKdo, esc: esc, datum: datum, cas: cas };
})();
