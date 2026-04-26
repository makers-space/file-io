import React, { createContext, useContext, useState, useEffect } from 'react';

const PreferencesContext = createContext();

export const usePreferences = () => {
    const context = useContext(PreferencesContext);
    if (!context) throw new Error('usePreferences must be used within a PreferencesProvider');
    return context;
};

const STORAGE_KEY = 'filesystem-one-prefs';

const defaults = {
    viewMode: 'grid',   // 'grid' | 'list'
    sortBy: 'updatedAt', // 'name' | 'updatedAt' | 'size' | 'type'
    sortDir: 'desc'     // 'asc' | 'desc'
};

export const PreferencesProvider = ({ children }) => {
    const [prefs, setPrefs] = useState(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
        } catch {
            return defaults;
        }
    });

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    }, [prefs]);

    const setViewMode = (viewMode) => setPrefs(p => ({ ...p, viewMode }));
    const setSortBy = (sortBy) => setPrefs(p => ({ ...p, sortBy }));
    const setSortDir = (sortDir) => setPrefs(p => ({ ...p, sortDir }));
    const toggleSortDir = () => setPrefs(p => ({ ...p, sortDir: p.sortDir === 'asc' ? 'desc' : 'asc' }));

    return (
        <PreferencesContext.Provider value={{ ...prefs, setViewMode, setSortBy, setSortDir, toggleSortDir }}>
            {children}
        </PreferencesContext.Provider>
    );
};

export default PreferencesContext;
