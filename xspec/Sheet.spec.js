"use strict";

var proxyquire = require("proxyquire").noCallThru();


var findChildNodes = function (node, tag) {
    var result = [];
    for (var childNodeIndex in node.childNodes) {
        if (node.childNodes.hasOwnProperty(childNodeIndex)) {
            var childNode = node.childNodes[childNodeIndex];
            if (childNode.tagName === tag) {
                result.push(childNode);
            }
        }
    }
    return result;
};

var getNodeText = function (node) {
    if (node.childNodes.length === 1) {
        return node.childNodes[0].nodeValue;
    }
    return null;
};

var getNodeAttribute = function (node, attribute) {
    return node.getAttribute(attribute);
};

describe("Sheet", function () {
    var Row, Sheet  // Classes
    var workbook, sheetNode, sheetXML, row, sheet // Instances

    beforeEach(function () {
        Row = jasmine.createSpy("Row");
        Sheet = proxyquire("../lib/Sheet", { "./Row": Row });

        workbook = {};
        sheetXML = '<sheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" name="Sheet1" sheetId="1"/>';
        sheetXML = '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"/></sheetData></worksheet>';

        row = jasmine.createSpyObj("Row", ["sheet", "rowNumber"]);
        row.sheet.and.callFake(function () { return sheet; });
        row.rowNumber.and.callFake(function () { return 1; });
        Row.and.returnValue(row);

        sheet = new Sheet(...);  // TODO
    });

    describe("workbook", function () {
        it("should throw an error if a value is provided", function () {
            expect(function () { sheet.workbook('foo') }).toThrow();
        });
        it("should return the workbook", function () {
            expect(sheet.workbook()).toBe(workbook);
        });
    });

    describe("name", function () {
        it("should return the sheet name", function () {
            expect(sheet.name()).toBe("Sheet1");
        });
        it("should set the sheet name and return the same sheet", function () {
            expect(sheet.name("foo")).toBe(sheet);
            expect(sheet.name()).toBe("foo");
        });
    })

    describe("row", function () {
        it("should use an existing row node if it exists", function () {
            sheet.row(1);
            expect(Row).not.toHaveBeenCalled();
            //expect(sheet._sheetDataNode.childNodes.length).toEqual(1);
            expect(sheet._rows.length).toEqual(1);
            //expect(sheet._xml.toString()).toEqual('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"/></sheetData></worksheet>');
        });
        it("should create a new row node if it does not exist", function () {
            sheet.row(3);
            expect(Row).toHaveBeenCalled();
            expect(Row.calls.count()).toEqual(1);
            //expect(sheet._sheetDataNode.childNodes.length).toEqual(2);
            expect(sheet._rows.length).toEqual(2);
            //expect(sheet._xml.toString()).toEqual('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"/><row r="3"/></sheetData></worksheet>');
        });
        it('should create rows in order', function () {
            sheet.row(3);
            sheet.row(2);
            expect(Row).toHaveBeenCalled();
            expect(Row.calls.count()).toEqual(2);
            //expect(sheet._sheetDataNode.childNodes.length).toEqual(3);
            expect(sheet._rows.length).toEqual(3);
            //expect(sheet._xml.toString()).toBe('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"/><row r="2"/><row r="3"/></sheetData></worksheet>');
        });
    });

    xdescribe("cell", function () {
        var getCell;
        beforeEach(function () {
            getCell = jasmine.createSpy("getCell");
            sheet.row = jasmine.createSpy("row").and.returnValue({ getCell: getCell });
        });

        it("should call row and cell with the given row and column", function () {
            sheet.cell(5, 7);
            expect(sheet.row).toHaveBeenCalledWith(5);
            expect(getCell).toHaveBeenCalledWith(7);
        });

        it("should call row and cell with the row and column corresponding to the given address", function () {
            sheet.cell("H11");
            expect(sheet.row).toHaveBeenCalledWith(11);
            expect(getCell).toHaveBeenCalledWith(8);
        });

        it("should call row and cell with the row and column corresponding to a lowercase address", function () {
            sheet.cell("g9");
            expect(sheet.row).toHaveBeenCalledWith(9);
            expect(getCell).toHaveBeenCalledWith(7);
        });
    });

    xdescribe("cell (advanced test)", function () {
        var workbook, sheet;
        beforeEach(function () {
            workbook = Workbook.fromBlankSync();
            sheet = workbook.sheet(0);
        });

        describe("deterministic access", function () {
            it("correctly maps to the same cell", function () {
                var upperCaseCell = sheet.cell("A1");
                var lowerCaseCell = sheet.cell("a1");
                var rowAndColumnCell = sheet.cell(1, 1);
                expect(upperCaseCell.fullAddress()).toBe(lowerCaseCell.fullAddress());
                expect(upperCaseCell.fullAddress()).toBe(rowAndColumnCell.fullAddress());
                var num = Math.random();
                upperCaseCell.value(num);
                var upperCaseVNode = findChildNodes(upperCaseCell._node, "v")[0];
                var lowerCaseVNode = findChildNodes(lowerCaseCell._node, "v")[0];
                var rowAndColumnVNode = findChildNodes(rowAndColumnCell._node, "v")[0];
                expect(upperCaseVNode).not.toBeNull("A1 value node should not be null");
                expect(lowerCaseVNode).not.toBeNull("a1 value node should not be null");
                expect(rowAndColumnVNode).not.toBeNull("1,1 value node should not be null");
                expect(getNodeText(upperCaseVNode)).toBe(getNodeText(lowerCaseVNode));
                expect(getNodeText(upperCaseVNode)).toBe(getNodeText(rowAndColumnVNode));
                expect(parseFloat(getNodeText(upperCaseVNode))).toBe(num, "A1 value set must match value generated");
                expect(parseFloat(getNodeText(lowerCaseVNode))).toBe(num, "a1 value set must match value generated");
                expect(parseFloat(getNodeText(rowAndColumnVNode))).toBe(num, "1,1 value set must match value generated");
            });
        });

        xdescribe("stochastic access", function () {
            var MAX_ROW = 100;
            var MAX_COLUMN = 100;
            var MAX_EDIT = 1000;

            beforeEach(function () {
                // Make random edits to the sheet
                for (var i = 0; i < MAX_EDIT; i++) {
                    var rowNumber = 1 + Math.floor(MAX_ROW * Math.random());
                    var columnNumber = 1 + Math.floor(MAX_COLUMN * Math.random());
                    var cell = sheet.cell(rowNumber, columnNumber);
                    cell.value(Math.random());
                }
            });

            it("is stored in order", function () {
                // Reload workbook and sheet
                workbook = new Workbook(workbook.output());
                sheet = workbook.sheet(0);

                // Check order
                var lastRowNumber = 0;
                var sheetDataNode = findChildNodes(sheet._sheetXML, "sheetData")[0];
                var rowNodes = findChildNodes(sheetDataNode, "row");
                expect(rowNodes.length).toBeGreaterThan(0, "Rows must exist after workbook reload");
                rowNodes.forEach(function (rowNode) {
                    var rowNumber = parseInt(getNodeAttribute(rowNode, "r"));
                    expect(isNaN(rowNumber)).toBe(false);
                    expect(rowNumber).toBeGreaterThan(lastRowNumber);
                    lastRowNumber = rowNumber;
                    var lastColumnNumber = 0;
                    var cNodes = findChildNodes(rowNode, "c");
                    cNodes.forEach(function (cNode) {
                        var address = getNodeAttribute(cNode, "r");
                        expect(address).toBeDefined();
                        var ref = utils.addressToRowAndColumn(address);
                        expect(ref.row).toBe(rowNumber);
                        expect(ref.column).toBeGreaterThan(lastColumnNumber);
                        lastColumnNumber = ref.column;
                    });
                });
            });

            it("does not contain duplicates", function () {
                var addressCounter = {};
                var sheetDataNode = findChildNodes(sheet._sheetXML, "sheetData")[0];
                var rowNodes = findChildNodes(sheetDataNode, "row");
                expect(rowNodes.length).toBeGreaterThan(0, "Rows must exist");
                rowNodes.forEach(function (rowNode) {
                    var cNodes = findChildNodes(rowNode, "c");
                    cNodes.forEach(function (cNode) {
                        var address = getNodeAttribute(cNode, "r");
                        expect(address).not.toBeNull();
                        expect(address).toBeDefined();
                        if (address in addressCounter === false) {
                            addressCounter[address] = 0;
                        }
                        addressCounter[address]++;
                    });
                });
                for (var address in addressCounter) {
                    if (addressCounter.hasOwnProperty(address)) {
                        expect(addressCounter[address]).toBeLessThan(2);
                    }
                }
            });
        });
    });
});
