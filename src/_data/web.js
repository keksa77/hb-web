// Nastavení webu. Klíč je veřejný (publishable) — sám o sobě neotevře nic,
// dovnitř pouštějí až pravidla (policy) v databázi.
export default {
  nazev: "Hory Bory",
  popis: "Štafetový běh z Beskyd na Pálavu. 30 etap, nepřetržitě dnem i nocí.",
  supabaseUrl: process.env.SUPABASE_URL || "https://rjuxqlyckikuxfaeaozf.supabase.co",
  supabaseKlic: process.env.SUPABASE_KLIC || "sb_publishable_wsSsZ1hCLbrRThr8Co4xbg_W9yAucb6",
  // Adresa, pod kterou web běží. Na testovací adrese GitHub Pages je web
  // v podsložce /hb-web/, na ostrém webu v kořeni.
  zaklad: process.env.ZAKLAD_URL || "",
  jazyk: "cs",
};
