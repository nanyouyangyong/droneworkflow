import { http, HttpResponse } from 'msw';

export const handlers = [
  // Auth endpoints
  http.post('/api/auth/login', async ({ request }) => {
    const body = await request.json() as { email: string; password: string };

    if (body.email === 'test@example.com' && body.password === 'password123') {
      return HttpResponse.json({
        success: true,
        data: {
          user: {
            id: '1',
            email: 'test@example.com',
            name: 'Test User',
            role: 'user'
          },
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
          expiresIn: 7200,
        },
      });
    }

    return HttpResponse.json(
      { success: false, error: 'Invalid credentials' },
      { status: 401 }
    );
  }),

  http.post('/api/auth/register', async ({ request }) => {
    const body = await request.json() as { email: string; password: string; name: string };

    return HttpResponse.json({
      success: true,
      data: {
        user: {
          id: '2',
          email: body.email,
          name: body.name,
          role: 'user'
        },
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 7200,
      },
    });
  }),

  http.post('/api/auth/refresh', async ({ request }) => {
    const body = await request.json() as { refreshToken: string };

    if (body.refreshToken === 'mock-refresh-token') {
      return HttpResponse.json({
        success: true,
        data: {
          user: {
            id: '1',
            email: 'test@example.com',
            name: 'Test User',
            role: 'user'
          },
          accessToken: 'new-mock-access-token',
          refreshToken: 'new-mock-refresh-token',
          expiresIn: 7200,
        },
      });
    }

    return HttpResponse.json(
      { success: false, error: 'Invalid refresh token' },
      { status: 401 }
    );
  }),

  http.get('/api/auth/me', async ({ request }) => {
    const authHeader = request.headers.get('Authorization');

    if (authHeader === 'Bearer mock-access-token') {
      return HttpResponse.json({
        success: true,
        data: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'user'
        },
      });
    }

    return HttpResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }),

  // Chat endpoints
  http.get('/api/chat', async () => {
    return HttpResponse.json({
      ok: true,
      data: {
        messages: [
          { role: 'user', content: 'Test message', ts: Date.now() },
          { role: 'assistant', content: 'Test response', ts: Date.now() },
        ],
      },
    });
  }),

  http.get('/api/chat/sessions', async () => {
    return HttpResponse.json({
      ok: true,
      data: {
        sessions: [
          { id: 'session-1', title: 'Test Session', createdAt: Date.now() },
        ],
      },
    });
  }),

  http.post('/api/llm/stream', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"chunk","content":"Hello"}\n'));
        await new Promise(resolve => setTimeout(resolve, 10));
        controller.enqueue(encoder.encode('data: {"type":"chunk","content":" World"}\n'));
        await new Promise(resolve => setTimeout(resolve, 10));
        controller.enqueue(encoder.encode('data: {"type":"complete","workflow":{}}\n'));
        controller.close();
      },
    });
    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }),

  // Workflow endpoints
  http.get('/api/workflow/list', async () => {
    return HttpResponse.json({
      ok: true,
      data: {
        workflows: [
          { id: 'wf-1', name: 'Test Workflow', createdAt: Date.now() },
        ],
      },
    });
  }),

  http.post('/api/workflow/save', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      ok: true,
      data: { id: 'wf-new', ...body },
    });
  }),

  http.post('/api/workflow/execute', async () => {
    return HttpResponse.json({
      ok: true,
      data: { missionId: 'mission-1', status: 'running' },
    });
  }),
];
