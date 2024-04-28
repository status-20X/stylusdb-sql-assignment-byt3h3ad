const parseSelectQuery = (query) => {
	try {
		let trimmedQuery = query.trim();
		let isDistinct = false;
		if (trimmedQuery.toUpperCase().includes("SELECT DISTINCT")) {
			isDistinct = true;
			trimmedQuery = trimmedQuery.replace("SELECT DISTINCT", "SELECT");
		}
		const limitSplit = trimmedQuery.split(/\sLIMIT\s/i);
		const queryWithoutlimit = limitSplit[0];
		const limit =
			limitSplit.length > 1 ? Number.parseInt(limitSplit[1].trim()) : null;
		const orderBySplit = queryWithoutlimit.split(/\sORDER BY\s/i);
		const queryWithoutOrderBy = orderBySplit[0];
		const orderByFields =
			orderBySplit.length > 1
				? orderBySplit[1]
						.trim()
						.split(",")
						.map((field) => {
							const [fieldName, order] = field.trim().split(/\s+/);
							return { fieldName, order: order ? order.toUpperCase() : "ASC" };
						})
				: null;
		const groupBySplit = queryWithoutOrderBy.split(/\sGROUP BY\s/i);
		const queryWithoutGroupBy = groupBySplit[0];
		const groupByFields =
			groupBySplit.length > 1
				? groupBySplit[1]
						.trim()
						.split(",")
						.map((field) => field.trim())
				: null;
		const whereSplit = queryWithoutGroupBy.split(/\sWHERE\s/i);
		const queryWithoutWhere = whereSplit[0];
		const whereClause = whereSplit.length > 1 ? whereSplit[1].trim() : null;
		const joinSplit = queryWithoutWhere.split(/\s(INNER|LEFT|RIGHT) JOIN\s/i);
		const selectPart = joinSplit[0].trim();
		const selectRegex = /^SELECT\s(.+?)\sFROM\s(.+)/i;
		const selectMatch = selectPart.match(selectRegex);
		if (!selectMatch) {
			throw new Error(
				"Error executing query: Query parsing error: Invalid SELECT format",
			);
		}
		const [, fields, table] = selectMatch;
		const { joinType, joinTable, joinCondition } =
			parseJoinClause(queryWithoutWhere);
		let whereClauses = [];
		if (whereClause) {
			whereClauses = parseWhereClause(whereClause);
		}
		const aggregateFunctionRegex =
			/(\bCOUNT\b|\bAVG\b|\bSUM\b|\bMIN\b|\bMAX\b)\s*\(\s*(\*|\w+)\s*\)/i;
		const hasAggregateWithoutGroupBy =
			aggregateFunctionRegex.test(query) && !groupByFields;
		return {
			fields: fields.split(",").map((field) => field.trim()),
			table: table.trim(),
			whereClauses,
			joinType,
			joinTable,
			joinCondition,
			groupByFields,
			hasAggregateWithoutGroupBy,
			orderByFields,
			limit,
			isDistinct,
		};
	} catch (error) {
		console.log(error);
		throw new Error(`Query parsing error: ${error.message}`);
	}
};

const parseInsertQuery = (query) => {
	const insertRegex = /INSERT INTO (\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/;
	const inserMatch = query.match(insertRegex);
	if (inserMatch) {
		const [, table, columns, values] = inserMatch;
		const columnList = columns.split(",").map((field) => field.trim());
		const valueList = values.match(/'([^']+)'/g).map((val) => val);
		return {
			type: "INSERT",
			table: table.trim(),
			columns: columnList,
			values: valueList,
		};
	}
	console.log("No match found");
	throw new Error("Query Parsing Error : INSERT Query has inavlid format.");
};

const parseDeleteQuery = (query) => {
	const deleteRegex = /DELETE FROM\s+(\w+)\s+WHERE\s+(.+)/;
	const deleteMatch = query.match(deleteRegex);
	if (deleteMatch) {
		const [, table, whereString] = deleteMatch;
		const whereClauses = parseWhereClause(whereString);
		return {
			type: "DELETE",
			table,
			whereClauses,
		};
	}
	throw new Error("Query Parsing Error: Invalid DELETE format");
};

const parseWhereClause = (whereString) => {
	const conditionRegex = /(.*?)(=|!=|>|<|>=|<=)(.*)/;
	return whereString.split(/ AND | OR /i).map((conditionString) => {
		if (conditionString.includes("LIKE")) {
			const [field, pattern] = conditionString.split(/\sLIKE\s/i);
			return { field: field.trim(), operator: "LIKE", value: pattern.trim() };
		}
		const match = conditionString.match(conditionRegex);
		if (match) {
			const [, field, operator, value] = match;
			return { field: field.trim(), operator, value: value.trim() };
		}
		throw new Error("Invalid WHERE clause format");
	});
};

const parseJoinClause = (query) => {
	const joinRegex =
		/\s(INNER|LEFT|RIGHT) JOIN\s(.+?)\sON\s([\w.]+)\s*=\s*([\w.]+)/i;
	const joinMatch = query.match(joinRegex);

	if (joinMatch) {
		return {
			joinType: joinMatch[1].trim(),
			joinTable: joinMatch[2].trim(),
			joinCondition: {
				left: joinMatch[3].trim(),
				right: joinMatch[4].trim(),
			},
		};
	}

	return {
		joinType: null,
		joinTable: null,
		joinCondition: null,
	};
};

module.exports = {
	parseSelectQuery,
	parseJoinClause,
	parseInsertQuery,
	parseDeleteQuery,
};
