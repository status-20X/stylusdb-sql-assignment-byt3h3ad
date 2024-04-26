const parseQuery = require("./queryParser");
const readCSV = require("./csvReader");

async function executeSELECTQuery(query) {
	const { fields, table } = parseQuery(query);
	const data = await readCSV(`${table}.csv`);

	return data.map((row) => {
		const filteredRow = {};
		for (const field of fields) {
			filteredRow[field] = row[field];
		}
		return filteredRow;
	});
}

module.exports = executeSELECTQuery;
