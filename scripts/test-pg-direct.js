const { Client } = require('pg');

async function testConnection() {
    const connectionString = "postgresql://postgres.uoltahlxvmuyznfthgxv:wpK7KMSj4YVt9zO6@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require";
    const client = new Client({
        connectionString: connectionString,
    });

    try {
        await client.connect();
        console.log("Connected to Supabase.");
        const res = await client.query('SELECT COUNT(*) FROM "User"');
        console.log("User Count:", res.rows[0].count);

        const res2 = await client.query('SELECT * FROM "TokenTransaction" ORDER BY "createdAt" DESC LIMIT 5');
        console.log("Last Transactions:");
        res2.rows.forEach(tx => {
            console.log(`- ${tx.id} | ${tx.status} | ${tx.type}`);
        });

    } catch (err) {
        console.error("Connection error:", err.message);
    } finally {
        await client.end();
    }
}

testConnection();
