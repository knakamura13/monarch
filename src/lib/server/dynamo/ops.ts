import {
    DeleteCommand,
    GetCommand,
    PutCommand,
    QueryCommand,
    ScanCommand,
    TransactWriteCommand,
    UpdateCommand,
    type QueryCommandInput,
    type ScanCommandInput
} from '@aws-sdk/lib-dynamodb';
import { ENV } from '$lib/server/env';

const isTest = Boolean(process.env.VITEST) || process.env.NODE_ENV === 'test';
const useMem = isTest;

type Key = { PK: string; SK: string };
type AnyItem = Record<string, unknown> & Key;

const globalForMem = globalThis as unknown as { __ddbMem?: Map<string, AnyItem> };
function memStore() {
    if (!globalForMem.__ddbMem) globalForMem.__ddbMem = new Map();
    return globalForMem.__ddbMem;
}

function keyStr(k: Key) {
    return `${k.PK}||${k.SK}`;
}

// DynamoDB has no native Date type and the DocumentClient marshaller rejects
// class instances by default. Normalize any Date we see into an ISO string so
// callers (domain services, Better Auth adapter, future code) never have to
// think about it. Plain Date values round-trip back as ISO strings; adapters
// that expect Date objects are responsible for parsing them on read.
function normalize<T>(value: T): T {
    if (value instanceof Date) return value.toISOString() as unknown as T;
    if (Array.isArray(value)) return value.map(normalize) as unknown as T;
    if (value && typeof value === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            if (v === undefined) continue;
            Reflect.set(out, k, normalize(v));
        }
        return out as T;
    }
    return value;
}

async function getLive() {
    const mod = await import('./client');
    return { ddb: mod.ddb, tableName: ENV.DYNAMO_TABLE };
}

export async function ddbPut(item: Record<string, unknown>) {
    const normalized = normalize(item) as Record<string, unknown>;
    if (useMem) {
        const it = normalized as AnyItem;
        memStore().set(keyStr({ PK: it.PK, SK: it.SK }), it);
        return;
    }
    const { ddb, tableName } = await getLive();
    return ddb.send(new PutCommand({ TableName: tableName, Item: normalized }));
}

export async function ddbGet<T>(key: { PK: string; SK: string }) {
    if (useMem) {
        return memStore().get(keyStr(key)) as T | undefined;
    }
    const { ddb, tableName } = await getLive();
    const res = await ddb.send(new GetCommand({ TableName: tableName, Key: key }));
    return (res.Item as T | undefined) ?? undefined;
}

export async function ddbUpdate<T>(
    key: { PK: string; SK: string },
    updateExpression: string,
    expressionAttributeValues: Record<string, unknown>,
    expressionAttributeNames?: Record<string, string>
) {
    expressionAttributeValues = normalize(expressionAttributeValues) as Record<string, unknown>;
    if (useMem) {
        const store = memStore();
        const cur = store.get(keyStr(key));
        if (!cur) return undefined;
        // Minimal parser for `SET a = :x, b = :y` style updates.
        const setPrefix = updateExpression.trim().startsWith('SET') ? updateExpression.trim().slice(3) : '';
        const assignments = setPrefix
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        for (const a of assignments) {
            const [lhsRaw, rhsRaw] = a.split('=').map((s) => s.trim());
            if (!lhsRaw || !rhsRaw) continue;
            const field = (expressionAttributeNames ? Reflect.get(expressionAttributeNames, lhsRaw) : undefined) ?? (lhsRaw.startsWith('#') ? lhsRaw.slice(1) : lhsRaw);
            const val = Reflect.get(expressionAttributeValues, rhsRaw);
            Reflect.set(cur as Record<string, unknown>, field, val);
        }
        store.set(keyStr(key), cur);
        return cur as unknown as T;
    }
    const { ddb, tableName } = await getLive();
    const res = await ddb.send(
        new UpdateCommand({
            TableName: tableName,
            Key: key,
            UpdateExpression: updateExpression,
            ExpressionAttributeValues: expressionAttributeValues,
            ExpressionAttributeNames: expressionAttributeNames,
            ReturnValues: 'ALL_NEW'
        })
    );
    return res.Attributes as T | undefined;
}

export async function ddbDelete(key: { PK: string; SK: string }) {
    if (useMem) {
        memStore().delete(keyStr(key));
        return;
    }
    const { ddb, tableName } = await getLive();
    return ddb.send(new DeleteCommand({ TableName: tableName, Key: key }));
}

export async function ddbQuery<T>(input: Omit<QueryCommandInput, 'TableName'>) {
    if (useMem) {
        const items = Array.from(memStore().values());
        // SUPPORTED QUERY PATTERNS (in-memory test mode):
        // - PK equality (via :pk)
        // - SK begins_with prefix (via :prefix)
        // - SK equality (via :sk)
        // - GSI1PK equality when IndexName === 'GSI1' (via :pk)
        // - ScanIndexForward for descending sort
        // - Limit for result truncation
        //
        // NOTE: If you add a new query pattern to production code, you MUST
        // update this in-memory implementation to match. Otherwise tests may
        // pass but production will fail.
        const vals = (input.ExpressionAttributeValues ?? {}) as Record<string, unknown>;
        if (input.IndexName === 'GSI1') {
            const pk = Reflect.get(vals, ':pk');
            return items.filter((it) => it.GSI1PK === pk) as unknown as T[];
        }
        const pk = Reflect.get(vals, ':pk');
        const prefix = Reflect.get(vals, ':prefix');
        const skEq = Reflect.get(vals, ':sk');
        let out = items.filter((it) => it.PK === pk);
        if (typeof skEq === 'string') out = out.filter((it) => it.SK === skEq);
        else if (typeof prefix === 'string') out = out.filter((it) => String(it.SK).startsWith(prefix));
        if (input.ScanIndexForward === false) out = out.slice().sort((a, b) => String(b.SK).localeCompare(String(a.SK)));
        if (typeof input.Limit === 'number') out = out.slice(0, input.Limit);
        return out as unknown as T[];
    }
    const { ddb, tableName } = await getLive();
    const res = await ddb.send(new QueryCommand({ ...input, TableName: tableName }));
    return (res.Items as T[]) ?? [];
}

type TransactPut = { Put: { Item: Record<string, unknown> } };
type TransactUpdate = {
    Update: {
        Key: Key;
        UpdateExpression: string;
        ExpressionAttributeValues: Record<string, unknown>;
        ExpressionAttributeNames?: Record<string, string>;
        ConditionExpression?: string;
    };
};
type TransactDelete = { Delete: { Key: Key; ConditionExpression?: string } };
export type TransactItem = TransactPut | TransactUpdate | TransactDelete;

function applyTransactItemToMem(item: TransactItem) {
    const store = memStore();
    if ('Put' in item) {
        const it = item.Put.Item as AnyItem;
        store.set(keyStr({ PK: it.PK, SK: it.SK }), it);
        return;
    }
    if ('Update' in item) {
        const cur = store.get(keyStr(item.Update.Key));
        if (!cur) return;
        const setPrefix = item.Update.UpdateExpression.trim().startsWith('SET') ? item.Update.UpdateExpression.trim().slice(3) : '';
        const assignments = setPrefix
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        for (const a of assignments) {
            const [lhsRaw, rhsRaw] = a.split('=').map((s) => s.trim());
            if (!lhsRaw || !rhsRaw) continue;
            const field = (item.Update.ExpressionAttributeNames ? Reflect.get(item.Update.ExpressionAttributeNames, lhsRaw) : undefined) ?? (lhsRaw.startsWith('#') ? lhsRaw.slice(1) : lhsRaw);
            const val = Reflect.get(item.Update.ExpressionAttributeValues, rhsRaw);
            Reflect.set(cur as Record<string, unknown>, field, val);
        }
        store.set(keyStr(item.Update.Key), cur);
        return;
    }
    if ('Delete' in item) {
        store.delete(keyStr(item.Delete.Key));
    }
}

export async function ddbTransactWrite(items: TransactItem[]) {
    if (items.length === 0) return;
    if (items.length > 100) {
        throw new Error(`ddbTransactWrite supports at most 100 items per call (got ${items.length})`);
    }
    const normalized = items.map((item) => {
        if ('Put' in item) {
            return { Put: { Item: normalize(item.Put.Item) as Record<string, unknown> } };
        }
        if ('Update' in item) {
            return {
                Update: {
                    ...item.Update,
                    ExpressionAttributeValues: normalize(item.Update.ExpressionAttributeValues) as Record<string, unknown>
                }
            };
        }
        return item;
    }) as TransactItem[];

    if (useMem) {
        for (const item of normalized) applyTransactItemToMem(item);
        return;
    }

    const { ddb, tableName } = await getLive();
    const transactItems = normalized.map((item) => {
        if ('Put' in item) return { Put: { TableName: tableName, Item: item.Put.Item } };
        if ('Update' in item) return { Update: { TableName: tableName, ...item.Update } };
        return { Delete: { TableName: tableName, ...item.Delete } };
    });
    return ddb.send(new TransactWriteCommand({ TransactItems: transactItems }));
}

export async function ddbScan<T>(input: Omit<ScanCommandInput, 'TableName'>) {
    if (useMem) {
        return Array.from(memStore().values()) as unknown as T[];
    }
    const { ddb, tableName } = await getLive();
    const res = await ddb.send(new ScanCommand({ ...input, TableName: tableName }));
    return (res.Items as T[]) ?? [];
}
