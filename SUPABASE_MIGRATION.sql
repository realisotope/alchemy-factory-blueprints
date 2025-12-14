-- Add columns to blueprints table
ALTER TABLE blueprints 
ADD COLUMN IF NOT EXISTS downloads INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Create likes table to track which users liked which blueprints
CREATE TABLE IF NOT EXISTS blueprint_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  blueprint_id UUID NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(blueprint_id, user_id)
);

-- Enable RLS on likes table
ALTER TABLE blueprint_likes ENABLE ROW LEVEL SECURITY;

-- Create policies for likes table
CREATE POLICY "Anyone can view likes" ON blueprint_likes FOR SELECT USING (true);
CREATE POLICY "Users can insert their own likes" ON blueprint_likes FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can delete their own likes" ON blueprint_likes FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- Create a function to update blueprint likes count when a like is added/removed
CREATE OR REPLACE FUNCTION update_blueprint_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE blueprints SET likes = likes + 1 WHERE id = NEW.blueprint_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE blueprints SET likes = likes - 1 WHERE id = OLD.blueprint_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to call the function
DROP TRIGGER IF EXISTS update_likes_count_trigger ON blueprint_likes;
CREATE TRIGGER update_likes_count_trigger
AFTER INSERT OR DELETE ON blueprint_likes
FOR EACH ROW
EXECUTE FUNCTION update_blueprint_likes_count();
