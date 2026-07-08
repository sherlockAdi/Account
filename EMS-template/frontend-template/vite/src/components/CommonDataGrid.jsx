import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { DataGrid } from '@mui/x-data-grid';

import CloseOutlined from '@ant-design/icons/CloseOutlined';
import DownloadOutlined from '@ant-design/icons/DownloadOutlined';
import FileExcelOutlined from '@ant-design/icons/FileExcelOutlined';
import FilePdfOutlined from '@ant-design/icons/FilePdfOutlined';
import FilterOutlined from '@ant-design/icons/FilterOutlined';
import ReloadOutlined from '@ant-design/icons/ReloadOutlined';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

import DateField from 'components/DateField';

function normalize(value) {
  if (value === null || value === undefined) return '';
  return String(value).toLowerCase();
}

function dateOnly(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function cellExportValue(column, row) {
  if (column.exportValue) return column.exportValue(row);
  const value = row[column.field];
  return value === null || value === undefined ? '' : value;
}

export default function CommonDataGrid({
  title,
  rows,
  columns,
  getRowId,
  searchPlaceholder = 'Search',
  dateField,
  selectFilters = [],
  fileName = 'export',
  height = 460,
  pageSize = 25,
  onRowClick
}) {
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectValues, setSelectValues] = useState(() => Object.fromEntries(selectFilters.map((filter) => [filter.field, ''])));

  const gridRows = useMemo(
    () => rows.map((row, index) => ({ ...row, id: getRowId ? getRowId(row, index) : row.id || row.ledgerId || `${fileName}-${index}` })),
    [fileName, getRowId, rows]
  );

  const exportColumns = useMemo(() => columns.filter((column) => column.exportable !== false && column.field !== 'actions'), [columns]);

  const resolvedSelectFilters = useMemo(
    () =>
      selectFilters.map((filter) => {
        if (filter.options) return filter;
        const options = [...new Set(gridRows.map((row) => row[filter.field]).filter((value) => value !== null && value !== undefined && value !== ''))]
          .sort((a, b) => String(a).localeCompare(String(b)))
          .map((value) => ({ value, label: String(value) }));
        return { ...filter, options };
      }),
    [gridRows, selectFilters]
  );

  const filteredRows = useMemo(() => {
    const query = normalize(search);

    return gridRows.filter((row) => {
      if (dateField) {
        const rowDate = dateOnly(row[dateField]);
        if (from && rowDate < from) return false;
        if (to && rowDate > to) return false;
      }

      for (const filter of resolvedSelectFilters) {
        const selected = selectValues[filter.field];
        if (selected && String(row[filter.field]) !== String(selected)) return false;
      }

      if (!query) return true;
      return exportColumns.some((column) => normalize(cellExportValue(column, row)).includes(query));
    });
  }, [dateField, exportColumns, from, gridRows, resolvedSelectFilters, search, selectValues, to]);

  const exportRows = useMemo(
    () =>
      filteredRows.map((row) =>
        Object.fromEntries(exportColumns.map((column) => [column.headerName || column.field, cellExportValue(column, row)]))
      ),
    [exportColumns, filteredRows]
  );

  const activeFilterCount = useMemo(
    () => Number(Boolean(search)) + Number(Boolean(from)) + Number(Boolean(to)) + Object.values(selectValues).filter(Boolean).length,
    [from, search, selectValues, to]
  );

  function resetFilters() {
    setSearch('');
    setFrom('');
    setTo('');
    setSelectValues(Object.fromEntries(selectFilters.map((filter) => [filter.field, ''])));
  }

  function exportCsv() {
    const sheet = XLSX.utils.json_to_sheet(exportRows);
    const csv = XLSX.utils.sheet_to_csv(sheet);
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${fileName}.csv`);
  }

  function exportExcel() {
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
  }

  function exportPdf() {
    const doc = new jsPDF({ orientation: exportColumns.length > 5 ? 'landscape' : 'portrait' });
    doc.text(title || fileName, 14, 14);
    autoTable(doc, {
      head: [exportColumns.map((column) => column.headerName || column.field)],
      body: filteredRows.map((row) => exportColumns.map((column) => cellExportValue(column, row))),
      startY: 20,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235] }
    });
    doc.save(`${fileName}.pdf`);
  }

  const filterPanel = (
    <Stack spacing={2} sx={{ width: { xs: 300, sm: 360 }, p: 2.5 }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h5">Filters</Typography>
          <Typography variant="caption" color="text.secondary">
            {filteredRows.length} of {gridRows.length} records
          </Typography>
        </Box>
        <IconButton aria-label="Close filters" onClick={() => setFilterOpen(false)}>
          <CloseOutlined />
        </IconButton>
      </Stack>
      <Divider />
      <TextField
        fullWidth
        size="small"
        label={searchPlaceholder}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {dateField && (
        <Stack spacing={1.5}>
          <Typography variant="subtitle2">Date Range</Typography>
          <DateField fullWidth size="small" label="From" value={from} onChange={(event) => setFrom(event.target.value)} />
          <DateField fullWidth size="small" label="To" value={to} onChange={(event) => setTo(event.target.value)} />
        </Stack>
      )}
      {resolvedSelectFilters.length > 0 && (
        <Stack spacing={1.5}>
          <Typography variant="subtitle2">Selections</Typography>
          {resolvedSelectFilters.map((filter) => (
            <TextField
              key={filter.field}
              select
              fullWidth
              size="small"
              label={filter.label}
              value={selectValues[filter.field] || ''}
              onChange={(event) => setSelectValues((current) => ({ ...current, [filter.field]: event.target.value }))}
            >
              <MenuItem value="">All</MenuItem>
              {filter.options.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          ))}
        </Stack>
      )}
      <Divider />
      <Stack direction="row" spacing={1}>
        <Button fullWidth variant="outlined" startIcon={<ReloadOutlined />} onClick={resetFilters}>
          Reset
        </Button>
        <Button fullWidth variant="contained" onClick={() => setFilterOpen(false)}>
          Apply
        </Button>
      </Stack>
    </Stack>
  );

  return (
    <Stack spacing={1.5}>
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.25} sx={{ justifyContent: 'space-between', alignItems: { lg: 'center' } }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
          <Button variant={activeFilterCount ? 'contained' : 'outlined'} startIcon={<FilterOutlined />} onClick={() => setFilterOpen(true)}>
            Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
          </Button>
          <Button variant="outlined" startIcon={<ReloadOutlined />} onClick={resetFilters} disabled={!activeFilterCount}>
            Clear Filters
          </Button>
          <Typography variant="caption" color="text.secondary">
            {filteredRows.length} of {gridRows.length} records
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
          <Button variant="outlined" startIcon={<DownloadOutlined />} onClick={exportCsv} disabled={!filteredRows.length}>
            CSV
          </Button>
          <Button variant="outlined" startIcon={<FileExcelOutlined />} onClick={exportExcel} disabled={!filteredRows.length}>
            Excel
          </Button>
          <Button variant="outlined" startIcon={<FilePdfOutlined />} onClick={exportPdf} disabled={!filteredRows.length}>
            PDF
          </Button>
        </Stack>
      </Stack>

      {title && (
        <Typography variant="caption" color="text.secondary">
          Use the column menu for per-column sorting and filters.
        </Typography>
      )}

      <Drawer anchor="left" open={filterOpen} onClose={() => setFilterOpen(false)} ModalProps={{ keepMounted: true }}>
        {filterPanel}
      </Drawer>

      <Box sx={{ width: '100%', height }}>
        <DataGrid
          rows={filteredRows}
          columns={columns}
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize } } }}
          disableRowSelectionOnClick
          disableColumnReorder={false}
          density="compact"
          onRowClick={onRowClick}
          sx={{
            borderColor: 'divider',
            '& .MuiDataGrid-columnHeaders': { bgcolor: 'grey.50' },
            '& .MuiDataGrid-cell:focus, & .MuiDataGrid-columnHeader:focus': { outline: 'none' }
          }}
        />
      </Box>
    </Stack>
  );
}
