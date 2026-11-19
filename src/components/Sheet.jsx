import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Container } from './Container';
import Button from './Button';
import { ButtonGroup } from './ButtonGroup';
import { Switch } from './Switch';
import Typography from './Typography';
import Input from './Input';
import Select from './Select';
import Icon from './Icon';
import { Figure } from './Figure';
import { Pagination } from './Data';

const PAGE_SIZES = [10, 20, 50, 100, 500];

const columnName = (index) => {
    let name = '';
    for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
    return name;
};
const columnIndex = (name) => [...name].reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1;
const placeOf = (address) => {
    const [, letters, digits] = String(address).match(/^\$?([A-Z]+)\$?(\d+)$/) || [];
    return letters ? { row: Number(digits) - 1, column: columnIndex(letters) } : null;
};

const numberText = (value, format = '') => {
    if (!Number.isFinite(value)) return String(value);
    const decimals = (String(format).match(/\.(0+)/) || [])[1]?.length;
    if (String(format).includes('%')) return `${(value * 100).toFixed(decimals ?? 0)}%`;
    if (decimals !== undefined) return value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return String(Number(value.toPrecision(12)));
};
const dateText = (value) => {
    const iso = value.toISOString();
    return iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso.slice(0, 16).replace('T', ' ');
};
// A CSV file's cells are kept as the plain text the file holds, so a very large file fits in memory; a cell of a
// workbook is an object with its formula and format.
const cellOf = (cell) => {
    if (typeof cell !== 'string') return cell || null;
    const number = cell.trim() !== '' && Number.isFinite(Number(cell));
    return { text: cell, formula: null, waiting: false, number, value: number ? Number(cell) : null, bold: false };
};
const textOf = (cell) => (typeof cell === 'string' ? cell : cell ? (cell.waiting ? cell.formula : cell.text) : '');
const valueText = (value, format) => {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return dateText(value);
    if (typeof value === 'number') return numberText(value, format);
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    if (typeof value === 'object') {
        if (Array.isArray(value.richText)) return value.richText.map((part) => part.text).join('');
        if (value.error) return String(value.error);
        if (value.text !== undefined) return valueText(value.text, format);
        if ('result' in value) return valueText(value.result, format);
        return '';
    }
    return String(value);
};

// One sheet as rows of cells: what each cell shows, its formula if it has one, and whether the file holds a result for it.
const readSheet = (sheet) => {
    const rows = sheet.rowCount;
    const columns = sheet.columnCount;
    const spans = new Map();
    const covered = new Set();
    for (const range of sheet.model?.merges || []) {
        const [from, to] = String(range).split(':').map(placeOf);
        if (!from || !to) continue;
        spans.set(`${from.row}:${from.column}`, { rowSpan: to.row - from.row + 1, colSpan: to.column - from.column + 1 });
        for (let row = from.row; row <= to.row; row += 1) for (let column = from.column; column <= to.column; column += 1) if (row !== from.row || column !== from.column) covered.add(`${row}:${column}`);
    }
    const cells = [];
    let pending = 0;
    for (let row = 0; row < rows; row += 1) {
        const line = [];
        const source = sheet.getRow(row + 1);
        for (let column = 0; column < columns; column += 1) {
            const cell = source.getCell(column + 1);
            const value = covered.has(`${row}:${column}`) ? null : cell.value;
            if (value === null || value === undefined) {
                line.push(null);
                continue;
            }
            const formula = cell.formula ? `=${cell.formula}` : null;
            const result = formula ? cell.result : value;
            const waiting = Boolean(formula) && (result === undefined || result === null);
            if (waiting) pending += 1;
            line.push({ text: waiting ? '' : valueText(result, cell.numFmt), formula, waiting, number: typeof result === 'number', value: typeof result === 'number' ? result : null, bold: Boolean(cell.font?.bold), format: cell.numFmt || '', source: value });
        }
        cells.push(line);
    }
    return { name: sheet.name, rows, columns, cells, spans, covered, pending };
};

const readCsv = (text, name, mark = ',') => {
    const cells = [];
    const split = mark.charCodeAt(0);
    const size = text.length;
    const fieldEnd = (from) => {
        let to = from;
        for (; to < size; to += 1) {
            const code = text.charCodeAt(to);
            if (code === split || code === 10 || code === 13) break;
        }
        return to;
    };
    let line = [];
    let columns = 0;
    let at = 0;
    const endLine = () => {
        if (line.length > columns) columns = line.length;
        cells.push(line);
        line = [];
    };
    while (at < size) {
        let field = '';
        if (text.charCodeAt(at) === 34) {
            let from = at + 1;
            for (;;) {
                const close = text.indexOf('"', from);
                if (close < 0) { field += text.slice(from); at = size; break; }
                if (text.charCodeAt(close + 1) === 34) { field += text.slice(from, close + 1); from = close + 2; continue; }
                field += text.slice(from, close);
                at = close + 1;
                break;
            }
        }
        const to = fieldEnd(at);
        if (to > at) field += text.slice(at, to);
        at = to;
        line.push(field === '' ? null : field);
        if (at >= size) { endLine(); break; }
        const code = text.charCodeAt(at);
        at += code === 13 && text.charCodeAt(at + 1) === 10 ? 2 : 1;
        if (code !== split) endLine();
        else if (at >= size) { line.push(null); endLine(); }
    }
    return { name, rows: cells.length, columns, cells, spans: new Map(), covered: new Set(), pending: 0, text: true };
};

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const FORMATS = ['', '0', '0.00', '0%', '0.00%'];

// What a cell holds, as the person would type it.
const rawOf = (cell) => (typeof cell === 'string' ? cell : !cell ? '' : cell.formula || (cell.value !== null && cell.value !== undefined ? String(cell.value) : cell.text));
// What was typed, as a cell: plain text in a CSV file; a formula, a number or text in a workbook.
const cellFrom = (raw, before, plain) => {
    if (raw === '') return null;
    if (plain) return raw;
    const kept = { bold: Boolean(before?.bold), format: before?.format || '' };
    if (raw.startsWith('=') && raw.length > 1) return { text: '', formula: raw, waiting: true, number: false, value: null, ...kept };
    const number = raw.trim() !== '' && Number.isFinite(Number(raw));
    return number ? { text: numberText(Number(raw), kept.format), formula: null, waiting: false, number: true, value: Number(raw), ...kept }
        : { text: raw, formula: null, waiting: false, number: false, value: null, ...kept };
};
const writeCsv = (sheet, mark) => sheet.cells.map((line) => Array.from(line, (cell) => {
    const field = textOf(cell);
    return field.includes(mark) || /["\r\n]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field;
}).join(mark)).join('\n');

// Every change is made twice: to the rows the grid draws, and to the workbook the file was read into (`page` is its
// worksheet; a CSV file has none), so saving writes the workbook as it stands.
const put = (sheet, page, row, column, cell) => {
    const line = sheet.cells[row] || (sheet.cells[row] = []);
    sheet.pending += (cell?.waiting ? 1 : 0) - (line[column]?.waiting ? 1 : 0);
    line[column] = cell;
    if (!page) return;
    const target = page.getCell(row + 1, column + 1);
    target.value = !cell ? null : cell.source !== undefined ? cell.source : cell.formula ? { formula: cell.formula.slice(1) } : cell.value !== null ? cell.value : cell.text;
    if (!cell) return;
    if (Boolean(target.font?.bold) !== cell.bold) target.font = { ...(target.font || {}), bold: cell.bold };
    if ((target.numFmt || '') !== cell.format && (cell.format || target.numFmt)) target.numFmt = cell.format || 'General';
};
// A row or a column put in or taken out. What is taken out is kept on the change, so undoing puts it back.
const shift = (sheet, page, change, back) => {
    const add = (change.kind === 'insert') !== back;
    const waiting = (cells) => cells.filter((cell) => cell?.waiting).length;
    if (change.rows && add) {
        sheet.cells.splice(change.at, 0, []);
        sheet.rows += 1;
        page?.spliceRows(change.at + 1, 0, []);
        (change.saved || []).forEach((cell, column) => { if (cell !== null && cell !== undefined) put(sheet, page, change.at, column, cell); });
    } else if (change.rows) {
        change.saved = sheet.cells.splice(change.at, 1)[0] || [];
        sheet.rows -= 1;
        sheet.pending -= waiting(change.saved);
        page?.spliceRows(change.at + 1, 1);
    } else if (add) {
        sheet.cells.forEach((line) => { if (line.length > change.at) line.splice(change.at, 0, null); });
        sheet.columns += 1;
        page?.spliceColumns(change.at + 1, 0, []);
        (change.saved || []).forEach((cell, row) => { if (cell !== null && cell !== undefined) put(sheet, page, row, change.at, cell); });
    } else {
        change.saved = sheet.cells.map((line) => (line.length > change.at ? line.splice(change.at, 1)[0] : null));
        sheet.columns -= 1;
        sheet.pending -= waiting(change.saved);
        page?.spliceColumns(change.at + 1, 1);
    }
};

// The rows of a CSV file as records for the Data component: row 1 gives the field names, and a column with no name
// of its own, or a name already used, goes by its letter.
export const csvRecords = (text, fileName = '') => {
    const { cells, columns } = readCsv(text || '', '', /\.tsv$/i.test(fileName) ? '\t' : ',');
    const names = [];
    for (let column = 0; column < columns; column += 1) {
        const given = (cells[0]?.[column] || '').trim();
        names.push(given && !names.includes(given) ? given : columnName(column));
    }
    return cells.slice(1).map((line) => Object.fromEntries(names.map((name, column) => [name, line[column] ?? ''])));
};

// A spreadsheet file shown as a grid, read in the browser. It shows what the file holds: a formula is shown with the
// result stored beside it, and is not worked out again here. Row 1 is taken as the headings: it stays on top of every
// page and names the columns in the search, filter, column and sort controls, which are the Data component's own.
// With `editable`, cells can be changed: a CSV given as `text` reports every change through `onTextChange`, and a
// file given as a blob is written again and handed to `onSave` when the person saves.
export const Sheet = ({
    blob,
    text = null, // The text of a CSV file, in place of a blob
    fileName = 'sheet.xlsx',
    compact = false,
    editable = false,
    onSave = null,
    onTextChange = null,
    width = '100%',
    height = '100%',
    onError,
    className = ''
}) => {
    const [state, setState] = useState({ loading: true, sheets: [], problem: null });
    const [version, setVersion] = useState(0);
    const [editing, setEditing] = useState(null);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const book = useRef(null);
    const done = useRef([]);
    const undone = useRef([]);
    const emitted = useRef(null);
    const draft = useRef(null);
    const grid = useRef(null);
    const mark = /\.tsv$/i.test(fileName) ? '\t' : ',';
    const [index, setIndex] = useState(0);
    const [pageNumber, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(100);
    const [picked, setPicked] = useState(null);
    const [formulas, setFormulas] = useState(false);
    const [search, setSearch] = useState('');
    const [filtering, setFiltering] = useState(false);
    const [filters, setFilters] = useState({});
    const [hidden, setHidden] = useState(() => new Set());
    const [sort, setSort] = useState('none');
    const open = (at) => { setIndex(at); setPage(1); setPicked(null); setSearch(''); setFilters({}); setHidden(new Set()); setSort('none'); };

    useEffect(() => {
        if (!blob && text === null) return undefined;
        // The text this sheet itself just reported is already what it shows.
        if (text !== null && text === emitted.current) return undefined;
        let live = true;
        book.current = null;
        done.current = [];
        undone.current = [];
        draft.current = null;
        setEditing(null);
        setDirty(false);
        setState((now) => (text !== null && now.sheets.length > 0 ? now : { loading: true, sheets: [], problem: null }));
        if (text === null) open(0);
        (async () => {
            try {
                let sheets;
                const title = fileName.replace(/\.[^.]+$/, '');
                if (text !== null) {
                    sheets = [readCsv(text, title, mark)];
                } else if (/\.(csv|tsv|txt)$/i.test(fileName) || /csv|plain/.test(blob.type || '')) {
                    sheets = [readCsv(await blob.text(), title, mark)];
                } else {
                    const [library, bytes] = await Promise.all([import('exceljs'), blob.arrayBuffer()]);
                    const loaded = new (library.default || library).Workbook();
                    await loaded.xlsx.load(bytes);
                    sheets = loaded.worksheets.map(readSheet);
                    if (live) book.current = loaded;
                }
                if (live) setState({ loading: false, sheets, problem: sheets.length === 0 ? 'This file holds no sheets.' : null });
            } catch (error) {
                if (!live) return;
                setState({ loading: false, sheets: [], problem: 'This file could not be shown as a sheet.' });
                onError?.(error);
            }
        })();
        return () => { live = false; };
    }, [blob, text, fileName]); // eslint-disable-line react-hooks/exhaustive-deps

    const sheet = state.sheets[index] || null;
    const head = sheet?.cells[0] || [];
    const label = (column) => (textOf(head[column]) ? `${columnName(column)} · ${textOf(head[column])}` : columnName(column));
    const columns = useMemo(() => (sheet ? Array.from({ length: sheet.columns }, (_, column) => column).filter((column) => !hidden.has(column)) : []), [sheet, hidden, version]);
    // A column with ten values or fewer is filtered by picking one; any other by typing part of a value.
    const choices = useMemo(() => {
        const found = {};
        if (!sheet || !filtering) return found;
        for (let column = 0; column < sheet.columns; column += 1) {
            const seen = new Set();
            for (let row = 1; row < sheet.rows && seen.size <= 10; row += 1) {
                const value = textOf(sheet.cells[row]?.[column]);
                if (value !== '') seen.add(value);
            }
            found[column] = seen.size > 0 && seen.size <= 10 ? [...seen].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })) : null;
        }
        return found;
    }, [sheet, filtering, version]);
    const term = search.trim().toLowerCase();
    const altered = term !== '' || sort !== 'none' || Object.values(filters).some((filter) => filter.value.trim() !== '');
    const body = useMemo(() => {
        if (!sheet) return [];
        let rows = Array.from({ length: Math.max(0, sheet.rows - 1) }, (_, at) => at + 1);
        if (term) rows = rows.filter((row) => sheet.cells[row].some((cell) => textOf(cell).toLowerCase().includes(term)));
        for (const [column, filter] of Object.entries(filters)) {
            const wanted = filter.value.trim().toLowerCase();
            if (!wanted) continue;
            rows = rows.filter((row) => {
                const value = textOf(sheet.cells[row][column]).toLowerCase();
                return filter.exact ? value === wanted : value.includes(wanted);
            });
        }
        if (sort !== 'none') {
            const [column, way] = sort.split(':');
            const turn = way === 'desc' ? -1 : 1;
            const keys = new Map(rows.map((row) => {
                const cell = cellOf(sheet.cells[row][column]);
                return [row, { text: textOf(cell), value: cell ? cell.value : null }];
            }));
            rows.sort((a, b) => {
                const one = keys.get(a);
                const other = keys.get(b);
                if (one.text === '' || other.text === '') return (one.text === '') - (other.text === '');
                if (one.value !== null && other.value !== null) return (one.value - other.value) * turn;
                return one.text.localeCompare(other.text, undefined, { numeric: true }) * turn;
            });
        }
        return rows;
    }, [sheet, term, filters, sort, version]);
    const pages = Math.max(1, Math.ceil(body.length / pageSize));
    const shown = body.slice((pageNumber - 1) * pageSize, pageNumber * pageSize);
    // Merged cells are drawn merged only while the rows and columns stand as the file has them.
    const plain = !altered && hidden.size === 0;
    const chosen = picked && sheet ? cellOf(sheet.cells[picked.row]?.[picked.column]) : null;
    const pending = state.sheets.reduce((sum, one) => sum + one.pending, 0);
    const empty = Boolean(sheet) && (sheet.rows === 0 || sheet.columns === 0);
    const hasFormulas = useMemo(() => state.sheets.some((one) => !one.text && one.cells.some((row) => row.some((cell) => cell?.formula))), [state.sheets, version]);
    const address = picked ? `${columnName(picked.column)}${picked.row + 1}` : null;
    const reading = !picked ? 'rest' : !chosen ? 'empty' : chosen.formula ? `${chosen.formula}${chosen.waiting ? '' : ` → ${chosen.text}`}` : chosen.text;
    // What stands in for the grid when there is nothing to show: a file being read, a file with no rows, a file that failed.
    const rest = state.loading ? { figure: 'format', play: true, says: 'Reading the file…' }
        : state.problem ? { figure: 'query', says: state.problem }
            : empty ? { figure: 'loupe', says: 'This sheet holds no rows.' }
                : null;
    const size = 'xs';
    const page = sheet && !sheet.text ? book.current?.worksheets[index] || null : null;
    const canEdit = editable && Boolean(sheet) && (sheet.text || Boolean(page));
    // Rows and columns stay where they are when moving them would leave formulas or merged cells pointing at the wrong place.
    const merged = Boolean(sheet) && (sheet.spans.size > 0 || (Boolean(page) && hasFormulas));
    const run = (change, back = false) => {
        if (change.cells) change.cells.forEach((one) => put(sheet, page, one.row, one.column, back ? one.before : one.after));
        else shift(sheet, page, change, back);
        setVersion((now) => now + 1);
        if (text !== null) {
            emitted.current = writeCsv(sheet, mark);
            onTextChange?.(emitted.current);
        } else setDirty(true);
    };
    const act = (change) => { run(change); done.current.push(change); undone.current = []; };
    const undo = () => { const change = done.current.pop(); if (change) { run(change, true); undone.current.push(change); } };
    const redo = () => { const change = undone.current.pop(); if (change) { run(change); done.current.push(change); } };
    const change = (row, column, after) => act({ cells: [{ row, column, before: sheet.cells[row]?.[column] ?? null, after }] });
    const edit = (next) => { draft.current = next; setEditing(next); };
    const commit = () => {
        const typed = draft.current;
        if (!typed) return;
        edit(null);
        const before = sheet.cells[typed.row]?.[typed.column] ?? null;
        if (typed.value !== rawOf(before)) change(typed.row, typed.column, cellFrom(typed.value, before, sheet.text));
    };
    const move = (down, across) => {
        if (!picked) return;
        const order = [0, ...shown];
        const row = order[Math.max(0, Math.min(order.length - 1, order.indexOf(picked.row) + down))] ?? picked.row;
        const column = columns[Math.max(0, Math.min(columns.length - 1, columns.indexOf(picked.column) + across))] ?? picked.column;
        setPicked({ row, column });
    };
    const setBold = () => { if (chosen && page) change(picked.row, picked.column, { ...chosen, bold: !chosen.bold }); };
    const setFormat = (format) => { if (chosen && page && typeof chosen.value === 'number') change(picked.row, picked.column, { ...chosen, format, text: numberText(chosen.value, format) }); };
    const reshape = (rows, kind) => {
        if (!picked) return;
        act({ rows, kind, at: rows ? picked.row : picked.column });
        if (kind === 'delete') setPicked(null);
    };
    const gridKey = (event) => {
        if (editing || !picked) return;
        const held = event.ctrlKey || event.metaKey;
        const arrows = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
        const letter = event.key.toLowerCase();
        if (arrows[event.key]) move(...arrows[event.key]);
        else if (!canEdit) return;
        else if (held && letter === 'z') undo();
        else if (held && letter === 'y') redo();
        else if (held && letter === 'b') setBold();
        else if (held || event.altKey) return;
        else if (event.key === 'Enter' || event.key === 'F2') edit({ ...picked, value: rawOf(chosen) });
        else if (event.key === 'Delete' || event.key === 'Backspace') { if (chosen) change(picked.row, picked.column, null); }
        else if (event.key.length === 1) edit({ ...picked, value: event.key });
        else return;
        event.preventDefault();
    };
    const editorKey = (event) => {
        if (event.key === 'Escape') edit(null);
        else if (event.key === 'Enter') { commit(); move(1, 0); }
        else if (event.key === 'Tab') { commit(); move(0, event.shiftKey ? -1 : 1); }
        else return;
        event.preventDefault();
        grid.current?.focus();
    };
    const save = async () => {
        setSaving(true);
        try {
            if (page) book.current.calcProperties.fullCalcOnLoad = true;
            const written = page ? new Blob([await book.current.xlsx.writeBuffer()], { type: XLSX_TYPE }) : new Blob([writeCsv(sheet, mark)], { type: 'text/csv' });
            await onSave(written);
            setDirty(false);
        } catch (error) {
            onError?.(error);
        } finally {
            setSaving(false);
        }
    };
    const setFilter = (column, value) => { setFilters((now) => ({ ...now, [column]: { value, exact: Boolean(choices[column]) } })); setPage(1); };
    const showOnly = (kept) => setHidden(new Set(kept ? [] : Array.from({ length: sheet?.columns || 0 }, (_, column) => column)));
    const notes = [
        dirty && page && hasFormulas ? 'Formulas are not worked out again here: their results are from before your changes, and are worked out when the file is next opened in a spreadsheet program.' : '',
        dirty && page ? 'Saving writes the whole workbook again: charts, pictures and pivot tables in it may not survive.' : '',
        altered ? `${body.length.toLocaleString()} of ${Math.max(0, (sheet?.rows || 1) - 1).toLocaleString()} rows match.` : '',
        pending > 0 ? `${pending === 1 ? '1 formula has' : `${pending} formulas have`} no result stored in this file, so ${pending === 1 ? 'it is' : 'they are'} shown as written.` : ''
    ].filter(Boolean).join(' ');

    const line = (row, heading) => {
        const cells = sheet.cells[row] || [];
        const joined = plain && (!heading || pageNumber === 1);
        return (
            <tr key={row} className={heading ? 'sheet-heading' : undefined}>
                <th className={picked?.row === row ? 'sheet-head-on' : ''}>{row + 1}</th>
                {columns.map((column) => {
                    if (joined && sheet.covered.has(`${row}:${column}`)) return null;
                    const cell = cellOf(cells[column]);
                    const span = joined ? sheet.spans.get(`${row}:${column}`) : null;
                    const typing = editing?.row === row && editing?.column === column;
                    const on = picked?.row === row && picked?.column === column;
                    const kind = [cell?.number && !formulas ? 'sheet-number' : '', cell?.bold ? 'sheet-bold' : '', cell?.waiting ? 'sheet-waiting' : '', on ? 'sheet-on' : ''].filter(Boolean).join(' ');
                    return (
                        <td
                            key={column}
                            className={typing ? 'sheet-typing' : kind || undefined}
                            rowSpan={span?.rowSpan}
                            colSpan={span?.colSpan}
                            onClick={() => { if (!typing) { commit(); setPicked({ row, column }); } }}
                            onDoubleClick={() => { if (canEdit && !typing) edit({ row, column, value: rawOf(cell) }); }}
                        >
                            {typing
                                ? <Input className="sheet-editor" size={size} autoFocus value={editing.value} onChange={(event) => edit({ ...draft.current, value: event.target.value })} onKeyDown={editorKey} onBlur={commit} />
                                : cell ? (formulas && cell.formula ? cell.formula : textOf(cell)) : ''}
                        </td>
                    );
                })}
                <td className="sheet-fill" aria-hidden="true" />
            </tr>
        );
    };

    return (
        <Container className={`sheet ${compact ? 'sheet-compact' : ''} ${className}`.trim()} layout="flex-column" gap="xs" padding="none" width={width} height={height}>
            {sheet && !rest && (
                <Container className="sheet-tools" layout="flex" wrap={false} align="center" gap="sm" padding="none" width="100%">
                    <Container padding="none" flexFill>
                        <Input placeholder="Search all columns..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} size={size} variant="outline" type="search" icon="FaSearch" />
                    </Container>
                    <Button variant="secondary" size={size} selected={filtering} onClick={() => setFiltering((now) => !now)}>
                        <Icon name="FiFilter" size="xxs" />
                        Filters
                    </Button>
                    <Button
                        variant="secondary"
                        size={size}
                        genieTrigger="click"
                        genie={
                            <Container layout="flex-column" gap="sm" padding="md">
                                <Container layout="flex" align="center" justify="between" padding="none">
                                    <Typography size={size} weight="medium">Select Columns</Typography>
                                    <ButtonGroup spaced selectable={false} justify="start">
                                        <Button variant="tertiary" size={size} onClick={() => showOnly(true)}>All</Button>
                                        <Button variant="tertiary" size={size} onClick={() => showOnly(false)}>None</Button>
                                    </ButtonGroup>
                                </Container>
                                {Array.from({ length: sheet.columns }, (_, column) => (
                                    <Container key={column} layout="flex" align="center" gap="sm" padding="none">
                                        <Input
                                            type="checkbox"
                                            id={`sheet-column-${column}`}
                                            checked={!hidden.has(column)}
                                            onChange={() => setHidden((now) => { const next = new Set(now); if (!next.delete(column)) next.add(column); return next; })}
                                        />
                                        <Typography as="label" htmlFor={`sheet-column-${column}`} size={size}>{label(column)}</Typography>
                                    </Container>
                                ))}
                            </Container>
                        }
                    >
                        <Icon name="FiColumns" size="xxs" />
                        Columns
                    </Button>
                </Container>
            )}
            {canEdit && !rest && (
                <Container className="sheet-edit" layout="flex" align="center" gap="sm" padding="none" width="100%">
                    <ButtonGroup size={size} selectable={false}>
                        <Button variant="secondary" size={size} title="Undo" disabled={done.current.length === 0} onClick={undo}><Icon name="FiRotateCcw" size="xxs" /></Button>
                        <Button variant="secondary" size={size} title="Redo" disabled={undone.current.length === 0} onClick={redo}><Icon name="FiRotateCw" size="xxs" /></Button>
                    </ButtonGroup>
                    {page && (
                        <Button variant="secondary" size={size} title="Bold" selected={Boolean(chosen?.bold)} disabled={!chosen} onClick={setBold}><Icon name="FiBold" size="xxs" /></Button>
                    )}
                    {page && (
                        <Container padding="none">
                            <Select
                                size={size}
                                value={chosen?.format || 'General'}
                                disabled={typeof chosen?.value !== 'number'}
                                onChange={(event) => { const wanted = event?.target?.value ?? event; setFormat(wanted === 'General' ? '' : wanted); }}
                                options={[...new Set([...FORMATS, chosen?.format || ''])].map((format) => ({ value: format || 'General', label: format || 'General' }))}
                            />
                        </Container>
                    )}
                    <ButtonGroup size={size} selectable={false}>
                        <Button variant="secondary" size={size} title={merged ? 'Not available in a file with formulas or merged cells' : 'Put a row in above the chosen cell'} disabled={!picked || merged} onClick={() => reshape(true, 'insert')}><Icon name="FiPlus" size="xxs" />Row</Button>
                        <Button variant="secondary" size={size} title={merged ? 'Not available in a file with formulas or merged cells' : 'Take out the chosen row'} disabled={!picked || merged} onClick={() => reshape(true, 'delete')}><Icon name="FiMinus" size="xxs" />Row</Button>
                        <Button variant="secondary" size={size} title={merged ? 'Not available in a file with formulas or merged cells' : 'Put a column in before the chosen cell'} disabled={!picked || merged} onClick={() => reshape(false, 'insert')}><Icon name="FiPlus" size="xxs" />Column</Button>
                        <Button variant="secondary" size={size} title={merged ? 'Not available in a file with formulas or merged cells' : 'Take out the chosen column'} disabled={!picked || merged} onClick={() => reshape(false, 'delete')}><Icon name="FiMinus" size="xxs" />Column</Button>
                    </ButtonGroup>
                    {onSave && text === null && (
                        <Button color="primary" size={size} disabled={!dirty || saving} onClick={save}><Icon name="FiSave" size="xxs" />{saving ? 'Saving…' : 'Save'}</Button>
                    )}
                </Container>
            )}
            {sheet && !rest && filtering && (
                <Container className="sheet-filters" gap="sm" padding="sm" backgroundColor="surface" width="100%">
                    <Container layout="flex" align="center" justify="between" padding="none">
                        <Typography weight="semibold" size={size}>Column Filters</Typography>
                        <Button variant="secondary" size={size} onClick={() => { setFilters({}); setPage(1); }}>Clear All</Button>
                    </Container>
                    <Container layout="flex" gap="sm" padding="none">
                        {columns.map((column) => (choices[column] ? (
                            <Select
                                key={column}
                                placeholder={`Filter by ${label(column)}...`}
                                value={filters[column]?.value || ''}
                                onChange={(event) => setFilter(column, event?.target?.value ?? event)}
                                options={[{ value: '', label: `${label(column)}: all` }, ...choices[column].map((option) => ({ value: option, label: option }))]}
                                size={size}
                            />
                        ) : (
                            <Input key={column} placeholder={`Filter ${label(column)}...`} value={filters[column]?.value || ''} onChange={(event) => setFilter(column, event.target.value)} size={size} variant="outline" />
                        )))}
                    </Container>
                </Container>
            )}
            <Container className="sheet-plate" layout="flex-column" gap="none" padding="none" width="100%" flexFill>
                <Container className="sheet-tags" layout="flex" wrap={false} align="center" justify="between" gap="sm" padding="none" width="100%">
                    <Typography className="sheet-tag" size="xxs" color="muted" truncate title={fileName}>{fileName}</Typography>
                    <Container className="sheet-read" layout="flex" wrap={false} align="center" gap="xs" padding="none" minWidth="0">
                        {address && <Typography className="sheet-tag sheet-tag-on" size="xxs">{address}</Typography>}
                        <Typography className="sheet-tag" size="xxs" color={picked && chosen ? null : 'muted'} truncate title={chosen?.waiting ? 'The file holds no result for this formula.' : null}>{reading}</Typography>
                    </Container>
                </Container>
                <Container className="sheet-grid" layout="block" padding="none" width="100%" flexFill>
                    {rest && (
                        <Container className="sheet-rest" layout="flex-column" align="center" justify="center" gap="xs" padding="md" width="100%" height="100%">
                            <Figure name={rest.figure} play={Boolean(rest.play)} label={rest.says} maxWidth={compact ? '200px' : '280px'} />
                            <Typography size="xs" color="muted">{rest.says}</Typography>
                        </Container>
                    )}
                    {sheet && !rest && (
                        <table ref={grid} className="sheet-table" tabIndex={0} onKeyDown={gridKey}>
                            <thead>
                                <tr>
                                    <th className="sheet-corner" />
                                    {columns.map((column) => <th key={column} className={picked?.column === column ? 'sheet-head-on' : ''}>{columnName(column)}</th>)}
                                    <th className="sheet-fill" />
                                </tr>
                            </thead>
                            <tbody>
                                {line(0, true)}
                                {shown.map((row) => line(row, false))}
                            </tbody>
                        </table>
                    )}
                </Container>
            </Container>
            {notes && <Typography size="xxs" color="muted">{notes}</Typography>}
            {(state.sheets.length > 1 || hasFormulas) && (
                <Container className="sheet-controls" layout="flex" align="center" justify="between" gap="sm" padding="none" width="100%">
                    <ButtonGroup className="sheet-tabs" selectable={false} size={size}>
                        {state.sheets.map((one, at) => (
                            <Button key={`${one.name}-${at}`} size={size} color={at === index ? 'primary' : 'secondary'} selected={at === index} onClick={() => open(at)}>{one.name}</Button>
                        ))}
                    </ButtonGroup>
                    {hasFormulas && <Switch label="Show formulas" size={size} checked={formulas} onChange={(event) => setFormulas(event.target.checked)} />}
                </Container>
            )}
            {sheet && !rest && (
                <Pagination page={pageNumber} pages={pages} onPage={setPage} pageSize={pageSize} pageSizes={PAGE_SIZES} onPageSize={(chosenSize) => { setPageSize(chosenSize); setPage(1); }} size={size} padding="none">
                    <Select
                        size={size}
                        value={sort}
                        onChange={(event) => { setSort((event?.target?.value ?? event) || 'none'); setPage(1); }}
                        options={[{ value: 'none', label: 'No sorting' }, ...columns.flatMap((column) => [{ value: `${column}:asc`, label: `${label(column)} ↑` }, { value: `${column}:desc`, label: `${label(column)} ↓` }])]}
                        placeholder="Sort by..."
                    />
                </Pagination>
            )}
        </Container>
    );
};

export default Sheet;
