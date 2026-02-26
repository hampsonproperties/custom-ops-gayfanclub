-- Check current users and their names
SELECT id, email, full_name, is_active, created_at
FROM users
ORDER BY email;

-- Update user full names
-- Uncomment and modify with actual names:

/*
UPDATE users SET full_name = 'Timothy' WHERE email = 'timothy@thegayfanclub.com';
UPDATE users SET full_name = 'Sales Team' WHERE email = 'sales@thegayfanclub.com';
UPDATE users SET full_name = 'Sarah' WHERE email = 'sarah@thegayfanclub.com';
UPDATE users SET full_name = 'Operations' WHERE email = 'ops@thegayfanclub.com';
*/

-- Verify the changes
SELECT id, email, full_name, is_active
FROM users
ORDER BY email;
