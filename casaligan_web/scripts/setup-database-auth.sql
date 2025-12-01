-- Add password_hash column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Create a default admin user with hashed password
-- Password: "admin123" (you should change this after first login)
-- Hash generated with bcrypt: $2a$10$... (bcrypt.hash("admin123", 10))

-- Update existing user_id=1 to be admin with correct role and password
UPDATE users 
SET 
  role = 'admin',
  password = 'admin123',
  password_hash = '$2b$10$Om3Igu8qZMzAcwxKL1hqaOnRQUOetyuCX1eM8lafl/q0KJPGSAABm',
  status = 'active'
WHERE user_id = 1;

-- Make sure admin entry exists in admins table
INSERT INTO admins (admin_id, user_id, admin_actions)
VALUES (1, 1, 0)
ON CONFLICT (admin_id) DO NOTHING;
