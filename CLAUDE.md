# Hory Bory — nový web (hb-web)

Kontext pro Clauda. Tenhle soubor se načte na začátku každé relace,
ať se nemusí projekt pokaždé vysvětlovat znovu. Podrobnosti pro lidi jsou v `README.md`.

## O projektu

Hory Bory je štafetový běh z Beskyd na Pálavu: 30 etap, nepřetržitě dnem i nocí.
V repozitáři je nový web závodu (veřejné stránky, kapitánská sekce, administrace).
Komunikuj česky a srozumitelně, bez zbytečného žargonu.

## Kde co běží

| Co | Kde |
|---|---|
| Testovací web | https://keksa77.github.io/hb-web/ (podsložka `/hb-web/`) |
| Ostrý web | https://www.horybory.cz/ — přepnutí plánované na prosinec 2026, zatím starý web na Wedosu |
| Databáze | Supabase, projekt **`hory-bory`** (ref `rjuxqlyckikuxfaeaozf`, eu-central-1) |

V Supabase jsou na stejném účtu i jiné projekty (`vixen-dev`, `diktator`, `trenink`).
S Hory Bory nesouvisí, nepleť si je.

## Jak to funguje

- Statický web z **Eleventy 3** (Node 22). Obsah (texty, FAQ, stránky, galerie, výsledky)
  se stahuje ze Supabase **při sestavení** (`src/_data/obsah.js`) a zapeče se do HTML.
- Kapitánská sekce (`src/kapitan/`) a administrace (`src/admin/`) běží v prohlížeči
  a volají databázové funkce přes `supabase.rpc(...)`. Funkce mají předponu `web_`,
  kapitánské `web_k_`, administrátorské `web_admin_`.
- Nasazení: GitHub Actions `.github/workflows/build.yml` při pushi do `main`
  (nebo ručně: Actions → Sestavit a vystavit → Run workflow). Kromě webu tiskne
  karty etap do PDF (`nastroje/karty-pdf.mjs`, Playwright).
- Nasazení na Wedos přes FTP ve workflow **schválně není**, aby se nepřepsal živý web.
  Nepřidávej ho bez výslovného pokynu.

## Příkazy

```
npm install
npm run build                                          # výsledek v _site/
npm start                                              # náhled na http://localhost:8080
OBSAH_ZE_SOUBORU=misto/obsah-nanecisto.json npm run build   # bez přístupu k databázi
ZAKLAD_URL=/hb-web npm run build                       # jako na testovací adrese
```

## Struktura

```
src/_data/web.js        nastavení — adresa Supabase, veřejný klíč, základ adresy
src/_data/obsah.js      stažení obsahu ze Supabase; blokyStranek = co patří na kterou stránku
src/_data/trasa.js, gpx.js   etapy a trasy
src/_includes/          kostry: zaklad.njk (veřejný web), kapitan.njk, admin.njk
src/stranky.njk         šablona pro obsahové stránky z databáze
src/kapitan/, src/admin/     kapitánská sekce a administrace
src/assets/             styly, skripty, písmo Nunito, obrázky etap, loga partnerů
misto/                  zkušební data pro sestavení bez databáze
nastroje/               pomocné skripty (tisk karet etap)
```

## Pravidla a na co pozor

- **Veřejný (publishable) klíč** v `web.js` není tajemství; data chrání pravidla RLS.
  Tabulky s osobními údaji (`web_osoba`, `web_tym`, `web_pristup_tymu`) nemají veřejné čtení
  a nesmí ho dostat. Tajné klíče (service role) nikdy nedávej do repozitáře.
- **Build schválně spadne**, když databáze neodpoví nebo vznikne málo stránek.
  Tuhle kontrolu neobcházej.
- Odkazy v textech z databáze se píšou od kořene (`/kapitan/...`); základ `/hb-web`
  doplňuje `sZakladem()` v `obsah.js`. V šablonách používej `{{ web.zaklad }}`.
- Žádná externí písma (Nunito je přímo na webu). Veřejný web nenačítá nic z cizích serverů;
  výjimkou je administrace (Tabulator a xlsx z jsDelivr v `admin.njk`).
- Stránky se zveřejňují přepnutím `viditelna` v databázi.
- Obsah je zatím o ročníku 2026 (termíny, startovné A–E, dresy); před registrací HB27 se přepisuje.
- Změny v databázi (migrace, nové funkce) dělej opatrně, jde rovnou na ostrý projekt.
  Před úpravou se podívej na existující tabulky a funkce.
- Na startovní časy, vlny a odhady časů týmů je skill `hb-kalkulace-startu`.

## Commity

Krátká česká zpráva bez diakritiky ve tvaru `Oblast: co se změnilo`, např.
`Fotky: galerie po rocnicich (/fotky/ a /fotky/RRRR/)`.
