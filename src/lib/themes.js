export const lightTheme = {
  name: "light",
  colors: {
    // Primary backgrounds
    primary: "#876e54",
    secondary: "#9c8368",
    tertiary: "#a78158",
    
    // Header
    headerGradientFrom: "#a78158",
    headerGradientVia: "#9f7f5a",
    headerGradientTo: "#9b7956",
    headerBorder: "#bba664",
    
    // Accents
    accentYellow: "#fcd34d",
    accentGold: "#fbcd32",
    accentLighter: "#fde047",
    
    // Text
    textPrimary: "#ffdca7",
    textSecondary: "#e8c89e",
    textDark: "#654e35",
    
    // Backgrounds for elements
    elementBg: "#b99a77",
    elementBgDark: "#b39471",
    elementBgCard: "#8f7456",
    elementBorder: "#cfb153",
    
    // Buttons
    buttonBg: "#dbb84a",
    buttonBg2: "#5b4a39",
    buttonBgAlt: "#fbcd32",
    buttonHover: "#dbb84a",
    buttonText: "#654e35",
    
    // Cards
    cardBg: "#8f7456",
    cardBorder: "#bba664",
    cardHoverBorder: "#ecd65a",
    cardShadow: "#000000",
    
    // Gradients for stat/info boxes
    gradientFrom: "#634116",
    gradientTo: "#9f722e",
    
    // Scrollbar
    scrollbarTrack: "#9b7956",
    scrollbarThumb: "#bba664",
    scrollbarThumbHover: "#ecd65a",
  },
  gradients: {
    dots: [
      "rgb(252, 211, 77)",
      "rgba(159, 133, 105, 0.4)",
      "rgba(135, 114, 90, 0.5)",
    ],
  },
};

export const darkTheme = {
  name: "dark",
  colors: {
    // Primary backgrounds
    primary: "#0f172a",
    secondary: "#1e293b",
    tertiary: "#475569",
    
    // Header
    headerGradientFrom: "#1e3a8a",
    headerGradientVia: "#0c4a6e",
    headerGradientTo: "#164e63",
    headerBorder: "#0ea5e9",
    
    // Accents
    accentYellow: "#4cb7ffff",
    accentGold: "#4dcafcff",
    accentLighter: "#47d9fdff",
    
    // Text
    textPrimary: "#e0e7ff",
    textSecondary: "#cbd5e1",
    textDark: "#1e293b",
    
    // Backgrounds for elements
    elementBg: "#1f2d45",
    elementBgDark: "#121b31",
    elementBgCard: "#121b31",
    elementBorder: "#0ea5e9",
    
    // Buttons
    buttonBg: "#0284c7",
    buttonBg2: "#003c5a",
    buttonBgAlt: "#06b6d4",
    buttonHover: "#0284c7",
    buttonText: "#f0f9ff",
    
    // Cards
    cardBg: "#1e293b",
    cardBorder: "#0369a1",
    cardHoverBorder: "#0ea5e9",
    cardShadow: "#0284c7",
    
    // Gradients for stat/info boxes
    gradientFrom: "#1e40af",
    gradientTo: "#0284c7",
    
    // Scrollbar
    scrollbarTrack: "#1e293b",
    scrollbarThumb: "#0284c7",
    scrollbarThumbHover: "#0ea5e9",
  },
  gradients: {
    dots: [
      "rgba(92, 202, 246, 0.6)",
      "rgba(59, 130, 246, 0.4)",
      "rgba(72, 83, 236, 0.5)",
    ],
  },
};

export const darkerTheme = {
  name: "darker",
  colors: {
    // Primary backgrounds
    primary: "#1E1A16", // Main page background
    secondary: "#2A231C", // Main container background
    tertiary: "#362B22", // Element background

    // Header
    headerGradientFrom: "#3C2F24", // Header top
    headerGradientVia: "#32271D", // Header middle
    headerGradientTo: "#2C231A", // Header bottom
    headerBorder: "#4F4332", // Header border

    // Accents
    accentYellow: "#fcd34d",
    accentGold: "#fbcd32",
    accentLighter: "#fde047",

    // Text
    textPrimary: "#E8C89E",
    textSecondary: "#C5A37A",
    textDark: "#876E54",

    // Backgrounds for elements
    elementBg: "#3D3128", // Container for elements
    elementBgDark: "#30261E", // Darker container
    elementBgCard: "#30261E", // Background for Card Detail view
    elementBorder: "#66573D", // Darker border

    // Buttons
    buttonBg: "#dbb84a",
    buttonBg2: "#4A3C31",
    buttonBgAlt: "#fbcd32",
    buttonHover: "#DBB84A",
    buttonText: "#1E1A16",

    // Cards
    cardBg: "#30261E",
    cardBorder: "#4F4332",
    cardHoverBorder: "#ECD65A",
    cardShadow: "#000000",

    // Gradients for stat/info boxes
    gradientFrom: "#362B22",
    gradientTo: "#47382B",

    // Scrollbar
    scrollbarTrack: "#2C231A",
    scrollbarThumb: "#4F4332",
    scrollbarThumbHover: "#66573D",
  },
  gradients: {
    dots: [
      "rgb(252, 211, 77)",
      "rgba(79, 67, 50, 0.4)",
      "rgba(42, 35, 28, 0.5)",
    ],
  },
};

export const THEMES = {
  light: lightTheme,
  dark: darkTheme,
  darker: darkerTheme,
};

export const THEME_NAMES = Object.keys(THEMES);

export const getTheme = (themeName) => THEMES[themeName] || lightTheme;