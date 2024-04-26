const parseWhereClause = (whereString) => {
	const conditions = whereString.split(/ AND | OR /);
	return conditions.map((condition) => {
		const [field, operator, value] = condition.split(/\s+/);
		return { field, operator, value };
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
