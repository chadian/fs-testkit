// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import mdx from "@astrojs/mdx";

// https://astro.build/config
export default defineConfig({
  site: "https://chadian.github.io",
  base: "/fs-testkit",

  vite: {
    plugins: [tailwindcss()],
  },

  markdown: {
    rehypePlugins: [
      rehypeSlug,
      [
        rehypeAutolinkHeadings,
        {
          behavior: "wrap",
          properties: { className: ["no-underline", "font-bold"] },
        },
      ],
    ],
    shikiConfig: {
      theme: "one-light",
    },
  },

  integrations: [mdx()],
});
