# Trade Summary and Analysis Script

## Overview

This script processes multiple Google Sheets files containing trade data, consolidates the information into a summary spreadsheet, and generates various pivot tables for analysis. Additionally, it includes functionality to summarize totals by the date a position was opened for each asset.

## Features

- Consolidates trade data from multiple Google Sheets files
- Generates a summary sheet with statistical information and pivot tables
- Summarizes totals according to the date a position was opened
- Formats the summary and date sheets for better readability

## Prerequisites

- Google Apps Script
- Google Drive API (Advanced Drive Service enabled)

## Configuration

Update the `config` object in the script with the appropriate folder IDs and settings:

```javascript
const config = {
  production: false, // Set to false for testing, true for production use
  testfolder: 'your_test_folder_id', // ID of the folder containing test data
  realfolder: 'your_production_folder_id', // ID of the folder containing production data
  dumpfolder: 'your_dump_folder_id', // ID of the folder where the summary spreadsheet will be saved
  textsearch: 'Total' // The text to search for in each sheet to find the total trade value
};
```

## Usage

1. Set up the config object with the appropriate folder IDs:
   - `testfolder`: ID of the folder containing test data
   - `realfolder`: ID of the folder containing production data
   - `dumpfolder`: ID of the folder where the summary spreadsheet will be saved

2. Set the `production` flag in the config object:
   - `false`: Runs the script on the test folder
   - `true`: Runs the script on the real (production) folder

3. Ensure the `textsearch` value in the config object matches the label for the total trade value in your sheets

4. Run the `processFolder` function to execute the script. The script will:
   - Create a new spreadsheet in the specified dump folder
   - Generate a summary sheet of all processed trades
   - Create multiple pivot tables for different analyses
   - Summarize totals by the date a position was opened

## Functions

### `processFolder()`
Main function to process spreadsheets in a specified folder and generate a summary report.

### `setupSummarySheet(summarysheet)`
Sets up the summary sheet with headers and formatting.

### `processInputFile(ipssid, opssid)`
Processes each sheet in the input spreadsheet and returns rows to append.

### `stringSearch(sheet, textsearch)`
Searches for a specific string in a given sheet and returns the value in the adjacent cell.

### `formatSummarySheet(sheet)`
Applies formatting to the summary sheet.

### `createAlternatingColors(numRows, numCols)`
Creates an array of alternating background colors for rows.

### `createPivotTables(ssid)`
Creates pivot tables in a new sheet within the specified spreadsheet for different statistical functions.

### `createPivotTable(ssid, sheetName, rowGroupIndex, colGroupIndex, pivotFunction)`
Creates a pivot table in a new sheet within the specified spreadsheet.

### `createSummaryPivotTable(ssid)`
Creates a summary pivot table in a new sheet within the specified spreadsheet.

### `formatPivotTable(sh, formatAsCurrency)`
Applies formatting to a pivot table.

### `summarizeByDate(ssid)`
Summarizes totals according to the date the position was opened for each asset, using only the date part of the format "6/6/2024 12:37:38".

### `formatDate(dateStr)`
Formats the date string to only include the date part from "6/6/2024 12:37:38".

## Notes

- This script requires the 'Drive API' Advanced Drive Service to be enabled
- Ensure your Google Sheets files follow a consistent structure for accurate processing

## License

This project is licensed under the BSD 3-Clause License. See the separate LICENSE file for details.