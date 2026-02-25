/**
 * AnnouncementsTab - إدارة الإعلانات (عبر Edge Function)
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { Announcement } from './types';
import { adminApi } from '@/lib/adminApi';

interface AnnouncementsTabProps {
  announcements: Announcement[];
  onRefresh: () => void;
  adminCode: string;
}

const AnnouncementsTab: React.FC<AnnouncementsTabProps> = ({ announcements, onRefresh, adminCode }) => {
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '', link: '', button_text: '' });

  const handleAddAnnouncement = async () => {
    if (!newAnnouncement.title.trim() && !newAnnouncement.content.trim()) {
      toast.error('يرجى إدخال العنوان أو المحتوى');
      return;
    }

    const result = await adminApi(adminCode, 'announcements.insert', {
      title: newAnnouncement.title.trim(),
      content: newAnnouncement.content.trim(),
      link: newAnnouncement.link.trim(),
      button_text: newAnnouncement.button_text.trim(),
    });

    if (result.error) { toast.error('حدث خطأ أثناء إضافة الإعلان'); return; }

    toast.success('تم إضافة الإعلان');
    setNewAnnouncement({ title: '', content: '', link: '', button_text: '' });
    onRefresh();
  };

  const handleToggleAnnouncement = async (id: number, isActive: boolean) => {
    const result = await adminApi(adminCode, 'announcements.update', { id, is_active: !isActive });
    if (result.error) { toast.error('حدث خطأ'); return; }
    onRefresh();
  };

  const handleDeleteAnnouncement = async (id: number) => {
    const result = await adminApi(adminCode, 'announcements.delete', { id });
    if (result.error) { toast.error('حدث خطأ'); return; }
    toast.success('تم حذف الإعلان');
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>إضافة إعلان جديد</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input placeholder="العنوان" value={newAnnouncement.title} onChange={(e) => setNewAnnouncement(prev => ({ ...prev, title: e.target.value }))} />
            <Input placeholder="نص الزر (اختياري)" value={newAnnouncement.button_text} onChange={(e) => setNewAnnouncement(prev => ({ ...prev, button_text: e.target.value }))} />
          </div>
          <Textarea placeholder="المحتوى" value={newAnnouncement.content} onChange={(e) => setNewAnnouncement(prev => ({ ...prev, content: e.target.value }))} rows={3} />
          <Input placeholder="الرابط (اختياري)" value={newAnnouncement.link} onChange={(e) => setNewAnnouncement(prev => ({ ...prev, link: e.target.value }))} dir="ltr" />
          <Button onClick={handleAddAnnouncement}><Plus className="w-4 h-4 ml-2" /> إضافة الإعلان</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>الإعلانات</CardTitle></CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              {announcements.map((ann) => (
                <div key={ann.id} className={`p-4 rounded-lg border ${ann.is_active ? 'bg-muted' : 'bg-muted/50 opacity-60'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      {ann.title && <h3 className="font-bold text-lg">{ann.title}</h3>}
                      {ann.content && <p className="text-muted-foreground">{ann.content}</p>}
                      {ann.link && <a href={ann.link} target="_blank" className="text-primary text-sm underline" dir="ltr">{ann.link}</a>}
                      {ann.button_text && <span className="inline-block mt-2 px-3 py-1 bg-primary/10 rounded text-sm">{ann.button_text}</span>}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleToggleAnnouncement(ann.id, !!ann.is_active)}>
                        {ann.is_active ? 'إلغاء التفعيل' : 'تفعيل'}
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteAnnouncement(ann.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {announcements.length === 0 && <p className="text-center text-muted-foreground py-8">لا توجد إعلانات</p>}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnnouncementsTab;
