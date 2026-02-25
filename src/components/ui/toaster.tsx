import { useToast } from "@/hooks/use-toast";
import { Toast, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider swipeDirection="down" duration={2000}>
      {/* عرض آخر toast فقط - بدون تراكم */}
      {toasts.slice(-1).map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props} className="text-center border-2 border-black pointer-events-none animate-in fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
            <div className="grid gap-1 w-full">
              {title && <ToastTitle className="text-center" style={{ textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' }}>{title}</ToastTitle>}
              {description && (
                <ToastDescription className="text-center text-white font-bold text-lg" style={{ textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' }}>
                  {description}
                </ToastDescription>
              )}
            </div>
            {action}
            {/* بدون زر إغلاق - يختفي تلقائياً */}
          </Toast>
        );
      })}
      {/* Toast في وسط الشاشة من الأسفل */}
      <ToastViewport className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 w-auto p-0 max-w-[90vw] pointer-events-none" />
    </ToastProvider>
  );
}
