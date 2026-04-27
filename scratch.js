import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://zevumdqfzvzucxjdqtbv.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpldnVtZHFmenZ6dWN4amRxdGJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NjUyODcsImV4cCI6MjA5MjM0MTI4N30.udOG8zCcY_s1VXpmHGesSSsdLVadtfEe1drkIaHOUWg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  // Try inserting directly
  const { data, error } = await supabase.from('teams').insert({ project_id: 'dummy' }).select();
  console.log('Insert team:', error ? error.message : 'Success');
}

check();
