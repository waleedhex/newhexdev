import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { X, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { t, getLangFromUrl, isRtl } from '@/lib/i18n';

interface Player {
  id: string;
  player_name: string;
  team: string | null;
  is_connected: boolean;
  last_seen: string | null;
}

interface TeamPlayersPanelProps {
  sessionId: string | null;
  redColor: string;
  greenColor: string;
}

const LONG_PRESS_DURATION = 500;
const INACTIVE_THRESHOLD_MS = 60000;

const TeamPlayersPanel: React.FC<TeamPlayersPanelProps> = ({
  sessionId,
  redColor,
  greenColor,
}) => {
  const lang = getLangFromUrl();
  const [players, setPlayers] = useState<Player[]>([]);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [pressingPlayerId, setPressingPlayerId] = useState<string | null>(null);
  const [movingPlayerId, setMovingPlayerId] = useState<string | null>(null);
  const [kickDialogOpen, setKickDialogOpen] = useState(false);
  const [playerToKick, setPlayerToKick] = useState<{ id: string; name: string } | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const isPlayerActive = useCallback((player: Player): boolean => {
    if (!player.last_seen) return player.is_connected;
    const lastSeenTime = new Date(player.last_seen).getTime();
    const now = Date.now();
    const isRecent = (now - lastSeenTime) < INACTIVE_THRESHOLD_MS;
    return player.is_connected && isRecent;
  }, []);

  const fetchPlayers = useCallback(async () => {
    if (!sessionId) return;
    const { data, error } = await supabase
      .from('session_players')
      .select('id, player_name, team, is_connected, last_seen')
      .eq('session_id', sessionId)
      .eq('role', 'contestant');
    if (error) { console.error('Error fetching players:', error); return; }
    setPlayers(data || []);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    fetchPlayers();
    const channel = supabase
      .channel(`players-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_players', filter: `session_id=eq.${sessionId}` }, () => { fetchPlayers(); })
      .subscribe();
    refreshIntervalRef.current = setInterval(fetchPlayers, 15000);
    return () => {
      supabase.removeChannel(channel);
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [sessionId, fetchPlayers]);

  const movePlayer = useCallback(async (playerId: string, currentTeam: string | null) => {
    const newTeam = currentTeam === 'red' ? 'green' : 'red';
    setMovingPlayerId(playerId);
    const { error } = await supabase.from('session_players').update({ team: newTeam }).eq('id', playerId);
    setTimeout(() => setMovingPlayerId(null), 300);
    if (error) { console.error('Error moving player:', error); toast.error(t(lang, 'moveError')); return; }
    toast.success(`${t(lang, 'moveSuccess')} ${newTeam === 'red' ? t(lang, 'redTeam') : t(lang, 'greenTeam')}`);
  }, [lang]);

  const handleKickClick = useCallback((playerId: string, playerName: string) => {
    setPlayerToKick({ id: playerId, name: playerName });
    setKickDialogOpen(true);
  }, []);

  const confirmKickPlayer = useCallback(async () => {
    if (!playerToKick) return;
    const { error } = await supabase.from('session_players').delete().eq('id', playerToKick.id);
    if (error) { console.error('Error kicking player:', error); toast.error(t(lang, 'kickError')); }
    else { toast.success(t(lang, 'kickSuccess').replace('{name}', playerToKick.name)); }
    setKickDialogOpen(false);
    setPlayerToKick(null);
  }, [playerToKick, lang]);

  const handlePressStart = useCallback((playerId: string, team: string | null) => {
    setPressingPlayerId(playerId);
    longPressTimerRef.current = setTimeout(() => { movePlayer(playerId, team); setPressingPlayerId(null); }, LONG_PRESS_DURATION);
  }, [movePlayer]);

  const handlePressEnd = useCallback(() => {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
    setPressingPlayerId(null);
  }, []);

  const redTeamPlayers = players.filter(p => p.team === 'red' && isPlayerActive(p));
  const greenTeamPlayers = players.filter(p => p.team === 'green' && isPlayerActive(p));
  const inactiveRedPlayers = players.filter(p => p.team === 'red' && !isPlayerActive(p));
  const inactiveGreenPlayers = players.filter(p => p.team === 'green' && !isPlayerActive(p));

  const PlayerBalloon = ({ player, teamColor, isInactive = false }: { player: Player; teamColor: string; isInactive?: boolean }) => {
    const isPressing = pressingPlayerId === player.id;
    const isMoving = movingPlayerId === player.id;
    return (
      <div
        className={`relative inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-white text-sm font-medium cursor-pointer select-none transition-transform duration-200 ${isPressing ? 'scale-95 opacity-80' : 'hover:scale-105'} ${isMoving ? 'scale-0 opacity-0' : ''} ${isInactive ? 'opacity-40 grayscale' : ''}`}
        style={{ backgroundColor: teamColor }}
        onMouseDown={() => handlePressStart(player.id, player.team)}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={() => handlePressStart(player.id, player.team)}
        onTouchEnd={handlePressEnd}
        onTouchCancel={handlePressEnd}
      >
        {isInactive ? <WifiOff className="w-3 h-3 opacity-70" /> : <Wifi className="w-3 h-3 opacity-70" />}
        <span>{player.player_name}</span>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); handlePressEnd(); handleKickClick(player.id, player.player_name); }}
          className="w-4 h-4 rounded-full bg-white/30 hover:bg-white/50 flex items-center justify-center transition-colors"
          title={t(lang, 'kickPlayer')}
        >
          <X className="w-3 h-3" />
        </button>
        {isPressing && <div className="absolute inset-0 rounded-full border-2 border-white animate-pulse" />}
      </div>
    );
  };

  if (!sessionId) return null;

  return (
    <div className="w-full max-w-2xl mx-auto mt-4">
      <div className="flex flex-col gap-3">
        {/* Red team */}
        <div className="relative p-3 rounded-xl border-2 min-h-[60px]" style={{ borderColor: redColor, backgroundColor: `${redColor}15` }}>
          <span className="absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: redColor }}>
            {redTeamPlayers.length}
            {inactiveRedPlayers.length > 0 && <span className="opacity-60"> (+{inactiveRedPlayers.length})</span>}
          </span>
          <div className="flex flex-wrap gap-2 justify-center">
            {redTeamPlayers.length === 0 && inactiveRedPlayers.length === 0 ? (
              <p className="text-muted-foreground text-sm py-2">{t(lang, 'noPlayers')}</p>
            ) : (
              <>
                {redTeamPlayers.map(player => <PlayerBalloon key={player.id} player={player} teamColor={redColor} />)}
                {inactiveRedPlayers.map(player => <PlayerBalloon key={player.id} player={player} teamColor={redColor} isInactive />)}
              </>
            )}
          </div>
        </div>

        {/* Green team */}
        <div className="relative p-3 rounded-xl border-2 min-h-[60px]" style={{ borderColor: greenColor, backgroundColor: `${greenColor}15` }}>
          <span className="absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: greenColor }}>
            {greenTeamPlayers.length}
            {inactiveGreenPlayers.length > 0 && <span className="opacity-60"> (+{inactiveGreenPlayers.length})</span>}
          </span>
          <div className="flex flex-wrap gap-2 justify-center">
            {greenTeamPlayers.length === 0 && inactiveGreenPlayers.length === 0 ? (
              <p className="text-muted-foreground text-sm py-2">{t(lang, 'noPlayers')}</p>
            ) : (
              <>
                {greenTeamPlayers.map(player => <PlayerBalloon key={player.id} player={player} teamColor={greenColor} />)}
                {inactiveGreenPlayers.map(player => <PlayerBalloon key={player.id} player={player} teamColor={greenColor} isInactive />)}
              </>
            )}
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground mt-2">{t(lang, 'longPressHint')}</p>

      <AlertDialog open={kickDialogOpen} onOpenChange={setKickDialogOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t(lang, 'confirmKickTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(lang, 'confirmKickMessage')} <strong>{playerToKick?.name}</strong> {t(lang, 'confirmKickSuffix')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 sm:flex-row">
            <AlertDialogCancel className="flex-1 mt-0">{t(lang, 'cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmKickPlayer} className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t(lang, 'kick')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TeamPlayersPanel;
