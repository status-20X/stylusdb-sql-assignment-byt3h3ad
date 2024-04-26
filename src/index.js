const parseQuery = require("./queryParser");
const readCSV = require("./csvReader");

async function executeSELECTQuery(query) {
	const { fields, table, where } = parseQuery(query);
	const data = await readCSV(`${table}.csv`);

	const filteredData = where
		? data.filter((row) => {
				const [field, value] = where.split("=").map((s) => s.trim());
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
