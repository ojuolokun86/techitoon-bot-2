const { createClient } = require('@supabase/supabase-js');
const { supabaseUrl, supabaseKey } = require('./loadEnv');

console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key:', supabaseKey);

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL and Key are required.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;