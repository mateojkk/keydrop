const contractId = process.env.NEAR_CONTRACT_ID || 'keydrop.testnet';
const rpcUrl = process.env.NEAR_RPC_URL || 'https://test.rpc.fastnear.com';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rpcResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'keydrop-status',
        method: 'query',
        params: {
          request_type: 'call_function',
          finality: 'final',
          account_id: contractId,
          method_name: 'collection_count',
          args_base64: 'e30=',
        },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!rpcResponse.ok) throw new Error('RPC unavailable');
    const result = await rpcResponse.json();
    if (result.error || result.result?.error || !Array.isArray(result.result?.result)) {
      throw new Error('Contract query failed');
    }
    const collectionCount = JSON.parse(Buffer.from(result.result.result).toString('utf8'));
    return response.status(200).json({ ok: true, network: 'testnet', contractId, collectionCount });
  } catch {
    return response.status(503).json({
      ok: false,
      network: 'testnet',
      contractId,
      error: 'Testnet contract status unavailable',
    });
  }
}
