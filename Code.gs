// ─────────────────────────────────────────────────────────────
//  ERC Event Planning – Apps Script Backend
//  Paste this entire file into Tools > Script Editor in your
//  Google Sheet, then deploy as a Web App (see README).
// ─────────────────────────────────────────────────────────────

const TASKS_SHEET_NAME = 'Sheet1';        // ← change if your tab has a different name
const LOG_SHEET_NAME   = 'Completion Log';

// ── Entry point ───────────────────────────────────────────────
function doGet(e) {
  const action = (e && e.parameter) ? e.parameter.action : null;

  try {
    if (action === 'complete') {
      return completeTask(e.parameter);
    }
    // Default: return all tasks as JSON (optional – HTML reads CSV directly)
    return getTasks();
  } catch (err) {
    return respond({ success: false, error: err.message });
  }
}

// ── GET all tasks as JSON ─────────────────────────────────────
function getTasks() {
  const sheet = getTasksSheet();
  const data  = sheet.getDataRange().getValues();
  if (data.length < 2) return respond([]);

  const headers = data[0].map(h => String(h).trim());
  const rows = data.slice(1).map((row, i) => {
    const obj = {};
    headers.forEach((h, j) => { obj[h] = row[j]; });
    obj._row = i + 2; // 1-indexed sheet row (row 1 = header)
    return obj;
  });

  return respond(rows);
}

// ── Mark a task complete ──────────────────────────────────────
function completeTask(params) {
  const initials  = (params.initials  || '').trim().toUpperCase();
  const taskName  = (params.task      || '').trim();
  const eventName = (params.event     || '').trim();

  if (!initials)  return respond({ success: false, error: 'Missing initials' });
  if (!taskName)  return respond({ success: false, error: 'Missing task'     });
  if (!eventName) return respond({ success: false, error: 'Missing event'    });

  const sheet  = getTasksSheet();
  const values = sheet.getDataRange().getValues();
  const hdrs   = values[0].map(h => String(h).toLowerCase().trim());

  const colDone  = hdrs.indexOf('done');
  const colEvent = hdrs.indexOf('event');
  const colTask  = hdrs.indexOf('task');

  if (colDone < 0 || colEvent < 0 || colTask < 0) {
    return respond({ success: false, error: 'Required columns not found (Done, Event, Task)' });
  }

  // Find matching row (first undone match)
  let targetRow = -1;
  for (let i = 1; i < values.length; i++) {
    if (
      String(values[i][colEvent]).trim() === eventName &&
      String(values[i][colTask]).trim()  === taskName  &&
      values[i][colDone] !== true
    ) {
      targetRow = i + 1; // convert to 1-indexed
      break;
    }
  }

  if (targetRow === -1) {
    return respond({ success: false, error: 'Task not found or already complete' });
  }

  // ✓ Check the Done box
  sheet.getRange(targetRow, colDone + 1).setValue(true);

  // Write to Completion Log
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const tz  = ss.getSpreadsheetTimeZone();
  const now = new Date();

  let log = ss.getSheetByName(LOG_SHEET_NAME);
  if (!log) {
    log = ss.insertSheet(LOG_SHEET_NAME);
    log.appendRow(['Date', 'Time', 'Initials', 'Event', 'Task']);
    log.getRange(1, 1, 1, 5).setFontWeight('bold');
    log.setFrozenRows(1);
  }

  log.appendRow([
    Utilities.formatDate(now, tz, 'MM/dd/yyyy'),
    Utilities.formatDate(now, tz, 'hh:mm a z'),
    initials,
    eventName,
    taskName,
  ]);

  return respond({ success: true });
}

// ── Helpers ───────────────────────────────────────────────────
function getTasksSheet() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(TASKS_SHEET_NAME) || ss.getSheets()[0];
  if (!sheet) throw new Error('Tasks sheet not found');
  return sheet;
}

function respond(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
