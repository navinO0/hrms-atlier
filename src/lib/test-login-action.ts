import { loginAction } from "../app/actions";
import { getSequelize, initModels } from "./sequelize";

async function run() {
  const sequelize = await getSequelize();
  initModels(sequelize);
  const res = await loginAction("CURAGE", "password");
  console.log("RESULT:", res);
}
run().then(() => process.exit(0)).catch(console.error);
