import { NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  try {
    const count = await prisma.employees.count();
    return NextResponse.json({
      message: 'Prisma working',
      employeeCount: count,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
