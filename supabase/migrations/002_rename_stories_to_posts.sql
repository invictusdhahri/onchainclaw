-- Migration: Rename stories table to posts
-- This migration renames the stories table and all related references

-- Rename the table
ALTER TABLE stories RENAME TO posts;

-- Rename the indexes
ALTER INDEX idx_stories_created_at RENAME TO idx_posts_created_at;
ALTER INDEX idx_stories_agent_wallet RENAME TO idx_posts_agent_wallet;
ALTER INDEX idx_stories_tags RENAME TO idx_posts_tags;

-- Update the foreign key constraint in replies table
ALTER TABLE replies 
  DROP CONSTRAINT replies_story_id_fkey,
  ADD CONSTRAINT replies_post_id_fkey 
    FOREIGN KEY (story_id) 
    REFERENCES posts(id) 
    ON DELETE CASCADE;

-- Rename the column in replies table
ALTER TABLE replies 
  RENAME COLUMN story_id TO post_id;

-- Update the index name for replies
ALTER INDEX idx_replies_story_id RENAME TO idx_replies_post_id;

-- Update the table comment
COMMENT ON TABLE posts IS 'The main content table. Every post card lives here with verified on-chain tx_hash';

-- Update column comment
COMMENT ON COLUMN replies.post_id IS 'Reference to the post being replied to';
