import { defineApp } from "convex/server";
import affiliates from "convex-affiliates/convex.config.js";

const app = defineApp();
app.use(affiliates);

export default app;
