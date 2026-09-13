// Space-separated RGB channels in :root need slash alpha, not rgba(r g b, a).
function withOpacity(variableName) {
  return ({ opacityValue }) => {
    if (opacityValue !== undefined) {
      return `rgb(var(${variableName}) / ${opacityValue})`;
    }
    return `rgb(var(${variableName}) / 1)`;
  };
}

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{svelte,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "surface-container-low": withOpacity("--color-surface-container-low"),
        "on-secondary-container": withOpacity("--color-on-secondary-container"),
        "on-background": withOpacity("--color-on-background"),
        "background": withOpacity("--color-background"),
        "tertiary": withOpacity("--color-tertiary"),
        "primary-fixed-dim": withOpacity("--color-primary-fixed-dim"),
        "surface-container-highest": withOpacity("--color-surface-container-highest"),
        "on-secondary": withOpacity("--color-on-secondary"),
        "on-tertiary-fixed-variant": withOpacity("--color-on-tertiary-fixed-variant"),
        "outline-variant": withOpacity("--color-outline-variant"),
        "on-primary": withOpacity("--color-on-primary"),
        "inverse-primary": withOpacity("--color-inverse-primary"),
        "secondary": withOpacity("--color-secondary"),
        "surface-bright": withOpacity("--color-surface-bright"),
        "tertiary-fixed-dim": withOpacity("--color-tertiary-fixed-dim"),
        "on-tertiary": withOpacity("--color-on-tertiary"),
        "inverse-surface": withOpacity("--color-inverse-surface"),
        "surface-container": withOpacity("--color-surface-container"),
        "secondary-fixed": withOpacity("--color-secondary-fixed"),
        "secondary-container": withOpacity("--color-secondary-container"),
        "outline": withOpacity("--color-outline"),
        "error": withOpacity("--color-error"),
        "on-primary-fixed-variant": withOpacity("--color-on-primary-fixed-variant"),
        "on-error": withOpacity("--color-on-error"),
        "error-container": withOpacity("--color-error-container"),
        "surface-variant": withOpacity("--color-surface-variant"),
        "tertiary-container": withOpacity("--color-tertiary-container"),
        "on-secondary-fixed-variant": withOpacity("--color-on-secondary-fixed-variant"),
        "secondary-fixed-dim": withOpacity("--color-secondary-fixed-dim"),
        "inverse-on-surface": withOpacity("--color-inverse-on-surface"),
        "on-error-container": withOpacity("--color-on-error-container"),
        "on-tertiary-container": withOpacity("--color-on-tertiary-container"),
        "surface": withOpacity("--color-surface"),
        "surface-dim": withOpacity("--color-surface-dim"),
        "on-primary-fixed": withOpacity("--color-on-primary-fixed"),
        "surface-container-lowest": withOpacity("--color-surface-container-lowest"),
        "primary-fixed": withOpacity("--color-primary-fixed"),
        "on-secondary-fixed": withOpacity("--color-on-secondary-fixed"),
        "on-surface": withOpacity("--color-on-surface"),
        "tertiary-fixed": withOpacity("--color-tertiary-fixed"),
        "surface-container-high": withOpacity("--color-surface-container-high"),
        "on-primary-container": withOpacity("--color-on-primary-container"),
        "primary-container": withOpacity("--color-primary-container"),
        "on-tertiary-fixed": withOpacity("--color-on-tertiary-fixed"),
        "on-surface-variant": withOpacity("--color-on-surface-variant"),
        "primary": withOpacity("--color-primary"),
        "surface-tint": withOpacity("--color-surface-tint")
      },
      borderRadius: {
        "DEFAULT": "0.125rem",
        "lg": "0.25rem",
        "xl": "0.5rem",
        "full": "0.75rem"
      },
      spacing: {
        "margin-tablet": "1.5rem",
        "space-sm": "0.5rem",
        "gutter-desktop": "1.5rem",
        "margin": "1rem",
        "space-xs": "0.25rem",
        "margin-desktop": "2rem",
        "space-lg": "1.25rem",
        "space-xl": "2rem",
        "gutter": "1rem",
        "space-md": "0.75rem"
      },
      fontFamily: {
        "label-code-sm": ["JetBrains Mono", "monospace"],
        "headline-lg": ["Inter", "sans-serif"],
        "label-code": ["JetBrains Mono", "monospace"],
        "headline-lg-mobile": ["Inter", "sans-serif"],
        "label-ui": ["Inter", "sans-serif"],
        "headline-md": ["Inter", "sans-serif"],
        "body-sm": ["Inter", "sans-serif"],
        "body-md": ["Inter", "sans-serif"],
        "headline-sm": ["Inter", "sans-serif"],
        "body-lg": ["Inter", "sans-serif"]
      },
      fontSize: {
        "label-code-sm": ["11px", { lineHeight: "14px", letterSpacing: "0em", fontWeight: "400" }],
        "headline-lg": ["30px", { lineHeight: "38px", letterSpacing: "-0.02em", fontWeight: "600" }],
        "label-code": ["12px", { lineHeight: "16px", letterSpacing: "-0.02em", fontWeight: "500" }],
        "headline-lg-mobile": ["24px", { lineHeight: "32px", letterSpacing: "-0.015em", fontWeight: "600" }],
        "label-ui": ["11px", { lineHeight: "14px", letterSpacing: "0.04em", fontWeight: "600" }],
        "headline-md": ["20px", { lineHeight: "28px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "body-sm": ["12px", { lineHeight: "16px", letterSpacing: "0.01em", fontWeight: "400" }],
        "body-md": ["13px", { lineHeight: "18px", letterSpacing: "0em", fontWeight: "400" }],
        "headline-sm": ["16px", { lineHeight: "24px", letterSpacing: "-0.005em", fontWeight: "600" }],
        "body-lg": ["15px", { lineHeight: "22px", letterSpacing: "0em", fontWeight: "400" }]
      }
    }
  },
  plugins: [],
}
