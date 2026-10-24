// Supabase project settings. Replace these two placeholders with values from Supabase > Project Settings > API.
const SUPABASE_URL = 'https://tisimirheyocovvvdzof.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xfrQZ-GdXDHBpdaMllhY1A_IPB-2Ypx';
const SUPABASE_CONFIGURED = /^https:\/\/[^/]+\.supabase\.co$/i.test(SUPABASE_URL) && !SUPABASE_URL.includes('YOUR-PROJECT') && SUPABASE_ANON_KEY.length > 30 && !SUPABASE_ANON_KEY.includes('YOUR_SUPABASE');
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
