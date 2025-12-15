
// prisma.config.ts
import "dotenv/config"; // 👈 ADD THIS LINE at the top!
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  // Point to your schema
  schema: "prisma/schema.prisma",
  // Define the datasource here (NOT in the schema file anymore)
  datasource: {
    provider: "postgresql",
    url: env("DATABASE_URL"),
  },
});