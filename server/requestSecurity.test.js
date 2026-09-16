import assert from "node:assert/strict";
import { isAllowedRequestOrigin } from "./requestSecurity.js";

const allowedOrigins = new Set(["https://portal.escola.edu.br"]);
const request = { protocol: "https", host: "api.escola.edu.br", allowedOrigins, isProduction: true };

assert.equal(isAllowedRequestOrigin({ ...request, origin: "https://portal.escola.edu.br" }), true);
assert.equal(isAllowedRequestOrigin({ ...request, origin: "https://api.escola.edu.br" }), true);
assert.equal(isAllowedRequestOrigin({ ...request, origin: "https://malicioso.example" }), false);
