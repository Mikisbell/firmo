'use client';

/**
 * Test Page for Delivery SSE Endpoint
 * 
 * This page tests the Server-Sent Events endpoint for real-time delivery updates.
 * Navigate to: http://localhost:3000/test-delivery-sse
 */

import { useEffect, useState } from 'react';

interface DeliveryEvent {
  id: string;
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
  restaurantId?: string;
  driverId?: string;
}

export default function TestDeliverySSEPage() {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<DeliveryEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [restaurantId, setRestaurantId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [connectionTime, setConnectionTime] = useState<Date | null>(null);

  useEffect(() => {
    let eventSource: EventSource | null = null;

    const connect = () => {
      try {
        // Build URL with optional filters
        const params = new URLSearchParams();
        if (restaurantId) params.append('restaurantId', restaurantId);
        if (driverId) params.append('driverId', driverId);
        
        const url = `/api/deliveries/stream${params.toString() ? `?${params.toString()}` : ''}`;
        
        console.log('Connecting to SSE:', url);
        eventSource = new EventSource(url);
        
        eventSource.onopen = () => {
          console.log('SSE connection opened');
          setConnected(true);
          setConnectionTime(new Date());
          setError(null);
        };
        
        eventSource.addEventListener('connected', (e) => {
          console.log('Connected event:', e.data);
          const data = JSON.parse(e.data);
          setEvents(prev => [...prev, {
            id: Date.now().toString(),
            type: 'connected',
            timestamp: new Date().toISOString(),
            data
          }]);
        });
        
        eventSource.addEventListener('initial_state', (e) => {
          console.log('Initial state event:', e.data);
          const data = JSON.parse(e.data);
          setEvents(prev => [...prev, {
            id: Date.now().toString(),
            type: 'initial_state',
            timestamp: new Date().toISOString(),
            data
          }]);
        });
        
        eventSource.addEventListener('order_created', (e) => {
          console.log('Order created event:', e.data);
          const data = JSON.parse(e.data);
          setEvents(prev => [...prev, {
            id: (e as any).lastEventId || Date.now().toString(),
            type: 'order_created',
            timestamp: new Date().toISOString(),
            data
          }]);
        });
        
        eventSource.addEventListener('order_assigned', (e) => {
          console.log('Order assigned event:', e.data);
          const data = JSON.parse(e.data);
          setEvents(prev => [...prev, {
            id: (e as any).lastEventId || Date.now().toString(),
            type: 'order_assigned',
            timestamp: new Date().toISOString(),
            data
          }]);
        });
        
        eventSource.addEventListener('order_dispatched', (e) => {
          console.log('Order dispatched event:', e.data);
          const data = JSON.parse(e.data);
          setEvents(prev => [...prev, {
            id: (e as any).lastEventId || Date.now().toString(),
            type: 'order_dispatched',
            timestamp: new Date().toISOString(),
            data
          }]);
        });
        
        eventSource.addEventListener('order_delivered', (e) => {
          console.log('Order delivered event:', e.data);
          const data = JSON.parse(e.data);
          setEvents(prev => [...prev, {
            id: (e as any).lastEventId || Date.now().toString(),
            type: 'order_delivered',
            timestamp: new Date().toISOString(),
            data
          }]);
        });
        
        eventSource.addEventListener('location_update', (e) => {
          console.log('Location update event:', e.data);
          const data = JSON.parse(e.data);
          setEvents(prev => [...prev, {
            id: (e as any).lastEventId || Date.now().toString(),
            type: 'location_update',
            timestamp: new Date().toISOString(),
            data
          }]);
        });
        
        eventSource.addEventListener('eta_update', (e) => {
          console.log('ETA update event:', e.data);
          const data = JSON.parse(e.data);
          setEvents(prev => [...prev, {
            id: (e as any).lastEventId || Date.now().toString(),
            type: 'eta_update',
            timestamp: new Date().toISOString(),
            data
          }]);
        });
        
        eventSource.onerror = (e) => {
          console.error('SSE error:', e);
          setConnected(false);
          setError('Connection lost. Reconnecting...');
          // EventSource will automatically reconnect
        };
        
      } catch (err) {
        console.error('Error creating EventSource:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setConnected(false);
      }
    };

    connect();

    return () => {
      if (eventSource) {
        console.log('Closing SSE connection');
        eventSource.close();
        setConnected(false);
      }
    };
  }, [restaurantId, driverId]);

  const clearEvents = () => {
    setEvents([]);
  };

  const sendTestEvent = async () => {
    try {
      // This would normally be done by the backend when a real event occurs
      // For testing, we can manually trigger the broadcaster
      const response = await fetch('/api/test/broadcast-delivery-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'order_created',
          data: {
            orderId: `test-${Date.now()}`,
            customerName: 'Test Customer',
            status: 'PENDING'
          },
          restaurantId: restaurantId || undefined,
          driverId: driverId || undefined
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      
      console.log('Test event sent successfully');
    } catch (err) {
      console.error('Error sending test event:', err);
      setError(err instanceof Error ? err.message : 'Failed to send test event');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Delivery SSE Test Page</h1>
        <p className="text-gray-600 mb-8">
          Testing Server-Sent Events for real-time delivery updates
        </p>

        {/* Connection Status */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
          <div className="flex items-center gap-4">
            <div className={`w-4 h-4 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="font-medium">
              {connected ? 'Connected' : 'Disconnected'}
            </span>
            {connectionTime && (
              <span className="text-sm text-gray-500">
                Since: {connectionTime.toLocaleTimeString()}
              </span>
            )}
          </div>
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Filters</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Restaurant ID (optional)
              </label>
              <input
                type="text"
                value={restaurantId}
                onChange={(e) => setRestaurantId(e.target.value)}
                placeholder="e.g., restaurant-123"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Driver ID (optional)
              </label>
              <input
                type="text"
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
                placeholder="e.g., driver-456"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Note: Changing filters will reconnect the SSE stream
          </p>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Actions</h2>
          <div className="flex gap-4">
            <button
              onClick={sendTestEvent}
              disabled={!connected}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Send Test Event
            </button>
            <button
              onClick={clearEvents}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              Clear Events
            </button>
          </div>
        </div>

        {/* Events Log */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Events Log</h2>
            <span className="text-sm text-gray-500">
              {events.length} event{events.length !== 1 ? 's' : ''}
            </span>
          </div>
          
          {events.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No events received yet</p>
              <p className="text-sm mt-2">
                {connected 
                  ? 'Waiting for events...' 
                  : 'Connect to start receiving events'}
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {events.map((event, index) => (
                <div
                  key={`${event.id}-${index}`}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        event.type === 'connected' ? 'bg-green-100 text-green-800' :
                        event.type === 'initial_state' ? 'bg-blue-100 text-blue-800' :
                        event.type === 'order_created' ? 'bg-purple-100 text-purple-800' :
                        event.type === 'order_assigned' ? 'bg-yellow-100 text-yellow-800' :
                        event.type === 'order_dispatched' ? 'bg-orange-100 text-orange-800' :
                        event.type === 'order_delivered' ? 'bg-green-100 text-green-800' :
                        event.type === 'location_update' ? 'bg-indigo-100 text-indigo-800' :
                        event.type === 'eta_update' ? 'bg-pink-100 text-pink-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {event.type}
                      </span>
                      <span className="text-xs text-gray-500">
                        ID: {event.id}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                    {JSON.stringify(event.data, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2">How to Test</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
            <li>The page automatically connects to the SSE endpoint on load</li>
            <li>You should see a "connected" event immediately</li>
            <li>The "initial_state" event shows all active deliveries</li>
            <li>Click "Send Test Event" to manually trigger a test event</li>
            <li>Use filters to test restaurant/driver-specific streams</li>
            <li>Open multiple browser tabs to test multi-client broadcasting</li>
            <li>Check the browser console for detailed logs</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
