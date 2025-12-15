import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    out: "./.drizzle/",
    schema: "./src/config/db",
    dialect: "postgresql",
    dbCredentials: {
      host: process.env.DATABASE_HOST as string,
      port: parseInt(process.env.DATABASE_PORT as string),
      user: process.env.DATABASE_USER as string,
      password: process.env.DATABASE_PASSWORD as string,
      database: process.env.DATABASE_NAME as string,
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
      } : false
    },
    extensionsFilters: ["postgis"]
});
