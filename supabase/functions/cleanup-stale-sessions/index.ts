import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Cleanup Edge Function - نسخة مبسّطة
 * 
 * المنطق:
 * 1. أي جلسة last_activity > 5 دقائق → حذف لاعبيها + حذف الجلسة (session_questions تبقى)
 * 2. لاعبون أشباح (is_connected=true + last_seen > 5 دقائق) → تصحيح حالتهم
 * 3. لاعبون منقطعون بدون جلسة نشطة > 5 دقائق → حذفهم
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const results = {
      sessionsDeleted: 0,
      playersDeleted: 0,
      ghostPlayersFixed: 0,
      orphanPlayersDeleted: 0,
    }

    const now = Date.now()
    const fiveMinutesAgo = new Date(now - 5 * 60 * 1000).toISOString()

    // ====== 1. كشف وحذف الجلسات الخاملة (5 دقائق) ======
    // أي جلسة last_activity > 5 دقائق → حذف كل شيء ما عدا session_questions
    const { data: staleSessions, error: staleError } = await supabase
      .from('game_sessions')
      .select('id, session_code')
      .lt('last_activity', fiveMinutesAgo)

    if (staleError) {
      console.error('Error finding stale sessions:', staleError)
    } else if (staleSessions && staleSessions.length > 0) {
      const staleIds = staleSessions.map(s => s.id)

      // حذف اللاعبين أولاً
      const { data: deletedPlayers } = await supabase
        .from('session_players')
        .delete()
        .in('session_id', staleIds)
        .select('id')

      results.playersDeleted = deletedPlayers?.length || 0

      // حذف الجلسات
      const { error: deleteError } = await supabase
        .from('game_sessions')
        .delete()
        .in('id', staleIds)

      if (!deleteError) {
        results.sessionsDeleted = staleSessions.length
        console.log(`🗑️ Deleted ${staleSessions.length} stale sessions (5min+):`, staleSessions.map(s => s.session_code))
      }
    }

    // ====== 2. تصحيح الأشباح (is_connected=true + last_seen > 5 دقائق) ======
    const { data: ghostPlayers, error: ghostError } = await supabase
      .from('session_players')
      .select('id, player_name')
      .eq('is_connected', true)
      .lt('last_seen', fiveMinutesAgo)

    if (!ghostError && ghostPlayers && ghostPlayers.length > 0) {
      const ghostIds = ghostPlayers.map(p => p.id)

      await supabase
        .from('session_players')
        .update({ is_connected: false })
        .in('id', ghostIds)

      results.ghostPlayersFixed = ghostPlayers.length
      console.log(`👻 Fixed ${ghostPlayers.length} ghost players`)
    }

    // ====== 3. حذف لاعبين يتامى (بدون جلسة أو منقطعين > 5 دقائق) ======
    const { data: orphanPlayers, error: orphanError } = await supabase
      .from('session_players')
      .select('id')
      .eq('is_connected', false)
      .lt('last_seen', fiveMinutesAgo)

    if (!orphanError && orphanPlayers && orphanPlayers.length > 0) {
      const orphanIds = orphanPlayers.map(p => p.id)

      await supabase
        .from('session_players')
        .delete()
        .in('id', orphanIds)

      results.orphanPlayersDeleted = orphanPlayers.length
      console.log(`🧹 Deleted ${orphanPlayers.length} orphan players`)
    }

    // ====== النتيجة ======
    const totalCleaned = results.sessionsDeleted + results.playersDeleted + results.ghostPlayersFixed + results.orphanPlayersDeleted

    console.log('🧹 Cleanup summary:', results)

    return new Response(
      JSON.stringify({
        message: totalCleaned > 0 ? 'Cleanup completed' : 'Nothing to clean',
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Cleanup error:', error)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
