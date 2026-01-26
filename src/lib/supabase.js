import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://edcfmaofcobqzmsylcfv.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkY2ZtYW9mY29icXptc3lsY2Z2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NDI5NzIsImV4cCI6MjA4NDgwMjk3Mn0.Osgbqq_2tKXDp8KiMyzDKzJeGEeSEXCZKNugwO3UEjs",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);
