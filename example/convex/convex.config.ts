import { defineApp } from "convex/server";
import affiliates from "chief_emerie/convex.config.js";

const app = defineApp();
app.use(affiliates);

export default app;
