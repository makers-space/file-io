import React, { createContext, useContext, useState, useEffect } from 'react';

// Import all themes directly to avoid async loading issues and white flashes
import '../styles/themes/modern.css';
import '../styles/themes/dark.css';
import '../styles/themes/minimal.css';
import '../styles/themes/vibrant.css';
import '../styles/themes/admin.css';
import '../styles/themes/pink.css';

const ThemeContext = createContext();

// Available themes
const themes = {
  modern: {
    name: 'Modern',
    description: 'Clean and professional design with modern aesthetics'
  },
  dark: {
    name: 'Dark',  
    description: 'Dark mode theme with high contrast and modern feel'
  },
  minimal: {
    name: 'Minimal',
    description: 'Ultra-clean minimalist design with focus on content'
  },
  vibrant: {
    name: 'Vibrant',
    description: 'Colorful and energetic design with bold styling'
  },
  admin: {
    name: 'Admin',
    description: 'Professional administrative interface design'
  },
  pink: {
    name: 'Pink',
    description: 'Playful and vibrant design with a pink color palette'
  }
};

export const ThemeProvider = ({ children, theme: overrideTheme }) => {
  // Check if this is a nested ThemeProvider (override scenario)
  const parentContext = useContext(ThemeContext);
  const isNestedProvider = !!parentContext;
  
  // Get initial theme from localStorage or default to 'modern' (only for root provider)
  const [globalTheme, setGlobalTheme] = useState(() => {
    if (isNestedProvider) return null; // Nested providers don't manage global state
    const saved = localStorage.getItem('selectedTheme');
    return saved && themes[saved] ? saved : 'modern';
  });
  
  // Determine the effective current theme
  const currentTheme = isNestedProvider 
    ? (overrideTheme || parentContext.currentTheme) // Use override or inherit from parent
    : (overrideTheme || globalTheme); // Use override or global theme
  
  // Store theme preference, update body class, and dispatch change event
  useEffect(() => {
    if (isNestedProvider) return; // Only root provider manages global state
    
    // Store in localStorage (only for global theme changes, not overrides)
    if (!overrideTheme) {
      localStorage.setItem('selectedTheme', currentTheme);
    }

    // Update body class to ensure background color persists during page transitions
    // This prevents the "white flash" issue by ensuring the body always has the current theme class
    Object.keys(themes).forEach(themeName => {
      document.body.classList.remove(`theme-${themeName}`);
    });
    document.body.classList.add(`theme-${currentTheme}`);
    
    // Dispatch a custom event that components can listen for
    const themeChangeEvent = new CustomEvent('themechange', { 
      detail: { theme: currentTheme, isOverride: !!overrideTheme } 
    });
    document.dispatchEvent(themeChangeEvent);
  }, [currentTheme, isNestedProvider, overrideTheme]);

  const switchTheme = (themeName) => {
    if (!themes[themeName]) {
      console.warn(`Theme "${themeName}" does not exist`);
      return;
    }

    // Only root provider can switch global theme
    if (isNestedProvider) {
      console.warn('Cannot switch global theme from nested ThemeProvider. Use the root ThemeProvider.');
      return;
    }

    if (themeName === currentTheme) {
      return; // Already using this theme
    }
      
    setGlobalTheme(themeName);
  };

  // Get CSS variables as an object for external use
  const getThemeVariables = () => {
    const cssVars = getComputedStyle(document.documentElement);
    const variables = {};
    
    // Extract commonly used variables
    const varNames = [
      '--background-color', '--text-color', '--text-muted', '--primary-color',
      '--secondary-color', '--tertiary-color', '--success-color', '--warning-color', '--error-color',
      '--accent-color', '--surface-color', '--border-color',
      '--code-editor-bg', '--code-editor-line-bg', '--code-editor-line-numbers',
      '--code-editor-cursor', '--code-editor-selection', '--code-editor-border',
      '--code-keyword', '--code-string', '--code-number', '--code-comment',
      '--code-function', '--code-variable', '--code-operator', '--code-tag',
      '--code-attribute', '--code-value'
    ];
    
    varNames.forEach(varName => {
      const value = cssVars.getPropertyValue(varName).trim();
      if (value) {
        variables[varName] = value;
      }
    });
    
    return variables;
  };

  const getThemeInfo = (themeName) => {
    return themes[themeName] || null;
  };
  
  const value = {
    currentTheme,
    switchTheme,
    availableThemes: Object.keys(themes),
    themes,
    getThemeInfo,
    isNestedProvider,
    isOverride: !!overrideTheme,
    getThemeVariables
  };

  return (
    <ThemeContext.Provider value={value}>
      {isNestedProvider && overrideTheme ? (
        // Nested provider with theme override needs a wrapper to apply theme
        <div 
          className={`theme-override-wrapper theme-${currentTheme}`}
          data-theme={currentTheme}
          data-theme-source="override"
        >
          {children}
        </div>
      ) : (
        children
      )}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};