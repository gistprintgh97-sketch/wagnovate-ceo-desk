export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { checkEnvironment, startScheduler } = await import("./instrumentation-node");
    checkEnvironment();
    startScheduler();
  }
}
