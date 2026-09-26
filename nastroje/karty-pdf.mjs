// Karty etap do PDF.
//
// Starý web měl v administraci u každé etapy tlačítko „Generovat PDF“ a server
// z něj vyrobil soubor eNN-RRRR.pdf. Tady to dělá totéž, jen automaticky: po
// sestavení webu se každá stránka etapy vytiskne přes tiskový styl do PDF a
// uloží se vedle webu do složky karty/. Karta je tak vždycky shodná s tím, co
// je v databázi — není co zapomenout přegenerovat.
//
// Spouští se po `npm run build`: node nastroje/karty-pdf.mjs

import { createServer } from "node:http";
import { readFile, readdir, mkdir, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { chromium } from "playwright";

const WEB = "_site";
const ZAKLAD = process.env.ZAKLAD_URL || "";
const PORT = Number(process.env.PORT_KARTY || 8899);

const TYPY = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

function server() {
  return createServer(async (pozadavek, odpoved) => {
    let cesta = decodeURIComponent(pozadavek.url.split("?")[0]);
    if (ZAKLAD && cesta.startsWith(ZAKLAD)) cesta = cesta.slice(ZAKLAD.length);
    if (cesta.endsWith("/")) cesta += "index.html";
    if (cesta === "") cesta = "/index.html";
    try {
      const data = await readFile(join(WEB, cesta));
      odpoved.writeHead(200, { "Content-Type": TYPY[extname(cesta)] || "application/octet-stream" });
      odpoved.end(data);
    } catch {
      odpoved.writeHead(404);
      odpoved.end("404");
    }
  });
}

// Rok do názvu souboru je ve stránce etapy jako <meta name="hb-rok">.
// Proměnná ROK_KARET ho umí přebít, kdyby bylo potřeba.
const ROK = process.env.ROK_KARET || "";

async function main() {
  const slozky = (await readdir(join(WEB, "trasa"), { withFileTypes: true }))
    .filter((d) => d.isDirectory() && /^etapa-\d\d$/.test(d.name))
    .map((d) => d.name)
    .sort();

  if (!slozky.length) {
    console.log("Žádné stránky etap — karty se negenerují.");
    return;
  }

  await mkdir(join(WEB, "karty"), { recursive: true });
  const srv = server();
  await new Promise((hotovo) => srv.listen(PORT, hotovo));

  const prohlizec = await chromium.launch();
  const stranka = await prohlizec.newPage();
  let rok = ROK;

  for (const s of slozky) {
    const cislo = s.slice(-2);
    const adresa = `http://localhost:${PORT}${ZAKLAD}/trasa/${s}/`;
    await stranka.goto(adresa, { waitUntil: "networkidle" });
    if (!rok) {
      rok = await stranka.evaluate(
        () => document.querySelector('meta[name="hb-rok"]')?.content || ""
      );
      if (!rok) throw new Error("Stránka etapy neříká, ze kterého je ročníku (meta hb-rok).");
    }
    const soubor = join(WEB, "karty", `e${cislo}-${rok}.pdf`);
    await stranka.pdf({ path: soubor, format: "A4", printBackground: true });
    const { size } = await stat(soubor);
    console.log(`e${cislo}-${rok}.pdf — ${Math.round(size / 1024)} kB`);
  }

  await prohlizec.close();
  srv.close();
  console.log(`Hotovo: ${slozky.length} karet ve složce _site/karty/.`);
}

await main();
