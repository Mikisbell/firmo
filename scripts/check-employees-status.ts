import prisma from '@/src/core/db/prisma';

async function checkEmployees() {
  try {
    const employees = await prisma.employees.findMany({
      select: {
        id: true,
        name: true,
        role: true,
        is_active: true,
        created_at: true,
      },
      orderBy: { name: 'asc' },
    });

    console.log('Employees:');
    employees.forEach(emp => {
      const status = emp.is_active ? '✅ ACTIVE' : '❌ INACTIVE';
      console.log(\\$\{status\} \$\{emp.name\} (\$\{emp.role\})\);
    });

    const inactive = employees.filter(e => !e.is_active);
    console.log(\\nInactive employees: \$\{inactive.length\}\);
    inactive.forEach(emp => {
      console.log(\  - \$\{emp.name\} (\$\{emp.role\})\);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.\();
  }
}

checkEmployees();
