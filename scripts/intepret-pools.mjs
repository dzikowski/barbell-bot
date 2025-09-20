#!/usr/bin/env node

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// fetch pools from file
const pools = JSON.parse(
  readFileSync(join(__dirname, "../data/sample-pools-response.json"), "utf8"),
).data.pools;

function printPools(safeToken) {
  /* eslint-disable-next-line no-undef */
  console.log(`\n--- ${safeToken} ---`);
  pools
    // both TVLs must be > 10_000 USD
    // .filter(pool => pool.token0TvlUsd > 10_000 && pool.token1TvlUsd > 10_000)
    // one of the tokens must be a safe asset
    .filter(pool => pool.token0 === safeToken || pool.token1 === safeToken)
    .forEach(pool => {
      const vals = [
        "$" + Math.round(pool.token0TvlUsd),
        pool.token0,
        "$" + Math.round(pool.token1TvlUsd),
        pool.token1,
        "$" + Math.round(pool.tvl),
        pool.fee
      ];
      /* eslint-disable-next-line no-undef */
      console.log(vals.join("\t"));
    });
}

printPools("GUSDT");
printPools("GUSDC");
printPools("GWBTC");
printPools("GALA");
