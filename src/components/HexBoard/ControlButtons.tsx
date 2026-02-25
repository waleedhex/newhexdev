import React, { forwardRef, useState } from 'react';
import { Shuffle, ArrowLeftRight, Palette, PartyPopper, Monitor, Copy, Check, Share2, UserPlus, Bell, Sparkles, Download } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { QRCodeSVG } from 'qrcode.react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { t, getLangFromUrl, isRtl } from '@/lib/i18n';

interface BuzzerData {
  active: boolean;
  player: string;
  team: 'red' | 'green' | null;
  isTimeOut?: boolean;
}

interface ControlButtonsProps {
  onShuffle: () => void;
  onSwapColors: () => void;
  onChangeColors: () => void;
  onParty: () => void;
  sessionCode?: string;
  buzzer?: BuzzerData;
  redColor?: string;
  greenColor?: string;
  goldenLetterEnabled?: boolean;
  onToggleGoldenLetter?: () => void;
}

const ControlButtons = forwardRef<HTMLDivElement, ControlButtonsProps>(({
  onShuffle,
  onSwapColors,
  onChangeColors,
  onParty,
  sessionCode,
  buzzer,
  redColor = '#ef4444',
  greenColor = '#22c55e',
  goldenLetterEnabled = true,
  onToggleGoldenLetter,
}, ref) => {
  const lang = getLangFromUrl();
  const [copied, setCopied] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [openDisplay, setOpenDisplay] = useState(false);
  const [openInvite, setOpenInvite] = useState(false);
  const [openPwa, setOpenPwa] = useState(false);
  
  const isPwaInstalled = window.matchMedia('(display-mode: standalone)').matches 
    || (window.navigator as any).standalone === true;

  const displayUrl = sessionCode ? `${window.location.origin}/display?code=${sessionCode}` : '';
  const inviteUrl = sessionCode ? `${window.location.origin}/invite?code=${sessionCode}&t=${Date.now()}` : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: t(lang, 'displayShareTitle'),
          text: t(lang, 'displayShareText'),
          url: displayUrl,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Share failed:', err);
        }
      }
    } else {
      handleCopy();
    }
  };

  const handleShareInvite = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: t(lang, 'inviteShareTitle'),
          text: t(lang, 'inviteShareText'),
          url: inviteUrl,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Share failed:', err);
        }
      }
    } else {
      handleCopyInvite();
    }
  };

  const buttonClass = `
    w-[5vw] h-[5vw]
    min-w-[30px] min-h-[30px]
    max-w-[60px] max-h-[60px]
    rounded-full
    bg-[#007bff]
    text-white
    border-none
    flex justify-center items-center
    text-[2vw]
    cursor-pointer
    transition-all duration-300
    hover:scale-110 hover:bg-[#0056b3]
    shadow-lg
  `;

  return (
    <div ref={ref} className="flex flex-col items-center gap-2 my-[1vw]">
      <div className="flex gap-[1vw] items-center flex-wrap justify-center">
        <button className={buttonClass} onClick={onShuffle} title={t(lang, 'shuffleLetters')}>
          <Shuffle className="w-1/2 h-1/2" />
        </button>
        <button className={buttonClass} onClick={onSwapColors} title={t(lang, 'swapBorders')}>
          <ArrowLeftRight className="w-1/2 h-1/2" />
        </button>
        <button className={buttonClass} onClick={onChangeColors} title={t(lang, 'changeColors')}>
          <Palette className="w-1/2 h-1/2" />
        </button>
        <button className={`${buttonClass} text-[2.5vw]`} onClick={onParty} title={t(lang, 'party')}>
          <PartyPopper className="w-1/2 h-1/2" />
        </button>
        
        {sessionCode && (
          <>
            {/* Display share dialog */}
            <Dialog open={openDisplay} onOpenChange={setOpenDisplay}>
              <DialogTrigger asChild>
                <button className={`${buttonClass} !bg-purple-600 hover:!bg-purple-700`} title={t(lang, 'shareDisplay')}>
                  <Monitor className="w-1/2 h-1/2" />
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md" dir={isRtl(lang) ? 'rtl' : 'ltr'}>
                <DialogHeader>
                  <DialogTitle className="text-center text-xl">
                    {t(lang, 'shareDisplay')}
                  </DialogTitle>
                </DialogHeader>
                
                <div className="flex flex-col items-center gap-6 py-4">
                  <div className="p-4 bg-white rounded-xl shadow-inner">
                    <QRCodeSVG value={displayUrl} size={200} level="H" includeMargin={true} />
                  </div>

                  <div className="w-full p-3 bg-muted rounded-lg text-center">
                    <p className="text-sm text-muted-foreground break-all font-mono" dir="ltr">{displayUrl}</p>
                  </div>

                  <div className="flex gap-3 w-full">
                    <Button onClick={handleCopy} variant="outline" className="flex-1 gap-2">
                      {copied ? (<><Check className="w-4 h-4" />{t(lang, 'copied')}</>) : (<><Copy className="w-4 h-4" />{t(lang, 'copyLink')}</>)}
                    </Button>
                    <Button onClick={handleShare} className="flex-1 gap-2">
                      <Share2 className="w-4 h-4" />{t(lang, 'share')}
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground text-center">{t(lang, 'scanOrShare')}</p>
                </div>
              </DialogContent>
            </Dialog>

            {/* Invite dialog */}
            <Dialog open={openInvite} onOpenChange={setOpenInvite}>
              <DialogTrigger asChild>
                <button className={`${buttonClass} bg-green-600 hover:bg-green-700`} title={t(lang, 'invitePlayers')}>
                  <UserPlus className="w-1/2 h-1/2" />
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md" dir={isRtl(lang) ? 'rtl' : 'ltr'}>
                <DialogHeader>
                  <DialogTitle className="text-center text-xl">
                    {t(lang, 'invitePlayers')}
                  </DialogTitle>
                </DialogHeader>
                
                <div className="flex flex-col items-center gap-6 py-4">
                  <div className="p-4 bg-white rounded-xl shadow-inner">
                    <QRCodeSVG value={inviteUrl} size={200} level="H" includeMargin={true} fgColor="#16a34a" />
                  </div>

                  <div className="w-full p-3 bg-muted rounded-lg text-center">
                    <p className="text-sm text-muted-foreground break-all font-mono" dir="ltr">{inviteUrl}</p>
                  </div>

                  <div className="flex gap-3 w-full">
                    <Button onClick={handleCopyInvite} variant="outline" className="flex-1 gap-2">
                      {copiedInvite ? (<><Check className="w-4 h-4" />{t(lang, 'copied')}</>) : (<><Copy className="w-4 h-4" />{t(lang, 'copyLink')}</>)}
                    </Button>
                    <Button onClick={handleShareInvite} className="flex-1 gap-2 bg-green-600 hover:bg-green-700">
                      <Share2 className="w-4 h-4" />{t(lang, 'share')}
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground text-center">{t(lang, 'shareInviteNote')}</p>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}

        {/* PWA install */}
        {!isPwaInstalled && (
          <Dialog open={openPwa} onOpenChange={setOpenPwa}>
            <DialogTrigger asChild>
              <button className={`${buttonClass} !bg-amber-500 hover:!bg-amber-600`} title={t(lang, 'installApp')}>
                <Download className="w-1/2 h-1/2" />
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md" dir={isRtl(lang) ? 'rtl' : 'ltr'}>
              <DialogHeader>
                <DialogTitle className="text-center text-xl">
                  {t(lang, 'installAppTitle')}
                </DialogTitle>
              </DialogHeader>
              
              <div className="flex flex-col gap-5 py-4 text-sm">
                <div className="p-4 rounded-lg bg-muted">
                  <h3 className="font-bold text-base mb-3">{t(lang, 'iphoneTitle')}</h3>
                  <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                    <li>{t(lang, 'iphoneStep1')}</li>
                    <li>{t(lang, 'iphoneStep2')}</li>
                    <li>{t(lang, 'iphoneStep3')}</li>
                    <li>{t(lang, 'iphoneStep4')}</li>
                  </ol>
                </div>

                <div className="p-4 rounded-lg bg-muted">
                  <h3 className="font-bold text-base mb-3">{t(lang, 'androidTitle')}</h3>
                  <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                    <li>{t(lang, 'androidStep1')}</li>
                    <li>{t(lang, 'androidStep2')}</li>
                    <li>{t(lang, 'androidStep3')}</li>
                    <li>{t(lang, 'androidStep4')}</li>
                  </ol>
                </div>

                <div className="p-4 rounded-lg bg-muted">
                  <h3 className="font-bold text-base mb-3">{t(lang, 'desktopTitle')}</h3>
                  <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                    <li>{t(lang, 'desktopStep1')}</li>
                    <li>{t(lang, 'desktopStep2')}</li>
                  </ol>
                </div>

                <p className="text-xs text-muted-foreground text-center">{t(lang, 'installNote')}</p>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Golden letter toggle */}
        {onToggleGoldenLetter && (
          <div dir="ltr" className="flex items-center gap-1 sm:gap-2 bg-amber-500/20 px-1.5 sm:px-3 py-1 sm:py-2 rounded-full border border-amber-500/30 mr-1 sm:mr-2">
            <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-amber-500" />
            <span className="text-amber-600 dark:text-amber-400 text-[10px] sm:text-sm font-medium whitespace-nowrap">{t(lang, 'golden')}</span>
            <Switch
              checked={goldenLetterEnabled}
              onCheckedChange={onToggleGoldenLetter}
              className="data-[state=checked]:bg-amber-500 data-[state=unchecked]:bg-muted scale-75 sm:scale-100"
            />
          </div>
        )}
      </div>

      {/* Buzzer status */}
      {buzzer?.active && (
        <div 
          className="flex items-center gap-2 px-4 py-2 rounded-full text-white font-bold animate-pulse"
          style={{ backgroundColor: buzzer.team === 'red' ? redColor : greenColor }}
        >
          <Bell className="w-5 h-5" />
          <span>
            {buzzer.player} {t(lang, 'buzzerPlayerFrom')} {buzzer.team === 'red' ? t(lang, 'redTeamFull') : t(lang, 'greenTeamFull')}
          </span>
        </div>
      )}
    </div>
  );
});

ControlButtons.displayName = 'ControlButtons';

export default ControlButtons;
