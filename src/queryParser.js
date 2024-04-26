const parseWhereClause = (whereString) => {
	const conditionRegex = /(.*?)(=|!=|>|<|>=|<=)(.*)/;
	return whereString.split(/ AND | OR /i).map((conditionString) => {
		const match = conditionString.match(conditionRegex);
		if (match) {
			const [, field, operator, value] = match;
			return { field: field.trim(), operator, value: value.trim() };
		}
		throw new Error("Invalid WHERE clause format");
	});
};

const parseQuery = (query) => {
	const r = /SELECT (.+?) FROM (.+?)(?: WHERE (.*))?$/;
	const match = query.match(r);

	if (match) {
		const [, fields, table, whereString] = match;
		const whereClauses = whereString ? parseWhereClause(whereString) : [];
		return {
			fields: fields.split(",").map((field) => field.trim()),
			table: table.trim(),
			whereClauses,
		};
	}
};

module.exports = parseQuery;
