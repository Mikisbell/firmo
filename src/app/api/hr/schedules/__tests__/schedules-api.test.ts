/**
 * Schedules API Unit Tests
 * Tests for Schedule operations (templates, weekly calendar)
 * Requirements: HR schedule management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mock service methods at module level using vi.hoisted() ───
const { mockCreateTemplate, mockGetWeeklyCalendar } = vi.hoisted(() => ({
  mockCreateTemplate: vi.fn(),
  mockGetWeeklyCalendar: vi.fn(),
}));

// ─── Mock ALL dependencies BEFORE importing route handlers ───

// Mock Prisma
vi.mock('@/src/core/db/prisma', () => ({
  default: {
    schedule_templates: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

// Mock admin auth middleware
vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: vi.fn(async () => ({
    authorized: true,
    user: {
      id: 'test-admin-id',
      role: 'ADMIN',
      name: 'Test Admin',
      tenantId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      sessionId: 'test-session-id',
    },
  })),
}));

// Mock structured logger
vi.mock('@/src/core/observability/structured-logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock ScheduleService with class
vi.mock('@/src/core/services/schedule.service', () => ({
  ScheduleService: class MockScheduleService {
    createTemplate = mockCreateTemplate;
    getWeeklyCalendar = mockGetWeeklyCalendar;
  },
}));

// ─── NOW import route handlers (after all mocks are registered) ───
import { GET, POST } from '../route';
import { GET as WEEKLY_GET } from '../weekly/route';
import prisma from '@/src/core/db/prisma';

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const LOCATION_ID = 'loc-123';

function createMockRequest(body: any, method: string = 'POST', queryParams?: Record<string, string>): NextRequest {
  let url = 'http://localhost:3000/api/hr/schedules';
  
  if (queryParams) {
    const params = new URLSearchParams(queryParams);
    url += `?${params.toString()}`;
  }

  const init: RequestInit = {
    method,
    headers: {
      'content-type': 'application/json',
      'authorization': 'Bearer test-token',
    },
  };

  if (method !== 'GET' && method !== 'HEAD') {
    init.body = JSON.stringify(body);
  }

  return new NextRequest(url, init as any);
}

describe('Schedules API Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/hr/schedules - List Templates', () => {
    it('should return list of schedule templates', async () => {
      const mockTemplates = [
        {
          id: 'tpl-1',
          tenant_id: TENANT_ID,
          location_id: LOCATION_ID,
          name: 'Morning Shift',
          schedule_type: 'FIXED',
          days_of_week: [1, 2, 3, 4, 5],
          start_time: '08:00',
          end_time: '16:00',
          break_minutes: 60,
          is_active: true,
        },
        {
          id: 'tpl-2',
          tenant_id: TENANT_ID,
          location_id: LOCATION_ID,
          name: 'Evening Shift',
          schedule_type: 'FIXED',
          days_of_week: [1, 2, 3, 4, 5],
          start_time: '16:00',
          end_time: '00:00',
          break_minutes: 60,
          is_active: true,
        },
      ];

      vi.mocked(prisma.schedule_templates.findMany).mockResolvedValue(mockTemplates as any);

      const request = createMockRequest({}, 'GET');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(2);
      expect(data[0].name).toBe('Morning Shift');
    });

    it('should return empty array when no templates exist', async () => {
      vi.mocked(prisma.schedule_templates.findMany).mockResolvedValue([]);

      const request = createMockRequest({}, 'GET');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(0);
    });

    it('should return 500 on database error', async () => {
      vi.mocked(prisma.schedule_templates.findMany).mockRejectedValue(new Error('DB error'));

      const request = createMockRequest({}, 'GET');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });
  });

  describe('POST /api/hr/schedules - Create Template', () => {
    it('should create schedule template successfully', async () => {
      const templateData = {
        location_id: LOCATION_ID,
        name: 'Morning Shift',
        schedule_type: 'FIXED',
        days_of_week: [1, 2, 3, 4, 5],
        start_time: '08:00',
        end_time: '16:00',
        break_minutes: 60,
      };

      const mockTemplate = {
        id: 'tpl-123',
        tenant_id: TENANT_ID,
        ...templateData,
        is_active: true,
        created_at: new Date(),
      };

      mockCreateTemplate.mockResolvedValue({
        success: true,
        data: mockTemplate,
      });

      const request = createMockRequest(templateData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.name).toBe('Morning Shift');
      expect(data.schedule_type).toBe('FIXED');
      expect(data.days_of_week).toEqual([1, 2, 3, 4, 5]);
    });

    it('should reject invalid time format', async () => {
      const templateData = {
        location_id: LOCATION_ID,
        name: 'Morning Shift',
        schedule_type: 'FIXED',
        days_of_week: [1, 2, 3, 4, 5],
        start_time: '8:00', // Invalid format (missing leading zero)
        end_time: '16:00',
      };

      const request = createMockRequest(templateData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Datos inválidos');
    });

    it('should reject invalid schedule_type', async () => {
      const templateData = {
        location_id: LOCATION_ID,
        name: 'Morning Shift',
        schedule_type: 'INVALID',
        days_of_week: [1, 2, 3, 4, 5],
        start_time: '08:00',
        end_time: '16:00',
      };

      const request = createMockRequest(templateData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Datos inválidos');
    });

    it('should reject empty days_of_week', async () => {
      const templateData = {
        location_id: LOCATION_ID,
        name: 'Morning Shift',
        schedule_type: 'FIXED',
        days_of_week: [],
        start_time: '08:00',
        end_time: '16:00',
      };

      const request = createMockRequest(templateData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Datos inválidos');
    });

    it('should reject invalid day of week (out of range)', async () => {
      const templateData = {
        location_id: LOCATION_ID,
        name: 'Morning Shift',
        schedule_type: 'FIXED',
        days_of_week: [1, 2, 8], // 8 is invalid
        start_time: '08:00',
        end_time: '16:00',
      };

      const request = createMockRequest(templateData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Datos inválidos');
    });

    it('should return 500 on service error', async () => {
      const templateData = {
        location_id: LOCATION_ID,
        name: 'Morning Shift',
        schedule_type: 'FIXED',
        days_of_week: [1, 2, 3, 4, 5],
        start_time: '08:00',
        end_time: '16:00',
      };

      mockCreateTemplate.mockResolvedValue({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Database error',
        },
      });

      const request = createMockRequest(templateData);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });
  });

  describe('GET /api/hr/schedules/weekly - Weekly Calendar', () => {
    it('should return weekly calendar', async () => {
      const mockCalendar = {
        location_id: LOCATION_ID,
        week_start: '2026-03-02',
        week_end: '2026-03-08',
        days: [
          {
            date: '2026-03-02',
            day_of_week: 1,
            shifts: [
              {
                employee_id: 'emp-1',
                employee_name: 'John Doe',
                start_time: '08:00',
                end_time: '16:00',
              },
            ],
          },
        ],
      };

      mockGetWeeklyCalendar.mockResolvedValue({
        success: true,
        data: mockCalendar,
      });

      const url = 'http://localhost:3000/api/hr/schedules/weekly';
      const request = new NextRequest(`${url}?location_id=${LOCATION_ID}&week_start=2026-03-02`, {
        method: 'GET',
        headers: { 'authorization': 'Bearer test-token' },
      });

      const response = await WEEKLY_GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.location_id).toBe(LOCATION_ID);
      expect(data.week_start).toBe('2026-03-02');
      expect(data.days).toBeDefined();
    });

    it('should return 400 when location_id is missing', async () => {
      const url = 'http://localhost:3000/api/hr/schedules/weekly';
      const request = new NextRequest(`${url}?week_start=2026-03-02`, {
        method: 'GET',
        headers: { 'authorization': 'Bearer test-token' },
      });

      const response = await WEEKLY_GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('location_id');
    });

    it('should return 400 when week_start is missing', async () => {
      const url = 'http://localhost:3000/api/hr/schedules/weekly';
      const request = new NextRequest(`${url}?location_id=${LOCATION_ID}`, {
        method: 'GET',
        headers: { 'authorization': 'Bearer test-token' },
      });

      const response = await WEEKLY_GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('week_start');
    });

    it('should return 400 for invalid week_start format', async () => {
      const url = 'http://localhost:3000/api/hr/schedules/weekly';
      const request = new NextRequest(`${url}?location_id=${LOCATION_ID}&week_start=2026/03/02`, {
        method: 'GET',
        headers: { 'authorization': 'Bearer test-token' },
      });

      const response = await WEEKLY_GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('week_start');
    });

    it('should return 500 on service error', async () => {
      mockGetWeeklyCalendar.mockResolvedValue({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Database error',
        },
      });

      const url = 'http://localhost:3000/api/hr/schedules/weekly';
      const request = new NextRequest(`${url}?location_id=${LOCATION_ID}&week_start=2026-03-02`, {
        method: 'GET',
        headers: { 'authorization': 'Bearer test-token' },
      });

      const response = await WEEKLY_GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });
  });
});
