import React, { useEffect, useMemo, useState } from 'react';
import { Container } from './Container';
import Button from './Button';
import { ButtonGroup } from './ButtonGroup';
import { Switch } from './Switch';
import Typography from './Typography';
import CircularProgress from './CircularProgress';
import { Pagination } from './Data';

const MAX_ROWS = 5000;
const MAX_COLUMNS = 200;
const PAGE_ROWS = 100;
const CSV_READ_BYTES = 8 * 1024 * 1024;

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
    const rows = Math.min(sheet.rowCount, MAX_ROWS);
    const columns = Math.min(sheet.columnCount, MAX_COLUMNS);
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
            line.push({ text: waiting ? '' : valueText(result, cell.numFmt), formula, waiting, number: typeof result === 'number', bold: Boolean(cell.font?.bold) });
        }
        cells.push(line);
    }
    return { name: sheet.name, rows, columns, cells, spans, covered, pending, cut: sheet.rowCount > rows || sheet.columnCount > columns };
};

const readCsv = (text, name, mark = ',', partial = false) => {
    const cells = [];
    let line = [];
    let field = '';
    let quoted = false;
    const push = () => {
        const number = field.trim() !== '' && Number.isFinite(Number(field));
        line.push(field === '' ? null : { text: field, formula: null, waiting: false, number, bold: false });
        field = '';
    };
    for (let at = 0; at < text.length && cells.length < MAX_ROWS; at += 1) {
        const letter = text[at];
        if (quoted) {
            if (letter === '"' && text[at + 1] === '"') { field += '"'; at += 1; } else if (letter === '"') quoted = false; else field += letter;
        } else if (letter === '"') quoted = true;
        else if (letter === mark) push();
        else if (letter === '\n' || letter === '\r') {
            if (letter === '\r' && text[at + 1] === '\n') at += 1;
            push();
            cells.push(line.slice(0, MAX_COLUMNS));
            line = [];
        } else field += letter;
    }
    const full = cells.length >= MAX_ROWS;
    // The last line of a file read only in part may be half a line, so it is left out.
    if (!full && !partial && (field !== '' || line.length > 0)) { push(); cells.push(line.slice(0, MAX_COLUMNS)); }
    const columns = cells.reduce((most, row) => Math.max(most, row.length), 0);
    return { name, rows: cells.length, columns, cells, spans: new Map(), covered: new Set(), pending: 0, cut: full || partial };
};

// A spreadsheet file shown as a grid, read in the browser. It shows what the file holds: a formula is shown with the
// result stored beside it, and is not worked out again here.
export const Sheet = ({
    blob,
    text = null, // The text of a CSV file, in place of a blob
    fileName = 'sheet.xlsx',
    compact = false,
    width = '100%',
    height = '100%',
    onError,
    className = ''
}) => {
    const [state, setState] = useState({ loading: true, sheets: [], problem: null });
    const [index, setIndex] = useState(0);
    const [page, setPage] = useState(1);
    const [picked, setPicked] = useState(null);
    const [formulas, setFormulas] = useState(false);

    useEffect(() => {
        if (!blob && text === null) return undefined;
        let live = true;
        setState((now) => (text !== null && now.sheets.length > 0 ? now : { loading: true, sheets: [], problem: null }));
        if (text === null) {
            setIndex(0);
            setPage(1);
            setPicked(null);
        }
        (async () => {
            try {
                let sheets;
                const mark = /\.tsv$/i.test(fileName) ? '\t' : ',';
                const title = fileName.replace(/\.[^.]+$/, '');
                if (text !== null) {
                    sheets = [readCsv(text, title, mark)];
                } else if (/\.(csv|tsv|txt)$/i.test(fileName) || /csv|plain/.test(blob.type || '')) {
                    // Only the rows that can be shown are read, so a very large file still opens.
                    const partial = blob.size > CSV_READ_BYTES;
                    sheets = [readCsv(await (partial ? blob.slice(0, CSV_READ_BYTES) : blob).text(), title, mark, partial)];
                } else {
                    const [library, bytes] = await Promise.all([import('exceljs'), blob.arrayBuffer()]);
                    const book = new (library.default || library).Workbook();
                    await book.xlsx.load(bytes);
                    sheets = book.worksheets.map(readSheet);
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
    const pages = sheet ? Math.max(1, Math.ceil(sheet.rows / PAGE_ROWS)) : 1;
    const from = (page - 1) * PAGE_ROWS;
    const shown = useMemo(() => (sheet ? sheet.cells.slice(from, from + PAGE_ROWS) : []), [sheet, from]);
    const chosen = picked && sheet ? sheet.cells[picked.row]?.[picked.column] : null;
    const pending = state.sheets.reduce((sum, one) => sum + one.pending, 0);

    return (
        <Container className={`sheet ${compact ? 'sheet-compact' : ''} ${className}`.trim()} layout="flex-column" gap="xs" padding="none" width={width} height={height}>
            <Container layout="flex" wrap={false} align="center" justify="between" gap="sm" padding="none" width="100%">
                <Typography size="xs" color="muted" truncate title={fileName}>{fileName}</Typography>
                {state.sheets.some((one) => one.cells.some((row) => row.some((cell) => cell?.formula))) && <Switch label="Show formulas" size="xs" checked={formulas} onChange={(event) => setFormulas(event.target.checked)} />}
            </Container>
            <Container className="sheet-readout" layout="flex" wrap={false} align="center" gap="sm" padding="xs" width="100%">
                <Typography size="xs" weight="semibold">{picked ? `${columnName(picked.column)}${picked.row + 1}` : 'Cell'}</Typography>
                <Typography size="xs" color={chosen ? null : 'muted'} truncate>
                    {!picked ? 'Choose a cell to see what it holds.' : !chosen ? 'Empty' : chosen.formula ? `${chosen.formula}${chosen.waiting ? '  (no result stored)' : `  →  ${chosen.text}`}` : chosen.text}
                </Typography>
            </Container>
            <Container className="sheet-grid" layout="block" padding="none" width="100%" flexFill>
                {state.loading && <Container layout="flex" align="center" justify="center" padding="md" width="100%"><CircularProgress size="sm" /></Container>}
                {state.problem && <Container padding="sm"><Typography size="xs" color="warning">{state.problem}</Typography></Container>}
                {sheet && (
                    <table className="sheet-table">
                        <thead>
                            <tr>
                                <th className="sheet-corner" />
                                {Array.from({ length: sheet.columns }, (_, column) => <th key={column} className={picked?.column === column ? 'sheet-head-on' : ''}>{columnName(column)}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {shown.map((line, offset) => {
                                const row = from + offset;
                                return (
                                    <tr key={row}>
                                        <th className={picked?.row === row ? 'sheet-head-on' : ''}>{row + 1}</th>
                                        {Array.from({ length: sheet.columns }, (_, column) => {
                                            if (sheet.covered.has(`${row}:${column}`)) return null;
                                            const cell = line[column] || null;
                                            const span = sheet.spans.get(`${row}:${column}`);
                                            const on = picked?.row === row && picked?.column === column;
                                            const kind = [cell?.number && !formulas ? 'sheet-number' : '', cell?.bold ? 'sheet-bold' : '', cell?.waiting ? 'sheet-waiting' : '', on ? 'sheet-on' : ''].filter(Boolean).join(' ');
                                            return (
                                                <td key={column} className={kind || undefined} rowSpan={span?.rowSpan} colSpan={span?.colSpan} onClick={() => setPicked({ row, column })}>
                                                    {cell ? (formulas && cell.formula ? cell.formula : cell.waiting ? cell.formula : cell.text) : ''}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </Container>
            {(pending > 0 || sheet?.cut) && (
                <Typography size="xxs" color="warning">
                    {[pending > 0 ? `${pending === 1 ? '1 formula has' : `${pending} formulas have`} no result stored in this file, so ${pending === 1 ? 'it is' : 'they are'} shown as written.` : '', sheet?.cut ? `Only the first ${MAX_ROWS.toLocaleString()} rows and ${MAX_COLUMNS} columns are shown.` : ''].filter(Boolean).join(' ')}
                </Typography>
            )}
            <Container layout="flex" align="center" justify="between" gap="sm" padding="none" width="100%">
                <ButtonGroup selectable={false} size="xs">
                    {state.sheets.map((one, at) => (
                        <Button key={`${one.name}-${at}`} size="xs" color={at === index ? 'primary' : 'secondary'} selected={at === index} onClick={() => { setIndex(at); setPage(1); setPicked(null); }}>{one.name}</Button>
                    ))}
                </ButtonGroup>
                {pages > 1 && <Pagination page={page} pages={pages} onPage={setPage} size="xs" padding="none" />}
            </Container>
        </Container>
    );
};

export default Sheet;
