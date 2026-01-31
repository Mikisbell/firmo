// scripts/test-session-api.ts
// Test the /api/auth/session endpoint that admin panel uses

async function testSessionAPI() {
    console.log('\n🧪 TESTING SESSION API\n');
    console.log('============================================================\n');

    const testPin = '1234';
    const allowedRoles = ['OWNER', 'ADMIN', 'MANAGER'];

    console.log(`Testing with PIN: ${testPin}`);
    console.log(`Allowed roles: ${allowedRoles.join(', ')}\n`);

    try {
        const response = await fetch('http://localhost:3000/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pin: testPin,
                allowedRoles,
            }),
        });

        const data = await response.json();

        console.log(`Status: ${response.status} ${response.statusText}`);
        console.log(`Response:`, JSON.stringify(data, null, 2));

        if (response.ok) {
            console.log('\n✅ SESSION API LOGIN SUCCESSFUL');
            console.log(`   Employee: ${data.employee?.name}`);
            console.log(`   Role: ${data.employee?.role}`);
            console.log(`   ID: ${data.employee?.id}`);
        } else {
            console.log('\n❌ SESSION API LOGIN FAILED');
            console.log(`   Error: ${data.error}`);
            console.log(`   Error Code: ${data.errorCode}`);
            if (data.lockoutUntil) {
                console.log(`   Locked until: ${new Date(data.lockoutUntil).toLocaleString('es-PE')}`);
            }
        }
    } catch (error) {
        console.log('\n❌ REQUEST FAILED');
        console.error('Error:', error);
    }

    console.log('\n============================================================\n');
}

testSessionAPI();
