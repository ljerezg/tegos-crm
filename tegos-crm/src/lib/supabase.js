import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://fkdphovtwnexipnsfslh.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrZHBob3Z0d25leGlwbnNmc2xoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMjE2NDQsImV4cCI6MjA5NTg5NzY0NH0.EPy6DSbHAXYwAuLsYqhtuvvGtTz-g-rdnFIKR9qjmZ0'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
})
