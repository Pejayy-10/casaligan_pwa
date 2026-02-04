const bcrypt = require('bcryptjs');

// Generate password hash for "admin123"
const password = 'admin123';
const saltRounds = 10;

bcrypt.hash(password, saltRounds, function(err, hash) {
  if (err) {
    console.error('Error hashing password:', err);
    return;
  }
  console.log('Password hash for "admin123":');
  console.log(hash);
  console.log('\nUse this SQL to update your admin user:');
  console.log(`UPDATE users SET password_hash = '${hash}' WHERE user_id = 1;`);
});
