import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const count = await prisma.employees.count();
    return NextResponse.json({ 
      message: 'Prisma working', 
      employeeCount: count,
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    return NextResponse.json({ 
      error: 'Prisma error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString() 
    }, { status: 500 });
  }
}
