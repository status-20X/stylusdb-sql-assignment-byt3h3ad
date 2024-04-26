const parseQuery = require("./queryParser");
const readCSV = require("./csvReader");

async function executeSELECTQuery(query) {
	const { fields, table, whereClause } = parseQuery(query);
	const data = await readCSV(`${table}.csv`);

	const filteredData = whereClause
		? data.filter((row) => {
				const [field, value] = whereClause.split("=").map((s) => s.trim());
				return row[field] === value;
			})
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
