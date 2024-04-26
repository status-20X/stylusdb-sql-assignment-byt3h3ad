const parseQuery = require("./queryParser");
const readCSV = require("./csvReader");

async function executeSELECTQuery(query) {
	const { fields, table, whereClauses } = parseQuery(query);
	const data = await readCSV(`${table}.csv`);

	const filteredData = whereClauses.length > 0
        ? data.filter(row => whereClauses.every(clause => {
            return row[clause.field] === clause.value;
        }))
        : data;

	return filteredData.map((row) => {
		const filteredRow = {};
		for (const field of fields) {
			filteredRow[field] = row[field];
		}
		return filteredRow;
	});
}

module.exports = executeSELECTQuery;
