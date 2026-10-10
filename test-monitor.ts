import { checkHealthFactor } from "./src/libs/aave";

const WALLET = "0xc0A0dd5de293Ce2784b535c6b187A051e1608B0c";

checkHealthFactor(WALLET)
  .then(() => console.log("Check completado"))
  .catch((e) => console.error(e));
