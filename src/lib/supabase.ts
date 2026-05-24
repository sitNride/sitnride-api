import { createClient } from '@supabase/supabase-js';


// Initialize database client
const supabaseUrl = 'https://bcjnjmkspxszswcqrxzm.databasepad.com';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjI1MTk3NWI4LTllZGYtNGYwNC1hYTkxLWMyMDQ2N2JhNjBiNCJ9.eyJwcm9qZWN0SWQiOiJiY2puam1rc3B4c3pzd2Nxcnh6bSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzY5OTE2ODAwLCJleHAiOjIwODUyNzY4MDAsImlzcyI6ImZhbW91cy5kYXRhYmFzZXBhZCIsImF1ZCI6ImZhbW91cy5jbGllbnRzIn0.sZBjYedk5nbze8wrr3L_xR3je-6Hqoi8OljOzw6jym8';
const supabase = createClient(supabaseUrl, supabaseKey);


export { supabase };