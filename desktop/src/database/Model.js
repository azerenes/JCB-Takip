const { getDb, saveDb } = require('./db');
const { v4: uuidv4 } = require('uuid');

class QueryBuilder {
    constructor(model, filter = {}) {
        this.model = model;
        this._filter = filter;
        this._sort = null;
        this._limit = null;
        this._skip = null;
    }

    sort(sortObj) {
        if (typeof sortObj === 'string') {
            const dir = sortObj.startsWith('-') ? 'DESC' : 'ASC';
            const field = sortObj.replace(/^-/, '');
            this._sort = { field, dir };
        } else if (typeof sortObj === 'object') {
            const entries = Object.entries(sortObj);
            if (entries.length > 0) {
                const [field, val] = entries[0];
                this._sort = { field, dir: val === -1 ? 'DESC' : 'ASC' };
            }
        }
        return this;
    }

    limit(n) { this._limit = n; return this; }
    skip(n) { this._skip = n; return this; }
    select() { return this; }
    lean() { return this; }

    then(resolve, reject) {
        try {
            resolve(this.exec());
        } catch (err) {
            reject(err);
        }
    }

    catch(reject) {
        try { this.exec(); } catch (err) { reject(err); }
    }

    exec() {
        return this.model._find(this._filter, { sort: this._sort, limit: this._limit, skip: this._skip });
    }
}

function escapeId(id) { return `"${id}"`; }

function buildWhere(filter) {
    const clauses = [];
    const params = [];

    if (!filter || Object.keys(filter).length === 0) {
        return { sql: '', params: [] };
    }

    for (const [key, val] of Object.entries(filter)) {
        // Convert Date objects to ISO strings for SQLite
        if (val instanceof Date) {
            params.push(val.toISOString());
            clauses.push(`${escapeId(key)} = ?`);
            continue;
        }
        if (key === '$or' || key === '$and') {
            const op = key === '$or' ? 'OR' : 'AND';
            if (Array.isArray(val)) {
                const subClauses = val.map(sub => {
                    const r = buildWhere(sub);
                    return r.sql ? `(${r.sql})` : '1=1';
                });
                const allParams = val.flatMap(sub => buildWhere(sub).params);
                clauses.push(`(${subClauses.join(` ${op} `)})`);
                params.push(...allParams);
            }
        } else if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
            for (const [op, opVal] of Object.entries(val)) {
                const col = escapeId(key);
                switch (op) {
                    case '$in':
                        if (Array.isArray(opVal) && opVal.length > 0) {
                            clauses.push(`${col} IN (${opVal.map(() => '?').join(',')})`);
                            params.push(...opVal);
                        }
                        break;
                    case '$nin':
                        if (Array.isArray(opVal) && opVal.length > 0) {
                            clauses.push(`${col} NOT IN (${opVal.map(() => '?').join(',')})`);
                            params.push(...opVal);
                        }
                        break;
                    case '$regex':
                        clauses.push(`${col} LIKE ?`);
                        params.push(`%${opVal}%`);
                        break;
                    case '$gte': clauses.push(`${col} >= ?`); params.push(opVal instanceof Date ? opVal.toISOString() : opVal); break;
                    case '$lte': clauses.push(`${col} <= ?`); params.push(opVal instanceof Date ? opVal.toISOString() : opVal); break;
                    case '$gt': clauses.push(`${col} > ?`); params.push(opVal instanceof Date ? opVal.toISOString() : opVal); break;
                    case '$lt': clauses.push(`${col} < ?`); params.push(opVal instanceof Date ? opVal.toISOString() : opVal); break;
                    case '$ne': clauses.push(`${col} != ?`); params.push(opVal); break;
                    default:
                        clauses.push(`${col} = ?`);
                        params.push(typeof opVal === 'object' ? JSON.stringify(opVal) : opVal);
                }
            }
        } else {
            const col = escapeId(key);
            clauses.push(`${col} = ?`);
            params.push(val);
        }
    }

    return { sql: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

function rowsToArray(stmt) {
    const rows = [];
    while (stmt.step()) {
        rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
}

class Model {
    constructor(tableName, data = null) {
        this.tableName = tableName;
        if (data) {
            // Support `new Model({...})` pattern - return a document-like object
            const doc = { ...data, _id: data._id || uuidv4(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            Object.assign(this, doc);
            this._isNewDoc = true;
        }
    }

    // Allow `new` to also work by returning a document
    static _new(tableName, data) {
        const instance = new Model(tableName, data);
        return instance;
    }

    _db() { return getDb(); }
    _save() { saveDb(); }

    _find(filter = {}, options = {}) {
        const db = this._db();
        const { sql, params } = buildWhere(filter);

        let query = `SELECT * FROM ${escapeId(this.tableName)} ${sql}`;
        if (options.sort) {
            query += ` ORDER BY ${escapeId(options.sort.field)} ${options.sort.dir}`;
        }
        if (options.limit) query += ` LIMIT ${options.limit}`;
        if (options.skip) query += ` OFFSET ${options.skip}`;

        const stmt = db.prepare(query);
        stmt.bind(params);
        return rowsToArray(stmt);
    }

    find(filter = {}) {
        return new QueryBuilder(this, filter);
    }

    findOne(filter = {}) {
        const results = this._find(filter, { limit: 1 });
        return results.length > 0 ? this._toDoc(results[0]) : null;
    }

    findById(id) {
        return this.findOne({ _id: id });
    }

    create(data) {
        const db = this._db();
        const doc = { _id: uuidv4(), ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };

        const fields = Object.keys(doc);
        const placeholders = fields.map(() => '?');
        const values = fields.map(f => {
            const v = doc[f];
            if (v !== undefined && v !== null) {
                return typeof v === 'object' ? JSON.stringify(v) : v;
            }
            return null;
        });

        const sql = `INSERT INTO ${escapeId(this.tableName)} (${fields.map(escapeId).join(',')}) VALUES (${placeholders.join(',')})`;
        const stmt = db.prepare(sql);
        stmt.bind(values);
        stmt.step();
        stmt.free();
        this._save();
        return this._toDoc(doc);
    }

    findByIdAndUpdate(id, data) {
        return this.findOneAndUpdate({ _id: id }, data);
    }

    findOneAndUpdate(filter, data) {
        const existing = this.findOne(filter);
        if (!existing) return null;
        return this._update(existing._id, data);
    }

    _update(id, data) {
        const db = this._db();
        const sets = [];
        const params = [];

        let fields = data;
        if (data.$set || data.$unset || data.$inc) {
            fields = {};
            if (data.$set) Object.assign(fields, data.$set);
            if (data.$inc) {
                for (const [k, v] of Object.entries(data.$inc)) {
                    fields[k] = () => `${escapeId(k)} + ${v}`;
                }
            }
            if (data.$unset) {
                for (const k of Object.keys(data.$unset)) fields[k] = null;
            }
        }

        for (const [key, val] of Object.entries(fields)) {
            if (key === '_id' || key === 'createdAt') continue;
            if (typeof val === 'function') {
                sets.push(`${escapeId(key)} = ${val()}`);
            } else {
                sets.push(`${escapeId(key)} = ?`);
                params.push(val !== null && typeof val === 'object' ? JSON.stringify(val) : val);
            }
        }

        if (sets.length === 0) return this.findById(id);

        sets.push(`${escapeId('updatedAt')} = ?`);
        params.push(new Date().toISOString());
        params.push(id);

        const stmt = db.prepare(`UPDATE ${escapeId(this.tableName)} SET ${sets.join(',')} WHERE ${escapeId('_id')} = ?`);
        stmt.bind(params);
        stmt.step();
        stmt.free();
        this._save();
        return this.findById(id);
    }

    updateOne(filter, data) {
        const existing = this.findOne(filter);
        if (!existing) return { matchedCount: 0, modifiedCount: 0 };
        this._update(existing._id, data);
        return { matchedCount: 1, modifiedCount: 1 };
    }

    updateMany(filter, data) {
        const db = this._db();
        const { sql, params } = buildWhere(filter);
        const sets = [];
        const setParams = [];

        for (const [key, val] of Object.entries(data)) {
            if (key === '_id' || key === 'createdAt') continue;
            sets.push(`${escapeId(key)} = ?`);
            setParams.push(val !== null && typeof val === 'object' ? JSON.stringify(val) : val);
        }

        if (sets.length === 0) return { matchedCount: 0, modifiedCount: 0 };

        sets.push(`${escapeId('updatedAt')} = ?`);
        setParams.push(new Date().toISOString());

        const stmt = db.prepare(`UPDATE ${escapeId(this.tableName)} SET ${sets.join(',')} ${sql}`);
        stmt.bind([...setParams, ...params]);
        stmt.step();
        stmt.free();
        this._save();
        return { matchedCount: 1, modifiedCount: 1 };
    }

    findByIdAndDelete(id) {
        const doc = this.findById(id);
        if (doc) this.deleteOne({ _id: id });
        return doc;
    }

    deleteOne(filter) {
        const db = this._db();
        const { sql, params } = buildWhere(filter);
        const stmt = db.prepare(`DELETE FROM ${escapeId(this.tableName)} ${sql}`);
        stmt.bind(params);
        stmt.step();
        stmt.free();
        this._save();
        return { deletedCount: 1 };
    }

    deleteMany(filter) {
        const db = this._db();
        const { sql, params } = buildWhere(filter);
        const stmt = db.prepare(`DELETE FROM ${escapeId(this.tableName)} ${sql}`);
        stmt.bind(params);
        stmt.step();
        stmt.free();
        this._save();
        return { deletedCount: 1 };
    }

    countDocuments(filter = {}) {
        const db = this._db();
        const { sql, params } = buildWhere(filter);
        const stmt = db.prepare(`SELECT COUNT(*) as count FROM ${escapeId(this.tableName)} ${sql}`);
        stmt.bind(params);
        stmt.step();
        const row = stmt.getAsObject();
        stmt.free();
        return row ? row.count : 0;
    }

    distinct(field, filter = {}) {
        const db = this._db();
        const { sql, params } = buildWhere(filter);
        const stmt = db.prepare(`SELECT DISTINCT ${escapeId(field)} FROM ${escapeId(this.tableName)} ${sql}`);
        stmt.bind(params);
        const rows = rowsToArray(stmt);
        return rows.map(r => r[field]);
    }

    aggregate(pipeline) {
        if (!pipeline || pipeline.length === 0) return [];

        let results = this._find({});

        for (const stage of pipeline) {
            if (stage.$match) {
                results = results.filter(row => {
                    for (const [key, val] of Object.entries(stage.$match)) {
                        if (typeof val === 'object') {
                            if (val.$gte !== undefined && row[key] < val.$gte) return false;
                            if (val.$lte !== undefined && row[key] > val.$lte) return false;
                            if (val.$ne !== undefined && row[key] === val.$ne) return false;
                            if (val.$in && !val.$in.includes(row[key])) return false;
                        } else {
                            if (row[key] !== val) return false;
                        }
                    }
                    return true;
                });
            }
            if (stage.$group) {
                const groups = {};
                for (const row of results) {
                    let key;
                    if (typeof stage.$group._id === 'string') {
                        key = row[stage.$group._id.replace('$', '')];
                    } else if (typeof stage.$group._id === 'object') {
                        key = Object.values(stage.$group._id).map(v => row[v.replace('$', '')]).join('|');
                    } else {
                        key = null;
                    }
                    if (!groups[key]) groups[key] = {};
                    const g = groups[key];
                    for (const [k, v] of Object.entries(stage.$group)) {
                        if (k === '_id') continue;
                        if (v.$sum) {
                            const val = v.$sum === 1 ? 1 : (row[v.$sum.replace('$', '')] || 0);
                            g[k] = (g[k] || 0) + val;
                        }
                        if (v.$avg) {
                            const field = v.$avg.replace('$', '');
                            if (!g[k]) g[k] = { sum: 0, count: 0 };
                            g[k].sum += (row[field] || 0);
                            g[k].count += 1;
                        }
                        if (v.$first) {
                            const field = v.$first.replace('$', '');
                            if (!(k in g)) g[k] = row[field];
                        }
                    }
                }
                results = Object.entries(groups).map(([key, val]) => {
                    const doc = { _id: key || null };
                    for (const [k, v] of Object.entries(val)) {
                        if (v && typeof v === 'object' && 'sum' in v) {
                            doc[k] = v.count > 0 ? v.sum / v.count : 0;
                        } else {
                            doc[k] = v;
                        }
                    }
                    return doc;
                });
            }
            if (stage.$sort) {
                const [field, dir] = Object.entries(stage.$sort)[0];
                results.sort((a, b) => dir === -1 ? (b[field] || 0) - (a[field] || 0) : (a[field] || 0) - (b[field] || 0));
            }
            if (stage.$limit) results = results.slice(0, stage.$limit);
            if (stage.$skip) results = results.slice(stage.$skip);
        }
        return results;
    }

    _getDbColumns() {
        // Get actual column names from the table
        try {
            const db = this._db();
            const stmt = db.prepare(`PRAGMA table_info(${escapeId(this.tableName)})`);
            stmt.bind();
            const cols = [];
            while (stmt.step()) {
                cols.push(stmt.getAsObject().name);
            }
            stmt.free();
            return cols;
        } catch (e) {
            return [];
        }
    }

    _attachSave(doc) {
        if (!doc || typeof doc !== 'object') return doc;
        const self = this;
        const dbCols = this._getDbColumns();
        // Store a clean reference of only DB columns for accurate diff
        const dbSnapshot = {};
        for (const col of dbCols) {
            if (col in doc) dbSnapshot[col] = doc[col];
        }

        doc.save = function () {
            if (doc._isNewDoc) {
                const data = {};
                for (const key of Object.keys(doc)) {
                    if (key === 'save' || key === '_isNewDoc') continue;
                    data[key] = doc[key];
                }
                return self.create(data);
            }
            // Compare only DB columns to detect real changes
            const diff = {};
            for (const col of dbCols) {
                if (col === '_id' || col === 'createdAt') continue;
                const before = JSON.stringify(dbSnapshot[col]);
                const after = JSON.stringify(doc[col]);
                if (before !== after) {
                    diff[col] = doc[col];
                }
            }
            if (Object.keys(diff).length > 0) {
                return self._update(doc._id, diff);
            }
            return doc;
        };
        return doc;
    }

    _toDoc(row) {
        if (!row) return null;
        const doc = this._attachSave({ ...row });
        doc.isOnline = !!doc.isOnline;
        doc.isSuperAdmin = !!doc.isSuperAdmin;
        doc.isActive = !!doc.isActive;
        doc.setupComplete = !!doc.setupComplete;
        doc.acknowledged = !!doc.acknowledged;
        doc.isUsed = !!doc.isUsed;
        doc.enabled = !!doc.enabled;
        doc.ignition = !!doc.ignition;
        doc.lastIgnition = !!doc.lastIgnition;
        try {
            if (typeof doc.permissions === 'string') doc.permissions = JSON.parse(doc.permissions);
            if (typeof doc.coordinates === 'string') doc.coordinates = JSON.parse(doc.coordinates);
        } catch (e) {}
        return doc;
    }
}

module.exports = Model;

