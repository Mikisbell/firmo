/**
 * Check Audit Trail for Bulk Operations
 */

import prisma from '../src/core/db/prisma';

async function checkAuditTrail() {
  console.log('\n🔍 AUDIT TRAIL CHECK\n');
  console.log('='.repeat(60));
  
  // Get recent audit logs
  const auditLogs = await prisma.admin_access_logs.findMany({
    where: {
      action: {
        in: ['BULK_UPDATE', 'BULK_DELETE'],
      },
    },
    orderBy: {
      created_at: 'desc',
    },
    take: 10,
  });
  
  console.log(`\nFound ${auditLogs.length} bulk operation audit logs\n`);
  
  if (auditLogs.length > 0) {
    console.log('Recent Bulk Operations:');
    console.log('-'.repeat(60));
    
    auditLogs.forEach((log, index) => {
      console.log(`\n${index + 1}. ${log.action}`);
      console.log(`   Employee: ${log.employee_id}`);
      console.log(`   Timestamp: ${log.created_at.toISOString()}`);
      console.log(`   Details: ${JSON.stringify(log.details, null, 2)}`);
    });
  } else {
    console.log('⚠️  No bulk operation audit logs found');
    console.log('   This might indicate:');
    console.log('   - Audit logging is not working');
    console.log('   - No bulk operations have been performed yet');
    console.log('   - Audit logs have been cleaned up');
  }
  
  console.log('\n' + '='.repeat(60));
  
  await prisma.$disconnect();
}

checkAuditTrail().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
