import globals from "globals";
import pluginJs from "@eslint/js";
import jsdoc from "eslint-plugin-jsdoc";

// eslint-disable-next-line jsdoc/reject-any-type
export default /** @type { any } */ ([
  { languageOptions: { globals: globals.node } },
  pluginJs.configs.recommended,
  jsdoc.configs["flat/recommended-typescript-flavor-error"],

  {
    rules: {
      "jsdoc/require-param-description": "off",
      "jsdoc/require-returns-description": "off",
    },
  },

  {
    files: ["*.test.js"],
    rules: {
      "jsdoc/reject-any-type": "off",
    },
  },
]);
