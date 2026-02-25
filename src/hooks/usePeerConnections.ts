/**
 * hooks/usePeerConnections.ts
 * Hook لإدارة اتصالات RTC من جانب Host
 * 
 * يستمع لإعلانات انضمام اللاعبين ويُنشئ اتصالات RTC معهم
 */

import { useEffect, useRef, useCallback } from 'react';
import { 
  PeerAnnouncementManager, 
  createHostAnnouncementListener 
} from '@/transport/peerAnnouncement';

interface UsePeerConnectionsProps {
  sessionCode: string;
  enabled?: boolean;
  /** دالة لإنشاء اتصال RTC مع peer */
  onConnectToPeer?: (peerId: string) => Promise<void>;
}

export const usePeerConnections = ({
  sessionCode,
  enabled = true,
  onConnectToPeer,
}: UsePeerConnectionsProps) => {
  const managerRef = useRef<PeerAnnouncementManager | null>(null);
  const connectedPeersRef = useRef<Set<string>>(new Set());
  
  // معالجة انضمام peer جديد
  const handlePeerJoined = useCallback(async (peerId: string, playerName?: string) => {
    console.log('🤝 [usePeerConnections] New peer joined:', peerId, playerName);
    
    // تجنب الاتصال المكرر
    if (connectedPeersRef.current.has(peerId)) {
      console.log('⏭️ [usePeerConnections] Already connected to:', peerId);
      return;
    }
    
    connectedPeersRef.current.add(peerId);
    
    // إنشاء اتصال RTC
    try {
      await onConnectToPeer?.(peerId);
      console.log('✅ [usePeerConnections] Connected to:', peerId);
    } catch (err) {
      console.warn('⚠️ [usePeerConnections] Failed to connect to:', peerId, err);
      connectedPeersRef.current.delete(peerId);
    }
  }, [onConnectToPeer]);
  
  // معالجة مغادرة peer
  const handlePeerLeft = useCallback((peerId: string) => {
    console.log('👋 [usePeerConnections] Peer left:', peerId);
    connectedPeersRef.current.delete(peerId);
  }, []);
  
  // إعداد المستمع
  useEffect(() => {
    if (!sessionCode || !enabled) return;
    
    let mounted = true;
    
    const setup = async () => {
      try {
        const manager = await createHostAnnouncementListener(sessionCode, {
          onPeerJoined: handlePeerJoined,
          onPeerLeft: handlePeerLeft,
        });
        
        if (!mounted) {
          manager.disconnect();
          return;
        }
        
        managerRef.current = manager;
        console.log('✅ [usePeerConnections] Listening for peers');
      } catch (err) {
        console.error('❌ [usePeerConnections] Setup failed:', err);
      }
    };
    
    setup();
    
    return () => {
      mounted = false;
      managerRef.current?.disconnect();
      managerRef.current = null;
      connectedPeersRef.current.clear();
    };
  }, [sessionCode, enabled, handlePeerJoined, handlePeerLeft]);
  
  return {
    connectedPeers: connectedPeersRef.current.size,
  };
};

export default usePeerConnections;
