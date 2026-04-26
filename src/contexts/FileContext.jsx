import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';

const FileContext = createContext();

export const useFile = () => {
    const context = useContext(FileContext);
    if (!context) throw new Error('useFile must be used within a FileProvider');
    return context;
};

export const FileProvider = ({ children }) => {
    const { user } = useAuth();
    const userRoot = user?.username ? '/' + user.username : '/';

    const [currentPath, setCurrentPath] = useState(userRoot);
    const [breadcrumb, setBreadcrumb] = useState([{ name: 'My Drive', path: userRoot }]);
    const [selectedFiles, setSelectedFiles] = useState([]);

    // When user loads after mount, update root if we're still on the placeholder '/'
    useEffect(() => {
        if (!user?.username) return;
        const root = '/' + user.username;
        setCurrentPath(prev => (prev === '/' ? root : prev));
        setBreadcrumb(prev =>
            prev.length === 1 && prev[0].path === '/'
                ? [{ name: 'My Drive', path: root }]
                : prev
        );
    }, [user?.username]); // eslint-disable-line react-hooks/exhaustive-deps

    const navigateTo = useCallback((path, name) => {
        const root = user?.username ? '/' + user.username : '/';
        // Treat bare '/' as the user's own root
        const resolvedPath = path === '/' ? root : path;
        setCurrentPath(resolvedPath);
        setSelectedFiles([]);
        if (resolvedPath === root) {
            setBreadcrumb([{ name: 'My Drive', path: root }]);
        } else {
            // Strip the user root prefix so breadcrumbs don't show the username segment
            const userPrefix = root + '/';
            const displayPath = resolvedPath.startsWith(userPrefix)
                ? resolvedPath.slice(root.length)
                : resolvedPath;
            const segments = displayPath.split('/').filter(Boolean);
            const crumbs = [{ name: 'My Drive', path: root }];
            segments.forEach((seg, i) => {
                crumbs.push({
                    name: name && i === segments.length - 1 ? name : seg,
                    path: root + '/' + segments.slice(0, i + 1).join('/')
                });
            });
            setBreadcrumb(crumbs);
        }
    }, [user?.username]); // eslint-disable-line react-hooks/exhaustive-deps

    const selectFile = useCallback((fileId) => {
        setSelectedFiles(prev =>
            prev.includes(fileId) ? prev.filter(id => id !== fileId) : [...prev, fileId]
        );
    }, []);

    const clearSelection = useCallback(() => setSelectedFiles([]), []);

    const selectAll = useCallback((fileIds) => setSelectedFiles(fileIds), []);

    return (
        <FileContext.Provider value={{
            currentPath,
            breadcrumb,
            selectedFiles,
            navigateTo,
            selectFile,
            clearSelection,
            selectAll
        }}>
            {children}
        </FileContext.Provider>
    );
};

export default FileContext;
