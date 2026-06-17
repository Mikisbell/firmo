import { Pool } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  await client.query('LISTEN test_channel');
  
  client.on('notification', (msg) => {
    console.log('Received notification:', msg.payload);
    process.exit(0);
  });
  
  await pool.query("NOTIFY test_channel, 'hello'");
  
  setTimeout(() => {
    console.log('Timeout waiting for notification');
    process.exit(1);
  }, 3000);
}

run();
