import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        tajawal: ["Tajawal", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        hex: {
          cream: "hsl(var(--hex-cream))",
          orange: "hsl(var(--hex-orange))",
          red: "hsl(var(--hex-red))",
          green: "hsl(var(--hex-green))",
          gold: "hsl(var(--hex-gold))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "win-glow": {
          "0%": { 
            filter: "brightness(1) saturate(1)", 
            transform: "scale(1)",
            boxShadow: "0 0 0 0 gold"
          },
          "50%": { 
            filter: "brightness(1.5) saturate(1.8)", 
            transform: "scale(1.1)",
            boxShadow: "0 0 30px 10px gold"
          },
          "100%": { 
            filter: "brightness(1.2) saturate(1.3)", 
            transform: "scale(1.02)",
            boxShadow: "0 0 15px 5px gold"
          },
        },
        "win-sequence": {
          "0%, 100%": { 
            transform: "scale(1)",
            filter: "brightness(1.1) saturate(1.2)"
          },
          "50%": { 
            transform: "scale(1.15)",
            filter: "brightness(1.4) saturate(1.5)"
          },
        },
        pulse: {
          "0%": { transform: "translate(-50%, -50%) scale(1)" },
          "100%": { transform: "translate(-50%, -50%) scale(1.2)" },
        },
        flash: {
          "0%": { opacity: "1", transform: "scale(0)" },
          "100%": { opacity: "0", transform: "scale(2)" },
        },
        "confetti-fall": {
          "0%": { transform: "translateY(-100%) rotate(0deg)", opacity: "1" },
          "100%": { transform: "translateY(100vh) rotate(720deg)", opacity: "0" },
        },
        "sparkle": {
          "0%, 100%": { opacity: "0", transform: "scale(0)" },
          "50%": { opacity: "1", transform: "scale(1)" },
        },
        "party-text": {
          "0%, 100%": { 
            transform: "scale(1)",
            opacity: "0.9"
          },
          "50%": { 
            transform: "scale(1.08)",
            opacity: "1"
          },
        },
        "party-letter": {
          "0%, 100%": { 
            transform: "translateY(0) rotate(0deg)"
          },
          "25%": { 
            transform: "translateY(-8px) rotate(-3deg)"
          },
          "75%": { 
            transform: "translateY(-8px) rotate(3deg)"
          },
        },
        "golden-text": {
          "0%, 100%": { 
            transform: "scale(1)",
            opacity: "1",
            textShadow: "0 0 10px #ffd700, 0 0 20px #ffd700"
          },
          "50%": { 
            transform: "scale(1.1)",
            opacity: "0.9",
            textShadow: "0 0 20px #ffd700, 0 0 40px #ff4500"
          },
        },
        "golden-flash": {
          "0%": { opacity: "1", transform: "scale(0)", backgroundColor: "#ffd700" },
          "50%": { backgroundColor: "#ff4500" },
          "100%": { opacity: "0", transform: "scale(2.5)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "win-glow": "win-glow 0.8s ease-in-out infinite",
        "win-sequence": "win-sequence 0.6s ease-in-out infinite",
        pulse: "pulse 0.8s infinite alternate",
        flash: "flash 1s ease-out infinite",
        "confetti-fall": "confetti-fall 3s ease-out forwards",
        "sparkle": "sparkle 0.8s ease-in-out infinite",
        "party-text": "party-text 1.2s ease-in-out infinite",
        "party-letter": "party-letter 0.8s ease-in-out infinite",
        "golden-text": "golden-text 1s ease-in-out infinite",
        "golden-flash": "golden-flash 0.8s ease-out forwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
