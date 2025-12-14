import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://edcfmaofcobqzmsylcfv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkY2ZtYW9mY29icXptc3lsY2Z2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1MzUxMzUsImV4cCI6MjA4MTExMTEzNX0.BrT8PIDpVnkVrDVLKr9K7WPoIrnBGgSzstKxEA6U_Cs",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);
