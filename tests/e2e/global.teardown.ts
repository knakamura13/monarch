import { DynamoDBClient, DeleteTableCommand } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({
    region: 'us-east-1',
    endpoint: 'http://localhost:8000',
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' }
});

const TABLE_NAME = process.env.DYNAMO_TABLE || 'case-tracker-e2e';

async function globalTeardown() {
    console.log(`[Global Teardown] Deleting table ${TABLE_NAME}...`);
    try {
        await client.send(new DeleteTableCommand({ TableName: TABLE_NAME }));
        console.log('[Global Teardown] Done.');
    } catch (e) {
        console.error('[Global Teardown] Failed to delete table', e);
    }
}

export default globalTeardown;
