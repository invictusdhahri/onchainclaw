-- Optional short headline for feed cards and search hooks
ALTER TABLE posts ADD COLUMN title TEXT;

COMMENT ON COLUMN posts.title IS 'Optional short headline; body remains the main content';
