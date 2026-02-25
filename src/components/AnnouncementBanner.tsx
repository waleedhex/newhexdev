import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { X, ExternalLink, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Announcement {
  id: number;
  title: string | null;
  content: string | null;
  link: string | null;
  button_text: string | null;
  is_active: boolean | null;
}

const AnnouncementBanner: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState<number[]>([]);

  const visibleAnnouncements = announcements.filter(a => !dismissed.includes(a.id));
  const currentAnnouncement = visibleAnnouncements[currentIndex % visibleAnnouncements.length];

  useEffect(() => {
    const fetchAnnouncements = async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .order('id', { ascending: false });

      if (!error && data) {
        setAnnouncements(data);
      }
    };

    fetchAnnouncements();
  }, []);

  // Auto-rotate every 5 seconds
  useEffect(() => {
    if (visibleAnnouncements.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % visibleAnnouncements.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [visibleAnnouncements.length]);

  if (!currentAnnouncement) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(prev => [...prev, currentAnnouncement.id]);
    if (currentIndex >= visibleAnnouncements.length - 1) {
      setCurrentIndex(0);
    }
  };

  const handleNext = () => {
    setCurrentIndex(prev => (prev + 1) % visibleAnnouncements.length);
  };

  return (
    <div className="w-full bg-primary/10 border border-primary/20 rounded-lg p-4 mb-6 relative">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
          <Megaphone className="w-5 h-5 text-primary" />
        </div>
        
        <div className="flex-1 min-w-0">
          {currentAnnouncement.title && (
            <h3 className="font-bold text-foreground mb-1">{currentAnnouncement.title}</h3>
          )}
          {currentAnnouncement.content && (
            <p className="text-sm text-muted-foreground">{currentAnnouncement.content}</p>
          )}
          
          {currentAnnouncement.link && (
            <a
              href={currentAnnouncement.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-sm text-primary hover:underline"
            >
              {currentAnnouncement.button_text || 'اقرأ المزيد'}
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="flex-shrink-0 h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={handleDismiss}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {visibleAnnouncements.length > 1 && (
        <div className="flex items-center justify-center gap-2 mt-3">
          {visibleAnnouncements.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`w-2 h-2 rounded-full transition-colors ${
                idx === currentIndex % visibleAnnouncements.length
                  ? 'bg-primary'
                  : 'bg-primary/30'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AnnouncementBanner;
