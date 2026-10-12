// Browser-wide flattened CDP connection covers Lighthouse's independent tabs.
// Node's built-in WebSocket avoids another runtime dependency.
export async function installNetworkGuard(debugPort, origin) {
  const endpoint = await (
    await fetch('http://127.0.0.1:' + debugPort + '/json/version')
  ).json();
  const socket = new WebSocket(endpoint.webSocketDebuggerUrl),
    failures = [],
    pending = new Map();
  let seq = 0,
    closed = false;
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(Error('CDP timeout'));
      }, 10000);
      pending.set(id, { resolve, reject, timer });
      socket.send(
        JSON.stringify({
          id,
          method,
          params,
          ...(sessionId ? { sessionId } : {}),
        }),
      );
    });
  socket.addEventListener('message', ({ data }) => {
    const m = JSON.parse(data);
    if (m.id) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      if (p) {
        clearTimeout(p.timer);
        if (m.error) p.reject(Error(m.error.message));
        else p.resolve(m.result);
      }
      return;
    }
    if (m.method === 'Fetch.requestPaused') {
      const u = new URL(m.params.request.url),
        allowed = u.origin === origin;
      if (!allowed)
        failures.push({
          origin: u.origin,
          resourceType: m.params.resourceType,
        });
      send(
        allowed ? 'Fetch.continueRequest' : 'Fetch.failRequest',
        allowed
          ? { requestId: m.params.requestId }
          : { requestId: m.params.requestId, errorReason: 'BlockedByClient' },
        m.sessionId,
      ).catch(() => {
        if (!closed) failures.push({ error: 'interception_failed' });
      });
    }
    if (m.method === 'Target.attachedToTarget') {
      const { sessionId, targetInfo } = m.params;
      (async () => {
        if (
          ['page', 'iframe', 'worker', 'service_worker'].includes(
            targetInfo.type,
          )
        )
          await send(
            'Fetch.enable',
            { patterns: [{ urlPattern: '*', requestStage: 'Request' }] },
            sessionId,
          );
        await send('Runtime.runIfWaitingForDebugger', {}, sessionId);
      })().catch(() => {
        if (!closed) failures.push({ error: 'target_guard_failed' });
      });
    }
  });
  await send('Target.setAutoAttach', {
    autoAttach: true,
    waitForDebuggerOnStart: true,
    flatten: true,
  });
  return {
    failures,
    close() {
      closed = true;
      for (const p of pending.values()) {
        clearTimeout(p.timer);
        p.reject(Error('closed'));
      }
      pending.clear();
      socket.close();
    },
  };
}
