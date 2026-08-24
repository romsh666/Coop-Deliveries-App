import { config } from "dotenv";

// Database-backed tests (the price-list and delivery API suites) need
// DATABASE_URL and JWT_SECRET set. Prefer .env.test if present so tests
// never accidentally run against your development/production database.
config({ path: ".env.test" });
config(); // fall back to .env for anything not set in .env.test
