# WebRTC Transport - القواعد الثابتة (Invariants)

> هذا الملف يوثق القواعد التي لا يجب انتهاكها أبداً أثناء تطوير أو صيانة نظام النقل.

---

## 🔒 القواعد الأساسية

### 1. DB هو المرجع النهائي (Single Source of Truth)
```
✅ أي تعارض بين RTC و DB → نثق بـ DB
✅ حالة اللوحة (hexagons, colors, party_mode) تُقرأ من DB فقط
✅ حالة الجلسة (is_active, players) تُدار من DB فقط
❌ لا نخزن حالة في RTC أبداً
```

### 2. مقدم واحد فقط (Single Host)
```
✅ Host-to-All topology
✅ المقدم هو hub الاتصالات
✅ فقدان المقدم = fallback للجميع
❌ لا Mesh بين المتسابقين
```

### 3. WebRTC غير مضمون
```
✅ RTC قد يفشل في أي لحظة
✅ بعض المتصفحات لا تدعم
✅ بعض الشبكات تحظر P2P
❌ لا نفترض نجاح RTC أبداً
```

### 4. Fallback تلقائي صامت
```
✅ أي فشل RTC → رجوع لـ Broadcast فوراً
✅ المستخدم لا يرى أي تغيير
✅ الأحداث تستمر بدون انقطاع
❌ لا نطلب من المستخدم التدخل
```

### 5. UI و Admin معزولون
```
✅ لا يعرفون نوع الاتصال
✅ لا مؤشرات RTC في الواجهة
✅ لا إحصائيات RTC في Admin
❌ لا تغيير على الشاشات الحالية
```

---

## 📡 تقسيم الأحداث

### أحداث عابرة (Transient) - تمر عبر RTC أو Broadcast
| الحدث | المُرسل | الوصف |
|-------|--------|-------|
| `buzzer_pressed` | متسابق | ضغط الجرس |
| `buzzer_timeout` | متسابق | انتهاء وقت الجرس |
| `buzzer_reset` | مقدم | إعادة تعيين الجرس |
| `party_mode` | مقدم | تفعيل/إيقاف الاحتفال |
| `golden_celebration` | مقدم | احتفال الحرف الذهبي |
| `flash` | مقدم | وميض الشاشة |

### حالة دائمة (Persistent) - تبقى عبر DB فقط
| الحالة | الجدول |
|--------|--------|
| hexagons, letters_order | game_sessions |
| party_mode, winning_path | game_sessions |
| color_set_index, is_swapped | game_sessions |
| players, teams | session_players |
| last_seen, is_connected | session_players |

---

## 🚫 ممنوعات صريحة

### قاعدة البيانات
- ❌ لا أعمدة RTC جديدة
- ❌ لا جداول للـ signaling
- ❌ لا تغيير على Schema
- ❌ لا تغيير على Cleanup Edge Function

### الأمان
- ❌ لا Secrets عبر RTC (tokens, admin flags)
- ❌ لا صلاحيات عبر RTC
- ❌ لا بيانات مستخدمين حساسة

### الواجهة
- ❌ لا مؤشر "متصل عبر RTC"
- ❌ لا خيارات RTC للمستخدم
- ❌ لا تغيير على Admin Panel

---

## 🔄 سلوك Fallback

```
1. RTC يفشل من البداية:
   → يعمل على Broadcast فقط (كالمعتاد)

2. RTC ينجح ثم يفشل:
   → fallback صامت لـ Broadcast
   → لا فقدان أحداث (dual-send)

3. بعض اللاعبين على RTC وبعضهم لا:
   → Host يرسل عبر RTC + Broadcast معاً
   → الكل يستقبل (dedupe بـ event_id)

4. Host يفقد الاتصال:
   → كل RTC connections تنقطع
   → الكل يرجع لـ Broadcast
   → عند عودة RTC: إعادة اتصال تلقائية بجميع الـ peers المعروفين
```

---

## 🛡️ آليات الحماية

### 1. ICE Rate Limiting (منع الـ Spam)
```typescript
// في SignalingManager
MAX_ICE_CANDIDATES_PER_PEER = 10;  // حد أقصى 10 candidates لكل peer
ICE_GATHERING_TIMEOUT = 5000;      // إيقاف تلقائي بعد 5 ثواني
// عند نجاح الاتصال: stopIceForPeer() يوقف ICE فوراً
```

### 2. Transient Guard (منع إرسال DB-state)
```typescript
// في HybridTransport.send()
assertTransient(event); // يرمي TransientViolationError إذا كان الحدث يحتوي حقول محظورة

// الحقول المحظورة:
FORBIDDEN_FIELDS = ['hexagons', 'teams', 'session_id', 'players', ...]

// الحقول المسموحة لكل نوع حدث:
ALLOWED_FIELDS = {
  buzzer_pressed: ['type', 'event_id', 'timestamp', 'player', 'team'],
  party_mode: ['type', 'event_id', 'timestamp', 'active', 'winningTeam', 'winningPath'],
  // ...
}
```

### 3. Deduplication (منع التكرار)
```typescript
// في كل Transport:
processedEvents: Set<string>  // يحتفظ بـ event_id لآخر 30 ثانية

// عند الاستلام:
if (processedEvents.has(event.event_id)) return; // تجاهل المكرر
processedEvents.add(event.event_id);

// ✅ مضمون في: HybridTransport, BroadcastTransport, WebRTCTransport
```

### 4. RTC Auto-Reconnect (إعادة الاتصال التلقائية)
```typescript
// عند عودة RTC بعد فقدانه:
knownPeers: Set<string>  // قائمة الـ peers المعروفين

// عند نجاح attemptRTCConnection():
await reconnectToKnownPeers(); // إعادة الاتصال بالجميع تلقائياً
```

---

## 📋 قائمة التحقق قبل أي PR

- [ ] هل DB يبقى المرجع النهائي؟
- [ ] هل Fallback يعمل تلقائياً؟
- [ ] هل UI لا يتغير؟
- [ ] هل Admin لا يتأثر؟
- [ ] هل Cleanup يعمل كالمعتاد؟
- [ ] هل لا توجد بيانات حساسة عبر RTC؟
- [ ] هل assertTransient() يُستدعى قبل الإرسال؟
- [ ] هل Deduplication مفعّل في الـ consumer؟

---

## 📚 مراجع

- `src/hooks/useGameEvents.ts` - Hook الأحداث (Host)
- `src/hooks/useContestantChannel.ts` - قناة المتسابق الموحدة
- `src/hooks/useTransport.ts` - Hook النقل الموحد
- `src/transport/HybridTransport.ts` - النقل الهجين (Broadcast + RTC)
- `src/transport/validation.ts` - assertTransient و Guards
- `src/transport/signaling.ts` - ICE Rate Limiting
- `src/config/connectionConstants.ts` - ثوابت الاتصال
