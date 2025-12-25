import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";

const api = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./api" }),
});

export const collections = { api };
