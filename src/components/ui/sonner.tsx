import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:text-xs sm:group-[.toaster]:text-sm group-[.toaster]:p-3 sm:group-[.toaster]:p-4 group-[.toaster]:max-w-[90vw] sm:group-[.toaster]:max-w-md",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-[10px] sm:group-[.toast]:text-xs",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:text-xs sm:group-[.toast]:text-sm",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:text-xs sm:group-[.toast]:text-sm",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
