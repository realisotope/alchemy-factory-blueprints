-- Create blueprints table
CREATE TABLE IF NOT EXISTS blueprints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  image_url TEXT,
  downloads INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create storage bucket for blueprint files
INSERT INTO storage.buckets (id, name, public) VALUES ('blueprints', 'blueprints', true) ON CONFLICT DO NOTHING;

-- Create storage bucket for images
INSERT INTO storage.buckets (id, name, public) VALUES ('blueprint-images', 'blueprint-images', true) ON CONFLICT DO NOTHING;

-- Storage policies for blueprints
CREATE POLICY "Anyone can view blueprints" ON storage.objects FOR SELECT USING (bucket_id = 'blueprints');
CREATE POLICY "Users can upload blueprints" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'blueprints' AND auth.uid() = owner);
CREATE POLICY "Users can delete their blueprints" ON storage.objects FOR DELETE USING (bucket_id = 'blueprints' AND auth.uid() = owner);

-- Storage policies for images
CREATE POLICY "Anyone can view images" ON storage.objects FOR SELECT USING (bucket_id = 'blueprint-images');
CREATE POLICY "Users can upload images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'blueprint-images' AND auth.uid() = owner);
CREATE POLICY "Users can delete their images" ON storage.objects FOR DELETE USING (bucket_id = 'blueprint-images' AND auth.uid() = owner);

-- Enable RLS
ALTER TABLE blueprints ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read blueprints
CREATE POLICY "Anyone can read blueprints" ON blueprints FOR SELECT USING (true);

-- Allow users to insert their own blueprints
CREATE POLICY "Users can insert blueprints" ON blueprints FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own blueprints
CREATE POLICY "Users can update their blueprints" ON blueprints FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own blueprints
CREATE POLICY "Users can delete their blueprints" ON blueprints FOR DELETE USING (auth.uid() = user_id);
