import { DynamoDBClient, CreateTableCommand, DeleteTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import crypto from 'crypto';

const client = new DynamoDBClient({
    region: 'us-east-1',
    endpoint: 'http://localhost:8000',
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' }
});

const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.DYNAMO_TABLE || 'case-tracker-e2e';

async function globalSetup() {
    console.log(`[Global Setup] Provisioning table ${TABLE_NAME}...`);
    // 1. Recreate Table
    try { 
        await client.send(new DeleteTableCommand({ TableName: TABLE_NAME })); 
        // Wait a bit for local dynamo to fully delete
        await new Promise(resolve => setTimeout(resolve, 1000));
    } catch {
        // Ignore if it doesn't exist
    }

    await client.send(new CreateTableCommand({
        TableName: TABLE_NAME,
        AttributeDefinitions: [
            { AttributeName: 'PK', AttributeType: 'S' },
            { AttributeName: 'SK', AttributeType: 'S' },
            { AttributeName: 'GSI1PK', AttributeType: 'S' },
            { AttributeName: 'GSI1SK', AttributeType: 'S' }
        ],
        KeySchema: [
            { AttributeName: 'PK', KeyType: 'HASH' },
            { AttributeName: 'SK', KeyType: 'RANGE' }
        ],
        GlobalSecondaryIndexes: [
            {
                IndexName: 'GSI1',
                KeySchema: [
                    { AttributeName: 'GSI1PK', KeyType: 'HASH' },
                    { AttributeName: 'GSI1SK', KeyType: 'RANGE' }
                ],
                Projection: { ProjectionType: 'ALL' }
            }
        ],
        BillingMode: 'PAY_PER_REQUEST'
    }));

    // 2. Seed Data
    const now = new Date().toISOString();
    const userId = 'test_user';
    const workspaceId = `workspace_${crypto.randomUUID()}`;

    // Seed Better Auth User
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: { 
            PK: `ba_user`, 
            SK: userId, 
            id: userId, 
            email: 'test@example.com', 
            name: 'E2E Test User', 
            emailVerified: true, 
            createdAt: now, 
            updatedAt: now 
        }
    }));

    // Seed Better Auth Account (Credentials)
    // bcrypt hash of 'password123'
    const passwordHash = '$2a$10$VxSt1rn0rr8uKqhxeYrVRudTKMod2pB4cq8Nuqn7QeDHRWU61h.x2';
    const accountId = `acc_${crypto.randomUUID()}`;
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: { 
            PK: `ba_account`, 
            SK: accountId, 
            id: accountId, 
            userId, 
            accountId: 'test@example.com', 
            providerId: 'credential', 
            password: passwordHash, 
            createdAt: now, 
            updatedAt: now 
        }
    }));

    // Seed Workspace
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: { 
            PK: `WORKSPACE#${workspaceId}`, 
            SK: `WORKSPACE#${workspaceId}`, 
            id: workspaceId, 
            name: 'E2E Test Workspace', 
            ownerId: userId, 
            evidenceCategories: [], 
            evidenceTargets: {}, 
            evidenceCounts: {}, 
            createdAt: now, 
            updatedAt: now 
        }
    }));

    // Seed Membership
    const membershipId = `membership_${crypto.randomUUID()}`;
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
            PK: `WORKSPACE#${workspaceId}`, 
            SK: `MEMBER#${userId}`, 
            GSI1PK: `USER#${userId}`, 
            GSI1SK: `MEMBER#${workspaceId}`,
            id: membershipId, 
            workspaceId, 
            userId, 
            role: 'owner', 
            acceptedAt: now, 
            workspaceName: 'E2E Test Workspace', 
            createdAt: now, 
            updatedAt: now
        }
    }));
    console.log('[Global Setup] Done seeding.');
}

export default globalSetup;
