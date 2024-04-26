const parseQuery = (query) => {
	const r = /SELECT (.+?) FROM (.+?)(?: WHERE (.*))?$/;
	const match = query.match(r);

	if (match) {
		const [, fields, table, whereClause] = match;
		return {
			fields: fields.split(",").map((field) => field.trim()),
			table: table.trim(),
			whereClause: whereClause ? whereClause.trim() : null,
		};
	}
};

module.exports = parseQuery;
