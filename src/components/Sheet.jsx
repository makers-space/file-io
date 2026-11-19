import React, { useEffect, useMemo, useState } from 'react';
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
            line.push({ text: waiting ? '' : valueText(result, cell.numFmt), formula, waiting, number: typeof result === 'number', value: typeof result === 'number' ? result : null, bold: Boolean(cell.font?.bold) });
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
        let live = true;
        setState((now) => (text !== null && now.sheets.length > 0 ? now : { loading: true, sheets: [], problem: null }));
        if (text === null) open(0);
        (async () => {
            try {
                let sheets;
                const mark = /\.tsv$/i.test(fileName) ? '\t' : ',';
                const title = fileName.replace(/\.[^.]+$/, '');
                if (text !== null) {
                    sheets = [readCsv(text, title, mark)];
                } else if (/\.(csv|tsv|txt)$/i.test(fileName) || /csv|plain/.test(blob.type || '')) {
                    sheets = [readCsv(await blob.text(), title, mark)];
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
    const head = sheet?.cells[0] || [];
    const label = (column) => (textOf(head[column]) ? `${columnName(column)} · ${textOf(head[column])}` : columnName(column));
    const columns = useMemo(() => (sheet ? Array.from({ length: sheet.columns }, (_, column) => column).filter((column) => !hidden.has(column)) : []), [sheet, hidden]);
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
    }, [sheet, filtering]);
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
    }, [sheet, term, filters, sort]);
    const pages = Math.max(1, Math.ceil(body.length / pageSize));
    const shown = body.slice((page - 1) * pageSize, page * pageSize);
    // Merged cells are drawn merged only while the rows and columns stand as the file has them.
    const plain = !altered && hidden.size === 0;
    const chosen = picked && sheet ? cellOf(sheet.cells[picked.row]?.[picked.column]) : null;
    const pending = state.sheets.reduce((sum, one) => sum + one.pending, 0);
    const empty = Boolean(sheet) && (sheet.rows === 0 || sheet.columns === 0);
    const hasFormulas = useMemo(() => state.sheets.some((one) => !one.text && one.cells.some((row) => row.some((cell) => cell?.formula))), [state.sheets]);
    const address = picked ? `${columnName(picked.column)}${picked.row + 1}` : null;
    const reading = !picked ? 'rest' : !chosen ? 'empty' : chosen.formula ? `${chosen.formula}${chosen.waiting ? '' : ` → ${chosen.text}`}` : chosen.text;
    // What stands in for the grid when there is nothing to show: a file being read, a file with no rows, a file that failed.
    const rest = state.loading ? { figure: 'format', play: true, says: 'Reading the file…' }
        : state.problem ? { figure: 'query', says: state.problem }
            : empty ? { figure: 'loupe', says: 'This sheet holds no rows.' }
                : null;
    const size = 'xs';
    const setFilter = (column, value) => { setFilters((now) => ({ ...now, [column]: { value, exact: Boolean(choices[column]) } })); setPage(1); };
    const showOnly = (kept) => setHidden(new Set(kept ? [] : Array.from({ length: sheet?.columns || 0 }, (_, column) => column)));
    const notes = [
        altered ? `${body.length.toLocaleString()} of ${Math.max(0, (sheet?.rows || 1) - 1).toLocaleString()} rows match.` : '',
        pending > 0 ? `${pending === 1 ? '1 formula has' : `${pending} formulas have`} no result stored in this file, so ${pending === 1 ? 'it is' : 'they are'} shown as written.` : ''
    ].filter(Boolean).join(' ');

    const line = (row, heading) => {
        const cells = sheet.cells[row] || [];
        const merged = plain && (!heading || page === 1);
        return (
            <tr key={row} className={heading ? 'sheet-heading' : undefined}>
                <th className={picked?.row === row ? 'sheet-head-on' : ''}>{row + 1}</th>
                {columns.map((column) => {
                    if (merged && sheet.covered.has(`${row}:${column}`)) return null;
                    const cell = cellOf(cells[column]);
                    const span = merged ? sheet.spans.get(`${row}:${column}`) : null;
                    const on = picked?.row === row && picked?.column === column;
                    const kind = [cell?.number && !formulas ? 'sheet-number' : '', cell?.bold ? 'sheet-bold' : '', cell?.waiting ? 'sheet-waiting' : '', on ? 'sheet-on' : ''].filter(Boolean).join(' ');
                    return (
                        <td key={column} className={kind || undefined} rowSpan={span?.rowSpan} colSpan={span?.colSpan} onClick={() => setPicked({ row, column })}>
                            {cell ? (formulas && cell.formula ? cell.formula : textOf(cell)) : ''}
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
                        <table className="sheet-table">
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
                <Pagination page={page} pages={pages} onPage={setPage} pageSize={pageSize} pageSizes={PAGE_SIZES} onPageSize={(chosenSize) => { setPageSize(chosenSize); setPage(1); }} size={size} padding="none">
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
