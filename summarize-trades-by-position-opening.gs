// Configuration object
const config = {
  production: true, // Set to false for testing, true for production use
  testfolder: '1z38V8POr9lXNAoFBM-7I5_8GG9t5E2wx', // ID of the folder containing test data
  realfolder: '1k0FhOtK-3_mGoH5CnC9axY2l2FsP7h1q', // ID of the folder containing production data
  dumpfolder: '1zFsCLutd5pboDamsClZZBRsvPHB6QDwu', // ID of the folder where the summary spreadsheet will be saved
  textsearch: 'Total' // The text to search for in each sheet to find the total trade value
};

/**
 * Main function to process spreadsheets in a specified folder and generate a summary report.
 * It processes all Google Sheets files in the specified folder, extracts relevant data, and creates a summary sheet
 * with statistical information and pivot tables.
 */
function processFolder() {
  const infolderid = config.production ? config.realfolder : config.testfolder; // Determine which folder to process based on the production flag
  const reportdate = Utilities.formatDate(new Date(), 'GMT', 'yyyyMMdd'); // Generate a datestamp for the output file
  const foldername = DriveApp.getFolderById(infolderid).getName().toLowerCase(); // Get the name of the input folder
  const opfilename = `summary-of-${foldername}-${reportdate}`.replace(/\s/g, '-'); // Create the output filename
  const opmetadata = {
    name: opfilename, // Set the output filename
    mimeType: MimeType.GOOGLE_SHEETS, // Specify that we're creating a Google Sheets file
    parents: [config.dumpfolder] // Set the parent folder for the new spreadsheet
  };

  try {
    // Create a new Google Sheets file for the summary report
    const opmetafile = Drive.Files.create(opmetadata); // Create the new file (requires 'Drive API' Advanced Drive Service)
    const opdatafile = SpreadsheetApp.openById(opmetafile.id); // Open the newly created spreadsheet
    setupSummarySheet(opdatafile.getSheets()[0]); // Prepare and format the summary sheet
    
    const datafileid = opdatafile.getId(); // Get the ID of the output data file
    const inputfiles = DriveApp.getFolderById(infolderid).getFilesByType(MimeType.GOOGLE_SHEETS); // Get all Google Sheets files in the input folder
    
    let filenumber = 0;
    while (inputfiles.hasNext()) { 
      processInputFile(inputfiles.next().getId(), datafileid); 
      filenumber++;
      if (filenumber % 10 === 0) Logger.log(`Processed ${filenumber} files`); // Log progress every 10 files
    }
    
    const ss = SpreadsheetApp.openById(datafileid); // Open the summary spreadsheet
    const ts = ss.getSheetByName('TRADE SUMMARY'); // Get the summary sheet
    
    if (ts && ts.getLastRow() > 1) {
      formatSummarySheet(ts); // Format the summary sheet if it contains data
    } else {
      Logger.log("No data to format in summary sheet");
    }
    
    createPivotTables(datafileid); // Create pivot tables in the summary report
    summarizeByDate(datafileid); // New function to summarize totals by date

    Logger.log("Processing completed successfully.");
  } catch (error) {
    Logger.log(`Error in processFolder: ${error.message}`);
  }
}

/**
 * Sets up the summary sheet with headers and formatting.
 *
 * @param {SpreadsheetApp.Sheet} summarysheet - The sheet object to be set up as the summary sheet.
 */
function setupSummarySheet(summarysheet) {
  // Define the row headers and their corresponding formulas
  const rowheaders = [
    ['NUM', '=COUNT(C8:C)'], // Number of items (updated to start from row 8)
    ['SUM', '=SUM(C8:C)'], // Sum of values (updated to start from row 8)
    ['AVG', '=ROUND(AVERAGE(C8:C),2)'], // Mean of values, rounded to 2 decimal places (updated to start from row 8)
    ['MIN', '=MIN(C8:C)'], // Minimum value (updated to start from row 8)
    ['MAX', '=MAX(C8:C)'], // Maximum value (updated to start from row 8)
    ['DEV', '=IFERROR(ROUND(STDEV(C8:C),2),0)'], // Standard deviation, rounded to 2 decimal places (updated to start from row 8)
    ['TRX', 'GAIN'] // New row for transaction gain (placeholder, formula to be implemented)
  ];
  
  summarysheet.setName('TRADE SUMMARY').setHiddenGridlines(true).getDataRange().setFontFamily('Oswald'); // Set the name of the sheet, hide gridlines, and set the font family for the entire range
  summarysheet.getRange(1, 1, rowheaders.length, 3).setBackground('#000000').setFontColor('#ffffff'); // Set background and font color for the header area (now includes 7 rows)
  summarysheet.getRange(1, 2, rowheaders.length, rowheaders[0].length).setValues(rowheaders); // Set values for row headers and formulas
  summarysheet.getRange(1, 2, rowheaders.length, 1).setHorizontalAlignment('right'); // Align row headers (first column) to the right
  summarysheet.getRange(1, 3, rowheaders.length, 1).setHorizontalAlignment('right'); // NEW: Right-justify column C of the header row
  summarysheet.setFrozenRows(7); // Freeze the top 7 rows (increased from 6 to account for the new row)
}

/**
 * Processes each sheet in the input spreadsheet and appends relevant data to the output spreadsheet.
 *
 * @param {string} ipssid - The ID of the input spreadsheet.
 * @param {string} opssid - The ID of the output spreadsheet.
 */
function processInputFile(ipssid, opssid) {
  try {
    const ipss = SpreadsheetApp.openById(ipssid); // Open the input spreadsheet
    const opss = SpreadsheetApp.openById(opssid); // Open the output spreadsheet
    const opssname = opss.getSheetByName('TRADE SUMMARY');
    const ipssname = ipss.getName(); // Get the name of the input spreadsheet
    
    if (!opssname) { throw new Error('TRADE SUMMARY sheet not found in the output spreadsheet'); }
    
    ipss.getSheets().forEach(sheet => {
      const worksheet = sheet.getName();
      Logger.log(`Processing sheet: ${worksheet}`);
      
      const result = stringSearch(sheet, config.textsearch); // Search for the total trade value
      if (result !== null) {
        const positionOpenDate = sheet.getRange('B3').getValue(); // Get the position open date
        opssname.appendRow([ipssname, worksheet, result, positionOpenDate]); // Append the found data and position open date to the output spreadsheet
        Logger.log(`Processed ${ipssname} TRADE ${worksheet} [ ${result} USD ] on ${positionOpenDate}.`);
      } else {
        Logger.log(`No "${config.textsearch}" found in ${ipssname} TRADE ${worksheet}`);
      }
    });
    
    Logger.log(`Completed processing file ${ipssid}`);
  } catch (error) {
    Logger.log(`Error processing file ${ipssid}: ${error.message}`);
  }
}

/**
 * Searches for a specific string in a given sheet and returns the value in the adjacent cell.
 *
 * @param {SpreadsheetApp.Sheet} sheet - The sheet object to search.
 * @param {string} textsearch - The string to search for within the sheet.
 * @return {number|null} - Returns the numeric value of the cell adjacent to the found string, or null if not found or not numeric.
 */
function stringSearch(sheet, textsearch) {
  try {
    const values = sheet.getDataRange().getValues();  // Get all values from the sheet
    for (let row of values) {
      const index = row.indexOf(textsearch);
      if (index !== -1 && index + 1 < row.length) {
        const value = row[index + 1];
        return typeof value === 'number' ? value : null; // Return the value only if it's a number
      }
    }
    return null; // Return null if the string is not found
  } catch (error) {
    Logger.log(`Error in stringSearch for sheet "${sheet.getName()}": ${error.message}`);
    return null;
  }
}

/**
 * Applies formatting to the summary sheet.
 *
 * @param {SpreadsheetApp.Sheet} sheet - The sheet to be formatted.
 */
function formatSummarySheet(sheet) {
  try {
    const lr = sheet.getLastRow();
    const lc = sheet.getLastColumn();
    
    Logger.log(`Formatting summary sheet. Rows: ${lr}, Columns: ${lc}`);

    if (lr < 8 || lc < 3) { // Changed from 7 to 8 to account for the new header row
      Logger.log(`Warning: Summary sheet has insufficient data. Rows: ${lr}, Columns: ${lc}`);
      return;
    }

    // Set border for all data in the sheet
    Logger.log('Applying borders...');
    sheet.getRange(1, 1, lr, lc).setBorder(true, true, true, true, true, true);

    // Format numbers as currency, but only if the column exists
    if (lc >= 3) {
      Logger.log('Formatting currency...');
      sheet.getRange(2, 3, lr - 1, 1).setNumberFormat('$#,##0.00');
    }
    
    // Add alternating row colors
    if (lr > 8) { // Changed from 7 to 8 to account for the new header row
      Logger.log('Applying alternating colors...');
      const range = sheet.getRange(8, 1, lr - 7, lc); // Changed from 7 to 8
      const blend = createAlternatingColors(lr - 7, lc); // Changed from 6 to 7
      Logger.log(`Created colors array with ${blend.length} rows and ${blend[0].length} columns`);
      range.setBackgrounds(blend);
    }
    
    Logger.log(`Successfully formatted summary sheet. Rows: ${lr}, Columns: ${lc}`);
  } catch (error) {
    Logger.log(`Error in formatSummarySheet: ${error.message}`);
    Logger.log(`Error occurred at: ${error.stack}`);
    // Log the current state of the sheet for debugging
    Logger.log(`Sheet state - Name: ${sheet.getName()}, Rows: ${sheet.getLastRow()}, Columns: ${sheet.getLastColumn()}`);
    
    // Log the content of the sheet for further debugging
    const content = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
    Logger.log(`Sheet content: ${JSON.stringify(content)}`);
  }
}

/**
 * Creates an array of alternating background colors for rows.
 *
 * @param {number} numRows - The number of rows to create colors for.
 * @param {number} numCols - The number of columns to create colors for.
 * @return {string[][]} An array of color strings for each row.
 */
function createAlternatingColors(numRows, numCols) {
  // Create a 2D array with alternating colors
  // Even-indexed rows (0, 2, 4, ...) are white (#ffffff)
  // Odd-indexed rows (1, 3, 5, ...) are light gray (#f3f3f3)
  return Array(numRows).fill().map((_, i) => Array(numCols).fill((i % 2 === 0) ? '#ffffff' : '#f3f3f3'));
}

/**
 * Creates an array of alternating background colors for rows.
 *
 * @param {number} numRows - The number of rows to create colors for.
 * @param {number} numCols - The number of columns to create colors for.
 * @return {string[][]} An array of color strings for each row.
 */
function createAlternatingColors(numRows, numCols) {
  return Array(numRows).fill().map((_, i) => Array(numCols).fill((i % 2 === 0) ? '#ffffff' : '#f3f3f3'));
}

/**
 * Creates pivot tables in a new sheet within the specified spreadsheet for different statistical functions.
 *
 * @param {string} ssid - The ID of the spreadsheet where the pivot table will be created.
 */
function createPivotTables(ssid) {
  createPivotTable(ssid, 'DEVPIVOT', 1, 2, SpreadsheetApp.PivotTableSummarizeFunction.STDEV);
  createPivotTable(ssid, 'MINPIVOT', 1, 2, SpreadsheetApp.PivotTableSummarizeFunction.MIN);
  createPivotTable(ssid, 'MAXPIVOT', 1, 2, SpreadsheetApp.PivotTableSummarizeFunction.MAX);
  createPivotTable(ssid, 'AVEPIVOT', 1, 2, SpreadsheetApp.PivotTableSummarizeFunction.AVERAGE);
  createPivotTable(ssid, 'SUMPIVOT', 1, 2, SpreadsheetApp.PivotTableSummarizeFunction.SUM);
  createPivotTable(ssid, 'NUMPIVOT', 1, 2, SpreadsheetApp.PivotTableSummarizeFunction.COUNT);
  createSummaryPivotTable(ssid);
}

/**
 * Creates a pivot table in a new sheet within the specified spreadsheet.
 *
 * @param {string} ssid - The ID of the spreadsheet where the pivot table will be created.
 * @param {string} sheetName - The name of the new sheet that will contain the pivot table.
 * @param {number} rowGroupIndex - The index of the column to group by in rows (1-indexed).
 * @param {number} colGroupIndex - The index of the column to group by in columns (1-indexed).
 * @param {SpreadsheetApp.PivotTableSummarizeFunction} pivotFunction - The function to apply to the pivot table values.
 */
function createPivotTable(ssid, sheetName, rowGroupIndex, colGroupIndex, pivotFunction) {
  try {
    const ss = SpreadsheetApp.openById(ssid); // Open the spreadsheet by ID
    const sn = ss.getSheetByName('TRADE SUMMARY'); // Access the 'TRADE SUMMARY' sheet within the spreadsheet
    const hr = 7; // The row containing the headers
    const sc = 8; // Start from row 8 for the actual data (row after headers)
    const lr = sn.getLastRow();
    const lc = sn.getLastColumn();
    
    Logger.log(`Creating pivot table ${sheetName}. Source data: Rows: ${lr}, Columns: ${lc}`);
    
    if (lr < sc || lc < 3) {
      Logger.log(`Insufficient data for pivot table ${sheetName}. Rows: ${lr}, Columns: ${lc}`);
      return;
    }
    
    const pr = sn.getRange(sc, 1, lr - sc + 1, lc); // Define the range of the Pivot Table source data
    Logger.log(`Pivot table range: ${pr.getA1Notation()}`);
    Logger.log(`Pivot table range dimensions: Rows: ${pr.getNumRows()}, Columns: ${pr.getNumColumns()}`);
    
    const ps = ss.insertSheet(sheetName); // Create a new sheet for the pivot table
    const pt = ps.getRange('A1').createPivotTable(pr); // Create the pivot table in the new sheet
    
    // Set the row group and its header
    const rg = pt.addRowGroup(rowGroupIndex);
    rg.showTotals(true);
    rg.setDisplayName(sn.getRange(hr, rowGroupIndex).getValue()); // Set the header from row 7
    Logger.log(`Added row group: ${rowGroupIndex}`);
    
    if (colGroupIndex <= lc && sheetName !== 'NUMPIVOT') {
      // Set the column group and its header
      const cg = pt.addColumnGroup(colGroupIndex);
      cg.showTotals(true);
      cg.setDisplayName(sn.getRange(hr, colGroupIndex).getValue()); // Set the header from row 7
      Logger.log(`Added column group: ${colGroupIndex}`);
    }
    
    const vc = sheetName === 'NUMPIVOT' ? 2 : Math.min(3, lc);
    const pv = pt.addPivotValue(vc, pivotFunction);
    // Set the value header
    pv.setDisplayName(sn.getRange(hr, vc).getValue()); // Set the header from row 7
    Logger.log(`Added pivot value: Column ${vc}, Function: ${pivotFunction}`);
    
    formatPivotTable(ps, true); // Always apply formatting, regardless of pivot table type
    
    Logger.log(`Successfully created pivot table ${sheetName}`);
  } catch (error) {
    Logger.log(`Error creating pivot table ${sheetName}: ${error.message}`);
    Logger.log(`Error stack: ${error.stack}`);
  }
}

/**
 * Creates a summary pivot table in a new sheet within the specified spreadsheet.
 *
 * @param {string} ssid - The ID of the spreadsheet where the pivot table will be created.
 */
function createSummaryPivotTable(ssid) {
  try {
    const ss = SpreadsheetApp.openById(ssid);
    const sn = ss.getSheetByName('TRADE SUMMARY');
    const hr = 7; // The row containing the headers
    const sc = 8; // Start from row 8 for the actual data (row after headers)
    const lr = sn.getLastRow();
    const lc = Math.min(sn.getLastColumn(), 3); // Ensure we don't exceed 3 columns
    
    if (lr < sc || lc < 3) {
      Logger.log('Insufficient data for summary pivot table');
      return;
    }
    
    const pr = sn.getRange(sc, 1, lr - sc + 1, lc); // Define the range of the Pivot Table source data
    const ps = ss.insertSheet('TICKER PERFORMANCE');
    const pt = ps.getRange('A1').createPivotTable(pr);

    // Set the row group and its header
    const rg = pt.addRowGroup(1);
    rg.showTotals(true);
    rg.setDisplayName(sn.getRange(hr, 1).getValue()); // Set the header from row 7

    // Set the count value and its header
    const cv = pt.addPivotValue(2, SpreadsheetApp.PivotTableSummarizeFunction.COUNTA);
    cv.setDisplayName(sn.getRange(hr, 2).getValue() + ' Count'); // Set the header from row 7 + ' Count'

    // Set the sum value and its header
    const sv = pt.addPivotValue(3, SpreadsheetApp.PivotTableSummarizeFunction.SUM);
    sv.setDisplayName(sn.getRange(hr, 3).getValue() + ' Sum'); // Set the header from row 7 + ' Sum'
    
    formatPivotTable(ps, true);
    
    Logger.log('Successfully created summary pivot table');
  } catch (error) {
    Logger.log(`Error creating summary pivot table: ${error.message}`);
  }
}

/**
 * Applies formatting to a pivot table.
 *
 * @param {SpreadsheetApp.Sheet} sh - The sheet containing the pivot table.
 * @param {boolean} formatAsCurrency - Whether to format the values as currency.
 */
function formatPivotTable(sh, formatAsCurrency) {
  const dr = sh.getDataRange(); // Get the data range after pivot creation
  const sn = sh.getName();
  const lr = sh.getLastRow();
  const lc = sh.getLastColumn();
  
  Logger.log(`Formatting pivot table ${sn}. Rows: ${lr}, Columns: ${lc}`);

  // Freeze the first row for all pivot tables
  sh.setFrozenRows(1);
  
  sh.setFrozenColumns(1); // Freeze the header column
  dr.setFontFamily('Oswald'); // Use the 'Oswald' font in the data range
  dr.setBorder(true, true, true, true, true, true); // Apply a border to every cell in the data range
  sh.setHiddenGridlines(true); // Hide gridlines

  if (formatAsCurrency) {
    if (sn === 'TICKER PERFORMANCE' || sn === 'NUMPIVOT') {
      // Format column B as integer
      if (lc >= 2) sh.getRange(2, 2, lr - 1, 1).setNumberFormat('#,##0');
      // Format column C as currency (if it exists)
      if (lc >= 3) sh.getRange(2, 3, lr - 1, 1).setNumberFormat('$#,##0.00');
    } else {
      // Format all columns except the first as currency
      if (lc > 1) sh.getRange(2, 2, lr - 1, lc - 1).setNumberFormat('$#,##0.00');
    }
    sh.getRange(1, 1, 1, lc).setNumberFormat("@"); // Format header row as plain text
  }

  // Add alternating row colors
  if (lr > 2) {
    const ra = sh.getRange(2, 1, lr - 1, lc);
    ra.setBackgrounds(createAlternatingColors(lr - 1, lc));
  }
  
  Logger.log(`Successfully formatted pivot table ${sn}`);
}

/**
 * Summarizes totals according to the date the position was opened for each asset,
 * using only the first four space-delimited strings of the date field.
 *
 * @param {string} ssid - The ID of the summary spreadsheet.
 */
function summarizeByDate(ssid) {
  try {
    const ss = SpreadsheetApp.openById(ssid);
    const ts = ss.getSheetByName('TRADE SUMMARY');
    const summarySheet = ss.insertSheet('SUMMARY BY DATE');

    const dataRange = ts.getDataRange().getValues();
    const dateSummary = {};

    dataRange.forEach((row, index) => {
      if (index < 7) return; // Skip the header rows
      const [assetName, tradeNumber, total, openDate] = row;
      const formattedDate = formatDate(openDate);
      if (!dateSummary[formattedDate]) {
        dateSummary[formattedDate] = 0;
      }
      dateSummary[formattedDate] += total;
    });

    const summaryData = [['Date', 'Total']];
    for (let date in dateSummary) {
      summaryData.push([date, dateSummary[date]]);
    }

    summarySheet.getRange(1, 1, summaryData.length, summaryData[0].length).setValues(summaryData);

    Logger.log('Successfully summarized totals by date.');
  } catch (error) {
    Logger.log(`Error in summarizeByDate: ${error.message}`);
  }
}

/**
 * Formats the date string to only include the first four space-delimited strings.
 *
 * @param {string} dateStr - The full date string from the spreadsheet.
 * @return {string} The formatted date string.
 */
function formatDate(dateStr) {
  try {
    const parts = dateStr.split(' ');
    if (parts.length >= 4) {
      return `${parts[0]} ${parts[1]} ${parts[2]} ${parts[3]}`;
    } else {
      return dateStr; // Return the original date string if it doesn't have at least 4 parts
    }
  } catch (error) {
    Logger.log(`Error formatting date string: ${error.message}`);
    return dateStr; // Return the original date string in case of error
  }
}