# hb-web — nový web Hory Bory

Statické stránky generované nástrojem **Eleventy**. Obsah (texty, FAQ, stránky)
leží v **Supabase** a zapeče se do hotových HTML souborů při sestavení, ne až
v prohlížeči návštěvníka. Důvod: vyhledávače a hlavně náhledy odkazů na sítích
a v mailech potřebují text přímo ve stránce.

*Rozhodnuto 20. 9. 2026. Souvislosti jsou v projektu ve složce
`HB27 - nový web` v souboru `_KONTEXT.md`, sekce 1f.*

## Kde web běží

| Kde | Adresa | K čemu |
|---|---|---|
| Testovací | https://keksa77.github.io/hb-web/ | tady se vyvíjí a zkouší |
| Ostrý | https://www.horybory.cz/ | až po přepnutí, prosinec 2026 |

Nasazení na Wedos přes FTP zatím **není** ve workflow schválně — aby se
omylem nepřepsal živý web. Doplní se až před přepnutím domény.

## Jak se to sestaví

Sestavuje se samo na GitHubu při každé změně v repozitáři. Po úpravě textů
v databázi se web přegeneruje ručním spuštěním: **Actions → Sestavit a vystavit
→ Run workflow**. Trvá to pár minut.

Na svém počítači (potřeba Node 22):

```
npm install
npm run build     # výsledek je ve složce _site
npm start         # náhled na http://localhost:8080
```

## Jak je to poskládané

```
src/_data/web.js       nastavení — adresa databáze a veřejný klíč
src/_data/obsah.js     stažení obsahu ze Supabase při sestavení
src/_includes/         společná kostra stránky (hlavička, menu, patička)
src/stranky.njk        šablona, ze které vzniknou všechny stránky
src/assets/styl.css    styl — provizorium, než dorazí návrh grafika
misto/                 zkušební data pro práci bez přístupu k databázi
```

Které textové bloky patří na kterou stránku, je v `src/_data/obsah.js`
v proměnné `blokyStranek`.

### Zkušební režim bez databáze

```
OBSAH_ZE_SOUBORU=misto/obsah-nanecisto.json npm run build
```

## Na co si dát pozor

- **Veřejný klíč v souboru není tajemství.** Sám o sobě neotevře nic; dovnitř
  pouštějí až pravidla (policy) v databázi. Tabulky s osobními údaji
  (`web_osoba`, `web_tym`, `web_pristup_tymu`) nemají veřejné čtení vůbec.
- **Když databáze neodpoví, sestavení schválně spadne.** Je lepší nevydat nic
  než vydat web s prázdnými stránkami.
- **Stránky jsou zatím rozpracované a nesou upozornění.** Zveřejňují se
  přepnutím `viditelna` v databázi, až budou hotové.
- **Obsah je pořád o ročníku 2026** — termíny, ceny startovného A–E, dresy.
  Před spuštěním registrace HB27 se to musí přepsat.
# hb-web
