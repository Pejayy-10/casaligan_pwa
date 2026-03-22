-- Remove circular reference: users.address_id is unused
-- The correct relationship is addresses.user_id -> users.id

-- Drop the foreign key constraint first
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_address_id_fkey;

-- Drop the address_id column from users table
ALTER TABLE users DROP COLUMN IF EXISTS address_id;

-- Verify the remaining relationship is correct
-- addresses.user_id should still reference users.id (which it does)
