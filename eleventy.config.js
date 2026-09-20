// Eleventy – konfigurace webu Hory Bory.
// Web se generuje předem: obsah se vytáhne ze Supabase při buildu a zapeče se
// do hotových HTML souborů. Důvod je v rozhodnutí z 20. 9. 2026 — vyhledávače
// a hlavně náhledy odkazů na sítích a v mailech potřebují text přímo ve stránce.

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });

  // Datum ve tvaru, na který jsou lidi zvyklí: 5. 9. 2026
  eleventyConfig.addFilter("datum", (d) => {
    if (!d) return "";
    const x = new Date(d);
    return `${x.getDate()}. ${x.getMonth() + 1}. ${x.getFullYear()}`;
  });

  return {
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
}
