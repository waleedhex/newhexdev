/**
 * نظام ترجمة بسيط - عربي / إنجليزي
 * لا يشمل صفحة المدير (تبقى عربية دائماً)
 */

const translations = {
  ar: {
    // صفحة رمز الدخول
    gameTitle: 'لعبة الحروف',
    subscriptionCode: 'رمز الاشتراك',
    enterCodePlaceholder: 'أدخل الرمز هنا...',
    verifyCode: 'تحقق من الرمز',
    verifying: 'جاري التحقق...',
    enterCodeError: 'الرجاء إدخال الرمز',
    codeInvalid: 'الرمز غير صحيح',
    verificationError: 'حدث خطأ أثناء التحقق من الرمز',
    visitStore: 'حياكم في متجرنا',

    // صفحة اختيار الدور
    enterNameAndRole: 'أدخل اسمك واختر دورك',
    name: 'الاسم',
    enterNamePlaceholder: 'أدخل اسمك هنا...',
    host: 'مقدم',
    contestant: 'متسابق',
    checkingHost: 'جاري التحقق...',
    enterNameFirst: 'الرجاء إدخال اسمك أولاً',
    nameTooLong: 'الاسم يجب أن لا يتعدى كلمتين',

    // صفحة الدعوة
    welcomeTitle: 'مرحباً بك!',
    inviteSubtitle: 'تم دعوتك للانضمام إلى لعبة الحروف',
    inviteExpiredTitle: 'رابط الدعوة غير صالح',
    inviteExpiredMessage: 'انتهت صلاحية هذا الرابط. الرجاء طلب رابط جديد من المقدم.',
    inviteExpiredNote: 'روابط الدعوة صالحة لمدة ساعة واحدة فقط من وقت إنشائها.',
    backToHome: 'العودة للصفحة الرئيسية',

    // صفحة المقدم - أزرار التحكم
    shuffleLetters: 'خلط الحروف',
    swapBorders: 'عكس الحدود',
    changeColors: 'تغيير الألوان',
    party: 'بارتي',
    shareDisplay: 'مشاركة مع شاشات العرض',
    invitePlayers: 'دعوة مشاركين للعب',
    installApp: 'تثبيت التطبيق',
    golden: 'ذهبي',
    copyLink: 'نسخ الرابط',
    copied: 'تم النسخ',
    share: 'مشاركة',
    scanOrShare: 'امسح الكود أو شارك الرابط لفتح شاشة العرض على أجهزة أخرى',
    shareInviteNote: 'شارك رابط الدعوة مع اللاعبين للانضمام مباشرة بدون رمز',
    displayShareTitle: 'شاشة العرض - هيكسا',
    displayShareText: 'انضم لشاشة العرض',
    inviteShareTitle: 'دعوة للعب - هيكسا',
    inviteShareText: 'انضم إلى لعبة الحروف',
    installAppTitle: '📲 تثبيت التطبيق على جهازك',
    iphoneTitle: '🍎 على iPhone / iPad:',
    iphoneStep1: 'افتح الموقع في متصفح Safari',
    iphoneStep2: 'اضغط على زر المشاركة (المربع مع السهم للأعلى ⬆️)',
    iphoneStep3: 'مرر للأسفل واختر "إضافة إلى الشاشة الرئيسية"',
    iphoneStep4: 'اضغط "إضافة" في الأعلى',
    androidTitle: '🤖 على Android:',
    androidStep1: 'افتح الموقع في متصفح Chrome',
    androidStep2: 'اضغط على ⋮ (القائمة) في الأعلى',
    androidStep3: 'اختر "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية"',
    androidStep4: 'اضغط "تثبيت"',
    desktopTitle: '💻 على الكمبيوتر (Chrome):',
    desktopStep1: 'اضغط على أيقونة التثبيت في شريط العنوان',
    desktopStep2: 'أو اضغط ⋮ ثم "تثبيت التطبيق"',
    installNote: 'بعد التثبيت، سيظهر التطبيق على شاشتك الرئيسية ويعمل مثل أي تطبيق عادي 🎉',

    // لوحة الأسئلة
    questionFor: 'سؤال حرف',
    clickLetterPrompt: 'اضغط على حرف لعرض السؤال',
    next: 'التالي',
    general: 'عامة',
    loadingQuestion: 'جاري تحميل السؤال...',
    noQuestionForLetter: 'لا يوجد سؤال لهذا الحرف',
    waitingForLetter: 'في انتظار اختيار حرف...',
    answer: 'الجواب',

    // لوحة إضافة سؤال
    addCustomQuestion: 'إضافة سؤال خاص',
    letter: 'الحرف',
    chooseLetter: 'اختر الحرف...',
    question: 'السؤال',
    enterQuestionPlaceholder: 'أدخل السؤال هنا...',
    answerLabel: 'الجواب',
    enterAnswerPlaceholder: 'أدخل الجواب هنا...',
    adding: 'جاري الإضافة...',
    addQuestion: 'إضافة السؤال',
    fillAllFields: 'يرجى ملء جميع الحقول',
    questionAdded: 'تم إضافة السؤال بنجاح!',
    unexpectedError: 'حدث خطأ غير متوقع',
    errorAddingQuestion: 'حدث خطأ أثناء إضافة السؤال',

    // لوحة الفرق
    noPlayers: 'لا يوجد لاعبين',
    longPressHint: '💡 اضغط مطولاً على اسم اللاعب لنقله للفريق الآخر',
    confirmKickTitle: 'تأكيد طرد اللاعب',
    confirmKickMessage: 'هل أنت متأكد من طرد',
    confirmKickSuffix: 'من الجلسة؟',
    cancel: 'إلغاء',
    kick: 'طرد',
    kickPlayer: 'طرد اللاعب',
    kickSuccess: 'تم طرد {name} من الجلسة',
    moveSuccess: 'تم نقل اللاعب إلى الفريق',
    moveError: 'فشل نقل اللاعب',
    kickError: 'فشل طرد اللاعب',
    redTeam: 'الأحمر',
    greenTeam: 'الأخضر',

    // صفحة المتسابق
    loading: 'جاري التحميل...',
    youAreInTeam: 'أنت في الفريق',
    press: 'اضغط!',
    wait: 'انتظر...',
    buzzerPlayerFrom: 'من',
    redTeamFull: 'الفريق الأحمر',
    greenTeamFull: 'الفريق الأخضر',
    buzzerNotification: '{player} من الفريق {team} ضغط الجرس',
    timeUp: 'انتهى الوقت',

    // حالة الاتصال
    reconnecting: 'جاري إعادة الاتصال...',
    disconnected: 'انقطع الاتصال',
    retry: 'إعادة المحاولة',
    noInternet: 'لا يوجد اتصال بالإنترنت',

    // عام
    sessionCreationFailed: 'فشل إنشاء الجلسة',
    activeHostExists: 'يوجد مقدم نشط بالفعل',
    registrationFailed: 'فشل التسجيل كمقدم',
    goldenLetterText: '✨ حرف ذهبي ✨',
    congratsText: 'مبروك',
  },

  en: {
    // Code Verification
    gameTitle: 'Letters Game',
    subscriptionCode: 'Subscription Code',
    enterCodePlaceholder: 'Enter code here...',
    verifyCode: 'Verify Code',
    verifying: 'Verifying...',
    enterCodeError: 'Please enter the code',
    codeInvalid: 'Invalid code',
    verificationError: 'Error verifying code',
    visitStore: 'Visit our store',

    // Role Selection
    enterNameAndRole: 'Enter your name and choose your role',
    name: 'Name',
    enterNamePlaceholder: 'Enter your name here...',
    host: 'Host',
    contestant: 'Contestant',
    checkingHost: 'Checking...',
    enterNameFirst: 'Please enter your name first',
    nameTooLong: 'Name must be 2 words or less',

    // Invite Page
    welcomeTitle: 'Welcome!',
    inviteSubtitle: 'You have been invited to join Letters Game',
    inviteExpiredTitle: 'Invalid Invite Link',
    inviteExpiredMessage: 'This link has expired. Please request a new one from the host.',
    inviteExpiredNote: 'Invite links are valid for one hour only.',
    backToHome: 'Back to Home',

    // Host Page - Control Buttons
    shuffleLetters: 'Shuffle Letters',
    swapBorders: 'Swap Borders',
    changeColors: 'Change Colors',
    party: 'Party',
    shareDisplay: 'Share with Displays',
    invitePlayers: 'Invite Players',
    installApp: 'Install App',
    golden: 'Golden',
    copyLink: 'Copy Link',
    copied: 'Copied',
    share: 'Share',
    scanOrShare: 'Scan the code or share the link to open the display on other devices',
    shareInviteNote: 'Share invite link with players to join directly without a code',
    displayShareTitle: 'Display - Hexa',
    displayShareText: 'Join the display',
    inviteShareTitle: 'Game Invite - Hexa',
    inviteShareText: 'Join Letters Game',
    installAppTitle: '📲 Install App on Your Device',
    iphoneTitle: '🍎 On iPhone / iPad:',
    iphoneStep1: 'Open the site in Safari',
    iphoneStep2: 'Tap the Share button (square with arrow ⬆️)',
    iphoneStep3: 'Scroll down and tap "Add to Home Screen"',
    iphoneStep4: 'Tap "Add" at the top',
    androidTitle: '🤖 On Android:',
    androidStep1: 'Open the site in Chrome',
    androidStep2: 'Tap ⋮ (menu) at the top',
    androidStep3: 'Choose "Install App" or "Add to Home Screen"',
    androidStep4: 'Tap "Install"',
    desktopTitle: '💻 On Desktop (Chrome):',
    desktopStep1: 'Click the install icon in the address bar',
    desktopStep2: 'Or click ⋮ then "Install App"',
    installNote: 'After installing, the app will appear on your home screen and work like any native app 🎉',

    // Question Panel
    questionFor: 'Question for letter',
    clickLetterPrompt: 'Click a letter to show the question',
    next: 'Next',
    general: 'General',
    loadingQuestion: 'Loading question...',
    noQuestionForLetter: 'No question for this letter',
    waitingForLetter: 'Waiting for letter selection...',
    answer: 'Answer',

    // Add Question Panel
    addCustomQuestion: 'Add Custom Question',
    letter: 'Letter',
    chooseLetter: 'Choose letter...',
    question: 'Question',
    enterQuestionPlaceholder: 'Enter question here...',
    answerLabel: 'Answer',
    enterAnswerPlaceholder: 'Enter answer here...',
    adding: 'Adding...',
    addQuestion: 'Add Question',
    fillAllFields: 'Please fill all fields',
    questionAdded: 'Question added successfully!',
    unexpectedError: 'An unexpected error occurred',
    errorAddingQuestion: 'Error adding question',

    // Team Players Panel
    noPlayers: 'No players',
    longPressHint: '💡 Long press a player name to move them to the other team',
    confirmKickTitle: 'Confirm Kick Player',
    confirmKickMessage: 'Are you sure you want to kick',
    confirmKickSuffix: 'from the session?',
    cancel: 'Cancel',
    kick: 'Kick',
    kickPlayer: 'Kick player',
    kickSuccess: '{name} was kicked from session',
    moveSuccess: 'Player moved to',
    moveError: 'Failed to move player',
    kickError: 'Failed to kick player',
    redTeam: 'Red',
    greenTeam: 'Green',

    // Contestant Page
    loading: 'Loading...',
    youAreInTeam: 'You are in the',
    press: 'Press!',
    wait: 'Wait...',
    buzzerPlayerFrom: 'from',
    redTeamFull: 'Red Team',
    greenTeamFull: 'Green Team',
    buzzerNotification: '{player} from {team} pressed the buzzer',
    timeUp: 'Time is up',

    // Connection Status
    reconnecting: 'Reconnecting...',
    disconnected: 'Disconnected',
    retry: 'Retry',
    noInternet: 'No internet connection',

    // General
    sessionCreationFailed: 'Failed to create session',
    activeHostExists: 'There is already an active host',
    registrationFailed: 'Failed to register as host',
    goldenLetterText: '✨ Golden Letter ✨',
    congratsText: 'Congrats',
  },
} as const;

export type Lang = 'ar' | 'en';
export type TranslationKey = keyof typeof translations.ar;

export const t = (lang: Lang, key: TranslationKey): string => {
  return translations[lang]?.[key] ?? translations.ar[key] ?? key;
};

export const getLangFromUrl = (): Lang => {
  const params = new URLSearchParams(window.location.search);
  return (params.get('lang') as Lang) || 'ar';
};

export const isRtl = (lang: Lang): boolean => lang === 'ar';
