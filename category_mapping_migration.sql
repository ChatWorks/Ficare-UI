-- Migration: Create category_mapping table for enhanced P&L mapping
-- Run this SQL in your Supabase SQL Editor

-- Create category_mapping table
CREATE TABLE category_mapping (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    category_3 text NOT NULL,
    mapped_category text NOT NULL CHECK (mapped_category IN (
        'Omzet',
        'Inkoopwaarde omzet', 
        'Provisies',
        'Personeelskosten direct',
        'Autokosten',
        'Marketingkosten', 
        'Operationele personeelskosten',
        'Huisvestingskosten',
        'Kantoorkosten',
        'Algemene kosten',
        'Afschrijvingskosten',
        'Financieringskosten'
    )),
    type_rekening text NOT NULL CHECK (type_rekening IN ('Kosten', 'Opbrengsten')),
    user_verified boolean DEFAULT false, -- Has user manually verified this mapping
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now(),
    UNIQUE(user_id, category_3) -- One mapping per user per category_3
);

-- Create index for performance
CREATE INDEX idx_category_mapping_user_type ON category_mapping(user_id, type_rekening);
CREATE INDEX idx_category_mapping_category ON category_mapping(user_id, mapped_category);

-- Enable RLS
ALTER TABLE category_mapping ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own category mappings"
ON category_mapping
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own category mappings"
ON category_mapping
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own category mappings"
ON category_mapping
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own category mappings"
ON category_mapping
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_category_mapping_updated_at 
    BEFORE UPDATE ON category_mapping 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create user_settings table for storing general user preferences
CREATE TABLE user_settings (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    has_completed_initial_setup boolean DEFAULT false,
    enhanced_pnl_enabled boolean DEFAULT true,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

-- Enable RLS on user_settings
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_settings
CREATE POLICY "Users can view their own settings"
ON user_settings
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
ON user_settings
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
ON user_settings
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Create trigger for user_settings updated_at
CREATE TRIGGER update_user_settings_updated_at 
    BEFORE UPDATE ON user_settings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default settings for existing users (if any)
INSERT INTO user_settings (user_id, has_completed_initial_setup, enhanced_pnl_enabled)
SELECT id, false, true 
FROM auth.users 
WHERE id NOT IN (SELECT user_id FROM user_settings WHERE user_id IS NOT NULL)
ON CONFLICT (user_id) DO NOTHING;

