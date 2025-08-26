-- Migration: Add title column to conversations table
-- Run this SQL in your Supabase SQL Editor

-- Add title column to conversations table
ALTER TABLE conversations ADD COLUMN title text DEFAULT 'Financieel gesprek';

-- Update existing conversations with default title (if any exist)
UPDATE conversations SET title = 'Financieel gesprek' WHERE title IS NULL;
