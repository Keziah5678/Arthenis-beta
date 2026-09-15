const nextCoreWebVitals = require("eslint-config-next/core-web-vitals");

module.exports = [
  { ignores: [".next/**", "node_modules/**"] },
  ...nextCoreWebVitals,
  {
    // These React Compiler readiness rules assume a codebase built for
    // the React Compiler (not used here) and flag verified-working
    // patterns (hoisted function declarations, state updates from async
    // handlers) as hard errors. Keep the rest of the ruleset intact.
    rules: {
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
      "react-hooks/set-state-in-effect": "off"
    }
  }
];
