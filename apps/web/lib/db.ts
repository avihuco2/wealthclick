import postgres from "postgres";

let _sql: ReturnType<typeof postgres> | null = null;

export function getDb() {
  if (!_sql) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
    _sql = postgres(process.env.DATABASE_URL, { max: 10, idle_timeout: 20 });
  }
  return _sql;
}

export type DbUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: "admin" | "user";
  active: boolean;
  created_at: Date;
  updated_at: Date;
};
