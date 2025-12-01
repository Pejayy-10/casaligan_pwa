/**
 * Script to create an admin user in Supabase
 * Run this once: node scripts/create-admin.js
 * 
 * Note: You need to add your SUPABASE_SERVICE_ROLE_KEY to .env.local first
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Error: Missing environment variables!');
  console.error('Please add SUPABASE_SERVICE_ROLE_KEY to your .env.local file');
  console.error('\nTo get your service role key:');
  console.error('1. Go to Supabase Dashboard > Settings > API');
  console.error('2. Copy the "service_role" key (keep it secret!)');
  console.error('3. Add it to .env.local as: SUPABASE_SERVICE_ROLE_KEY=your_key_here');
  process.exit(1);
}

// Use service role key to bypass RLS
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createAdminUser() {
  const email = 'admin@example.com';
  const password = 'admin';

  try {
    console.log('🔄 Creating admin user...');
    
    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm email
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        console.log('ℹ️  User already exists, checking if we need to update...');
        // Try to sign in to get the user ID
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: email,
          password: password,
        });
        
        if (signInError) {
          console.error('❌ Error signing in existing user:', signInError.message);
          console.error('\nThe user might exist but with a different password.');
          console.error('Please delete the user from Supabase Dashboard and run this script again.');
          process.exit(1);
        }
        
        console.log('✅ User already exists and password is correct!');
        console.log('✅ You can now log in with:');
        console.log(`   Email: ${email}`);
        console.log(`   Password: ${password}`);
        process.exit(0);
      }
      
      console.error('❌ Error creating user:', authError.message);
      process.exit(1);
    }

    if (!authData?.user) {
      console.error('❌ Failed to create user: No user data returned');
      process.exit(1);
    }

    const userId = authData.user.id;

    console.log('✅ User created in Auth!');
    console.log(`   User ID: ${userId}`);
    console.log(`   Email: ${email}`);

    // Now create the user in the users table
    console.log('\n🔄 Creating user record in users table...');
    
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        user_id: userId, // Use the auth user ID
        name: 'Admin',
        email: email,
        role: 'admin', // Set role to admin
        status: 'active',
      })
      .select()
      .single();

    if (userError) {
      // If the insert fails, the user might already exist in users table
      if (userError.code === '23505') { // Unique constraint violation
        console.log('ℹ️  User already exists in users table, updating...');
        const { error: updateError } = await supabase
          .from('users')
          .update({
            role: 'admin',
            status: 'active',
          })
          .eq('email', email);

        if (updateError) {
          console.error('❌ Error updating user:', updateError.message);
        } else {
          console.log('✅ User updated in users table!');
        }
      } else {
        console.error('❌ Error creating user in users table:', userError.message);
        console.error('\nNote: User was created in Auth but not in users table.');
        console.error('You may need to manually create the user record in Supabase Dashboard.');
      }
    } else {
      console.log('✅ User created in users table!');
    }

    // Create admin record if admins table exists
    console.log('\n🔄 Creating admin record...');
    const { error: adminError } = await supabase
      .from('admins')
      .insert({
        user_id: userId,
        admin_actions: 'Full access',
      });

    if (adminError) {
      if (adminError.code === '23505') {
        console.log('ℹ️  Admin record already exists');
      } else {
        console.log('⚠️  Could not create admin record (this is optional):', adminError.message);
      }
    } else {
      console.log('✅ Admin record created!');
    }

    console.log('\n✅ Admin user created successfully!');
    console.log('\n📝 Login credentials:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log('\n🎉 You can now log in at /auth');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

createAdminUser();

