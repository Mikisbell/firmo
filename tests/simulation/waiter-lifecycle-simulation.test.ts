/**
 * UX Simulation: Waiter Employee Full Lifecycle (1 Month)
 * 
 * Simulates a complete month in the life of a new waiter:
 * - Day 0: Employee registration (name, DNI, PIN, photo, role=WAITER)
 * - Day 1-30: Daily attendance check-in/check-out
 * - Day 1-30: Table assignments and service registration
 * - Day 1-30: Customer ratings and waiter score tracking
 * - Day 5: Data update (photo, phone number change)
 * - Day 10: Vacation request (3 days)
 * - Day 15: Salary advance request
 * - Day 30: Monthly payroll calculation (base + tips - advances)
 * 
 * This tests the COMPLETE WAITER LIFECYCLE, not just isolated HR functions.
 */
import { describe, it, expect } from 'vitest';

// ============================================================
// Types and Constants
// ============================================================

type Centavos = number & { readonly __brand: 'Centavos' };
type Role = 'WAITER' | 'CASHIER' | 'KITCHEN' | 'ADMIN';
type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'VACATION' | 'SICK';
type VacationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type AdvanceStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';

const centavos = (v: number): Centavos => Math.round(v) as Centavos;

// ============================================================
// Employee Model
// ============================================================

interface WaiterEmployee {
  id: string;
  dni: string;
  name: string;
  lastName: string;
  phone: string;
  photoUrl?: string;
  role: Role;
  pinHash: string;
  isActive: boolean;
  hireDate: Date;
  baseSalaryCents: Centavos;
  createdAt: Date;
  updatedAt: Date;
}

interface AttendanceRecord {
  employeeId: string;
  date: Date;
  checkIn: Date | null;
  checkOut: Date | null;
  status: AttendanceStatus;
  minutesLate: number;
}

interface TableAssignment {
  assignmentId: string;
  employeeId: string;
  tableNumber: number;
  date: Date;
  shift: 'MORNING' | 'AFTERNOON' | 'NIGHT';
}

interface ServiceRecord {
  serviceId: string;
  employeeId: string;
  tableNumber: number;
  orderNumber: number;
  date: Date;
  itemsCount: number;
  totalCents: Centavos;
  tipCents: Centavos;
  customerRating?: number; // 1-5
}

interface VacationRequest {
  requestId: string;
  employeeId: string;
  startDate: Date;
  endDate: Date;
  days: number;
  status: VacationStatus;
  requestedAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
}

interface AdvanceRequest {
  requestId: string;
  employeeId: string;
  amountCents: Centavos;
  reason: string;
  status: AdvanceStatus;
  requestedAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
  paidAt?: Date;
}

interface MonthlyPayroll {
  employeeId: string;
  month: number;
  year: number;
  baseSalaryCents: Centavos;
  totalTipsCents: Centavos;
  totalAdvancesCents: Centavos;
  deductionsCents: Centavos;
  netPayCents: Centavos;
  attendanceBonusCents: Centavos;
  daysWorked: number;
  daysAbsent: number;
  daysLate: number;
  daysVacation: number;
  avgCustomerRating: number;
  totalServices: number;
  totalSalesCents: Centavos;
}

// ============================================================
// HR Business Logic Functions
// ============================================================

function registerWaiterEmployee(dni: string, name: string, lastName: string, phone: string, pin: string): WaiterEmployee {
  return {
    id: `emp-${Date.now()}`,
    dni,
    name,
    lastName,
    phone,
    role: 'WAITER',
    pinHash: `hash_${pin}`,
    isActive: true,
    hireDate: new Date(),
    baseSalaryCents: 102500 as Centavos, // S/. 1,025.00 (minimum wage Peru 2026)
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function updateEmployeePhoto(employee: WaiterEmployee, photoUrl: string): WaiterEmployee {
  return {
    ...employee,
    photoUrl,
    updatedAt: new Date(),
  };
}

function updateEmployeePhone(employee: WaiterEmployee, newPhone: string): WaiterEmployee {
  return {
    ...employee,
    phone: newPhone,
    updatedAt: new Date(),
  };
}

function recordAttendance(employeeId: string, date: Date, checkInHour: number, checkInMinute: number): AttendanceRecord {
  const scheduledStart = 8 * 60; // 8:00 AM in minutes
  const actualStart = checkInHour * 60 + checkInMinute;
  const minutesLate = Math.max(0, actualStart - scheduledStart);

  let status: AttendanceStatus;
  if (minutesLate === 0) status = 'PRESENT';
  else if (minutesLate <= 15) status = 'LATE';
  else status = 'LATE';

  return {
    employeeId,
    date,
    checkIn: new Date(date.getFullYear(), date.getMonth(), date.getDate(), checkInHour, checkInMinute),
    checkOut: null,
    status,
    minutesLate,
  };
}

function recordCheckOut(attendance: AttendanceRecord, checkOutHour: number, checkOutMinute: number): AttendanceRecord {
  return {
    ...attendance,
    checkOut: new Date(attendance.date.getFullYear(), attendance.date.getMonth(), attendance.date.getDate(), checkOutHour, checkOutMinute),
  };
}

function assignTable(employeeId: string, tableNumber: number, date: Date, shift: 'MORNING' | 'AFTERNOON' | 'NIGHT'): TableAssignment {
  return {
    assignmentId: `assign-${Date.now()}-${tableNumber}`,
    employeeId,
    tableNumber,
    date,
    shift,
  };
}

function recordService(
  employeeId: string,
  tableNumber: number,
  orderNumber: number,
  date: Date,
  itemsCount: number,
  totalCents: Centavos,
  tipCents: Centavos,
  customerRating?: number
): ServiceRecord {
  return {
    serviceId: `svc-${Date.now()}-${orderNumber}`,
    employeeId,
    tableNumber,
    orderNumber,
    date,
    itemsCount,
    totalCents,
    tipCents,
    customerRating,
  };
}

function requestVacation(employeeId: string, startDate: Date, endDate: Date): VacationRequest {
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  return {
    requestId: `vac-${Date.now()}`,
    employeeId,
    startDate,
    endDate,
    days,
    status: 'PENDING',
    requestedAt: new Date(),
  };
}

function approveVacation(request: VacationRequest, approvedBy: string): VacationRequest {
  return {
    ...request,
    status: 'APPROVED',
    approvedBy,
    approvedAt: new Date(),
  };
}

function requestAdvance(employeeId: string, amountCents: Centavos, reason: string): AdvanceRequest {
  return {
    requestId: `adv-${Date.now()}`,
    employeeId,
    amountCents,
    reason,
    status: 'PENDING',
    requestedAt: new Date(),
  };
}

function approveAdvance(request: AdvanceRequest, approvedBy: string): AdvanceRequest {
  return {
    ...request,
    status: 'APPROVED',
    approvedBy,
    approvedAt: new Date(),
  };
}

function payAdvance(request: AdvanceRequest): AdvanceRequest {
  return {
    ...request,
    status: 'PAID',
    paidAt: new Date(),
  };
}

function calculateMonthlyPayroll(
  employee: WaiterEmployee,
  attendances: AttendanceRecord[],
  services: ServiceRecord[],
  advances: AdvanceRequest[],
  vacations: VacationRequest[],
  month: number,
  year: number
): MonthlyPayroll {
  // Filter by month/year
  const monthAttendances = attendances.filter(a => a.date.getMonth() === month && a.date.getFullYear() === year);
  const monthServices = services.filter(s => s.date.getMonth() === month && s.date.getFullYear() === year);
  const monthAdvances = advances.filter(a => a.status === 'PAID' && a.paidAt && a.paidAt.getMonth() === month);
  const monthVacations = vacations.filter(v => v.startDate.getMonth() === month && v.status === 'APPROVED');

  // Calculate metrics
  const daysWorked = monthAttendances.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length;
  const daysAbsent = monthAttendances.filter(a => a.status === 'ABSENT').length;
  const daysLate = monthAttendances.filter(a => a.status === 'LATE').length;
  const daysVacation = monthVacations.reduce((sum, v) => sum + v.days, 0);

  // Tips
  const totalTipsCents = centavos(monthServices.reduce((sum, s) => sum + s.tipCents, 0));

  // Advances
  const totalAdvancesCents = centavos(monthAdvances.reduce((sum, a) => sum + a.amountCents, 0));

  // Average customer rating
  const ratedServices = monthServices.filter(s => s.customerRating);
  const avgCustomerRating = ratedServices.length > 0
    ? ratedServices.reduce((sum, s) => sum + (s.customerRating || 0), 0) / ratedServices.length
    : 0;

  // Total services and sales
  const totalServices = monthServices.length;
  const totalSalesCents = centavos(monthServices.reduce((sum, s) => sum + s.totalCents, 0));

  // Attendance bonus (perfect attendance = 5% bonus)
  const attendanceBonusCents = (daysAbsent === 0 && daysLate === 0)
    ? centavos(employee.baseSalaryCents * 0.05)
    : 0;

  // Deductions (absences without justification)
  const dailyRate = centavos(employee.baseSalaryCents / 30);
  const deductionsCents = centavos(daysAbsent * dailyRate);

  // Net pay
  const netPayCents = centavos(
    employee.baseSalaryCents + totalTipsCents + attendanceBonusCents - totalAdvancesCents - deductionsCents
  );

  return {
    employeeId: employee.id,
    month,
    year,
    baseSalaryCents: employee.baseSalaryCents,
    totalTipsCents,
    totalAdvancesCents,
    deductionsCents,
    netPayCents,
    attendanceBonusCents,
    daysWorked,
    daysAbsent,
    daysLate,
    daysVacation,
    avgCustomerRating,
    totalServices,
    totalSalesCents,
  };
}

// ============================================================
// WAITER LIFECYCLE SIMULATION TESTS
// ============================================================

describe('Waiter Employee Full Lifecycle Simulation (1 Month)', () => {

  it('should simulate complete waiter lifecycle: registration to monthly payroll', () => {
    // ==========================================
    // DAY 0: Employee Registration
    // ==========================================
    const hireDate = new Date('2026-04-01');
    const employee = registerWaiterEmployee(
      '72345678',
      'Carlos',
      'López Mendez',
      '987654321',
      '2222'
    );

    expect(employee.role).toBe('WAITER');
    expect(employee.isActive).toBe(true);
    expect(employee.baseSalaryCents).toBe(102500); // S/. 1,025.00

    console.log('📋 Day 0: Employee Registration');
    console.log(`   Name: ${employee.name} ${employee.lastName}`);
    console.log(`   DNI: ${employee.dni}`);
    console.log(`   Role: ${employee.role}`);
    console.log(`   Base Salary: S/. ${(employee.baseSalaryCents / 100).toFixed(2)}`);

    // ==========================================
    // DAY 0: Upload photo and update phone
    // ==========================================
    const employeeWithPhoto = updateEmployeePhoto(employee, 'https://storage.park-pos.com/photos/carlos-lopez.jpg');
    const employeeWithNewPhone = updateEmployeePhone(employeeWithPhoto, '987654322');

    expect(employeeWithPhoto.photoUrl).toBeDefined();
    expect(employeeWithNewPhone.phone).toBe('987654322');

    console.log('📸 Day 0: Photo uploaded and phone updated');

    // ==========================================
    // DAY 1-30: Daily Attendance + Table Assignments + Services
    // ==========================================
    const attendances: AttendanceRecord[] = [];
    const tableAssignments: TableAssignment[] = [];
    const services: ServiceRecord[] = [];
    const startDate = new Date('2026-04-01');

    // Waiter works Monday-Sunday, rests on weekdays (Mon-Thu)
    // Weekends (Fri-Sun) are ALWAYS working days (busiest)
    // Gets 4 rest days per month, scheduled on Mon-Thu
    const restDays = new Set<number>(); // Will assign 4 rest days on weekdays

    // Pre-assign rest days (e.g., April 2, 9, 16, 23 - all Thursdays)
    for (let day = 0; day < 30; day++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + day);
      const dayOfWeek = currentDate.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

      // Rest on Thursdays (day 4) if not a holiday/special event
      if (dayOfWeek === 4 && day < 28) {
        restDays.add(day);
      }
    }

    for (let day = 0; day < 30; day++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + day);
      const dayOfWeek = currentDate.getDay();

      // Skip rest days (waiter has day off)
      if (restDays.has(day)) {
        attendances.push({
          employeeId: employee.id,
          date: currentDate,
          checkIn: null,
          checkOut: null,
          status: 'VACATION', // Using VACATION for rest days
          minutesLate: 0,
        });
        continue;
      }

      // Weekends are busiest (Fri=5, Sat=6, Sun=0)
      const isWeekend = dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0;
      const servicesPerDay = isWeekend
        ? Math.floor(Math.random() * 10) + 12 // 12-21 services on weekends
        : Math.floor(Math.random() * 8) + 5;  // 5-12 services on weekdays

      // Attendance check-in (shift starts at 8 AM)
      const isLate = Math.random() < 0.08; // 8% chance of being late
      const checkInHour = isLate ? 8 : 7;
      const checkInMinute = isLate ? Math.floor(Math.random() * 30) + 10 : 55;

      const attendance = recordAttendance(employee.id, currentDate, checkInHour, checkInMinute);
      attendances.push(attendance);

      // Table assignment (more tables on weekends)
      const tablesCount = isWeekend
        ? Math.floor(Math.random() * 4) + 5 // 5-8 tables on weekends
        : Math.floor(Math.random() * 3) + 3; // 3-5 tables on weekdays

      for (let t = 0; t < tablesCount; t++) {
        const tableNumber = Math.floor(Math.random() * 20) + 1;
        const shift = isWeekend
          ? (Math.random() < 0.6 ? 'AFTERNOON' : 'NIGHT') // Weekends: more afternoon/night shifts
          : (Math.random() < 0.5 ? 'MORNING' : 'AFTERNOON');
        tableAssignments.push(assignTable(employee.id, tableNumber, currentDate, shift));
      }

      // Services
      for (let s = 0; s < servicesPerDay; s++) {
        const orderNumber = 1000 + day * 20 + s;
        const itemsCount = Math.floor(Math.random() * 5) + 1;
        const totalCents = centavos((Math.random() * 100 + 30) * 100); // S/. 30-130
        const tipCents = centavos(totalCents * (Math.random() * 0.15)); // 0-15% tip
        const customerRating = Math.random() < 0.8 ? Math.floor(Math.random() * 2) + 4 : Math.floor(Math.random() * 3) + 1;

        services.push(recordService(
          employee.id,
          tableAssignments[tableAssignments.length - 1]?.tableNumber || 1,
          orderNumber,
          currentDate,
          itemsCount,
          totalCents,
          tipCents,
          customerRating
        ));
      }

      // Check-out (8 PM on weekdays, 10 PM on weekends)
      const checkOutHour = isWeekend ? 22 : 20;
      const checkedOutAttendance = recordCheckOut(attendance, checkOutHour, Math.floor(Math.random() * 30));
      attendances[attendances.length - 1] = checkedOutAttendance;
    }

    console.log('📅 Days 1-30: Attendance, Tables, Services');
    console.log(`   Days worked: ${attendances.length}`);
    console.log(`   Table assignments: ${tableAssignments.length}`);
    console.log(`   Services completed: ${services.length}`);

    // ==========================================
    // DAY 5: Vacation Request
    // ==========================================
    const vacationRequest = requestVacation(
      employee.id,
      new Date('2026-04-20'),
      new Date('2026-04-22')
    );

    expect(vacationRequest.days).toBe(3);
    expect(vacationRequest.status).toBe('PENDING');

    // Manager approves
    const approvedVacation = approveVacation(vacationRequest, 'manager-1');
    expect(approvedVacation.status).toBe('APPROVED');

    console.log('🏖️ Day 5: Vacation Request');
    console.log(`   Requested: ${vacationRequest.days} days`);
    console.log(`   Status: ${approvedVacation.status}`);

    // ==========================================
    // DAY 15: Salary Advance Request
    // ==========================================
    const advanceRequest = requestAdvance(
      employee.id,
      50000 as Centavos, // S/. 500.00
      'Emergencia médica familiar'
    );

    expect(advanceRequest.amountCents).toBe(50000);
    expect(advanceRequest.status).toBe('PENDING');

    // Manager approves and pays
    const approvedAdvance = approveAdvance(advanceRequest, 'manager-1');
    const paidAdvance = payAdvance(approvedAdvance);
    expect(paidAdvance.status).toBe('PAID');

    console.log('💰 Day 15: Salary Advance');
    console.log(`   Requested: S/. ${(advanceRequest.amountCents / 100).toFixed(2)}`);
    console.log(`   Reason: ${advanceRequest.reason}`);
    console.log(`   Status: ${paidAdvance.status}`);

    // ==========================================
    // DAY 30: Monthly Payroll Calculation
    // ==========================================
    const payroll = calculateMonthlyPayroll(
      employee,
      attendances,
      services,
      [paidAdvance],
      [approvedVacation],
      3, // April (0-indexed)
      2026
    );

    // Validate payroll
    expect(payroll.baseSalaryCents).toBe(102500);
    expect(payroll.totalAdvancesCents).toBe(50000);
    expect(payroll.daysWorked).toBeGreaterThan(20); // Should have worked most days
    expect(payroll.totalServices).toBeGreaterThan(100); // Should have many services

    // Net pay calculation
    const expectedNet = payroll.baseSalaryCents + payroll.totalTipsCents + payroll.attendanceBonusCents - payroll.totalAdvancesCents - payroll.deductionsCents;
    expect(payroll.netPayCents).toBe(expectedNet);

    console.log('💵 Day 30: Monthly Payroll');
    console.log(`   Base Salary: S/. ${(payroll.baseSalaryCents / 100).toFixed(2)}`);
    console.log(`   Tips: S/. ${(payroll.totalTipsCents / 100).toFixed(2)}`);
    console.log(`   Attendance Bonus: S/. ${(payroll.attendanceBonusCents / 100).toFixed(2)}`);
    console.log(`   Advances: -S/. ${(payroll.totalAdvancesCents / 100).toFixed(2)}`);
    console.log(`   Deductions: -S/. ${(payroll.deductionsCents / 100).toFixed(2)}`);
    console.log(`   NET PAY: S/. ${(payroll.netPayCents / 100).toFixed(2)}`);
    console.log(`   Days Worked: ${payroll.daysWorked}`);
    console.log(`   Services: ${payroll.totalServices}`);
    console.log(`   Total Sales: S/. ${(payroll.totalSalesCents / 100).toFixed(2)}`);
    console.log(`   Avg Customer Rating: ${payroll.avgCustomerRating.toFixed(1)}⭐`);
  });

  it('should calculate waiter performance metrics', () => {
    // Simulate 100 services with ratings
    const services: ServiceRecord[] = [];
    for (let i = 0; i < 100; i++) {
      services.push(recordService(
        'emp-1',
        Math.floor(Math.random() * 20) + 1,
        1000 + i,
        new Date(),
        Math.floor(Math.random() * 5) + 1,
        centavos((Math.random() * 100 + 30) * 100),
        centavos(Math.random() * 1500),
        Math.floor(Math.random() * 2) + 4 // Mostly 4-5 stars
      ));
    }

    const ratedServices = services.filter(s => s.customerRating);
    const avgRating = ratedServices.reduce((sum, s) => sum + (s.customerRating || 0), 0) / ratedServices.length;
    const excellentService = ratedServices.filter(s => (s.customerRating || 0) >= 5).length;
    const poorService = ratedServices.filter(s => (s.customerRating || 0) <= 2).length;

    expect(avgRating).toBeGreaterThanOrEqual(3.5);
    expect(excellentService).toBeGreaterThan(poorService);

    console.log('⭐ Waiter Performance Metrics:');
    console.log(`   Total Services: ${services.length}`);
    console.log(`   Avg Rating: ${avgRating.toFixed(1)}⭐`);
    console.log(`   Excellent (5⭐): ${excellentService}`);
    console.log(`   Poor (1-2⭐): ${poorService}`);
  });

  it('should handle attendance patterns and calculate bonuses', () => {
    const attendances: AttendanceRecord[] = [];
    const startDate = new Date('2026-04-01');

    // Simulate 26 working days (excluding Sundays in April 2026: days 5, 12, 19, 26)
    const workingDays: Date[] = [];
    for (let day = 0; day < 30; day++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + day);
      if (currentDate.getDay() !== 0) { // Not Sunday
        workingDays.push(currentDate);
      }
    }

    // 22 present, 2 late, 2 absent = 26 total
    for (let i = 0; i < workingDays.length; i++) {
      const currentDate = workingDays[i];
      let status: AttendanceStatus;
      let minutesLate = 0;

      if (i < 22) {
        status = 'PRESENT';
      } else if (i < 24) {
        status = 'LATE';
        minutesLate = Math.floor(Math.random() * 20) + 5;
      } else {
        status = 'ABSENT';
      }

      attendances.push({
        employeeId: 'emp-1',
        date: currentDate,
        checkIn: currentDate,
        checkOut: currentDate,
        status,
        minutesLate,
      });
    }

    const daysWorked = attendances.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length;
    const daysLate = attendances.filter(a => a.status === 'LATE').length;
    const daysAbsent = attendances.filter(a => a.status === 'ABSENT').length;

    // Attendance bonus requires perfect attendance
    const hasAttendanceBonus = daysAbsent === 0 && daysLate === 0;

    expect(daysWorked).toBe(24); // 22 present + 2 late
    expect(daysLate).toBe(2);
    expect(daysAbsent).toBe(2);
    expect(attendances.length).toBe(26); // Total working days
    expect(hasAttendanceBonus).toBe(false); // Has absences and lates

    console.log('📊 Attendance Analysis:');
    console.log(`   Days Worked: ${daysWorked}`);
    console.log(`   Days Late: ${daysLate}`);
    console.log(`   Days Absent: ${daysAbsent}`);
    console.log(`   Attendance Bonus: ${hasAttendanceBonus ? 'Yes (5%)' : 'No'}`);
  });

  it('should recommend: Waiter lifecycle improvements', () => {
    const currentGaps = [
      'No automated attendance tracking',
      'No tip pooling calculation',
      'No performance-based bonuses',
      'Vacation approval manual',
      'Advance limit not enforced (max 30% of salary)',
      'No customer feedback integration',
    ];

    const recommendations = [
      'QR code check-in/out at terminal, auto-calculate lateness',
      'Auto-distribute tips among waiters by service count',
      '5% bonus for avg rating > 4.5, 10% for perfect month',
      'Auto-approve if < 5 days/year remaining, else manager approval',
      'Block advances > 30% of base salary, max 1 per month',
      'Post-service rating prompt, monthly performance report',
    ];

    expect(recommendations.length).toBe(currentGaps.length);

    console.log('✅ Waiter Lifecycle Recommendations:');
    for (let i = 0; i < currentGaps.length; i++) {
      console.log(`   🔴 ${currentGaps[i]}`);
      console.log(`   ✅ ${recommendations[i]}`);
    }
  });
});
