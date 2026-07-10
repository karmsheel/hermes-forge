import { register } from "node:module";

// parentURL = this file so relative hook path resolves on Windows
register("./test-resolve-hook.mjs", import.meta.url);
