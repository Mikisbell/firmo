# Uptime Robot Configuration Guide

## Overview

This guide provides step-by-step instructions for configuring Uptime Robot to monitor the PARK POS health check endpoint. Uptime Robot will check the system health every 5 minutes and send alerts when the system becomes unavailable.

## Prerequisites

- PARK POS deployed and accessible at production URL
- Health check endpoint available at `/api/health`
- Email address for alert notifications

## Setup Instructions

### Step 1: Create Uptime Robot Account

1. Go to [https://uptimerobot.com/](https://uptimerobot.com/)
2. Click "Sign Up" (free tier supports up to 50 monitors)
3. Verify your email address
4. Log in to your dashboard

### Step 2: Create Health Check Monitor

1. Click "+ Add New Monitor" button
2. Configure the monitor with the following settings:

   **Monitor Type:** HTTP(s)
   
   **Friendly Name:** PARK POS Health Check
   
   **URL (or IP):** `https://parkperu.vercel.app/api/health`
   
   **Monitoring Interval:** 5 minutes
   
   **Monitor Timeout:** 30 seconds
   
   **HTTP Method:** GET
   
   **HTTP Status Codes:** 200, 201, 202, 203, 204, 205, 206, 207, 208, 226
   
   **Alert Contacts:** Select your email address

3. Click "Create Monitor"

### Step 3: Configure Alert Settings

1. Go to "My Settings" → "Alert Contacts"
2. Add your email address if not already added
3. Configure alert preferences:
   - **Send alerts when:** Monitor goes down
   - **Send alerts when:** Monitor comes back up
   - **Alert frequency:** Every time (no delay)

### Step 4: Configure Advanced Settings (Optional)

For more sophisticated monitoring, configure these optional settings:

1. **Keyword Monitoring:**
   - Enable "Keyword Exists" check
   - Keyword: `"status":"healthy"` or `"status":"degraded"`
   - This ensures the endpoint returns valid JSON with expected status

2. **Response Time Monitoring:**
   - Enable "Response Time" alert
   - Threshold: 2000ms (2 seconds)
   - This alerts if health check takes too long

3. **SSL Certificate Monitoring:**
   - Enable "SSL Certificate Expiry" alert
   - Alert before: 7 days
   - This prevents SSL-related downtime

### Step 5: Test the Monitor

1. Click on your monitor in the dashboard
2. Click "Quick Stats" to see recent checks
3. Verify that the monitor shows "Up" status
4. Click "Test" to manually trigger a check
5. Verify that the response time is < 2 seconds

### Step 6: Configure Status Page (Optional)

Create a public status page for transparency:

1. Go to "Public Status Pages"
2. Click "Add New Status Page"
3. Configure:
   - **Friendly Name:** PARK POS Status
   - **Monitors:** Select "PARK POS Health Check"
   - **Custom Domain:** (optional)
4. Click "Create Status Page"
5. Share the status page URL with stakeholders

## Expected Behavior

### Healthy System

When the system is healthy, Uptime Robot will:
- Check `/api/health` every 5 minutes
- Receive HTTP 200 response
- See `"status":"healthy"` in response body
- Show "Up" status in dashboard
- Response time < 2 seconds

### Degraded System

When the system is degraded (e.g., Redis unavailable):
- Check `/api/health` every 5 minutes
- Receive HTTP 200 response
- See `"status":"degraded"` in response body
- Show "Up" status in dashboard (no alert)
- System continues to function with reduced performance

### Unhealthy System

When the system is unhealthy (e.g., database down):
- Check `/api/health` every 5 minutes
- Receive HTTP 503 response
- See `"status":"unhealthy"` in response body
- Show "Down" status in dashboard
- **Send alert email within 1 minute**

### System Unavailable

When the system is completely unavailable:
- Check `/api/health` every 5 minutes
- Receive connection timeout or error
- Show "Down" status in dashboard
- **Send alert email within 1 minute**

## Alert Configuration

### Email Alert Template

Uptime Robot will send emails with the following information:

**Subject:** [Uptime Robot] PARK POS Health Check is DOWN

**Body:**
```
Monitor: PARK POS Health Check
URL: https://parkperu.vercel.app/api/health
Status: DOWN
Reason: HTTP 503 (Service Unavailable)
Time: 2026-02-05 10:30:00 UTC
```

### Alert Channels

Uptime Robot free tier supports:
- ✅ Email notifications
- ✅ Webhook notifications
- ✅ Slack integration (via webhook)
- ❌ SMS (paid tier only)
- ❌ Phone call (paid tier only)

### Webhook Integration (Optional)

To integrate with Slack or custom alerting:

1. Go to "My Settings" → "Alert Contacts"
2. Click "Add Alert Contact"
3. Select "Webhook"
4. Configure:
   - **Friendly Name:** Slack Webhook
   - **URL:** Your Slack webhook URL
   - **POST Value:** 
     ```json
     {
       "text": "*monitorFriendlyName* is *alertTypeFriendlyName*",
       "attachments": [{
         "color": "danger",
         "fields": [
           {"title": "URL", "value": "*monitorURL*", "short": false},
           {"title": "Reason", "value": "*alertDetails*", "short": false},
           {"title": "Time", "value": "*alertDateTime*", "short": false}
         ]
       }]
     }
     ```
5. Click "Create Alert Contact"

## Monitoring Dashboard

### Key Metrics

Uptime Robot dashboard shows:
- **Uptime Percentage:** 30-day rolling window
- **Response Time:** Average, min, max
- **Downtime Events:** Count and duration
- **Status:** Current status (Up/Down)

### Target Metrics

Based on requirements:
- **Uptime:** > 99.5% (30-day window)
- **Response Time:** < 2 seconds (95th percentile)
- **Alert Latency:** < 1 minute
- **Check Interval:** 5 minutes

### Viewing Reports

1. Go to monitor details
2. Click "Logs" to see check history
3. Click "Response Times" to see performance graph
4. Click "Uptime" to see availability percentage

## Troubleshooting

### Monitor Shows "Down" but System is Up

**Possible causes:**
1. Health check endpoint is slow (> 30 seconds)
2. Firewall blocking Uptime Robot IPs
3. SSL certificate issue
4. DNS resolution issue

**Solutions:**
1. Check health check response time in logs
2. Whitelist Uptime Robot IPs (if using firewall)
3. Verify SSL certificate is valid
4. Test DNS resolution manually

### Monitor Shows "Up" but System is Unhealthy

**Possible causes:**
1. Health check endpoint returns 200 even when unhealthy
2. Keyword monitoring not configured
3. Component failures not detected

**Solutions:**
1. Verify health check logic returns 503 when unhealthy
2. Enable keyword monitoring for `"status":"healthy"`
3. Review component health check implementation

### False Positive Alerts

**Possible causes:**
1. Transient network issues
2. Health check timeout too aggressive
3. Deployment causing temporary downtime

**Solutions:**
1. Increase monitor timeout to 60 seconds
2. Configure "Alert after X consecutive failures" (e.g., 2)
3. Pause monitoring during deployments

## Maintenance

### During Deployments

To prevent false alerts during deployments:

1. Go to monitor details
2. Click "Pause Monitoring"
3. Perform deployment
4. Click "Resume Monitoring"
5. Verify system is healthy

### Updating Monitor Configuration

To update monitor settings:

1. Go to monitor details
2. Click "Edit"
3. Update settings
4. Click "Save Changes"

### Monitoring Multiple Environments

For staging/production separation:

1. Create separate monitors:
   - **Production:** `https://parkperu.vercel.app/api/health`
   - **Staging:** `https://parkperu-staging.vercel.app/api/health`
2. Use different alert contacts for each environment
3. Set different check intervals (production: 5min, staging: 15min)

## Cost Optimization

### Free Tier Limits

Uptime Robot free tier includes:
- ✅ 50 monitors
- ✅ 5-minute check interval
- ✅ Email/webhook alerts
- ✅ 2-month log retention
- ❌ 1-minute check interval (paid)
- ❌ SMS alerts (paid)

### Staying Within Free Tier

Current usage:
- **Monitors:** 1 (PARK POS Health Check)
- **Check Interval:** 5 minutes
- **Alerts:** Email only
- **Cost:** $0/month

To stay within free tier:
- Keep total monitors < 50
- Use 5-minute check interval
- Use email/webhook alerts only
- Avoid SMS/phone alerts

## Integration with Other Tools

### Sentry Integration

Link Uptime Robot alerts to Sentry:

1. Create Sentry webhook URL
2. Add as Uptime Robot alert contact
3. Uptime Robot downtime events appear in Sentry

### Vercel Integration

Uptime Robot automatically detects Vercel deployments:
- Monitors deployment status
- Tracks deployment-related downtime
- Links downtime to specific deployments

### Slack Integration

Send alerts to Slack channel:

1. Create Slack incoming webhook
2. Add as Uptime Robot alert contact
3. Configure message format
4. Test alert delivery

## Security Considerations

### Public Health Check Endpoint

The `/api/health` endpoint is publicly accessible:
- ✅ No authentication required (by design)
- ✅ No sensitive data exposed
- ✅ Rate limiting not needed (read-only)
- ✅ Safe for public monitoring

### Sensitive Information

Health check response does NOT include:
- ❌ Database credentials
- ❌ API keys
- ❌ User data
- ❌ Internal IP addresses
- ❌ Detailed error messages

Health check response DOES include:
- ✅ Component status (up/down/degraded)
- ✅ Response times
- ✅ Generic error messages
- ✅ Timestamp

## Next Steps

After configuring Uptime Robot:

1. ✅ Verify monitor is active and showing "Up" status
2. ✅ Test alert delivery by pausing monitor
3. ✅ Document alert response procedures
4. ✅ Share status page URL with team
5. ✅ Set up Slack integration (optional)
6. ✅ Configure additional monitors for critical endpoints (optional)

## Support

### Uptime Robot Support

- **Documentation:** https://uptimerobot.com/help/
- **API Docs:** https://uptimerobot.com/api/
- **Status:** https://status.uptimerobot.com/
- **Support:** support@uptimerobot.com

### PARK POS Health Check

- **Endpoint:** `/api/health`
- **Documentation:** This file
- **Source Code:** `src/app/api/health/route.ts`
- **Service:** `src/core/health/health-check.ts`

## Conclusion

Uptime Robot monitoring is now configured for PARK POS. The system will be checked every 5 minutes, and alerts will be sent within 1 minute of any downtime. This provides the required 99.5% uptime monitoring with minimal cost (free tier).

**Status:** ✅ Ready for Production

**Last Updated:** 2026-02-05
