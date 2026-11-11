import { useEffect } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { useNotification } from '@contexts/NotificationContext';
import fileService from '@/client/file.client';

const BATCH_WINDOW_MS = 300;

const VERBS = {
    created: 'created',
    directory_created: 'created',
    uploaded: 'uploaded',
    deleted: 'deleted',
    renamed: 'renamed',
    moved: 'moved',
    shared: 'shared',
    unshared: 'changed sharing on',
    version_saved: 'saved a version of'
};

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

const actorIdOf = (data) => data.userId || data.sharedBy || data.unsharedBy;

const describeOwn = (action, data) => {
    const name = `"${data.newFileName || data.fileName}"`;
    switch (action) {
        case 'created':
            if (data.operation !== 'copy') return `Created ${name}`;
            return data.renamed ? `Copied as ${name} — that name was already taken` : `Copied ${name}`;
        case 'directory_created':
            return `Created folder ${name}`;
        case 'uploaded': {
            const base = data.count > 1 ? `Uploaded ${data.count} files` : `Uploaded ${name}`;
            const renamed = data.renamed || [];
            if (renamed.length === 1) {
                return `${base} — "${renamed[0].fileName}" already existed, saved as "${renamed[0].savedAs}"`;
            }
            return renamed.length > 1 ? `${base} — ${renamed.length} already existed and were saved under new names` : base;
        }
        case 'deleted':
            return `Deleted ${name}`;
        case 'renamed':
            return `Renamed to ${name}`;
        case 'moved':
            return data.renamed ? `Moved as ${name} — that name was already taken` : `Moved ${name}`;
        case 'shared': {
            const count = Array.isArray(data.sharedWith) ? data.sharedWith.length : 1;
            return `Shared ${name} with ${count} user${count !== 1 ? 's' : ''}`;
        }
        case 'unshared':
            return `Updated sharing on ${name}`;
        case 'version_saved':
            return `Saved version ${data.versionNumber} of ${name}`;
        default:
            return null;
    }
};

const describeOther = (action, data, userId) => {
    const who = data.actor || 'Someone';
    const name = `"${data.newFileName || data.fileName}"`;
    const includesMe = (list) => Array.isArray(list) && list.map(String).includes(String(userId));
    if (action === 'shared' && includesMe(data.sharedWith)) return `${who} shared ${name} with you`;
    if (action === 'unshared' && includesMe(data.unsharedFrom)) return `${who} changed your access to ${name}`;
    if (action === 'uploaded' && data.count > 1) return `${who} uploaded ${data.count} files`;
    if (action === 'renamed') return `${who} renamed a file to ${name}`;
    return VERBS[action] ? `${who} ${VERBS[action]} ${name}` : null;
};

/**
 * The only place file-operation notifications are raised: every one comes
 * from a WebSocket event, so an operation can never notify twice.
 */
const FileNotifications = () => {
    const { user } = useAuth();
    const { success, info } = useNotification();
    const userId = user?.id || user?._id;

    useEffect(() => {
        if (!userId) return undefined;

        const batches = new Map();

        const flush = (key) => {
            const batch = batches.get(key);
            batches.delete(key);
            if (!batch) return;
            const { action, own, events } = batch;
            const notify = own ? success : info;

            if (events.length === 1) {
                const message = own ? describeOwn(action, events[0]) : describeOther(action, events[0], userId);
                if (message) notify(message, own ? {} : { title: 'Activity' });
                return;
            }
            const verb = VERBS[action] || action;
            notify(
                own
                    ? `${capitalize(verb)} ${events.length} items`
                    : `${events[0].actor || 'Someone'} ${verb} ${events.length} items`,
                own ? {} : { title: 'Activity' }
            );
        };

        const cleanup = fileService.onFileNotification((action, data = {}) => {
            const own = String(actorIdOf(data)) === String(userId);
            const key = `${action}:${own ? 'own' : data.actor || 'other'}`;
            const batch = batches.get(key);
            if (batch) {
                batch.events.push(data);
                return;
            }
            batches.set(key, { action, own, events: [data], timer: setTimeout(() => flush(key), BATCH_WINDOW_MS) });
        });

        return () => {
            cleanup();
            batches.forEach(batch => clearTimeout(batch.timer));
            batches.clear();
        };
    }, [userId, success, info]);

    return null;
};

export default FileNotifications;
