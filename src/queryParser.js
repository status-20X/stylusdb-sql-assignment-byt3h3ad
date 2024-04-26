const parseQuery = (query) => {
	const r = /SELECT (.+?) FROM (.+?)(?: WHERE (.*))?$/;
	const match = query.match(r);

	if (match) {
		const [, fields, table, where] = match;
		return {
			fields: fields.split(",").map((field) => field.trim()),
			table: table.trim(),
			where: where ? where.trim() : null,
		};
	}
};

module.exports = parseQuery;
