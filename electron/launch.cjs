const { app } = require("electron");
const { startCadence } = require("../dist-electron/main.js");

startCadence().catch((error) => {
  console.error(error);
  app.exit(1);
});
