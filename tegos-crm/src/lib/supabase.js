import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://fkdphovtwnexipnsfslh.supabase.co'
const SUPABASE_KEY = 'sb_publishable_U14eETqXoqj7m0xUjD83WQ_wPGaK41v'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
