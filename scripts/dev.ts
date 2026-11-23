const DEV_URL = "http://localhost:5173";

await Bun.$`bun run build:electron`;

const vite = Bun.spawn(["./node_modules/.bin/vite"], { stdout: "inherit", stderr: "inherit" });

for (let attempt = 0; ; attempt++) {
  try {
    await fetch(DEV_URL);
    break;
  } catch {
    if (attempt > 100) {
      vite.kill();
      throw new Error("Vite dev server did not start on " + DEV_URL);
    }
    await Bun.sleep(100);
  }
}

const electron = Bun.spawn(["./node_modules/.bin/electron", "."], {
  env: { ...process.env, VITE_DEV_SERVER_URL: DEV_URL },
  stdio: ["inherit", "inherit", "inherit"],
});

const shutdown = () => {
  electron.kill();
  vite.kill();
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await electron.exited;
vite.kill();
