-- Check all packages in the database
SELECT 
  p.package_id,
  p.title,
  p.description,
  p.price,
  p.availability,
  p.status,
  p.created_at,
  w.worker_id,
  u.name as worker_name
FROM packages p
JOIN workers w ON p.worker_id = w.worker_id
JOIN users u ON w.user_id = u.user_id
ORDER BY p.package_id;

-- Count total packages
SELECT COUNT(*) as total_packages FROM packages;

-- Show package IDs only (for reference when inserting matching records)
SELECT package_id FROM packages ORDER BY package_id;
