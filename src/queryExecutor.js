const {
	parseSelectQuery,
	parseInsertQuery,
	parseDeleteQuery,
} = require("./queryParser");
const { readCSV, writeCSV, updateCSV } = require("./csvReader");

const performInnerJoin = (data, joinData, joinCondition, fields, table) => {
	return data.flatMap((mainRow) => {
		return joinData
			.filter((joinRow) => {
				const mainValue = mainRow[joinCondition.left.split(".")[1]];
				const joinValue = joinRow[joinCondition.right.split(".")[1]];
				return mainValue === joinValue;
			})
			.map((joinRow) => {
				return fields.reduce((acc, field) => {
					const [tableName, fieldName] = field.split(".");
					acc[field] =
						tableName === table ? mainRow[fieldName] : joinRow[fieldName];
					return acc;
				}, {});
			});
	});
};

const performLeftJoin = (data, joinData, joinCondition, fields, table) => {
	return data.flatMap((mainRow) => {
		const matchingJoinRows = joinData.filter((joinRow) => {
			const mainValue = getValueFromRow(mainRow, joinCondition.left);
			const joinValue = getValueFromRow(joinRow, joinCondition.right);
			return mainValue === joinValue;
		});
		if (matchingJoinRows.length === 0) {
			return [createResultRow(mainRow, null, fields, table, true)];
		}
		return matchingJoinRows.map((joinRow) =>
			createResultRow(mainRow, joinRow, fields, table, true),
		);
	});
};

const getValueFromRow = (row, compoundFieldName) => {
	const [tableName, fieldName] = compoundFieldName.split(".");
	return row[`${tableName}.${fieldName}`] || row[fieldName];
};

const performRightJoin = (data, joinData, joinCondition, fields, table) => {
	const mainTableRowStructure =
		data.length > 0
			? Object.keys(data[0]).reduce((acc, key) => {
					acc[key] = null;
					return acc;
				}, {})
			: {};

	return joinData.map((joinRow) => {
		const mainRowMatch = data.find((mainRow) => {
			const mainValue = getValueFromRow(mainRow, joinCondition.left);
			const joinValue = getValueFromRow(joinRow, joinCondition.right);
			return mainValue === joinValue;
		});

		const mainRowToUse = mainRowMatch || mainTableRowStructure;
		return createResultRow(mainRowToUse, joinRow, fields, table, true);
	});
};

const createResultRow = (
	mainRow,
	joinRow,
	fields,
	table,
	includeAllMainFields,
) => {
	const resultRow = {};
	if (includeAllMainFields) {
		for (const key of Object.keys(mainRow || {})) {
			const prefixedKey = `${table}.${key}`;
			resultRow[prefixedKey] = mainRow ? mainRow[key] : null;
		}
	}
	for (const field of fields) {
		const [tableName, fieldName] = field.includes(".")
			? field.split(".")
			: [table, field];
		resultRow[field] =
			tableName === table && mainRow
				? mainRow[fieldName]
				: joinRow
					? joinRow[fieldName]
					: null;
	}
	return resultRow;
};

const evaluateCondition = (row, clause) => {
	const { field, operator, value } = clause;
	if (row[field] === undefined) {
		throw new Error(`Invalid field: ${field}`);
	}
	const rowValue = parseValue(row[field]);
	const conditionValue = parseValue(value);
	switch (operator) {
		case "=":
			return rowValue === conditionValue;
		case "!=":
			return rowValue !== conditionValue;
		case ">":
			return rowValue > conditionValue;
		case "<":
			return rowValue < conditionValue;
		case ">=":
			return rowValue >= conditionValue;
		case "<=":
			return rowValue <= conditionValue;
		case "LIKE": {
			const regexPattern = `^${value.slice(1, -1).replace(/%/g, ".*")}$`;
			return new RegExp(regexPattern, "i").test(row[field]);
		}
		default:
			throw new Error(`Unsupported operator: ${operator}`);
	}
};

const parseValue = (value) => {
	if (value === null || value === undefined) {
		return value;
	}
	let modifiedValue = value;
	if (
		typeof modifiedValue === "string" &&
		((modifiedValue.startsWith("'") && modifiedValue.endsWith("'")) ||
			(modifiedValue.startsWith('"') && modifiedValue.endsWith('"')))
	) {
		modifiedValue = value.substring(1, modifiedValue.length - 1);
	}
	if (!isNaN(modifiedValue) && modifiedValue.trim() !== "") {
		return Number(modifiedValue);
	}
	return modifiedValue;
};

const mapColumnsToValues = (columns, values) => {
	const mappedObjects = [];
	const numColumns = columns.length;
	const numValues = values.length;
	if (numValues % numColumns !== 0) {
		throw new Error("Number of values does not match the number of columns.");
	}
	for (let i = 0; i < numValues; i += numColumns) {
		const mappedObject = {};
		for (let j = 0; j < numColumns; j++) {
			const columnName = columns[j].trim();
			const columnIndex = i + j;
			const columnValue = values[columnIndex].replace(/'/g, "");
			mappedObject[columnName] = columnValue;
		}
		mappedObjects.push(mappedObject);
	}

	return mappedObjects;
};

const applyGroupBy = (data, groupByFields, aggregateFunctions) => {
	const groupResults = {};
	for (const row of data) {
		const groupKey = groupByFields.map((field) => row[field]).join("-");
		if (!groupResults[groupKey]) {
			groupResults[groupKey] = { count: 0, sums: {}, mins: {}, maxes: {} };
			for (const field of groupByFields) {
				groupResults[groupKey][field] = row[field];
			}
		}
		groupResults[groupKey].count += 1;
		for (const func of aggregateFunctions) {
			const match = /(\w+)\((\w+)\)/.exec(func);
			if (match) {
				const [, aggFunc, aggField] = match;
				const value = Number.parseFloat(row[aggField]);
				switch (aggFunc.toUpperCase()) {
					case "SUM":
						groupResults[groupKey].sums[aggField] =
							(groupResults[groupKey].sums[aggField] || 0) + value;
						break;
					case "MIN":
						groupResults[groupKey].mins[aggField] = Math.min(
							groupResults[groupKey].mins[aggField] || value,
							value,
						);
						break;
					case "MAX":
						groupResults[groupKey].maxes[aggField] = Math.max(
							groupResults[groupKey].maxes[aggField] || value,
							value,
						);
						break;
				}
			}
		}
	}

	return Object.values(groupResults).map((group) => {
		const finalGroup = {};
		for (const field of groupByFields) {
			finalGroup[field] = group[field];
		}
		for (const func of aggregateFunctions) {
			const match = /(\w+)\((\*|\w+)\)/.exec(func);
			if (match) {
				const [, aggFunc, aggField] = match;
				switch (aggFunc.toUpperCase()) {
					case "SUM":
						finalGroup[func] = group.sums[aggField];
						break;
					case "MIN":
						finalGroup[func] = group.mins[aggField];
						break;
					case "MAX":
						finalGroup[func] = group.maxes[aggField];
						break;
					case "COUNT":
						finalGroup[func] = group.count;
						break;
				}
			}
		}
		return finalGroup;
	});
};

const executeSELECTQuery = async (query) => {
	try {
		const {
			fields,
			table,
			whereClauses,
			joinType,
			joinTable,
			joinCondition,
			groupByFields,
			hasAggregateWithoutGroupBy,
			orderByFields,
			limit,
			isDistinct,
		} = parseSelectQuery(query);
		let data = await readCSV(`${table}.csv`);
		if (joinTable && joinCondition) {
			const joinData = await readCSV(`${joinTable}.csv`);
			switch (joinType.toUpperCase()) {
				case "INNER":
					data = performInnerJoin(data, joinData, joinCondition, fields, table);
					break;
				case "LEFT":
					data = performLeftJoin(data, joinData, joinCondition, fields, table);
					break;
				case "RIGHT":
					data = performRightJoin(data, joinData, joinCondition, fields, table);
					break;
				default:
					throw new Error(`Unsupported JOIN type: ${joinType}`);
			}
		}
		data =
			whereClauses.length > 0
				? data.filter((row) =>
						whereClauses.every((clause) => evaluateCondition(row, clause)),
					)
				: data;
		let groupResults = data;
		if (hasAggregateWithoutGroupBy) {
			const result = {};
			for (const field of fields) {
				const match = /(\w+)\((\*|\w+)\)/.exec(field);
				if (match) {
					const [, aggFunc, aggField] = match;
					switch (aggFunc.toUpperCase()) {
						case "COUNT":
							result[field] = data.length;
							break;
						case "SUM":
							result[field] = data.reduce(
								(acc, row) => acc + Number.parseFloat(row[aggField]),
								0,
							);
							break;
						case "AVG":
							result[field] =
								data.reduce(
									(acc, row) => acc + Number.parseFloat(row[aggField]),
									0,
								) / data.length;
							break;
						case "MIN":
							result[field] = Math.min(
								...data.map((row) => Number.parseFloat(row[aggField])),
							);
							break;
						case "MAX":
							result[field] = Math.max(
								...data.map((row) => Number.parseFloat(row[aggField])),
							);
							break;
					}
				}
			}
			data = [result];
		} else if (groupByFields) {
			groupResults = applyGroupBy(data, groupByFields, fields);
			data = groupResults;
		}
		if (orderByFields) {
			for (const { fieldName, order } of orderByFields) {
				data.sort((a, b) => {
					if (a[fieldName] < b[fieldName]) return order === "ASC" ? -1 : 1;
					if (a[fieldName] > b[fieldName]) return order === "ASC" ? 1 : -1;
				});
			}
		}
		data = data.map((row) => {
			const selectedRow = {};
			for (const field of fields) {
				selectedRow[field] = row[field];
			}
			return selectedRow;
		});
		if (limit !== null) {
			data = data.slice(0, limit);
		}
		if (isDistinct) {
			data = [
				...new Map(
					data.map((item) => [
						fields.map((field) => item[field]).join("|"),
						item,
					]),
				).values(),
			];
		}
		return data;
	} catch (error) {
		console.error("Error executing query:", error);
		throw new Error(`Error executing query: ${error.message}`);
	}
};

const executeINSERTQuery = async (query) => {
	const { type, table, columns, values } = parseInsertQuery(query);
	const writeData = mapColumnsToValues(columns, values);
	return await updateCSV(`${table}.csv`, writeData);
};

const executeDELETEQuery = async (query) => {
	const { table, whereClauses } = parseDeleteQuery(query);
	let data = await readCSV(`${table}.csv`);
	console.log(data);
	if (whereClauses.length > 0) {
		data = data.filter(
			(row) => !whereClauses.every((clause) => evaluateCondition(row, clause)),
		);
		console.log(data);
	} else {
		data = [];
	}
	await writeCSV(`${table}.csv`, data);
	return { message: "Rows deleted successfully." };
};

module.exports = { executeSELECTQuery, executeINSERTQuery, executeDELETEQuery };
