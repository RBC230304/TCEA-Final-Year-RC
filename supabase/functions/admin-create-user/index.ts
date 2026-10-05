import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!serviceKey) return json({ error: 'Server is not configured with SUPABASE_SERVICE_ROLE_KEY.' }, 500)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Authentication required.' }, 401)
  const token = authHeader.replace('Bearer ', '')

  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? serviceKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: { user }, error: userError } = await userClient.auth.getUser(token)
  if (userError || !user) return json({ error: 'Invalid session.' }, 401)

  const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: callerProfile, error: profileError } = await adminClient.from('profiles').select('role').eq('id', user.id).single()
  if (profileError || callerProfile?.role !== 'admin') return json({ error: 'Admin access required.' }, 403)

  let body: any
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON body.' }, 400) }
  const { full_name, email, password, role = 'student', department = null, roll_no = null, cgpa = null } = body
  if (!full_name || !email || !password) return json({ error: 'Full name, email and password are required.' }, 400)
  if (String(password).length < 8) return json({ error: 'Password must contain at least 8 characters.' }, 400)
  if (!['student', 'tpo', 'admin', 'company'].includes(role)) return json({ error: 'Invalid role.' }, 400)

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email: String(email).trim(),
    password: String(password),
    email_confirm: true,
    user_metadata: { full_name: String(full_name).trim() },
  })
  if (createError || !created.user) return json({ error: createError?.message ?? 'Unable to create user.' }, 400)

  const { error: upsertError } = await adminClient.from('profiles').upsert({
    id: created.user.id,
    full_name: String(full_name).trim(),
    role,
    email: String(email).trim(),
    department: department || null,
    roll_no: roll_no || null,
    cgpa: cgpa === null || cgpa === '' ? null : Number(cgpa),
  })
  if (!upsertError && role === 'company') {
    const { error: companyError } = await adminClient.from('companies').insert({
      user_id: created.user.id, name: String(full_name).trim(), email: String(email).trim()
    })
    if (companyError) { await adminClient.auth.admin.deleteUser(created.user.id); return json({ error: companyError.message }, 400) }
  }
  if (upsertError) {
    await adminClient.auth.admin.deleteUser(created.user.id)
    return json({ error: upsertError.message }, 400)
  }

  return json({ ok: true, user: { id: created.user.id, email: created.user.email, role } })
})
