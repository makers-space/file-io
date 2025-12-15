import React, { createContext, useContext, useState, useCallback } from 'react';

const NotificationContext = createContext();

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);

    const addNotification = useCallback((notification) => {
        const id = Date.now() + Math.random();
        const newNotification = {
            id,
            timestamp: new Date().toISOString(),
            ...notification
        };

        setNotifications(prev => [...prev, newNotification]);

        // Auto-remove notification after duration
        if (notification.duration !== 0) { // 0 means persist until manually dismissed
            setTimeout(() => {
                removeNotification(id);
            }, notification.duration || 5000);
        }

        return id;
    }, []);

    const removeNotification = useCallback((id) => {
        setNotifications(prev => prev.filter(notification => notification.id !== id));
    }, []);

    const clearAllNotifications = useCallback(() => {
        setNotifications([]);
    }, []);

    // Convenience methods for common notification types
    const success = useCallback((message, options = {}) => {
        return addNotification({
            type: 'success',
            message,
            title: options.title || 'Success',
            duration: options.duration || 5000,
            ...options
        });
    }, [addNotification]);

    const error = useCallback((message, options = {}) => {
        return addNotification({
            type: 'error',
            message,
            title: options.title || 'Error',
            duration: options.duration || 7000, // Longer duration for errors
            ...options
        });
    }, [addNotification]);

    const warning = useCallback((message, options = {}) => {
        return addNotification({
            type: 'warning',
            message,
            title: options.title || 'Warning',
            duration: options.duration || 6000,
            ...options
        });
    }, [addNotification]);

    const info = useCallback((message, options = {}) => {
        return addNotification({
            type: 'info',
            message,
            title: options.title || 'Info',
            duration: options.duration || 5000,
            ...options
        });
    }, [addNotification]);

    const value = {
        notifications,
        addNotification,
        removeNotification,
        clearAllNotifications,
        success,
        error,
        warning,
        info
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
};

export default NotificationContext;
